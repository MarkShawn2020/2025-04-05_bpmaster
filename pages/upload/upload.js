import { logger } from '../../utils/logger';
import { chooseFile, isValidBPFile, formatFileSize } from '../../utils/file';
import { apiService } from '../../services/api';


Page({
  data: {
    fileList: [], // 文件列表，只会存储一个文件
    uploadProgress: 0,
    uploadProgressText: '0',
    uploading: false,
    uploadSuccess: false,
    analyzing: false,
    analysisProgress: 0,
    analysisProgressText: '0',
    analysisStage: '准备分析',
    analysisResult: null, // 分析结果
    showAnalysisResult: false, // 是否展示分析结果
    previewLoading: false, // 预览加载状态
    error: '',
    cozeResponseContent: '', // 存储Coze响应内容
    fileId: null,
    analysisTaskId: null,
    pollingFailCount: 0,
    statusPollingTimeout: null,
    cloudFileID: '', // 云存储文件ID
    cloudFileURL: '' // 云存储文件临时URL
  },

  onLoad(options) {
    logger.info('上传页面加载', options);
    this.toast = this.selectComponent('#toast');
    
    // 如果有文件ID参数，说明是从其他页面跳转过来查看已上传的文件
    if (options.fileId) {
      this._loadBPFileInfo(options.fileId);
    }
  },

  onShow() {
    // 每次显示页面时，检查是否需要重置状态
    if (this.data.fileList.length === 0 && !this.data.uploadSuccess) {
      // 状态初始化
      this.setData({
        uploadProgress: 0,
        uploading: false,
        uploadSuccess: false,
        analyzing: false,
        analysisProgress: 0,
        analysisStage: '准备分析',
        error: '',
        showAnalysisResult: false,
        analysisResult: null
      });
    }
    
    // 如果有在进行中的分析，检查分析状态
    if (this.data.analyzing && this.data.fileId) {
      this._checkAnalysisStatus(this.data.fileId);
    }
  },

  // 加载BP文件信息
  _loadBPFileInfo(fileId) {
    wx.showLoading({
      title: '加载文件信息',
    });
    
    apiService.getBPFileInfo(fileId).then(data => {
      logger.info('获取BP文件信息成功', data);
      
      // 设置文件信息
      this.setData({
        fileList: [{
          id: data._id,
          name: data.name || '未命名文件',
          size: data.size ? formatFileSize(data.size) : '未知大小',
          time: data.uploadDate ? new Date(data.uploadDate).toLocaleString() : '未知时间',
          type: data.type || 'pdf',
          fileId: data._id,
          status: data.analysisResults ? 'analyzed' : 'uploaded'
        }],
        fileId: data._id,
        uploadSuccess: true,
        cloudFileID: data.fileID,
        loading: false
      });
      
      // 获取文件临时URL
      this._getFileURL(data.fileID);
      
      // 检查分析状态
      this._checkAnalysisStatus(data._id);
      
    }).catch(error => {
      logger.error('获取BP文件信息失败', error);
      this._showToast('error', '获取文件信息失败');
      this.setData({ loading: false });
    });
  },
  
  // 获取文件临时URL
  _getFileURL(fileID) {
    if (!fileID) return;
    
    apiService.getFileUrl(fileID).then(url => {
      logger.info('获取文件URL成功', url);
      this.setData({ cloudFileURL: url });
    }).catch(error => {
      logger.error('获取文件URL失败', error);
    });
  },
  
  // 检查分析状态
  _checkAnalysisStatus(fileId) {
    apiService.getBPDetail(fileId).then(result => {
      if (result && result.data) {
        const data = result.data;
        
        // 检查是否已分析
        if (data.analysisResults && Object.keys(data.analysisResults).length > 0) {
          logger.info('文件已分析', data.analysisResults);
          this.setData({
            analyzing: false,
            analysisProgress: 100,
            showAnalysisResult: true,
            analysisResult: data.analysisResults
          });
        }
      }
    }).catch(error => {
      logger.error('检查分析状态失败', error);
    });
  },

  // 选择文件
  async handleChooseFile() {
    try {
      const file = await chooseFile();
      logger.info('选择文件成功', file);

      this.setData({
        fileList: [{
          name: file.name,
          size: formatFileSize(file.size),
          path: file.path,
          time: new Date().toLocaleString(),
          type: file.name.split('.').pop().toLowerCase(),
          file: file // 保存原始文件对象
        }],
        uploadSuccess: false,
        error: '',
        showAnalysisResult: false,
        analysisResult: null,
        cozeResponseContent: ''
      });
    } catch (error) {
      logger.error('选择文件失败', error);
      this._showToast('error', error.message || '选择文件失败');
    }
  },

  // 跳转到文件分析详情页
  navigateToFileAnalysis(e) {
    const index = e.currentTarget.dataset.index;
    const fileId = this.data.fileList[index].fileId;
    
    if (fileId) {
      wx.navigateTo({
        url: `/pages/analysis-detail/analysis-detail?id=${fileId}`
      });
    } else {
      this._showToast('error', '文件尚未上传或分析');
    }
  },

  // 移除文件
  removeFile() {
    this.setData({
      fileList: [],
      uploadSuccess: false,
      fileId: null
    });
  },

  // 合并上传与分析功能
  async handleUploadAndAnalyze() {
    if (this.data.fileList.length === 0 || this.data.uploading || this.data.analyzing) {
      return;
    }

    // 如果已上传但未分析
    if (this.data.uploadSuccess && this.data.fileId && !this.data.analyzing) {
      await this.handleAnalyzeFile();
      return;
    }

    try {
      logger.info('开始上传并分析流程');
      
      // 先上传文件
      await this.handleUploadFile();
      
      // 上传成功后，handleUploadFile已经会自动调用handleAnalyzeFile
      // 所以这里不需要额外处理
    } catch (error) {
      logger.error('上传分析过程中出错', error);
      this._showToast('error', '处理过程出现错误，请重试');
    }
  },

  // 上传文件
  async handleUploadFile() {
    if (this.data.fileList.length === 0 || this.data.uploading) {
      return;
    }

    this.setData({
      uploading: true,
      uploadProgress: 0,
      uploadProgressText: '0',
      error: '',
      // 确保重置分析相关状态
      showAnalysisResult: false,
      analyzing: false
    });

    try {
      // 模拟上传进度
      this._simulateProgress('upload');

      const file = this.data.fileList[0];
      
      // 上传到云存储
      logger.info('开始上传文件到云存储', file.name);
      
      // 生成云存储路径
      const cloudPath = `bp_files/${Date.now()}_${file.name}`;
      
      // 上传到云存储
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadTask = wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: file.path || file.file.path,
          success: res => resolve(res),
          fail: err => reject(err)
        });
        
        // 监听上传进度
        uploadTask.onProgressUpdate(res => {
          // 使用真实进度
          this.setData({
            uploadProgress: res.progress,
            uploadProgressText: res.progress.toFixed(0)
          });
        });
      });
      
      logger.info('文件上传到云存储成功', uploadResult);
      
      // 停止模拟进度
      if (this.uploadProgressInterval) {
        clearInterval(this.uploadProgressInterval);
      }
      
      // 保存云文件ID
      this.setData({
        cloudFileID: uploadResult.fileID
      });
      
      // 获取文件临时URL
      const tempFileURL = await apiService.getFileUrl(uploadResult.fileID);
      logger.info('获取文件URL成功', tempFileURL);
      
      this.setData({
        cloudFileURL: tempFileURL
      });
      
      // 调用云函数记录文件信息
      const saveResult = await wx.cloud.callFunction({
        name: 'saveBPFile',
        data: {
          fileID: uploadResult.fileID,
          fileName: file.name,
          fileSize: file.file ? file.file.size : 0,
          fileType: file.type
        }
      });
      
      logger.info('保存文件信息成功', saveResult);
      
      if (saveResult.result && saveResult.result.fileId) {
        this.setData({
          uploading: false,
          uploadProgress: 100,
          uploadProgressText: '100',
          uploadSuccess: true,
          fileId: saveResult.result.fileId
        });
        
        this._showToast('success', '上传成功');
        
        // 自动开始分析
        setTimeout(() => {
          this.handleAnalyzeFile();
        }, 1000);
      } else {
        throw new Error('保存文件信息失败');
      }
    } catch (error) {
      // 停止模拟进度
      if (this.uploadProgressInterval) {
        clearInterval(this.uploadProgressInterval);
      }

      logger.error('文件上传失败', error);
      this.setData({
        uploading: false,
        error: error.message || '上传失败，请重试'
      });
      this._showToast('error', error.message || '上传失败，请重试');
    }
  },

  // 分析文件
  async handleAnalyzeFile() {
    if (this.data.analyzing) {
      return;
    }

    // 设置分析状态
    this.setData({
      analyzing: true,
      analysisProgress: 0,
      analysisProgressText: '0',
      analysisStage: '准备分析',
      error: ''
    });

    try {
      // 获取文件信息
      logger.info('开始分析流程', this.data.fileId);
      const fileInfo = await this._loadBPFileInfo(this.data.fileId);
      
      if (!fileInfo || !fileInfo.fileID) {
        throw new Error('获取文件信息失败');
      }
      
      // 获取云存储文件临时URL
      const fileUrl = await this._getFileURL(fileInfo.fileID);
      
      if (!fileUrl) {
        throw new Error('获取文件URL失败');
      }
      
      logger.info('文件URL获取成功', fileUrl);
      
      // 调用Coze分析API并跳转到结果页
      this._callCozeWorkflow(fileUrl, fileInfo);
      
    } catch (error) {
      logger.error('分析过程出错', error);
      
      this.setData({
        analyzing: false,
        error: error.message || '分析失败，请重试'
      });
      
      this._showToast('error', error.message || '分析失败');
    }
  },

  /**
   * 调用Coze工作流API进行分析
   * @param {string} fileUrl 文件URL
   * @param {object} fileInfo 文件信息
   */
  _callCozeWorkflow(fileUrl, fileInfo) {
    // 配置参数
    const token = 'pat_qLidHTjFnf7XlU0UwEz2L2OcWl34KsuSU56X9V1dFDAuhNf3atXTOl2gO5G2laVN';
    const workflowId = '7488013332172193801';
    const analysisId = `analysis_${Date.now()}`;
    const app = getApp();
    
    // 确保全局数据结构初始化
    if (!app.globalData.analysisStreams) {
      app.globalData.analysisStreams = {};
    }
    
    // 初始化分析流数据
    app.globalData.analysisStreams[analysisId] = {
      content: '',
      isComplete: false,
      error: null,
      fileId: this.data.fileId,
      fileName: fileInfo.fileName || '未命名文件'
    };
    
    // 更新进度显示
    this.setData({
      analysisStage: '连接分析服务...',
      analysisProgress: 10,
      analysisProgressText: '10'
    });
    
    logger.info('开始调用Coze工作流API', {
      streamId: analysisId,
      fileName: fileInfo.fileName
    });
    
    // 配置请求参数
    const requestTask = wx.request({
      url: 'https://api.coze.cn/v1/workflow/stream_run',
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream'
      },
      data: {
        workflow_id: workflowId,
        parameters: {
          input: [fileUrl],
          useJson: false,
          outputFormat: "markdown"
        }
      },
      enableChunked: true,
      responseType: 'text',
      success: (res) => {
        logger.info('Coze API请求成功完成', {statusCode: res.statusCode});
      },
      fail: (err) => {
        logger.error('Coze API请求失败', err);
        app.globalData.analysisStreams[analysisId].error = err.errMsg || '请求失败';
        
        this.setData({
          analyzing: false,
          error: '分析服务请求失败'
        });
        
        this._showToast('error', '分析服务请求失败');
      }
    });
    
    // 数据接收计数
    let receivedChunks = 0;
    let hasNavigated = false;
    
    // 监听分块数据接收
    requestTask.onChunkReceived((res) => {
      receivedChunks++;
      try {
        const chunk = res.data;
        logger.info(`收到数据块 #${receivedChunks}，长度: ${chunk.length}`);
        
        // 处理数据块
        this._processStreamChunk(chunk, analysisId);
        
        // 更新进度
        const progress = Math.min(10 + receivedChunks * 5, 90);
        this.setData({
          analysisProgress: progress,
          analysisProgressText: Math.floor(progress),
          analysisStage: '分析中...'
        });
        
        // 收到第一块数据后立即跳转
        if (!hasNavigated) {
          hasNavigated = true;
          this._navigateToAnalysisPage(analysisId, fileInfo);
        }
      } catch (e) {
        logger.error('处理数据块出错', e);
      }
    });
    
    // 监听请求完成
    requestTask.onHeadersReceived((res) => {
      logger.info('收到响应头', res.header);
    });
    
    // 设置5秒超时，即使没收到数据也跳转到结果页
    setTimeout(() => {
      if (!hasNavigated) {
        hasNavigated = true;
        logger.info('等待超时，直接跳转到分析页面');
        this._navigateToAnalysisPage(analysisId, fileInfo);
      }
    }, 5000);
  },

  /**
   * 导航到分析页面
   * @param {string} analysisId 分析ID
   * @param {object} fileInfo 文件信息
   */
  _navigateToAnalysisPage(analysisId, fileInfo) {
    // 延迟跳转以确保全局数据已设置
    setTimeout(() => {
      wx.navigateTo({
        url: `/pages/analysis-detail/analysis-detail?id=${this.data.fileId}&streamId=${analysisId}`,
        success: () => {
          logger.info('跳转到分析详情页成功');
          
          // 页面跳转成功后设置分析状态为完成
          this.setData({
            analyzing: false,
            analysisProgress: 100,
            analysisProgressText: '100',
            analysisStage: '分析完成'
          });
        },
        fail: (err) => {
          logger.error('跳转到分析详情页失败', err);
          
          // 跳转失败时也更新UI状态
          this.setData({
            analyzing: false,
            error: '打开分析页面失败'
          });
          
          this._showToast('error', '打开分析页面失败');
        }
      });
    }, 300);
  },

  /**
   * 处理流式响应的数据块
   * @param {string} chunk 接收到的数据块
   * @param {string} analysisId 分析ID
   */
  _processStreamChunk(chunk, analysisId) {
    if (!chunk) return;
    
    const app = getApp();
    if (!app.globalData.analysisStreams[analysisId]) return;
    
    try {
      // 解析事件流数据
      const events = this._parseEventStream(chunk);
      
      // 处理事件
      for (const event of events) {
        // 处理文本内容
        if (event.data && event.data.content && event.data.content_type === 'text') {
          app.globalData.analysisStreams[analysisId].content += event.data.content;
          logger.debug('累积内容长度', app.globalData.analysisStreams[analysisId].content.length);
        }
        
        // 检查完成事件
        if (event.event === 'Done') {
          app.globalData.analysisStreams[analysisId].isComplete = true;
          logger.info('收到完成事件，分析结束');
        }
      }
    } catch (e) {
      logger.error('解析数据块失败', e);
    }
  },

  /**
   * 解析事件流文本
   * @param {string} text 事件流文本
   * @returns {Array} 解析后的事件数组
   */
  _parseEventStream(text) {
    if (!text) return [];
    
    const lines = text.split('\n');
    const events = [];
    let event = {};
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // 空行表示事件结束
      if (trimmed === '') {
        if (Object.keys(event).length > 0) {
          events.push(event);
          event = {};
        }
        continue;
      }
      
      // 解析事件类型
      if (trimmed.startsWith('event:')) {
        event.event = trimmed.substring(6).trim();
      }
      // 解析数据内容
      else if (trimmed.startsWith('data:')) {
        try {
          const dataContent = trimmed.substring(5).trim();
          event.data = JSON.parse(dataContent);
        } catch (e) {
          event.data = { content: trimmed.substring(5).trim() };
        }
      }
    }
    
    // 处理最后一个事件
    if (Object.keys(event).length > 0) {
      events.push(event);
    }
    
    return events;
  },

  // 预览报告
  async previewReport() {
    if (!this.data.analysisResult) return;
    
    this.setData({ previewLoading: true });
    
    try {
      // 为了演示，我们使用模拟生成DOCX的方法
      await this._mockGenerateAndPreviewDocx();
      
      // 真实环境下应该调用云函数生成文档
      /*
      const res = await wx.cloud.callFunction({
        name: 'generateReport',
        data: { 
          fileId: this.data.fileId,
          format: 'docx'
        }
      });
      
      if (res.result && res.result.code === 200 && res.result.data.fileID) {
        await previewFile(res.result.data.fileID);
      }
      */
    } catch (error) {
      logger.error('预览报告失败', error);
      this._showToast('error', '预览失败，请重试');
    } finally {
      this.setData({ previewLoading: false });
    }
  },
  
  // 模拟生成和预览DOCX的方法
  _mockGenerateAndPreviewDocx() {
    return new Promise((resolve) => {
      setTimeout(() => {
        this._showToast('info', '此功能在开发中，敬请期待');
        resolve();
      }, 1500);
    });
  },

  // 关闭分析结果
  closeAnalysisResult() {
    this.setData({
      showAnalysisResult: false
    });
  },

  // 模拟进度
  _simulateProgress(type) {
    if (type === 'upload') {
      this.uploadProgressInterval = setInterval(() => {
        let progress = this.data.uploadProgress;
        progress += Math.random() * 10;
        if (progress > 95) {
          progress = 95;
          clearInterval(this.uploadProgressInterval);
        }
        this.setData({
          uploadProgress: progress,
          uploadProgressText: progress.toFixed(0)
        });
      }, 300);
    } else if (type === 'analysis') {
      const stages = [
        '准备分析',
        '读取文档内容',
        '解析文本结构',
        '提取关键信息',
        '生成分析报告'
      ];

      this.analysisProgressInterval = setInterval(() => {
        let progress = this.data.analysisProgress;
        progress += Math.random() * 5;
        if (progress > 95) {
          progress = 95;
          clearInterval(this.analysisProgressInterval);
        }

        // 更新分析阶段
        const stageIndex = Math.min(
          Math.floor(progress / 20),
          stages.length - 1
        );

        this.setData({
          analysisProgress: progress,
          analysisProgressText: progress.toFixed(0),
          analysisStage: stages[stageIndex]
        });
      }, 300);
    }
  },

  // 重置
  handleReset() {
    // 清除所有定时器
    if (this.uploadProgressInterval) {
      clearInterval(this.uploadProgressInterval);
    }
    if (this.analysisProgressInterval) {
      clearInterval(this.analysisProgressInterval);
    }
    if (this.statusPollingTimeout) {
      clearTimeout(this.statusPollingTimeout);
    }

    this.setData({
      fileList: [],
      uploadProgress: 0,
      uploadProgressText: '0',
      uploading: false,
      uploadSuccess: false,
      analyzing: false,
      analysisProgress: 0,
      analysisProgressText: '0',
      analysisStage: '准备分析',
      error: '',
      showAnalysisResult: false,
      analysisResult: null,
      cozeResponseContent: '',
      fileId: null,
      analysisTaskId: null,
      pollingFailCount: 0,
      statusPollingTimeout: null,
      cloudFileID: '',
      cloudFileURL: ''
    });
  },

  onShareAppMessage() {
    return {
      title: 'BP小诸葛 - 商业计划书智能评估专家',
      path: '/pages/index/index',
      imageUrl: '/assets/images/share.png'
    };
  },
  
  // 显示提示
  _showToast(type, message) {
    const toast = this.selectComponent('#toast');
    if (toast) {
      toast[type](message);
    } else {
      wx.showToast({
        title: message,
        icon: type === 'success' ? 'success' : 'none'
      });
    }
  },

  // 组件销毁时清理
  onUnload() {
    // 清除所有定时器
    if (this.uploadProgressInterval) {
      clearInterval(this.uploadProgressInterval);
    }
    if (this.analysisProgressInterval) {
      clearInterval(this.analysisProgressInterval);
    }
    if (this.statusPollingTimeout) {
      clearTimeout(this.statusPollingTimeout);
    }
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
    }
  },

  // 查看分析结果
  viewAnalysisResult() {
    // 如果有文件ID，导航到详情页
    if (this.data.fileId) {
      wx.navigateTo({
        url: `/pages/analysis-detail/analysis-detail?id=${this.data.fileId}`
      });
    } else {
      this._showToast('error', '无法查看分析结果，文件ID不存在');
    }
  }
}) 