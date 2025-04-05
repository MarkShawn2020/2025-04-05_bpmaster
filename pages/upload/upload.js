import { logger } from '../../utils/logger';
import { chooseFile, isValidBPFile, formatFileSize } from '../../utils/file';
import { apiService } from '../../services/api';

Page({
  data: {
    fileInfo: null,
    uploadProgress: 0,
    uploading: false,
    uploadSuccess: false,
    analyzing: false,
    analysisProgress: 0,
    analysisStage: '准备分析',
    error: ''
  },

  onLoad(options) {
    logger.info('上传页面加载', options);
  },

  // 选择文件
  async handleChooseFile() {
    try {
      logger.info('开始选择文件...');
      const file = await chooseFile();
      logger.info('选择文件成功', {name: file.name, size: file.size, type: file.name.split('.').pop().toLowerCase()});

      this.setData({
        fileInfo: {
          name: file.name,
          size: formatFileSize(file.size),
          path: file.path,
          time: new Date().toLocaleString(),
          type: file.name.split('.').pop().toLowerCase()
        },
        uploadSuccess: false,
        error: ''
      });
    } catch (error) {
      logger.error('选择文件失败', error);
      // 显示更具体的错误信息
      if (error.errMsg && error.errMsg.includes('cancel')) {
        // 用户取消选择
        this.selectComponent('#toast').info('已取消选择文件');
      } else {
        this.selectComponent('#toast').error(error.message || '选择文件失败，请确保微信聊天记录中有PDF文件');
      }
    }
  },

  // 上传文件
  async handleUploadFile() {
    if (!this.data.fileInfo || this.data.uploading) {
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

      // 实际上传文件
      const result = await apiService.uploadBP({
        name: this.data.fileInfo.name,
        path: this.data.fileInfo.path
      });

      logger.info('文件上传成功', result);

      // 停止模拟进度
      clearInterval(this.uploadProgressInterval);

      this.setData({
        uploading: false,
        uploadProgress: 100,
        uploadSuccess: true,
        fileId: result.fileId
      });

      this.selectComponent('#toast').success('上传成功');

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
      this.selectComponent('#toast').error(error.message || '上传失败，请重试');
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

      // 实际分析文件
      const result = await apiService.analyzeBP(this.data.fileId);

      logger.info('文件分析成功', result);

      // 停止模拟进度
      clearInterval(this.analysisProgressInterval);

      this.setData({
        analyzing: false,
        analysisProgress: 100,
        analysisStage: '分析完成',
        analysisResult: result
      });

      this.selectComponent('#toast').success('分析完成');

      // 分析完成后跳转到分析结果页
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/analysis/analysis?id=${result.id}`
        });
      }, 1500);
    } catch (error) {
      // 停止模拟进度
      clearInterval(this.analysisProgressInterval);

      logger.error('文件分析失败', error);
      this.setData({
        analyzing: false,
        error: error.message || '分析失败，请重试'
      });
      this.selectComponent('#toast').error(error.message || '分析失败，请重试');
    }
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

  // 重新选择文件
  handleReset() {
    this.setData({
      fileInfo: null,
      uploadProgress: 0,
      uploading: false,
      uploadSuccess: false,
      analyzing: false,
      analysisProgress: 0,
      analysisStage: '准备分析',
      error: '',
      fileId: null,
      analysisResult: null
    });
  },

  onShareAppMessage() {
    return {
      title: 'BP小诸葛 - 商业计划书智能评估专家',
      path: '/pages/index/index',
      imageUrl: '/assets/images/share.png'
    };
  }
}) 