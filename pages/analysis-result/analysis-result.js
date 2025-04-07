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
      
      // 检查是否已有报告或正在生成报告
      this.checkReportStatus();
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
  
  // 检查报告状态
  checkReportStatus: function() {
    info('检查报告状态', { fileId: this.data.fileId });
    
    const that = this;
    // 先从本地缓存中查询
    const storageKey = 'report_' + this.data.fileId;
    const reportCacheData = wx.getStorageSync(storageKey) || {};
    
    if (reportCacheData.mdContent && reportCacheData.isCompleted) {
      // 已有完整报告，直接加载
      info('发现已完成的报告，直接加载', reportCacheData);
      this.setData({
        mdContent: reportCacheData.mdContent,
        tocItems: reportCacheData.tocItems || [],
        isAnalyzing: false,
        isCompleted: true,
        statusText: '分析完成'
      });
      
      // 提取目录项(如果缓存中没有)
      if (!reportCacheData.tocItems || reportCacheData.tocItems.length === 0) {
        this.extractTocItems(reportCacheData.mdContent);
      }
      
      return;
    } else if (reportCacheData.mdContent && !reportCacheData.isCompleted && reportCacheData.timestamp) {
      // 有部分报告内容，且时间不超过10分钟，视为正在进行
      const now = new Date().getTime();
      const timeDiff = now - reportCacheData.timestamp;
      
      if (timeDiff < 10 * 60 * 1000) { // 10分钟内
        info('发现正在生成的报告', reportCacheData);
        this.setData({
          mdContent: reportCacheData.mdContent,
          isAnalyzing: true,
          statusText: '分析中...',
          loadingTip: '正在生成分析报告...'
        });
        
        // 提取目录项
        this.extractTocItems(reportCacheData.mdContent);
        
        // 查询服务端状态
        this.queryReportStatus();
        return;
      }
    }
    
    // 没有缓存或缓存已过期，需要调用API查询服务端
    this.queryReportStatus();
  },
  
  // 从服务端查询报告状态
  queryReportStatus: function() {
    info('查询服务端报告状态', { fileId: this.data.fileId });
    
    const that = this;
    // 可以从云函数或API查询当前文件的分析状态
    wx.showLoading({
      title: '查询报告状态',
      mask: true
    });
    
    // 模拟API调用，实际项目中请替换为真实API调用
    // TODO: 替换为真实API调用
    setTimeout(function() {
      wx.hideLoading();
      
      // 假设通过API得到的结果中可以判断报告状态
      const hasReport = false; // 通过API判断是否已有报告
      const isGenerating = false; // 通过API判断是否正在生成报告
      
      if (hasReport) {
        // 已有报告，API中返回了报告内容
        info('服务端已有完整报告', { fileId: that.data.fileId });
        // 加载报告内容并显示
        that.setData({
          // mdContent: apiResult.content,
          isAnalyzing: false,
          isCompleted: true,
          statusText: '分析完成'
        });
      } else if (isGenerating) {
        // 正在生成报告
        info('服务端报告正在生成中', { fileId: that.data.fileId });
        that.setData({
          isAnalyzing: true,
          statusText: '分析中...'
        });
        
        // 可以设置定时器定期检查状态
        that.checkReportInterval = setInterval(function() {
          that.queryReportStatus();
        }, 10000); // 每10秒检查一次
      } else {
        // 没有报告，需要开始分析
        info('没有找到报告，开始新的分析', { fileId: that.data.fileId });
        that.startAnalysis();
      }
    }, 500);
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
    
    // 清空之前的结果
    this.setData({
      mdContent: '',
      tocItems: [],
      isAnalyzing: true,
      hasError: false,
      errorMessage: '',
      statusText: '分析中...',
      loadingTip: '正在分析您的商业计划书...'
    });
    
    // 保存当前状态到缓存
    this.saveReportCache({
      mdContent: '',
      isCompleted: false,
      timestamp: new Date().getTime()
    });
    
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
      // ref: [wx.request POST传递中文时显示乱码处理方法_wx.request传值乱码的问题-CSDN博客](https://blog.csdn.net/weixin_45807026/article/details/124175930)
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      'Authorization': `Bearer ${token}`
    };
    
    const data = {
      workflow_id: workflowId,
      parameters: { 
        files: [this.data.fileUrl]
        // todo: add user identification
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
    
    // 清空之前的结果
    this.setData({
      mdContent: '',
      tocItems: []
    });
    
    const requestTask = wx.request({
      url: apiUrl,
      method: 'POST',
      header: headers,
      data: data,
      enableChunked: true, // 启用分块接收
      responseType: 'arraybuffer', // 重要：确保以ArrayBuffer格式接收数据
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
        // 记录接收到的原始数据块信息
        debug('接收数据块', { 
          chunkSize: res.data.byteLength,
          isLastChunk: res.isLastChunk || false
        });
        
        // 解析ArrayBuffer数据为文本
        const chunk = that.ab2str(res.data);
        
        // 如果是最后一个块，记录日志
        if (res.isLastChunk) {
          info('接收到最后一个数据块');
        }
        
        // 处理数据块
        that.processChunk(chunk);
      } catch (err) {
        error('处理Coze响应块数据失败', err);
      }
    });
  },
  
  // ArrayBuffer转字符串，确保中文不乱码
  ab2str: function(buf) {
    try {
      // 使用TextDecoder指定UTF-8编码，确保中文正确解码
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(new Uint8Array(buf));
      
      // 检查内容，记录是否包含中文(用于调试)
      const hasChinese = /[\u4e00-\u9fa5]/.test(text);
      const preview = text.length > 20 ? text.substring(0, 20) + '...' : text;
      
      info('解码ArrayBuffer结果', {
        byteLength: buf.byteLength,
        textLength: text.length,
        hasChinese: hasChinese,
        preview: preview
      });
      
      return text;
    } catch (err) {
      error('TextDecoder解码失败', err);
      
      // 兼容性方案1：手动解码UTF-8
      try {
        const bytes = new Uint8Array(buf);
        let result = '';
        let i = 0;
        while (i < bytes.length) {
          if (bytes[i] < 128) {
            // ASCII字符，直接添加
            result += String.fromCharCode(bytes[i]);
            i++;
          } else if (bytes[i] >= 192 && bytes[i] < 224) {
            // 2字节UTF-8
            const code = ((bytes[i] & 0x1f) << 6) | (bytes[i+1] & 0x3f);
            result += String.fromCharCode(code);
            i += 2;
          } else if (bytes[i] >= 224 && bytes[i] < 240) {
            // 3字节UTF-8
            const code = ((bytes[i] & 0x0f) << 12) | 
                         ((bytes[i+1] & 0x3f) << 6) | 
                         (bytes[i+2] & 0x3f);
            result += String.fromCharCode(code);
            i += 3;
          } else if (bytes[i] >= 240) {
            // 4字节UTF-8，需要拆成两个UTF-16字符
            const codePoint = ((bytes[i] & 0x07) << 18) | 
                             ((bytes[i+1] & 0x3f) << 12) | 
                             ((bytes[i+2] & 0x3f) << 6) | 
                             (bytes[i+3] & 0x3f);
            
            // 从代码点计算UTF-16代理对
            const highSurrogate = Math.floor((codePoint - 0x10000) / 0x400) + 0xD800;
            const lowSurrogate = ((codePoint - 0x10000) % 0x400) + 0xDC00;
            
            result += String.fromCharCode(highSurrogate, lowSurrogate);
            i += 4;
          } else {
            // 无效字节，跳过
            i++;
          }
        }
        
        info('手动UTF-8解码成功');
        return result;
      } catch (decodeErr) {
        error('手动UTF-8解码失败', decodeErr);
        
        // 最后的兜底方案：逐字节转换，可能会乱码
        try {
          const bytes = new Uint8Array(buf);
          let result = '';
          for (let i = 0; i < bytes.length; i++) {
            result += String.fromCharCode(bytes[i]);
          }
          
          // 尝试使用encodeURIComponent和decodeURIComponent修复UTF-8编码
          try {
            const fixed = decodeURIComponent(escape(result));
            info('URI编码修复成功');
            return fixed;
          } catch (e) {
            info('URI编码修复失败，返回原始结果');
            return result;
          }
        } catch (finalErr) {
          error('所有解码方法都失败', finalErr);
          return ''; // 返回空字符串避免报错
        }
      }
    }
  },
  
  // 处理数据块
  processChunk: function(chunk) {
    // 记录原始接收数据
    debug('处理数据块', { chunkLength: chunk.length });
    
    try {
      // 先检查是否为纯文本[DONE]标记，一些服务端会单独发送这个
      if (chunk.trim() === '[DONE]') {
        info('收到独立[DONE]标记，流式传输完成');
        this.handleWorkflowComplete();
        return;
      }
      
      // 按行分割，处理SSE格式
      const lines = chunk.split('\n');
      let currentEvent = {};
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // 记录接收的行数据
        // debug(`处理SSE行[${i}]`, { line });
        
        // 解析SSE格式的行
        if (line.startsWith('id: ')) {
          currentEvent.id = parseInt(line.substring(4));
        } else if (line.startsWith('event: ')) {
          currentEvent.event = line.substring(7);
        } else if (line.startsWith('data: ')) {
          const jsonStr = line.substring(6);
          
          // 特殊情况: [DONE]标记，表示流结束
          if (jsonStr === '[DONE]') {
            info('收到[DONE]标记，流式传输完成');
            this.handleWorkflowComplete();
            continue;
          }
          
          try {
            // 尝试解析JSON数据
            const data = JSON.parse(jsonStr);
            currentEvent.data = data;
            
            // 如果有完整事件（至少包含event和data），处理它
            if (currentEvent.event) {
              // info('完整事件', currentEvent);
              this.handleStreamEvent(currentEvent);
              currentEvent = {}; // 重置为新事件
            }
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
  handleStreamEvent: function(eventData) {
    // 检查事件类型
    if (!eventData || !eventData.event) {
      error('无效的事件数据', eventData);
      return;
    }
    
    debug('处理流式事件', { event: eventData.event, id: eventData.id });
    
    switch (eventData.event) {
      case 'Message':
        this.handleWorkflowMessage(eventData.data);
        break;
      case 'Error':
        this.handleWorkflowError(eventData.data);
        break;
      case 'Done':
        info('收到Done事件，工作流执行完成');
        this.handleWorkflowComplete();
        break;
      case 'Interrupt':
        info('工作流被中断', eventData.data);
        // 这里可以处理工作流中断逻辑
        break;
      default:
        info('未知的工作流事件类型', { event: eventData.event });
    }
  },
  
  // 处理工作流消息
  handleWorkflowMessage: function(data) {
    if (!data || !data.content) return;
    
    const content = data.content;
    
    // 检查内容是否包含中文，用于调试
    const hasChinese = /[\u4e00-\u9fa5]/.test(content);
    const preview = content.length > 20 ? content.substring(0, 20) + '...' : content;
    
    info('接收到消息内容', {
      contentLength: content.length,
      hasChinese: hasChinese,
      preview: preview
    });
    
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
    
    // 保存当前状态到缓存
    this.saveReportCache({
      mdContent,
      tocItems: this.data.tocItems,
      isCompleted: false
    });
    
    debug('工作流消息内容更新', { contentLength: content.length });
  },
  
  // 处理工作流错误
  handleWorkflowError: function(data) {
    error('工作流执行错误', data);
    
    this.setData({
      isAnalyzing: false,
      hasError: true,
      errorMessage: data.message ? data.message : '分析过程出现错误'
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
    
    // 清除状态检查定时器
    if (this.checkReportInterval) {
      clearInterval(this.checkReportInterval);
      this.checkReportInterval = null;
    }
    
    this.setData({
      isAnalyzing: false,
      isCompleted: true,
      statusText: '分析完成'
    });
    
    // 保存完整报告到缓存
    this.saveReportCache({
      mdContent: this.data.mdContent,
      tocItems: this.data.tocItems,
      isCompleted: true
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
  
  // 打开文件
  handleOpenFile: function() {
    info('尝试打开文件', { 
      fileName: this.data.fileName,
      fileUrl: this.data.fileUrl 
    });
    
    if (!this.data.fileUrl) {
      this.showToast('无法打开文件，文件链接不存在', 'error');
      return;
    }
    
    // 尝试打开文件链接
    wx.showLoading({ title: '打开文件中...' });
    
    wx.downloadFile({
      url: this.data.fileUrl,
      success: (res) => {
        if (res.statusCode === 200) {
          wx.openDocument({
            filePath: res.tempFilePath,
            success: () => {
              info('文件打开成功');
            },
            fail: (err) => {
              error('文件打开失败', err);
              this.showToast('文件打开失败', 'error');
            },
            complete: () => {
              wx.hideLoading();
            }
          });
        } else {
          wx.hideLoading();
          error('文件下载失败', res);
          this.showToast('文件下载失败', 'error');
        }
      },
      fail: (err) => {
        wx.hideLoading();
        error('文件下载失败', err);
        this.showToast('文件下载失败', 'error');
      }
    });
  },
  
  // 保存报告缓存
  saveReportCache: function(data) {
    try {
      const storageKey = 'report_' + this.data.fileId;
      wx.setStorageSync(storageKey, {
        ...data,
        fileId: this.data.fileId,
        fileName: this.data.fileName,
        timestamp: new Date().getTime()
      });
    } catch (err) {
      error('保存报告缓存失败', err);
    }
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
    
    // 清除状态检查定时器
    if (this.checkReportInterval) {
      clearInterval(this.checkReportInterval);
      this.checkReportInterval = null;
    }
  }
}); 