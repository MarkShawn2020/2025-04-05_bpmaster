import { logger } from '../../utils/logger';
import { chooseFile, isValidBPFile, formatFileSize } from '../../utils/file';
import { apiService } from '../../services/api';
import Toast from '../../components/toast/toast';
import { formatDate, getFileTypeByName } from '../../utils/fileUtils';
import { uploadFile } from '../../services/fileService';
import { sleep, markdownToHtml } from '../../utils/util';

Page({
  data: {
    fileList: [], // 文件列表，只会存储一个文件
    uploadProgress: 0,
    uploading: false,
    uploadSuccess: false,
    analyzing: false,
    analysisProgress: 0,
    analysisStage: '准备分析',
    analysisResult: null, // 分析结果
    showAnalysisResult: false, // 是否展示分析结果
    previewLoading: false, // 预览加载状态
    error: '',
    fileId: null,
    analysisTaskId: null,
    pollingFailCount: 0,
    statusPollingTimeout: null
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
    
    wx.cloud.callFunction({
      name: 'getBPFileInfo',
      data: { fileId },
      success: (res) => {
        if (res.result && res.result.code === 200) {
          const fileInfo = res.result.data;
          
          // 设置文件信息
          this.setData({
            fileList: [{
              id: fileInfo._id,
              name: fileInfo.name || '未命名文件',
              size: fileInfo.size ? formatFileSize(fileInfo.size) : '未知大小',
              time: fileInfo.uploadDate ? new Date(fileInfo.uploadDate).toLocaleString() : '未知时间',
              type: fileInfo.type || 'pdf',
              fileId: fileInfo._id,
              status: fileInfo.analysisResults ? 'analyzed' : 'uploaded'
            }],
            fileId: fileInfo._id,
            uploadSuccess: true
          });
          
          // 如果已经分析过，显示分析结果
          if (fileInfo.analysisResults) {
            this.setData({
              showAnalysisResult: true,
              analysisResult: fileInfo.analysisResults
            });
          }
        } else {
          this._showToast('error', '加载文件信息失败');
        }
      },
      fail: (err) => {
        logger.error('加载BP文件信息失败', err);
        this._showToast('error', '加载文件信息失败');
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },
  
  // 检查分析状态
  _checkAnalysisStatus(fileId) {
    // 调用云函数获取分析状态
    wx.cloud.callFunction({
      name: 'getBPDetail',
      data: { id: fileId },
      success: (res) => {
        if (res.result && res.result.code === 200) {
          const fileInfo = res.result.data;
          
          // 如果分析已完成
          if (fileInfo.analysisResults) {
            this.setData({
              analyzing: false,
              analysisProgress: 100,
              showAnalysisResult: true,
              analysisResult: fileInfo.analysisResults
            });
          }
        }
      }
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
          type: file.name.split('.').pop().toLowerCase()
        }],
        uploadSuccess: false,
        error: '',
        showAnalysisResult: false,
        analysisResult: null
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

  // 上传文件
  async handleUploadFile() {
    if (this.data.fileList.length === 0 || this.data.uploading) {
      return;
    }

    this.setData({
      uploading: true,
      uploadProgress: 0,
      error: ''
    });

    try {
      // 模拟上传进度
      this._simulateProgress('upload');

      const file = this.data.fileList[0];
      
      // 调用云函数上传文件
      wx.showLoading({
        title: '上传文件中',
      });
      
      const uploadRes = await new Promise((resolve, reject) => {
        const tempFilePath = file.path;
        
        // 上传文件到云存储
        wx.cloud.uploadFile({
          cloudPath: `bp_files/${new Date().getTime()}_${file.name}`,
          filePath: tempFilePath,
          success: (res) => {
            if (res.fileID) {
              resolve({
                fileID: res.fileID,
                cloudPath: `bp_files/${new Date().getTime()}_${file.name}`,
                filename: file.name
              });
            } else {
              reject(new Error('上传失败，未获取到文件ID'));
            }
          },
          fail: (error) => {
            reject(error);
          }
        });
      });
      
      logger.info('文件上传成功', uploadRes);
      
      // 保存文件信息到数据库
      const saveRes = await wx.cloud.callFunction({
        name: 'saveBPFile',
        data: {
          fileID: uploadRes.fileID,
          name: file.name,
          size: file.size,
          type: file.name.split('.').pop().toLowerCase(),
          cloudPath: uploadRes.cloudPath
        }
      });
      
      logger.info('文件信息保存成功', saveRes);
      
      // 停止模拟进度
      clearInterval(this.uploadProgressInterval);
      
      // 获取文件临时下载链接
      const tempUrlRes = await wx.cloud.getTempFileURL({
        fileList: [uploadRes.fileID]
      });
      
      if (tempUrlRes.fileList && tempUrlRes.fileList[0] && tempUrlRes.fileList[0].tempFileURL) {
        // 保存文件URL用于后续分析
        this.setData({
          fileURL: tempUrlRes.fileList[0].tempFileURL
        });
      }

      this.setData({
        uploading: false,
        uploadProgress: 100,
        uploadSuccess: true,
        fileId: saveRes.result.fileId,
        fileList: this.data.fileList.map(item => ({
          ...item,
          fileId: saveRes.result.fileId
        }))
      });

      this._showToast('success', '上传成功');
      
      wx.hideLoading();
      
      // 自动开始分析
      setTimeout(() => {
        this.handleAnalyzeFile();
      }, 1000);
    } catch (error) {
      // 停止模拟进度
      clearInterval(this.uploadProgressInterval);

      logger.error('文件上传失败', error);
      this.setData({
        uploading: false,
        error: error.message || '上传失败，请重试'
      });
      this._showToast('error', error.message || '上传失败，请重试');
      
      wx.hideLoading();
    }
  },

  // 分析文件
  async handleAnalyzeFile() {
    if (!this.data.fileId || this.data.analyzing) {
      return;
    }

    this.setData({
      analyzing: true,
      analysisProgress: 0,
      analysisStage: '准备分析',
      error: ''
    });

    try {
      // 模拟分析进度
      this._simulateProgress('analysis');
      
      // 获取文件URL
      let fileURL = this.data.fileURL;
      
      if (!fileURL) {
        // 如果没有文件URL，重新获取
        const fileId = this.data.fileId;
        
        const fileInfoRes = await wx.cloud.callFunction({
          name: 'getBPFileInfo',
          data: { fileId },
          config: { timeout: 600 * 1000 } // 600秒超时
        });
        
        if (fileInfoRes.result && fileInfoRes.result.code === 200 && fileInfoRes.result.data.fileID) {
          const tempUrlRes = await wx.cloud.getTempFileURL({
            fileList: [fileInfoRes.result.data.fileID]
          });
          
          if (tempUrlRes.fileList && tempUrlRes.fileList[0] && tempUrlRes.fileList[0].tempFileURL) {
            fileURL = tempUrlRes.fileList[0].tempFileURL;
          }
        }
      }
      
      if (!fileURL) {
        throw new Error('获取文件URL失败');
      }
      
      // 显示加载提示
      wx.showLoading({
        title: '提交分析任务...',
        mask: true
      });
      
      // 使用直接操作数据库的方式更新状态为"分析中"
      // 这样即使云函数返回超时错误，文件状态也已设置为分析中
      try {
        const db = wx.cloud.database();
        await db.collection('bp_files').doc(this.data.fileId).update({
          data: {
            status: 'analyzing',
            analysisStartTime: db.serverDate()
          }
        });
        logger.info('文件状态已更新为分析中');
      } catch (dbErr) {
        logger.warn('更新文件状态失败，但将继续提交分析任务', dbErr);
      }
      
      // 尝试使用较长的超时时间提交分析任务
      try {
        const startResult = await wx.cloud.callFunction({
          name: 'analyzeBPWithCoze',
          data: {
            fileURL,
            useJson: false,
            outputFormat: 'markdown',
            fileId: this.data.fileId,
            startOnly: true
          },
          config: { timeout: 30000 } // 30秒超时
        });
        
        // 隐藏启动任务的加载提示
        wx.hideLoading();
        
        if (startResult.result && startResult.result.code === 200) {
          logger.info('BP分析任务已提交', startResult.result);
          
          // 设置分析状态为进行中，并开始轮询
          this.setData({
            analysisTaskId: startResult.result.data.taskId,
            analysisStage: '分析进行中',
            analysisProgress: 30
          });
          
          // 提示用户
          this._showToast('success', '分析任务已提交，正在处理中');
          
          // 开始轮询任务状态
          this._pollAnalysisStatus();
        } else {
          throw new Error(startResult.result?.message || '提交分析任务失败');
        }
      } catch (callError) {
        // 如果是超时错误，但文件状态已更新为分析中，则继续处理
        if (callError.errMsg && callError.errMsg.includes('timed out')) {
          logger.warn('提交分析任务超时，但任务可能已在后台开始处理', callError);
          
          // 隐藏加载提示
          wx.hideLoading();
          
          // 设置分析状态为进行中，并开始轮询
          this.setData({
            analysisStage: '分析进行中',
            analysisProgress: 30
          });
          
          // 提示用户
          this._showToast('info', '任务已提交，服务器正在后台处理');
          
          // 开始轮询任务状态
          this._pollAnalysisStatus();
        } else {
          // 其他错误则正常抛出
          throw callError;
        }
      }
    } catch (error) {
      // 停止模拟进度
      clearInterval(this.analysisProgressInterval);
      
      // 隐藏可能存在的加载提示
      wx.hideLoading();

      logger.error('提交分析任务失败', error);
      this.setData({
        analyzing: false,
        error: error.message || '提交分析任务失败，请重试'
      });
      this._showToast('error', error.message || '提交分析任务失败，请重试');
    }
  },

  // 轮询分析状态
  async _pollAnalysisStatus() {
    if (!this.data.fileId || !this.data.analyzing) {
      return;
    }
    
    // 避免重复设置轮询
    if (this.statusPollingTimeout) {
      clearTimeout(this.statusPollingTimeout);
    }
    
    try {
      // 查询分析状态
      const statusRes = await wx.cloud.callFunction({
        name: 'getBPDetail',
        data: { id: this.data.fileId },
        config: { timeout: 10000 } // 10秒超时
      });
      
      if (statusRes.result && statusRes.result.code === 200) {
        const fileData = statusRes.result.data;
        
        // 检查分析状态
        if (fileData.status === 'analyzed' && fileData.analysisResults) {
          // 分析已完成
          logger.info('BP分析已完成', fileData);
          
          // 停止模拟进度和轮询
          clearInterval(this.analysisProgressInterval);
          
          this.setData({
            analyzing: false,
            analysisProgress: 100,
            analysisStage: '分析完成',
            showAnalysisResult: true,
            analysisResult: fileData.analysisResults
          });
          
          this._showToast('success', '分析完成');
          
          // 跳转到分析详情页
          setTimeout(() => {
            wx.navigateTo({
              url: `/pages/analysis-detail/analysis-detail?id=${this.data.fileId}&direct=true`
            });
          }, 1500);
          
          return;
        } else if (fileData.status === 'failed') {
          // 分析失败
          throw new Error(fileData.error || '分析失败');
        } else {
          // 分析仍在进行中，继续轮询
          let progress = this.data.analysisProgress;
          if (progress < 90) {
            progress += 2; // 每次增加一点进度，但速度减慢
          }
          
          this.setData({
            analysisProgress: progress
          });
          
          // 设置下一次轮询
          this.statusPollingTimeout = setTimeout(() => {
            this._pollAnalysisStatus();
          }, 8000); // 8秒轮询一次，减少API调用频率
        }
      } else {
        throw new Error(statusRes.result?.message || '查询分析状态失败');
      }
    } catch (error) {
      logger.error('轮询分析状态失败', error);
      
      // 如果连续失败超过3次，则停止轮询
      this.pollingFailCount = (this.pollingFailCount || 0) + 1;
      
      if (this.pollingFailCount >= 3) {
        clearInterval(this.analysisProgressInterval);
        this.setData({
          analyzing: false,
          error: '查询分析状态失败，请稍后在「历史记录」中查看结果'
        });
        this._showToast('error', '查询分析状态失败');
      } else {
        // 继续轮询，但增加间隔
        this.statusPollingTimeout = setTimeout(() => {
          this._pollAnalysisStatus();
        }, 12000); // 失败后延长轮询间隔到12秒
      }
    }
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
          uploadProgress: progress
        });
      }, 200);
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
    
    this.setData({
      fileList: [],
      uploadProgress: 0,
      uploading: false,
      uploadSuccess: false,
      analyzing: false,
      analysisProgress: 0,
      analysisStage: '准备分析',
      error: '',
      fileId: null,
      showAnalysisResult: false,
      analysisResult: null
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
  }
}) 