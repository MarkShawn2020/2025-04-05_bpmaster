import { cloud } from "wx-server-sdk";

const app = getApp();
import { debug, error, info, warn } from '../../utils/logger.js';
import { getFileType } from '../../utils/file.js';
import { formatCurrentTime, formatDisplayTime } from '../../utils/date.js';
import { aiService } from '../../utils/ai.js';

Page({
  data: {
    fileId: '', // 文件ID
    curFileId: '', // 当前正在处理的文件ID，用于处理多个分析任务的情况
    fileName: '',
    fileSize: '',
    fileTime: '',
    fileUrl: '',
    fileType: 'unknown',
    analysisId: '', // 分析任务ID
    content: '', // 分析报告内容
    
    isAnalyzing: true,
    isCompleted: false,
    hasError: false,
    errorMessage: '',
    isImageExists: false,
    
    loadingTip: '正在分析您的商业计划书...',
    statusText: '分析中...',
    
    tocItems: [], // 目录项
    savingToHistory: false
  },

  // 页面加载时执行
  onLoad: async function(options) {
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
      
      // 设置当前处理的文件ID
      this.setData({
        fileId: options.fileId,
        curFileId: options.fileId
      });
      
      // 从云数据库获取文件信息
      await this.getFileInfo(options.fileId);
      
      // 检查是否已有分析任务
      const hasAnalysis = await this.checkAnalysisTask(options.fileId);
      
      if (!hasAnalysis) {
        // 如果没有分析任务，创建新的分析任务并开始分析
        await this.createAnalysisTask(options.fileId);
        this.startAnalysis();
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
  
  // 获取文件信息
  getFileInfo: async function(fileId) {
    try {
      const db = wx.cloud.database();
      const fileRes = await db.collection("bp_files").doc(fileId).get();
      
      if (!fileRes || !fileRes.data) {
        throw new Error('文件不存在');
      }
      
      const fileData = fileRes.data;
      // 格式化文件大小和时间
      const fileTime = fileData.uploadTime ? formatDisplayTime(fileData.uploadTime) : formatCurrentTime();
      
      this.setData({
        fileName: fileData.name || '未知文件',
        fileSize: fileData.sizeText || '未知大小',
        fileTime: fileTime,
        fileUrl: fileData.url || '',
        fileType: fileData.fileType || getFileType(fileData.name) || 'unknown'
      });
      
      info('文件信息', { 
        fileId: this.data.fileId, 
        fileName: this.data.fileName,
        fileUrl: this.data.fileUrl
      });
      
      return fileData;
    } catch (err) {
      error('获取文件信息失败', err);
      throw err;
    }
  },
  
  // 检查是否已有分析任务
  checkAnalysisTask: async function(fileId) {
    try {
      const db = wx.cloud.database();
      const analysisList = await db.collection("analysis_tasks").where({
        fileId: fileId
      }).orderBy('createdAt', 'desc').limit(1).get();
      
      if (analysisList && analysisList.data && analysisList.data.length > 0) {
        const analysis = analysisList.data[0];
        info('发现已有分析任务', analysis);
        
        this.setData({
          analysisId: analysis._id,
          content: analysis.content || '',
          isAnalyzing: analysis.status !== 'completed',
          isCompleted: analysis.status === 'completed',
          statusText: analysis.status === 'completed' ? '分析完成' : '分析中...'
        });
        
        // 如果有内容，提取目录
        if (analysis.content) {
          this.extractTocItems(analysis.content);
          
          // 如果分析未完成，需要继续监听更新
          if (analysis.status !== 'completed') {
            this.checkAnalysisStatus();
          }
        }
        
        return true;
      }
      
      return false;
    } catch (err) {
      error('检查分析任务失败', err);
      return false;
    }
  },
  
  // 创建分析任务
  createAnalysisTask: async function(fileId) {
    try {
      const db = wx.cloud.database();
      const taskRes = await db.collection("analysis_tasks").add({
        data: {
          fileId: fileId,
          status: "pending",
          content: "",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      if (taskRes && taskRes._id) {
        info('创建分析任务成功', taskRes);
        this.setData({
          analysisId: taskRes._id
        });
        return taskRes._id;
      } else {
        throw new Error('创建分析任务失败');
      }
    } catch (err) {
      error('创建分析任务失败', err);
      throw err;
    }
  },
  
  // 定期检查分析状态
  checkAnalysisStatus: function() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    // 每10秒检查一次分析状态
    this.checkInterval = setInterval(async () => {
      try {
        if (!this.data.analysisId || this.data.isCompleted) {
          clearInterval(this.checkInterval);
          return;
        }
        
        const db = wx.cloud.database();
        const analysis = await db.collection("analysis_tasks").doc(this.data.analysisId).get();
        
        if (analysis && analysis.data) {
          // 如果数据库中的内容有更新，则更新页面内容
          if (analysis.data.content && analysis.data.content !== this.data.content) {
            this.setData({
              content: analysis.data.content
            });
            this.extractTocItems(analysis.data.content);
          }
          
          // 如果状态已完成，更新状态
          if (analysis.data.status === 'completed' && !this.data.isCompleted) {
            this.setData({
              isAnalyzing: false,
              isCompleted: true,
              statusText: '分析完成'
            });
            clearInterval(this.checkInterval);
          }
        }
      } catch (err) {
        error('检查分析状态失败', err);
      }
    }, 10000); // 10秒检查一次
  },
  
  // 开始分析
  startAnalysis: function() {
    info('开始AI分析', { fileId: this.data.fileId, fileUrl: this.data.fileUrl });
    
    // 清空之前的结果
    this.setData({
      content: '',
      tocItems: [],
      isAnalyzing: true,
      hasError: false,
      errorMessage: '',
      statusText: '分析中...',
      loadingTip: '正在分析您的商业计划书...'
    });
    
    // 调用Coze工作流API
    this.callCozeWorkflow();
  },
  
  // 调用Coze工作流API
  callCozeWorkflow: function() {
    const that = this;
    
    // 获取配置
    const cozeConfig = app.globalData.config.coze;
    
    // 记录当前文件ID，用于判断回调时是否需要更新UI
    const curFileId = this.data.curFileId;
    
    // 调用AI服务
    aiService.callCozeWorkflow({
      fileUrl: this.data.fileUrl,
      onChunk: async (chunk) => {
        // 如果当前处理的文件ID与页面显示的文件ID一致，才更新UI
        if (curFileId === that.data.curFileId) {
          // 累加内容
          const content = that.data.content + chunk;
          
          that.setData({
            content: content
          });
          
          // 提取目录项
          that.extractTocItems(content);
          
          // 更新分析任务内容
          try {
            // 每收到新的数据块，就更新数据库中的内容
            const db = wx.cloud.database();
            await db.collection("analysis_tasks").doc(that.data.analysisId).update({
              data: {
                content: content,
                updatedAt: new Date()
              }
            });
          } catch (err) {
            error('更新分析任务内容失败', err);
          }
        } else {
          info('忽略非当前文件的数据块', { curFileId, pageFileId: that.data.curFileId });
        }
      },
      onComplete: async () => {
        // 同样需要判断回调时文件ID是否一致
        if (curFileId === that.data.curFileId) {
          info('分析完成', { fileId: that.data.fileId });
          
          that.setData({
            isAnalyzing: false,
            isCompleted: true,
            statusText: '分析完成'
          });
          
          // 更新分析任务状态为已完成
          try {
            const db = wx.cloud.database();
            await db.collection("analysis_tasks").doc(that.data.analysisId).update({
              data: {
                status: 'completed',
                updatedAt: new Date()
              }
            });
          } catch (err) {
            error('更新分析任务状态失败', err);
          }
        }
      },
      onError: (err) => {
        if (curFileId === that.data.curFileId) {
          error('分析失败', err);
          
          that.setData({
            isAnalyzing: false,
            hasError: true,
            errorMessage: '分析失败，请稍后重试'
          });
          
          that.showToast('分析失败，请稍后重试', 'error');
        }
      },
      // 检查是否仍在分析中的回调函数
      isAnalyzing: () => {
        return that.data.isAnalyzing && curFileId === that.data.curFileId;
      }
    });
  },
  
  // 提取目录项
  extractTocItems: function(content) {
    // 简单匹配所有的标题行
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const tocItems = [];
    let match;
    
    while ((match = headingRegex.exec(content)) !== null) {
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
  
  // 重新分析
  handleReAnalyze: function() {
    wx.showModal({
      title: '重新分析',
      content: '确定要重新分析该文件吗？当前分析结果将被覆盖。',
      success: (res) => {
        if (res.confirm) {
          this.startAnalysis();
        }
      }
    });
  },
  
  // 保存报告
  handleSaveReport: async function() {
    if (!this.data.content || this.data.savingToHistory) {
      return;
    }
    
    this.setData({
      savingToHistory: true
    });
    
    try {
      const db = wx.cloud.database();
      await db.collection("reports").add({
        data: {
          fileId: this.data.fileId,
          analysisId: this.data.analysisId,
          content: this.data.content,
          createdAt: new Date()
        }
      });
      
      this.showToast('报告保存成功', 'success');
    } catch (err) {
      error('保存报告失败', err);
      this.showToast('保存失败，请稍后重试', 'error');
    } finally {
      this.setData({
        savingToHistory: false
      });
    }
  },
  
  // 分享报告
  handleShareReport: function() {
    // 可以实现分享逻辑
    this.showToast('分享功能开发中', 'info');
  },
  
  // 查看文件
  handleOpenFile: function() {
    // 可以实现打开文件逻辑
    this.showToast('文件查看功能开发中', 'info');
  },
  
  // 显示Toast
  showToast: function(message, type = 'info') {
    const toast = this.selectComponent('#toast');
    if (toast) {
      toast[type](message);
    } else {
      console.log('Toast组件不存在');
      wx.showToast({
        title: message,
        icon: type === 'success' ? 'success' : 'none'
      });
    }
  },
  
  onUnload: function() {
    // 清除定时器
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
});