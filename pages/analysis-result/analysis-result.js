import { cloud } from "miniprogram-ci";

const app = getApp();
import { debug, error, info, warn } from '../../utils/logger.js';
import { getFileType } from '../../utils/file.js';
import { uploadFile } from '../../utils/api.js';
import { formatCurrentTime, formatDisplayTime } from '../../utils/date.js';
import { last } from '../../utils/func.js';

Page({
  data: {
    fileId: '', analysisId: '', fileUrl: '', fileType: 'unknown', sessionId: '',

    isAnalyzing: true, isCompleted: false, hasError: false, errorMessage: '', isImageExists: false,

    mdContent: '', loadingTip: '正在分析您的商业计划书...', statusText: '分析中...',

    tocItems: [], savingToHistory: false
  },

  onLoad: async function (options) {
    info('分析结果页面加载', options);
    if (!options.fileId) {
      this.setData({
        isAnalyzing: false, hasError: true, errorMessage: '缺少必要的文件信息'
      });
      this.showToast('缺少必要的文件信息', 'error');
      return;
    }

    const db = wx.cloud.database();
    const file = await db.collection("bp_files").doc(options.fileId).get();
    if (!file || !file.data) {
      this.setData({
        isAnalyzing: false, hasError: true, errorMessage: '文件不存在'
      });
      this.showToast('文件不存在', 'error');
      return;
    }

    const data = Object.assign({}, this.data, {
      fileId: options.fileId,
      fileName: file.name,
      fileSize: file.size,
      fileTime: file.uploadTime,
      fileUrl: file.url,
      fileType: getFileType(file.name) || 'unknown'
    })
    this.setData(data);
    info('文件信息', data);

    this.queryReportStatus()
  },

  // 从服务端查询报告状态
  queryReportStatus: async function () {
    info('查询服务端报告状态', { fileId: this.data.fileId });

    const db = wx.cloud.database();

    const analysisList = await db.collection("analysis_taks").where({
      fileId: this.data.fileId,
    }).get();
    let analysis;

    if (!analysisList || !analysisList.data || analysisList.data.length === 0) {
      // create analysis
      analysis = await db.collection("analysis_taks").add({
        data: {
          fileId: this.data.fileId,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      });
      this.startAnalysis();
    } else {
      // init anlysis result with the latest one
      analysis = await db.collection("analysis_taks").doc(last(analysisList.data).id).get();
    }

    this.setData({
      ...this.data,
      analysis: analysis.data,
    });
  },

  // 开始分析
  startAnalysis: function () {
    info('开始AI分析', { fileId: this.data.fileId });

    // 调用coze工作流API
    this.callCozeWorkflow();
  },

  // 调用Coze流式工作流API
  callCozeWorkflow: function () {
    const that = this;

    // 获取配置
    const cozeConfig = app.globalData.config.coze;
    const workflowId = cozeConfig.WORKFLOW_ID;
    const token = cozeConfig.TOKEN;
    const apiUrl = cozeConfig.API_URL;

    info('Coze配置信息', { workflowId, apiUrl, tokenLength: token ? token.length : 0 });

    const headers = {
      // 不能用 application/x-www-form-urlencoded;charset=utf-8，否则会导致 coze 收不到消息
      "Content-Type": "application/json", 'Authorization': `Bearer ${token}`
    };

    const data = {
      workflow_id: workflowId, parameters: {
        files: [this.data.fileUrl]
        // todo: add user identification
      }
    };

    info('调用Coze工作流', data);

    const requestTask = wx.request({
      url: apiUrl, method: 'POST', header: headers, data: data, enableChunked: true, // 启用分块接收
      responseType: 'arraybuffer', // 重要：确保以ArrayBuffer格式接收数据
      success: function (res) {
        // 请求成功只表示请求已经发出
        info('Coze工作流请求成功', res.statusCode);
      }, fail: function (err) {
        // 请求失败
        error('Coze工作流请求失败', err);
        that.setData({
          isAnalyzing: false, hasError: true, errorMessage: '服务调用失败，请稍后重试'
        });
        that.showToast('服务调用失败，请稍后重试', 'error');
      }, complete: function () {
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
    requestTask.onChunkReceived(function (res) {
      try {
        // 记录接收到的原始数据块信息
        debug('接收数据块', {
          chunkSize: res.data.byteLength, isLastChunk: res.isLastChunk || false
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



  // 处理数据块
  processChunk: function (chunk) {
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
  handleStreamEvent: function (eventData) {
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
  handleWorkflowMessage: function (data) {
    if (!data || !data.content) return;

    const content = data.content;

    // 检查内容是否包含中文，用于调试
    const hasChinese = /[\u4e00-\u9fa5]/.test(content);
    const preview = content.length > 20 ? content.substring(0, 20) + '...' : content;

    debug('接收到消息内容', {
      contentLength: content.length, hasChinese: hasChinese, preview: preview
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
      mdContent, tocItems: this.data.tocItems, isCompleted: false
    });

    debug('工作流消息内容更新', { contentLength: content.length });
  },

  // 处理工作流错误
  handleWorkflowError: function (data) {
    error('工作流执行错误', data);

    this.setData({
      isAnalyzing: false, hasError: true, errorMessage: data.message ? data.message : '分析过程出现错误'
    });

    this.showToast('分析过程出现错误', 'error');
  },

  // 处理工作流完成
  handleWorkflowComplete: function () {
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
      isAnalyzing: false, isCompleted: true, statusText: '分析完成'
    });

    // 保存完整报告到缓存
    this.saveReportCache({
      mdContent: this.data.mdContent, tocItems: this.data.tocItems, isCompleted: true
    });

    // 保存到历史记录
    this.saveToHistory();
  },

  // 提取目录项
  extractTocItems: function (mdContent) {
    // 简单匹配所有的标题行
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const tocItems = [];
    let match;

    while ((
      match = headingRegex.exec(mdContent)
    ) !== null) {
      const level = match[1].length;
      const title = match[2].trim();

      // 只提取前三级标题
      if (level <= 3) {
        tocItems.push({
          level: level, title: title
        });
      }
    }

    this.setData({
      tocItems: tocItems
    });
  },

  // 保存到历史记录
  saveToHistory: function () {
    if (this.data.savingToHistory || !this.data.isCompleted) return;

    this.setData({
      savingToHistory: true
    });

    info('保存分析结果到历史记录', {
      fileId: this.data.fileId, sessionId: this.data.sessionId
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
  handleReAnalyze: function () {
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
  handleSaveReport: function () {
    this.showToast('报告已保存', 'success');
  },

  // 分享报告
  handleShareReport: function () {
    this.showToast('分享功能开发中', 'info');
  },

  // 打开文件
  handleOpenFile: function () {
    info('尝试打开文件', {
      fileName: this.data.fileName, fileUrl: this.data.fileUrl
    });

    if (!this.data.fileUrl) {
      this.showToast('无法打开文件，文件链接不存在', 'error');
      return;
    }

    // 尝试打开文件链接
    wx.showLoading({ title: '打开文件中...' });

    wx.downloadFile({
      url: this.data.fileUrl, success: (res) => {
        if (res.statusCode === 200) {
          wx.openDocument({
            filePath: res.tempFilePath, success: () => {
              info('文件打开成功');
            }, fail: (err) => {
              error('文件打开失败', err);
              this.showToast('文件打开失败', 'error');
            }, complete: () => {
              wx.hideLoading();
            }
          });
        } else {
          wx.hideLoading();
          error('文件下载失败', res);
          this.showToast('文件下载失败', 'error');
        }
      }, fail: (err) => {
        wx.hideLoading();
        error('文件下载失败', err);
        this.showToast('文件下载失败', 'error');
      }
    });
  },

  // 保存报告缓存
  saveReportCache: function (data) {
    try {
      const storageKey = 'report_' + this.data.fileId;
      wx.setStorageSync(storageKey, {
        ...data, fileId: this.data.fileId, fileName: this.data.fileName, timestamp: new Date().getTime()
      });
    } catch (err) {
      error('保存报告缓存失败', err);
    }
  },

  // 返回上传页
  handleBackToUpload: function () {
    // todo: would navigate-back destroy api resquest?
    wx.navigateBack();
  },

  // 查看历史
  handleViewHistory: function () {
    wx.navigateTo({
      url: '/pages/history/history'
    });
  },

  // 显示Toast
  showToast: function (message, type = 'info') {
    try {
      const toast = this.selectComponent('#toast');
      if (toast && typeof toast.show === 'function') {
        toast.show(message, type);
      } else {
        // 使用系统自带的toast
        wx.showToast({
          title: message, icon: type === 'success' ? 'success' : 'none', duration: 2000
        });
      }
    } catch (err) {
      // 出错时使用系统toast
      error('显示toast失败', err);
      wx.showToast({
        title: message, icon: 'none', duration: 2000
      });
    }
  },

  onShareAppMessage: function () {
    return {
      title: '商业计划书AI分析报告', path: '/pages/index/index', imageUrl: '/assets/images/share-img.png'
    };
  },

  onUnload: function () {
    warn(`页面卸载，清除定时器和缓存`, {
      fileId: this.data.fileId, sessionId: this.data.sessionId
    });
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
  },

    // ArrayBuffer转字符串，确保中文不乱码
    ab2str: function (buf) {
      try {
        // 使用TextDecoder指定UTF-8编码，确保中文正确解码
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(new Uint8Array(buf));
  
        // 检查内容，记录是否包含中文(用于调试)
        const hasChinese = /[\u4e00-\u9fa5]/.test(text);
        const preview = text.length > 20 ? text.substring(0, 20) + '...' : text;
  
        debug('解码ArrayBuffer结果', {
          byteLength: buf.byteLength, textLength: text.length, hasChinese: hasChinese, preview: preview
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
              const code = (
                (
                  bytes[i] & 0x1f
                ) << 6
              ) |
                (
                  bytes[i + 1] & 0x3f
                );
              result += String.fromCharCode(code);
              i += 2;
            } else if (bytes[i] >= 224 && bytes[i] < 240) {
              // 3字节UTF-8
              const code = (
                (
                  bytes[i] & 0x0f
                ) << 12
              ) |
                (
                  (
                    bytes[i + 1] & 0x3f
                  ) << 6
                ) |
                (
                  bytes[i + 2] & 0x3f
                );
              result += String.fromCharCode(code);
              i += 3;
            } else if (bytes[i] >= 240) {
              // 4字节UTF-8，需要拆成两个UTF-16字符
              const codePoint = (
                (
                  bytes[i] & 0x07
                ) << 18
              ) |
                (
                  (
                    bytes[i + 1] & 0x3f
                  ) << 12
                ) |
                (
                  (
                    bytes[i + 2] & 0x3f
                  ) << 6
                ) |
                (
                  bytes[i + 3] & 0x3f
                );
  
              // 从代码点计算UTF-16代理对
              const highSurrogate = Math.floor((
                codePoint - 0x10000
              ) / 0x400) + 0xD800;
              const lowSurrogate = (
                (
                  codePoint - 0x10000
                ) % 0x400
              ) + 0xDC00;
  
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
}); 