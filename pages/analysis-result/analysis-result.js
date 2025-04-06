const app = getApp();
import { info, error, debug, warn } from '../../utils/logger.js';
import { getFileType } from '../../utils/file.js';
import { uploadFile, callCozeWorkflow } from '../../utils/api.js';
import { formatCurrentTime, formatDisplayTime } from '../../utils/date.js';

Page({
  data: {
    fileName: '',
    fileSize: '',
    fileTime: '',
    fileId: '',
    fileUrl: '',
    fileType: 'unknown',
    sessionId: '',
    
    isAnalyzing: true,
    isCompleted: false,
    hasError: false,
    errorMessage: '',
    isImageExists: false,
    
    mdContent: '',
    loadingTip: '正在分析您的商业计划书...',
    statusText: '分析中...',
    
    tocItems: [],
    savingToHistory: false
  },

  onLoad: function(options) {
    info('分析结果页面加载', options);
    
    try {
      if (!options.fileId) {
        this.setData({
          isAnalyzing: false,
          hasError: true,
          errorMessage: '缺少必要的文件信息'
        });
        this.showToast('缺少必要的文件信息', 'error');
        return;
      }
      
      // 检查所需的图片资源是否存在
      this.checkImageResources();
      
      // 从options中获取文件信息，确保正确解码文件名和时间
      const fileName = options.fileName ? decodeURIComponent(options.fileName) : '未知文件';
      const fileSize = options.fileSize ? decodeURIComponent(options.fileSize) : '未知大小';
      const fileTimeRaw = options.fileTime ? decodeURIComponent(options.fileTime) : '';
      // 格式化日期
      const fileTime = fileTimeRaw ? formatDisplayTime(fileTimeRaw) : formatCurrentTime();
      
      this.setData({
        fileId: options.fileId,
        fileName: fileName,
        fileSize: fileSize,
        fileTime: fileTime,
        fileUrl: options.fileUrl ? decodeURIComponent(options.fileUrl) : '',
        fileType: options.fileType || getFileType(fileName) || 'unknown'
      });
      
      info('文件信息', { 
        fileId: this.data.fileId, 
        fileName: this.data.fileName,
        fileSize: this.data.fileSize,
        fileTime: this.data.fileTime,
        fileType: this.data.fileType
      });
      
      // 生成会话ID
      this.setData({
        sessionId: 'session_' + new Date().getTime()
      });
      
      // 开始分析
      this.startAnalysis();
    } catch (err) {
      error('分析结果页面加载异常', err);
      this.setData({
        isAnalyzing: false,
        hasError: true,
        errorMessage: '加载异常，请返回重试'
      });
      this.showToast('加载异常，请返回重试', 'error');
    }
  },
  
  // 检查图片资源是否存在
  checkImageResources: function() {
    // 初始化图片资源检查
    info('检查必要的图片资源');
    
    try {
      // 检查loading图标是否存在
      wx.getImageInfo({
        src: '/images/loading-icon.png',
        success: () => {
          this.setData({
            isImageExists: true
          });
        },
        fail: (err) => {
          error('加载图标资源不存在', err);
          this.setData({
            isImageExists: false
          });
        }
      });
    } catch (err) {
      error('检查图片资源失败', err);
    }
  },
  
  // 开始分析
  startAnalysis: function() {
    info('开始AI分析', { fileId: this.data.fileId });
    
    // 确保有文件ID
    if (!this.data.fileId) {
      this.setData({
        isAnalyzing: false,
        hasError: true,
        errorMessage: '缺少必要的文件信息'
      });
      this.showToast('缺少必要的文件信息', 'error');
      return;
    }
    
    // 调用coze工作流API
    this.callCozeWorkflow();
  },
  
  // 调用Coze流式工作流API
  callCozeWorkflow: function() {
    const that = this;
    
    // 检查全局配置
    if (!app.globalData || !app.globalData.config || !app.globalData.config.coze) {
      error('Coze配置不存在', { globalData: app.globalData });
      this.setData({
        isAnalyzing: false,
        hasError: true,
        errorMessage: '系统配置错误，请联系管理员'
      });
      this.showToast('系统配置错误', 'error');
      return;
    }
    
    // 获取配置
    const cozeConfig = app.globalData.config.coze;
    const workflowId = cozeConfig.WORKFLOW_ID;
    const token = cozeConfig.TOKEN;
    const apiUrl = cozeConfig.API_URL;
    
    info('Coze配置信息', { workflowId, apiUrl, tokenLength: token ? token.length : 0 });
    
    if (!workflowId || !token || !apiUrl) {
      error('缺少Coze必要配置项', { workflowId, token, apiUrl });
      this.setData({
        isAnalyzing: false,
        hasError: true,
        errorMessage: '系统配置错误，请联系管理员'
      });
      this.showToast('系统配置错误，请联系管理员', 'error');
      return;
    }
    
    info('调用Coze工作流', { workflowId, fileId: this.data.fileId });
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    
    const data = {
      workflow_id: workflowId,
      inputs: {
        file_id: this.data.fileId,
        file_name: this.data.fileName,
        file_type: this.data.fileType,
        file_url: this.data.fileUrl,
        user_id: app.globalData.userInfo ? app.globalData.userInfo.openId || app.globalData.userInfo.userId || '' : ''
      }
    };
    
    // 设置超时计时器，防止工作流卡死
    if (this.workflowTimeout) {
      clearTimeout(this.workflowTimeout);
    }
    
    this.workflowTimeout = setTimeout(() => {
      // 如果2分钟后仍处于分析中状态，则自动完成
      if (this.data.isAnalyzing) {
        info('工作流执行超时，自动完成');
        this.handleWorkflowComplete();
      }
    }, 120000); // 2分钟超时
    
    const requestTask = wx.request({
      url: apiUrl,
      method: 'POST',
      header: headers,
      data: data,
      enableChunked: true,
      responseType: 'text',
      success: function(res) {
        // 请求成功只表示请求已经发出
        info('Coze工作流请求成功', res.statusCode);
      },
      fail: function(err) {
        // 请求失败
        error('Coze工作流请求失败', err);
        if (that.workflowTimeout) {
          clearTimeout(that.workflowTimeout);
        }
        that.setData({
          isAnalyzing: false,
          hasError: true,
          errorMessage: '服务调用失败，请稍后重试'
        });
        that.showToast('服务调用失败，请稍后重试', 'error');
      },
      complete: function() {
        // 请求完成，但可能没收到[DONE]标记，启动一个短超时
        setTimeout(() => {
          if (that.data.isAnalyzing && that.data.mdContent) {
            info('工作流数据接收完毕但未收到完成标记，自动完成');
            that.handleWorkflowComplete();
          }
        }, 5000); // 5秒后如果有内容但未完成，则自动完成
      }
    });
    
    // 监听分块数据
    requestTask.onChunkReceived(function(res) {
      try {
        // 解析ArrayBuffer数据为文本
        const chunk = that.ab2str(res.data);
        // 处理数据块
        that.processChunk(chunk);
      } catch (err) {
        error('处理Coze响应块数据失败', err);
      }
    });
  },
  
  // 处理数据块
  processChunk: function(chunk) {
    // 尝试解析为JSON
    try {
      // 按行分割
      const lines = chunk.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // 检查是否是SSE的数据行
        if (line.startsWith('data: ')) {
          const jsonStr = line.substring(6);
          
          // 特殊情况: [DONE]
          if (jsonStr === '[DONE]') {
            info('Coze工作流执行完成');
            this.handleWorkflowComplete();
            continue;
          }
          
          try {
            // 解析JSON数据
            const data = JSON.parse(jsonStr);
            this.handleStreamEvent(data);
          } catch (err) {
            error('解析JSON数据失败', { jsonStr, error: err });
          }
        }
      }
    } catch (err) {
      error('处理数据块失败', err);
    }
  },
  
  // 处理流式事件
  handleStreamEvent: function(data) {
    // 检查事件类型
    if (!data.event) return;
    
    switch (data.event) {
      case 'workflow.message':
        this.handleWorkflowMessage(data);
        break;
      case 'workflow.error':
        this.handleWorkflowError(data);
        break;
      case 'workflow.metadata':
        this.handleWorkflowMetadata(data);
        break;
      case 'workflow.complete':
        this.handleWorkflowComplete();
        break;
      default:
        info('未知的工作流事件类型', { event: data.event });
    }
  },
  
  // 处理工作流消息
  handleWorkflowMessage: function(data) {
    if (!data.data || !data.data.content) return;
    
    const content = data.data.content;
    
    // 累加Markdown内容
    const mdContent = this.data.mdContent + content;
    
    this.setData({
      mdContent: mdContent
    });
    
    // 更新进度信息
    if (this.data.loadingTip === '正在分析您的商业计划书...') {
      this.setData({
        loadingTip: '正在生成分析报告...'
      });
    }
    
    // 提取目录项
    this.extractTocItems(mdContent);
    
    debug('工作流消息内容更新', { contentLength: content.length });
  },
  
  // 处理工作流错误
  handleWorkflowError: function(data) {
    error('工作流执行错误', data);
    
    this.setData({
      isAnalyzing: false,
      hasError: true,
      errorMessage: data.data && data.data.message ? data.data.message : '分析过程出现错误'
    });
    
    this.showToast('分析过程出现错误', 'error');
  },
  
  // 处理工作流元数据
  handleWorkflowMetadata: function(data) {
    info('工作流元数据', data);
    // 可以处理一些元数据，例如估计完成时间等
  },
  
  // 处理工作流完成
  handleWorkflowComplete: function() {
    info('工作流执行完成');
    
    // 防止重复调用
    if (!this.data.isAnalyzing) return;
    
    // 清除超时计时器
    if (this.workflowTimeout) {
      clearTimeout(this.workflowTimeout);
      this.workflowTimeout = null;
    }
    
    this.setData({
      isAnalyzing: false,
      isCompleted: true,
      statusText: '分析完成'
    });
    
    // 保存到历史记录
    this.saveToHistory();
  },
  
  // 提取目录项
  extractTocItems: function(mdContent) {
    // 简单匹配所有的标题行
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const tocItems = [];
    let match;
    
    while ((match = headingRegex.exec(mdContent)) !== null) {
      const level = match[1].length;
      const title = match[2].trim();
      
      // 只提取前三级标题
      if (level <= 3) {
        tocItems.push({
          level: level,
          title: title
        });
      }
    }
    
    this.setData({
      tocItems: tocItems
    });
  },
  
  // 保存到历史记录
  saveToHistory: function() {
    if (this.data.savingToHistory || !this.data.isCompleted) return;
    
    this.setData({
      savingToHistory: true
    });
    
    info('保存分析结果到历史记录', {
      fileId: this.data.fileId,
      sessionId: this.data.sessionId
    });
    
    // 构建历史记录数据
    const historyItem = {
      fileId: this.data.fileId,
      fileName: this.data.fileName,
      fileSize: this.data.fileSize,
      fileType: this.data.fileType,
      analysisTime: this.data.fileTime,
      sessionId: this.data.sessionId,
      content: this.data.mdContent,
      createTime: new Date().getTime()
    };
    
    // 使用API服务保存历史记录
    uploadFile(historyItem)
      .then(res => {
        info('历史记录保存成功', res);
        this.setData({
          savingToHistory: false
        });
      })
      .catch(err => {
        error('历史记录保存失败', err);
        this.setData({
          savingToHistory: false
        });
      });
  },
  
  // 重新分析
  handleReAnalyze: function() {
    this.setData({
      isAnalyzing: true,
      isCompleted: false,
      hasError: false,
      errorMessage: '',
      mdContent: '',
      loadingTip: '正在分析您的商业计划书...',
      statusText: '分析中...',
      tocItems: [],
      sessionId: 'session_' + new Date().getTime()
    });
    
    this.startAnalysis();
  },
  
  // 保存报告
  handleSaveReport: function() {
    this.showToast('报告已保存', 'success');
  },
  
  // 分享报告
  handleShareReport: function() {
    this.showToast('分享功能开发中', 'info');
  },
  
  // 返回上传页
  handleBackToUpload: function() {
    wx.navigateBack();
  },
  
  // 查看历史
  handleViewHistory: function() {
    wx.navigateTo({
      url: '/pages/history/history'
    });
  },
  
  // 工具方法：ArrayBuffer转字符串
  ab2str: function(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
  },
  
  // 显示Toast
  showToast: function(message, type = 'info') {
    try {
      const toast = this.selectComponent('#toast');
      if (toast && typeof toast.show === 'function') {
        toast.show(message, type);
      } else {
        // 使用系统自带的toast
        wx.showToast({
          title: message,
          icon: type === 'success' ? 'success' : 'none',
          duration: 2000
        });
      }
    } catch (err) {
      // 出错时使用系统toast
      error('显示toast失败', err);
      wx.showToast({
        title: message,
        icon: 'none',
        duration: 2000
      });
    }
  },
  
  onShareAppMessage: function() {
    return {
      title: '商业计划书AI分析报告',
      path: '/pages/index/index',
      imageUrl: '/images/share-img.png'
    };
  },
  
  onUnload: function() {
    // 清除超时计时器
    if (this.workflowTimeout) {
      clearTimeout(this.workflowTimeout);
      this.workflowTimeout = null;
    }
  }
}); 