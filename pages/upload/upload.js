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
    error: ''
  },

  onLoad(options) {
    logger.info('上传页面加载', options);
    this.toast = this.selectComponent('#toast');
    
    // 确保toast组件初始化
    if (!this.toast) {
      logger.warn('Toast组件未能正确初始化，将使用原生Toast');
    }
  },
  
  // 添加onShow生命周期函数
  onShow() {
    // 检查是否有文件正在分析中，如果有则更新状态
    if (this.data.fileList.length > 0 && this.data.fileList[0].status === 'analyzing') {
      // 获取文件ID
      const fileId = this.data.fileList[0].fileId;
      if (!fileId) return;
      
      logger.info('页面显示，检查文件分析状态', fileId);
      
      // 查询文件分析状态
      apiService.getBPDetail(fileId).then(res => {
        if (res && res.code === 200) {
          const fileData = res.data;
          
          // 更新文件状态
          const file = this.data.fileList[0];
          const updatedFile = { 
            ...file, 
            status: fileData.status || 'completed' // 根据API返回设置状态
          };
          
          this.setData({
            fileList: [updatedFile],
            analyzing: false  // 重置analyzing状态
          });
          
          logger.info('更新文件状态成功', updatedFile);
        }
      }).catch(err => {
        logger.error('获取文件状态失败', err);
        // 出错时也重置analyzing状态，避免永远显示"分析中"
        this.setData({
          analyzing: false
        });
      });
    }
  },

  // 选择文件
  async handleChooseFile() {
    try {
      logger.info('开始选择文件...');
      const file = await chooseFile();
      logger.info('选择文件成功', {name: file.name, size: file.size, type: file.name.split('.').pop().toLowerCase()});

      // 创建新的文件列表（只包含一个文件）
      this.setData({
        fileList: [{
          name: file.name,
          size: formatFileSize(file.size),
          path: file.path,
          time: new Date().toLocaleString(),
          type: file.name.split('.').pop().toLowerCase(),
          originalFile: file
        }],
        uploadSuccess: false,
        error: ''
      });
    } catch (error) {
      logger.error('选择文件失败', error);
      // 显示更具体的错误信息
      if (error.errMsg && error.errMsg.includes('cancel')) {
        // 用户取消选择
        this._showToast('info', '已取消选择文件');
      } else {
        this._showToast('error', '选择文件失败，请确保微信聊天记录中有PDF文件');
      }
    }
  },

  // 导航到文件分析页面
  navigateToFileAnalysis(e) {
    const file = this.data.fileList[0];
    
    logger.info('点击文件，准备跳转到分析页', { name: file.name, fileId: file.fileId });
    
    // 如果文件已上传且有分析结果，直接跳转到分析页
    if (file.fileId) {
      wx.navigateTo({
        url: `/pages/analysis-detail/analysis-detail?id=${file.fileId}&fileName=${encodeURIComponent(file.name)}`,
        fail: (err) => {
          logger.error('导航到分析页失败', err);
          this._showToast('error', '打开分析页失败');
        }
      });
    } else {
      // 如果文件未上传，提示用户先上传
      this._showToast('info', '请先上传文件后查看分析');
    }
  },

  // 删除文件
  removeFile() {
    this.setData({
      fileList: [],
      uploadSuccess: false
    });
  },

  // 上传文件
  async handleUploadFile() {
    // 检查是否有文件
    if (this.data.fileList.length === 0) {
      this._showToast('error', '请选择文件');
      return;
    }

    if (this.data.uploading) {
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
      
      // 实际上传文件
      const result = await apiService.uploadBP({
        name: file.name,
        path: file.path
      });
      
      logger.info('文件上传成功', result);

      // 停止模拟进度
      clearInterval(this.uploadProgressInterval);

      // 更新文件列表，为文件添加 fileId
      const updatedFile = {
        ...file,
        fileId: result.fileId || `mock-file-id-${Date.now()}`,
        uploadTime: new Date().toLocaleString()
      };

      this.setData({
        uploading: false,
        uploadProgress: 100,
        uploadSuccess: true,
        fileList: [updatedFile],
        fileIds: [updatedFile.fileId]
      });

      this._showToast('success', '上传成功');

    } catch (error) {
      // 停止模拟进度
      clearInterval(this.uploadProgressInterval);

      logger.error('文件上传失败', error);
      this.setData({
        uploading: false,
        error: error?.message || '上传失败，请重试'
      });
      
      this._showToast('error', '上传失败');
    }
  },

  /**
   * 分析文件
   */
  handleAnalyzeFile: function() {
    console.log('[handleAnalyzeFile] 用户点击分析文件');
    
    // 检查是否有上传成功的文件
    if (this.data.fileList.length === 0 || !this.data.fileList[0].fileId) {
      this._showToast('error', '没有可分析的文件');
      return;
    }
    
    const file = this.data.fileList[0];
    
    // 确认是否开始分析
    wx.showModal({
      title: '开始分析',
      content: `确定开始分析文件"${file.name}"吗？`,
      confirmText: '开始分析',
      success: (res) => {
        if (res.confirm) {
          // 显示加载提示
          wx.showLoading({
            title: '准备分析...',
            mask: true
          });
          
          // 获取文件ID
          const fileId = file.fileId;
          
          // 调用API开始分析
          apiService.startAnalysis(fileId).then(res => {
            wx.hideLoading();
            
            if (res && res.code === 200) {
              this._showToast('success', '分析任务已提交');
              
              // 更新文件状态为分析中
              const updatedFile = { ...file, status: 'analyzing' };
              this.setData({
                fileList: [updatedFile]
                // 修复：不要设置analyzing为false，这会导致状态不一致
              });
              
              // 导航到分析详情页面
              setTimeout(() => {
                wx.navigateTo({
                  url: `/pages/analysis-detail/analysis-detail?id=${fileId}&fileName=${encodeURIComponent(file.name)}`,
                  fail: (err) => {
                    console.error('导航到分析页失败', err);
                    this._showToast('error', '打开分析页失败');
                  }
                });
              }, 1000);
            } else {
              this._showToast('error', res?.message || '提交分析任务失败');
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('开始分析失败', err);
            this._showToast('error', '分析失败，请稍后再试');
          });
        }
      }
    });
  },

  // 预览分析报告
  async previewReport() {
    if (!this.data.analysisResult) return;
    
    this.setData({ previewLoading: true });
    
    try {
      // 这里模拟生成docx并预览
      await this._mockGenerateAndPreviewDocx();
      
      this.setData({ previewLoading: false });
    } catch (error) {
      logger.error('预览报告失败', error);
      this.setData({ previewLoading: false });
      this._showToast('error', '预览失败');
    }
  },
  
  // 模拟生成并预览docx文件
  _mockGenerateAndPreviewDocx() {
    return new Promise((resolve) => {
      setTimeout(() => {
        // 在实际实现中，这里应该调用云函数生成docx文件
        // 然后获取文件的临时链接进行预览
        wx.showModal({
          title: '文件生成成功',
          content: '在真实环境中，这里会打开一个docx文件预览',
          showCancel: false,
          success: () => {
            resolve();
          }
        });
      }, 2000);
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
        '评估商业模型',
        '分析市场机会',
        '评估团队能力',
        '财务分析',
        '生成综合评估',
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
          Math.floor(progress / 10),
          stages.length - 1
        );

        this.setData({
          analysisProgress: progress,
          analysisStage: stages[stageIndex]
        });
      }, 300);
    }
  },

  // 重新选择文件
  handleReset() {
    this.setData({
      fileList: [],
      uploadProgress: 0,
      uploading: false,
      uploadSuccess: false,
      analyzing: false,
      analysisProgress: 0,
      analysisStage: '准备分析',
      error: '',
      fileIds: null,
      analysisResult: null,
      showAnalysisResult: false
    });
  },

  onShareAppMessage() {
    return {
      title: 'BP小诸葛 - 商业计划书智能评估专家',
      path: '/pages/index/index',
      imageUrl: '/assets/images/share.png'
    };
  },

  // 辅助方法：安全地显示toast
  _showToast(type, message) {
    if (this.toast) {
      // 使用自定义toast组件
      this.toast[type](message);
    } else {
      // 降级为微信原生toast
      const iconMap = {
        success: 'success',
        error: 'error',
        info: 'none',
        loading: 'loading'
      };
      
      wx.showToast({
        title: message,
        icon: iconMap[type] || 'none',
        duration: 2000
      });
    }
  },
}) 