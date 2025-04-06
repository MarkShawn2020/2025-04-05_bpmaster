import { logger } from '../../utils/logger';
import { chooseFile, isValidBPFile, formatFileSize } from '../../utils/file';
import { apiService } from '../../services/api';
import Toast from '../../components/toast/toast';
import { formatDate, getFileTypeByName } from '../../utils/fileUtils';
import { uploadFile } from '../../services/fileService';
import { sleep, markdownToHtml } from '../../utils/util';

// Coze工作流配置
const COZE_CONFIG = {
  API_URL: 'https://api.coze.cn/v1/workflow/stream_run',
  TOKEN: 'pat_qLidHTjFnf7XlU0UwEz2L2OcWl34KsuSU56X9V1dFDAuhNf3atXTOl2gO5G2laVN',
  WORKFLOW_ID: '7488013332172193801'
};

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

    // 检查文件URL是否存在
    if (!this.data.cloudFileURL) {
      this._showToast('error', '获取文件URL失败，请重试');
      return;
    }

    this.setData({
      analyzing: true,
      analysisProgress: 0,
      analysisProgressText: '0',
      analysisStage: '准备分析',
      error: '',
      cozeResponseContent: ''
    });

    try {
      // 显示初始阶段
      this._simulateProgress('analysis');

      // 根据用户偏好选择直接流式调用或通过云函数调用
      const useDirectStreamCall = true; // 可以从配置或设置中获取

      if (useDirectStreamCall) {
        // 直接使用流式调用方式
        await this._callCozeWorkflowWithStream(this.data.cloudFileURL);
      } else {
        // 使用原有的云函数轮询方式
        const callResult = await wx.cloud.callFunction({
          name: 'callCozeAPI',
          data: {
            url: COZE_CONFIG.API_URL,
            token: COZE_CONFIG.TOKEN,
            workflow_id: COZE_CONFIG.WORKFLOW_ID,
            fileId: this.data.fileId,
            parameters: {
              input: [this.data.cloudFileURL],
              useJson: true,
              outputFormat: "json"
            }
          }
        });
        
        logger.info('启动分析任务成功', callResult);
        
        if (callResult.result && callResult.result.code === 200 && callResult.result.data && callResult.result.data.taskId) {
          const taskId = callResult.result.data.taskId;
          this._startPollingTaskStatus(taskId);
        } else {
          throw new Error('启动分析任务失败');
        }
      }
    } catch (error) {
      // 停止模拟进度
      if (this.analysisProgressInterval) {
        clearInterval(this.analysisProgressInterval);
      }

      logger.error('启动分析任务失败', error);
      
      let errorMessage = '分析失败，请重试';
      
      if (error.message && error.message.includes('网络请求失败')) {
        errorMessage = '网络连接异常，请检查网络后重试';
      }
      
      this.setData({
        analyzing: false,
        error: errorMessage
      });
      
      this._showToast('error', errorMessage);
    }
  },

  // 使用分块传输直接调用Coze API
  _callCozeWorkflowWithStream(fileUrl) {
    return new Promise((resolve, reject) => {
      logger.info('使用分块传输调用Coze API', fileUrl);

      // 确保URL有效
      if (!fileUrl) {
        reject(new Error('文件URL无效'));
        return;
      }

      // 初始化分析任务状态
      const streamId = `stream_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const fileInfo = getApp().globalData.uploadedFiles.find(f => f.fileId === this.data.fileId);
      
      logger.info('开始分析任务', { streamId, fileId: this.data.fileId, fileName: fileInfo?.fileName });
      
      // 初始化全局分析流数据
      getApp().globalData.analysisStreams = getApp().globalData.analysisStreams || {};
      getApp().globalData.analysisStreams[streamId] = {
        fileId: this.data.fileId,
        fileName: fileInfo?.fileName || '未知文件',
        content: '',
        progress: 5,
        stage: '连接Coze API...',
        status: 'analyzing',
        startTime: new Date(),
        receivedChunks: 0
      };
      
      // 更新UI状态
      this.setData({
        analysisProgress: 5,
        analysisProgressText: '5',
        analysisStage: '连接Coze API...',
        showAnalysisResult: true
      });
      
      // 跳转到分析页面，传递流ID
      wx.navigateTo({
        url: `/pages/analysis-detail/analysis-detail?mode=realtime&streamId=${streamId}&id=${this.data.fileId}`,
        success: () => {
          logger.info('成功导航到实时分析页面', { streamId });
        },
        fail: (err) => {
          logger.error('导航到实时分析页面失败', err);
          toast.error('打开分析页面失败');
        }
      });

      // 收集响应内容
      let accumulatedContent = '';
      let isFirstChunk = true;
      let receivedChunks = 0;
      
      // 创建分析阶段数组
      const stages = [
        '正在读取文档...',
        '提取文档结构...',
        '分析商业模型...',
        '评估市场潜力...',
        '分析团队能力...',
        '核算财务数据...',
        '综合评分...',
        '生成分析报告...'
      ];
      
      // 停止模拟进度
      if (this.analysisProgressInterval) {
        clearInterval(this.analysisProgressInterval);
      }

      // 发起请求并获取请求任务对象
      const requestTask = wx.request({
        url: COZE_CONFIG.API_URL,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${COZE_CONFIG.TOKEN}`,
          'Accept': 'text/event-stream' // 指定接受事件流
        },
        data: {
          workflow_id: COZE_CONFIG.WORKFLOW_ID,
          parameters: {
            input: [fileUrl],
            useJson: true,
            outputFormat: "json"
          }
        },
        responseType: 'text', // 使用文本类型接收数据
        enableChunked: true, // 启用分块接收
        success: (res) => {
          logger.info('Coze API请求完成', {
            statusCode: res.statusCode,
            hasData: !!res.data
          });
          
          // 请求完成但不一定成功，最终的成功判断基于是否收到了足够的数据块
        },
        fail: (err) => {
          logger.error('Coze API请求失败', err);
          
          // 更新全局分析流状态
          if (getApp().globalData.analysisStreams && this.data.fileId) {
            const streamId = Object.keys(getApp().globalData.analysisStreams).find(
              id => getApp().globalData.analysisStreams[id].fileId === this.data.fileId
            );
            
            if (streamId) {
              getApp().globalData.analysisStreams[streamId].status = 'failed';
              getApp().globalData.analysisStreams[streamId].error = err.errMsg || '未知错误';
            }
          }
          
          reject(new Error('API请求失败: ' + (err.errMsg || '未知错误')));
        },
        complete: () => {
          logger.info('Coze API请求结束，共收到数据块:', receivedChunks);
          
          // 只有当收到内容时才认为成功
          if (accumulatedContent.length > 0) {
            // 保存到分析结果
            this._saveAnalysisResult(accumulatedContent);
            
            // 更新全局分析流状态为完成
            if (getApp().globalData.analysisStreams && this.data.fileId) {
              const streamId = Object.keys(getApp().globalData.analysisStreams).find(
                id => getApp().globalData.analysisStreams[id].fileId === this.data.fileId
              );
              
              if (streamId) {
                getApp().globalData.analysisStreams[streamId].status = 'completed';
                getApp().globalData.analysisStreams[streamId].progress = 100;
                getApp().globalData.analysisStreams[streamId].stage = '分析完成';
              }
            }
            
            resolve(accumulatedContent);
          } else if (receivedChunks === 0) {
            // 更新全局分析流状态为失败
            if (getApp().globalData.analysisStreams && this.data.fileId) {
              const streamId = Object.keys(getApp().globalData.analysisStreams).find(
                id => getApp().globalData.analysisStreams[id].fileId === this.data.fileId
              );
              
              if (streamId) {
                getApp().globalData.analysisStreams[streamId].status = 'failed';
                getApp().globalData.analysisStreams[streamId].error = '未收到任何响应数据';
              }
            }
            
            reject(new Error('未收到任何响应数据'));
          }
        }
      });

      // 监听分块数据接收
      requestTask.onChunkReceived((res) => {
        try {
          receivedChunks++;
          
          // 将ArrayBuffer转换为字符串
          const chunk = this._arrayBufferToString(res.data);
          logger.info(`收到第${receivedChunks}块数据，长度: ${chunk.length}，内容：${chunk}`);
          
          if (isFirstChunk) {
            isFirstChunk = false;
            this.setData({
              analysisStage: '开始接收分析结果...',
              analysisProgress: 20,
              analysisProgressText: '20'
            });
          }
          
          // 解析事件数据
          const eventData = this._parseEventStream(chunk);
          
          // 处理解析到的事件数据
          if (eventData && eventData.length > 0) {
            // 处理每个事件
            eventData.forEach(event => {
              if (event.event === 'message' && event.data && event.data.content) {
                // 累加内容
                accumulatedContent += event.data.content;
                
                // 更新UI显示部分内容
                this.setData({
                  cozeResponseContent: accumulatedContent,
                  analysisProgress: Math.min(20 + receivedChunks * 5, 95),
                  analysisProgressText: Math.min(20 + receivedChunks * 5, 95).toString(),
                  analysisStage: stages[Math.min(Math.floor(receivedChunks / 2), stages.length - 1)]
                });
                
                // 更新全局分析流状态
                if (getApp().globalData.analysisStreams && this.data.fileId) {
                  const streamId = Object.keys(getApp().globalData.analysisStreams).find(
                    id => getApp().globalData.analysisStreams[id].fileId === this.data.fileId
                  );
                  
                  if (streamId) {
                    const progress = Math.min(20 + receivedChunks * 5, 95);
                    const stage = stages[Math.min(Math.floor(receivedChunks / 2), stages.length - 1)];
                    
                    // 直接更新完整内容，而非增量
                    getApp().globalData.analysisStreams[streamId].content = accumulatedContent;
                    getApp().globalData.analysisStreams[streamId].progress = progress;
                    getApp().globalData.analysisStreams[streamId].stage = stage;
                    getApp().globalData.analysisStreams[streamId].receivedChunks = receivedChunks;
                    
                    // 确保分析流数据会被刷新
                    logger.info(`更新分析流数据: ID=${streamId}, 内容长度=${accumulatedContent.length}, 进度=${progress}%`);
                    
                    // 创建一个新的对象引用，强制触发其他页面的数据刷新
                    const streams = {};
                    Object.keys(getApp().globalData.analysisStreams).forEach(key => {
                      streams[key] = {...getApp().globalData.analysisStreams[key]};
                    });
                    getApp().globalData.analysisStreams = streams;
                  }
                }
              }
              else if (event.event === 'done') {
                logger.info('收到完成事件');
                
                // 更新UI为完成状态
                this.setData({
                  analysisProgress: 100,
                  analysisProgressText: '100',
                  analysisStage: '分析完成'
                });
                
                // 更新全局分析流状态
                if (getApp().globalData.analysisStreams && this.data.fileId) {
                  const streamId = Object.keys(getApp().globalData.analysisStreams).find(
                    id => getApp().globalData.analysisStreams[id].fileId === this.data.fileId
                  );
                  
                  if (streamId) {
                    getApp().globalData.analysisStreams[streamId].progress = 100;
                    getApp().globalData.analysisStreams[streamId].stage = '分析完成';
                    getApp().globalData.analysisStreams[streamId].status = 'completed';
                    
                    // 在完成时确保最终内容已被保存
                    getApp().globalData.analysisStreams[streamId].content = accumulatedContent;
                    
                    // 创建一个新的对象引用，强制触发其他页面的数据刷新
                    logger.info(`分析完成，最终内容长度: ${accumulatedContent.length}`);
                    
                    const streams = {};
                    Object.keys(getApp().globalData.analysisStreams).forEach(key => {
                      streams[key] = {...getApp().globalData.analysisStreams[key]};
                    });
                    getApp().globalData.analysisStreams = streams;
                  }
                }
              }
              else if (event.event === 'error') {
                logger.error('收到错误事件', event);
                
                // 更新全局分析流状态
                if (getApp().globalData.analysisStreams && this.data.fileId) {
                  const streamId = Object.keys(getApp().globalData.analysisStreams).find(
                    id => getApp().globalData.analysisStreams[id].fileId === this.data.fileId
                  );
                  
                  if (streamId) {
                    getApp().globalData.analysisStreams[streamId].status = 'failed';
                    getApp().globalData.analysisStreams[streamId].error = event.data?.message || '未知错误';
                  }
                }
                
                reject(new Error('API返回错误: ' + (event.data?.message || '未知错误')));
              }
            });
          }
          
          // 如果是最后一块数据
          if (res.isLastChunk) {
            logger.info('收到最后一块数据');
            
            // 如果没有收到done事件，也完成处理
            if (accumulatedContent.length > 0) {
              // 更新全局分析流状态
              if (getApp().globalData.analysisStreams && this.data.fileId) {
                const streamId = Object.keys(getApp().globalData.analysisStreams).find(
                  id => getApp().globalData.analysisStreams[id].fileId === this.data.fileId
                );
                
                if (streamId) {
                  getApp().globalData.analysisStreams[streamId].progress = 100;
                  getApp().globalData.analysisStreams[streamId].stage = '分析完成';
                  getApp().globalData.analysisStreams[streamId].status = 'completed';
                }
              }
              
              // 保存完整结果
              this._saveAnalysisResult(accumulatedContent);
            }
          }
        } catch (error) {
          logger.error('处理数据块出错:', error);
        }
      });
    });
  },
  
  // 将ArrayBuffer转换为字符串
  _arrayBufferToString(buffer) {
    try {
      return new TextDecoder('utf-8').decode(buffer);
    } catch (error) {
      logger.error('转换ArrayBuffer到字符串失败', error);
      // 备用方案
      const bytes = new Uint8Array(buffer);
      let result = '';
      for (let i = 0; i < bytes.length; i++) {
        result += String.fromCharCode(bytes[i]);
      }
      return result;
    }
  },
  
  // 解析事件流数据
  _parseEventStream(text) {
    if (!text || text.trim() === '') return [];
    
    // 分割成行
    const lines = text.split('\n');
    const events = [];
    let currentEvent = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 空行表示事件结束
      if (line === '') {
        if (currentEvent) {
          events.push(currentEvent);
          currentEvent = null;
        }
        continue;
      }
      
      // 新事件开始
      if (line.startsWith('event:')) {
        if (currentEvent) {
          events.push(currentEvent);
        }
        const eventType = line.substring(6).trim();
        currentEvent = { event: eventType, data: null };
      }
      // 数据行
      else if (line.startsWith('data:') && currentEvent) {
        const dataStr = line.substring(5).trim();
        try {
          currentEvent.data = JSON.parse(dataStr);
        } catch (e) {
          currentEvent.data = { content: dataStr };
        }
      }
    }
    
    // 处理最后一个事件
    if (currentEvent) {
      events.push(currentEvent);
    }
    
    return events;
  },
  
  // 保存分析结果到数据库
  async _saveAnalysisResult(content) {
    if (!this.data.fileId || !content) return;
    
    try {
      // 解析内容为JSON或使用原始文本
      let analysisData = null;
      
      try {
        // 尝试提取JSON内容
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          analysisData = JSON.parse(jsonMatch[1]);
        } else {
          // 尝试直接解析整个内容
          analysisData = JSON.parse(content);
        }
      } catch (parseError) {
        logger.error('解析内容为JSON失败', parseError);
        // 使用原始文本
        analysisData = { rawContent: content };
      }
      
      // 调用云函数保存结果
      const updateResult = await wx.cloud.callFunction({
        name: 'updateAnalysisResult',
        data: {
          fileId: this.data.fileId,
          analysisResults: analysisData
        }
      });
      
      logger.info('保存分析结果成功', updateResult);
      
      // 更新UI
      this.setData({
        analyzing: false,
        showAnalysisResult: true,
        analysisResult: analysisData
      });
      
      this._showToast('success', '分析完成');
    } catch (error) {
      logger.error('保存分析结果失败', error);
      
      // 即使保存失败也显示结果
      this.setData({
        analyzing: false,
        showAnalysisResult: true,
        analysisResult: { rawContent: content }
      });
      
      this._showToast('info', '分析完成，但保存结果失败');
    }
  },

  // 开始轮询任务状态
  _startPollingTaskStatus(taskId) {
    logger.info('开始轮询任务状态', taskId);
    
    // 清除之前的定时器
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
    }
    
    // 初始化轮询计数和状态
    let pollingCount = 0;
    const MAX_POLLING = 30; // 最多轮询30次，约5分钟
    
    // 开始轮询
    this.statusPollingInterval = setInterval(async () => {
      try {
        pollingCount++;
        
        if (pollingCount > MAX_POLLING) {
          clearInterval(this.statusPollingInterval);
          throw new Error('分析超时，请稍后查看结果');
        }
        
        const statusResult = await wx.cloud.callFunction({
          name: 'getAnalysisTaskStatus',
          data: { taskId }
        });
        
        if (statusResult.result && statusResult.result.code === 200) {
          const taskData = statusResult.result.data;
          
          // 更新UI显示
          this.setData({
            analysisProgress: taskData.progress || 0,
            analysisProgressText: (taskData.progress || 0).toString(),
            analysisStage: taskData.message || '正在分析...',
            cozeResponseContent: taskData.result || ''
          });
          
          logger.info(`任务状态: ${taskData.status}, 进度: ${taskData.progress}%`);
          
          // 检查任务是否完成
          if (taskData.status === 'completed') {
            // 停止轮询和进度模拟
            clearInterval(this.statusPollingInterval);
            if (this.analysisProgressInterval) {
              clearInterval(this.analysisProgressInterval);
            }
            
            logger.info('分析任务已完成', taskData);
            
            // 分析完成，显示结果
            this.setData({
              analyzing: false,
              analysisProgress: 100,
              analysisProgressText: '100',
              analysisStage: '分析完成',
              showAnalysisResult: true,
              analysisResult: taskData.result || this.data.analysisResult
            });
            
            this._showToast('success', '分析完成');
          } 
          // 检查任务是否失败
          else if (taskData.status === 'failed') {
            // 停止轮询和进度模拟
            clearInterval(this.statusPollingInterval);
            if (this.analysisProgressInterval) {
              clearInterval(this.analysisProgressInterval);
            }
            
            logger.error('分析任务失败', taskData);
            
            this.setData({
              analyzing: false,
              error: taskData.error || '分析失败，请重试'
            });
            
            this._showToast('error', taskData.error || '分析失败，请重试');
          }
        } else {
          logger.warn('获取任务状态失败', statusResult);
        }
      } catch (error) {
        logger.error('轮询任务状态出错', error);
      }
    }, 10000); // 每10秒查询一次
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