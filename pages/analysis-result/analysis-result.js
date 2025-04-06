const app = getApp();
const logger = require('../../utils/logger.js');
const fileUtils = require('../../utils/file.js');
const apiService = require('../../utils/api.js');

Page({
  data: {
    fileName: '',
    fileSize: '',
    fileTime: '',
    fileId: '',
    fileUrl: '',
    fileType: '',
    sessionId: '',
    
    isAnalyzing: true,
    isCompleted: false,
    hasError: false,
    errorMessage: '',
    
    mdContent: '',
    loadingTip: '正在分析您的商业计划书...',
    statusText: '分析中...',
    
    tocItems: [],
    savingToHistory: false
  },

  onLoad: function(options) {
    logger.info('分析结果页面加载', options);
    
    if (!options.fileId) {
      this.setData({
        isAnalyzing: false,
        hasError: true,
        errorMessage: '缺少必要的文件信息'
      });
      this.showToast('缺少必要的文件信息', 'error');
      return;
    }
    
    // 从options中获取文件信息
    this.setData({
      fileId: options.fileId,
      fileName: options.fileName || '未知文件',
      fileSize: options.fileSize || '未知大小',
      fileTime: options.fileTime || this.formatCurrentTime(),
      fileUrl: options.fileUrl || '',
      fileType: options.fileType || fileUtils.getFileType(options.fileName || '')
    });
    
    // 生成会话ID
    this.setData({
      sessionId: 'session_' + new Date().getTime()
    });
    
    // 开始分析
    this.startAnalysis();
  },
  
  // 开始分析
  startAnalysis: function() {
    logger.info('开始AI分析', { fileId: this.data.fileId });
    
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
    const workflowId = app.globalData.config.cozeWorkflowId;
    const token = app.globalData.config.cozeApiToken;
    
    if (!workflowId || !token) {
      logger.error('缺少Coze配置', { workflowId, token });
      this.setData({
        isAnalyzing: false,
        hasError: true,
        errorMessage: '系统配置错误，请联系管理员'
      });
      return;
    }
    
    const url = 'https://api.coze.cn/v1/workflow/stream_run';
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
        user_id: app.globalData.userInfo ? app.globalData.userInfo.openId : ''
      }
    };
    
    logger.info('调用Coze工作流', { workflowId, fileId: this.data.fileId });
    
    const requestTask = wx.request({
      url: url,
      method: 'POST',
      header: headers,
      data: data,
      enableChunked: true,
      responseType: 'text',
      success: function(res) {
        // 请求成功只表示请求已经发出
        logger.info('Coze工作流请求成功', res.statusCode);
      },
      fail: function(err) {
        // 请求失败
        logger.error('Coze工作流请求失败', err);
        that.setData({
          isAnalyzing: false,
          hasError: true,
          errorMessage: '服务调用失败，请稍后重试'
        });
        that.showToast('服务调用失败，请稍后重试', 'error');
      },
      complete: function() {
        // 请求完成
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
        logger.error('处理Coze响应块数据失败', err);
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
            logger.info('Coze工作流执行完成');
            this.handleWorkflowComplete();
            continue;
          }
          
          try {
            // 解析JSON数据
            const data = JSON.parse(jsonStr);
            this.handleStreamEvent(data);
          } catch (err) {
            logger.error('解析JSON数据失败', { jsonStr, error: err });
          }
        }
      }
    } catch (err) {
      logger.error('处理数据块失败', err);
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
        logger.info('未知的工作流事件类型', { event: data.event });
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
    
    logger.debug('工作流消息内容更新', { contentLength: content.length });
  },
  
  // 处理工作流错误
  handleWorkflowError: function(data) {
    logger.error('工作流执行错误', data);
    
    this.setData({
      isAnalyzing: false,
      hasError: true,
      errorMessage: data.data && data.data.message ? data.data.message : '分析过程出现错误'
    });
    
    this.showToast('分析过程出现错误', 'error');
  },
  
  // 处理工作流元数据
  handleWorkflowMetadata: function(data) {
    logger.info('工作流元数据', data);
    // 可以处理一些元数据，例如估计完成时间等
  },
  
  // 处理工作流完成
  handleWorkflowComplete: function() {
    logger.info('工作流执行完成');
    
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
    
    logger.info('保存分析结果到历史记录', {
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
    apiService.saveAnalysisHistory(historyItem)
      .then(res => {
        logger.info('历史记录保存成功', res);
        this.setData({
          savingToHistory: false
        });
      })
      .catch(err => {
        logger.error('历史记录保存失败', err);
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
  
  // 格式化当前时间
  formatCurrentTime: function() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },
  
  // 显示Toast
  showToast: function(message, type = 'info') {
    const toast = this.selectComponent('#toast');
    if (toast) {
      toast.show(message, type);
    } else {
      wx.showToast({
        title: message,
        icon: type === 'success' ? 'success' : 'none',
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
  }
}); 