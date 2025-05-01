const app = getApp();
import { info, error, debug, warn } from '../../utils/logger.js';
import { getFileType } from '../../utils/file.js';
import { formatCurrentTime, formatDisplayTime } from '../../utils/date.js';
import { getBPAnalysisStatus, connectToCozeStream, saveAnalysisContent } from '../../utils/api.js';

Page({
  data: {
    fileName: '',
    fileSize: '',
    fileTime: '',
    fileId: '',
    fileUrl: '',
    fileType: 'unknown',
    analysisTaskId: '', // 分析任务ID
    
    isAnalyzing: true,
    isCompleted: false,
    hasError: false,
    errorMessage: '',
    isImageExists: false,
    
    mdContent: '',
    loadingTip: '正在分析您的商业计划书...',
    statusText: '分析中...',
    
    tocItems: [],
    savingToHistory: false,
    progress: 0, // 分析进度百分比
    sseConnected: false // SSE连接状态
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
        fileType: options.fileType || getFileType(fileName) || 'unknown',
        analysisTaskId: options.analysisTaskId || '' // 获取分析任务ID
      });
      
      info('文件信息', { 
        fileId: this.data.fileId, 
        fileName: this.data.fileName,
        fileSize: this.data.fileSize,
        fileTime: this.data.fileTime,
        fileType: this.data.fileType,
        analysisTaskId: this.data.analysisTaskId
      });
      
      // 检查是否已有报告或正在生成报告
      // 如果有分析任务ID，则直接查询分析状态和结果
      if (this.data.analysisTaskId) {
        this.startReceivingAnalysisResults();
      } else {
        // 兼容旧版页面，基于文件ID检查报告状态
        this.checkReportStatus();
      }
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
  
  // 检查报告状态
  checkReportStatus: function() {
    info('检查报告状态', { fileId: this.data.fileId });
    
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
        
        // 保存到缓存
        this.saveReportCache({
          mdContent: reportCacheData.mdContent,
          tocItems: this.data.tocItems,
          isCompleted: false,
          timestamp: new Date().getTime()
        });
      }
    }
    
    // 无论是否有缓存，都定期查询服务端状态
    this.queryReportStatus();
    
    // 设置定时查询
    this.setupStatusPolling();
  },
  
  // 开始接收分析结果（基于分析任务ID）
  startReceivingAnalysisResults: function() {
    if (!this.data.analysisTaskId) {
      error('开始接收分析结果失败：缺少分析任务ID');
      this.showToast('缺少分析任务ID', 'error');
      return;
    }
    
    info('开始接收分析结果', { analysisTaskId: this.data.analysisTaskId });
    
    // 1. 先查询当前的分析状态
    this.queryAnalysisStatus();
  },
  
  // 查询分析状态
  queryAnalysisStatus: function() {
    info('查询分析状态', { analysisTaskId: this.data.analysisTaskId });
    
    // 调用API查询分析状态
    getBPAnalysisStatus(this.data.analysisTaskId)
      .then(res => {
        if (!res || res.code !== 0) {
          throw new Error('查询分析状态失败: ' + (res?.message || '服务器响应异常'));
        }
        
        const data = res.data;
        info('分析状态查询结果', data);
        
        // 根据不同状态处理
        if (data.status === 'completed') {
          // 已完成，显示结果
          this.handleCompletedAnalysis(data);
        } else if (data.status === 'processing') {
          // 正在处理，连接SSE获取实时更新
          this.handleProcessingAnalysis(data);
        } else if (data.status === 'error') {
          // 分析出错
          this.handleErrorAnalysis(data);
        } else if (data.status === 'notfound') {
          // 找不到任务
          this.handleNotFoundAnalysis();
        }
      })
      .catch(err => {
        error('查询分析状态失败', err);
        
        this.setData({
          isAnalyzing: false,
          hasError: true,
          errorMessage: '查询分析状态失败，请重试'
        });
        
        this.showToast('查询分析状态失败', 'error');
      });
  },
  
  // 处理已完成的分析
  handleCompletedAnalysis: function(data) {
    info('处理已完成的分析', data);
    
    // 更新UI状态
    this.setData({
      mdContent: data.content || this.data.mdContent,
      isAnalyzing: false,
      isCompleted: true,
      statusText: '分析完成',
      progress: 100
    });
    
    // 提取目录项
    this.extractTocItems(this.data.mdContent);
    
    // 保存到缓存
    this.saveReportCache({
      mdContent: this.data.mdContent,
      tocItems: this.data.tocItems,
      isCompleted: true
    });
    
    // 保存到历史记录
    this.saveToHistory();
    
    // 清除任何现有连接
    this.closeSSEConnection();
  },
  
  // 处理正在进行的分析
  handleProcessingAnalysis: function(data) {
    info('处理正在进行的分析', data);
    
    // 更新当前内容（如果有）
    if (data.content && data.content !== this.data.mdContent) {
      this.setData({
        mdContent: data.content,
        progress: data.progress || this.data.progress
      });
      
      // 提取目录项
      this.extractTocItems(this.data.mdContent);
      
      // 保存到缓存
      this.saveReportCache({
        mdContent: this.data.mdContent,
        tocItems: this.data.tocItems,
        isCompleted: false,
        timestamp: new Date().getTime()
      });
    }
    
    // 更新UI状态
    this.setData({
      isAnalyzing: true,
      statusText: '分析中...'
    });
    
    // 直接连接到Coze流式API处理分析
    this.handleDirectCozeAnalysis();
  },
  
  // 处理分析错误
  handleErrorAnalysis: function(data) {
    error('分析出错', data);
    
    this.setData({
      isAnalyzing: false,
      hasError: true,
      errorMessage: data.message || '分析过程出现错误'
    });
    
    this.showToast('分析过程出现错误', 'error');
    
    // 清除任何连接
    this.closeSSEConnection();
  },
  
  // 处理未找到分析任务
  handleNotFoundAnalysis: function() {
    warn('未找到分析任务');
    
    // 如果是从旧版页面进入，则尝试使用旧版方式查找报告
    if (this.data.fileId && !this.data.analysisTaskId) {
      info('尝试使用旧版方式查询报告');
      this.checkReportStatus();
      return;
    }
    
    this.setData({
      isAnalyzing: false,
      hasError: true,
      errorMessage: '找不到分析任务，请重新开始分析'
    });
    
    this.showToast('找不到分析任务', 'error');
  },
  
  // 直接连接到Coze流式API处理分析
  handleDirectCozeAnalysis: function() {
    const fileUrl = this.data.fileUrl;
    const fileId = this.data.fileId;
    
    info("直接连接到Coze流式API", { fileId, fileUrl });
    
    // 如果已经连接，先关闭
    if (this.cozeConnection) {
      try {
        this.cozeConnection.close();
      } catch (err) {
        error("关闭Coze连接失败", err);
      }
      this.cozeConnection = null;
    }
    
    // 重置分析内容
    this.setData({
      mdContent: "",
      progress: 10,
      progressText: "分析中...",
      isAnalyzing: true,
      statusText: '分析中...'
    });
    
    // 开始进度条动画
    this.startProgressAnimation();
    
    // 建立新连接
    this.cozeConnection = connectToCozeStream(
      fileUrl,
      (content) => {
        // 处理消息
        debug("收到Coze消息", { contentLength: content.length });
        
        // 累加内容
        let currentContent = this.data.mdContent || "";
        currentContent += content;
        
        // 计算进度
        const progressValue = Math.min(Math.floor((currentContent.length / 2000) * 100), 99);
        
        this.setData({
          mdContent: currentContent,
          progress: progressValue,
          progressText: "分析中 " + progressValue + "%"
        });
        
        // 保存到全局状态和本地存储
        saveAnalysisContent(fileId, currentContent, false);
      },
      () => {
        // 完成回调
        info("Coze流结束，分析完成");
        
        this.setData({
          isAnalyzing: false,
          isCompleted: true,
          statusText: '分析完成',
          progress: 100
        });
        
        // 保存最终内容到全局状态和本地存储，标记为完成
        saveAnalysisContent(fileId, this.data.mdContent, true);
        
        // 停止进度条动画
        this.stopProgressAnimation();
        
        // 清理连接
        this.cozeConnection = null;
      },
      (err) => {
        // 错误回调
        error("Coze连接错误", err);
        
        // 保存错误状态
        saveAnalysisContent(fileId, this.data.mdContent, false, err);
        
        // 设置错误状态但保留已分析内容
        if (!this.data.mdContent) {
          this.setData({
            isAnalyzing: false,
            hasError: true,
            errorMessage: '分析过程中断: ' + err.message
          });
        } else {
          // 如果已有内容，则标记为完成
          this.setData({
            isAnalyzing: false,
            isCompleted: true,
            statusText: '分析完成 (部分)'
          });
        }
        
        // 停止进度条动画
        this.stopProgressAnimation();
      }
    );
  },
  
  // 关闭Coze连接
  closeCozeConnection: function() {
    if (this.cozeConnection) {
      try {
        this.cozeConnection.close();
      } catch (err) {
        error("关闭Coze连接失败", err);
      }
      this.cozeConnection = null;
    }
  },
  
  // 从服务端查询报告状态
  queryReportStatus: function() {
    info('查询服务端报告状态', { fileId: this.data.fileId });
    
    // 调用云函数查询分析状态
    wx.cloud.callFunction({
      name: 'getBPAnalysisStatus',
      data: {
        fileId: this.data.fileId
      },
      success: res => {
        info('查询分析状态成功', res.result);
        
        if (res.result && res.result.code === 0) {
          const data = res.result.data;
          
          // 根据返回状态更新UI
          if (data.status === 'completed') {
            // 分析完成
            this.setData({
              mdContent: data.content || this.data.mdContent,
              isAnalyzing: false,
              isCompleted: true,
              statusText: '分析完成'
            });
            
            // 提取目录项
            this.extractTocItems(this.data.mdContent);
            
            // 保存到缓存
            this.saveReportCache({
              mdContent: this.data.mdContent,
              tocItems: this.data.tocItems,
              isCompleted: true
            });
            
            // 清除轮询定时器
            this.clearStatusPolling();
            
          } else if (data.status === 'processing') {
            // 正在分析中
            if (data.content && data.content !== this.data.mdContent) {
              // 有新内容更新
              this.setData({
                mdContent: data.content,
                isAnalyzing: true,
                statusText: '分析中...'
              });
              
              // 提取目录项
              this.extractTocItems(this.data.mdContent);
              
              // 保存到缓存
              this.saveReportCache({
                mdContent: this.data.mdContent,
                tocItems: this.data.tocItems,
                isCompleted: false,
                timestamp: new Date().getTime()
              });
            }
          } else if (data.status === 'error') {
            // 分析出错
            this.setData({
              isAnalyzing: false,
              hasError: true,
              errorMessage: data.message || '分析过程出现错误'
            });
            
            this.showToast('分析过程出现错误', 'error');
            this.clearStatusPolling();
          }
        } else {
          // 返回错误
          error('查询分析状态返回错误', res.result);
        }
      },
      fail: err => {
        error('查询分析状态失败', err);
      }
    });
  },
  
  // 设置状态轮询
  setupStatusPolling: function() {
    info('设置状态轮询');
    
    // 清除已有的轮询
    this.clearStatusPolling();
    
    // 设置新的轮询，每5秒查询一次
    this.statusPollingInterval = setInterval(() => {
      if (this.data.isAnalyzing && !this.data.hasError) {
        this.queryReportStatus();
      } else {
        // 如果已完成或出错，停止轮询
        this.clearStatusPolling();
      }
    }, 5000);
  },
  
  // 清除状态轮询
  clearStatusPolling: function() {
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
      this.statusPollingInterval = null;
    }
  },
  
  // 重新开始分析
  startAnalysis: function() {
    info('重新开始分析', { fileId: this.data.fileId });
    
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
    
    // 显示确认对话框
    wx.showModal({
      title: '重新分析',
      content: '确定要重新开始分析吗？这将清除当前分析结果。',
      success: (res) => {
        if (res.confirm) {
          // 清除现有的SSE连接
          this.closeSSEConnection();
          
          // 清除轮询定时器
          this.clearStatusPolling();
          
          // 清空之前的结果
          this.setData({
            mdContent: '',
            tocItems: [],
            isAnalyzing: true,
            hasError: false,
            errorMessage: '',
            statusText: '分析中...',
            loadingTip: '正在启动新的分析...',
            progress: 0
          });
          
          // 保存当前状态到缓存
          this.saveReportCache({
            mdContent: '',
            isCompleted: false,
            timestamp: new Date().getTime()
          });
          
          // 显示加载提示
          wx.showLoading({
            title: '启动分析...',
            mask: true
          });
          
          // 调用API启动新的分析任务
          const startBPAnalysis = require('../../utils/api.js').startBPAnalysis;
          startBPAnalysis(this.data.fileId, this.data.fileUrl)
            .then(res => {
              wx.hideLoading();
              
              if (!res || res.code !== 0 || !res.data || !res.data.taskId) {
                throw new Error('启动分析任务失败：服务器响应异常');
              }
              
              // 更新分析任务ID
              const analysisTaskId = res.data.taskId;
              info('重新分析任务启动成功', { analysisTaskId });
              
              this.setData({ analysisTaskId });
              
              // 开始接收分析结果
              this.startReceivingAnalysisResults();
            })
            .catch(err => {
              wx.hideLoading();
              error('重新启动分析失败', err);
              
              this.setData({
                isAnalyzing: false,
                hasError: true,
                errorMessage: '重新启动分析失败，请稍后再试'
              });
              
              this.showToast('重新启动分析失败', 'error');
            });
        }
      }
    });
  },
  
  // 重新分析
  handleReAnalyze: function() {
    // 调用startAnalysis，它会显示确认对话框并处理重新分析
    this.startAnalysis();
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
    info('分析结果页面卸载');
    
    // 清除轮询定时器
    this.clearStatusPolling();
  }
}); 