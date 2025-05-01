import { info, error } from '../../utils/logger.js';
import { chooseFile, formatFileSize, getFileType, isSupportedFileType } from '../../utils/file.js';
import { uploadFile } from '../../utils/api.js';
import { toast } from '../../utils/toast.js';
import { formatCurrentTime } from '../../utils/date.js';
import {aiService} from '../../utils/ai.js';

const app = getApp();

Page({
  data: {
    step: 'choose', // choose, uploading, success, error
    file: {
      id: '',
      name: '',
      size: '',
      sizeText: '',
      type: '',
      path: '',
      url: '',
      time: ''
    },
    uploadProgress: 0,
    errorMessage: '',
    isUploading: false,
    reports: {} // 存储报告内容，键为文件ID，值为对应的报告内容
  },

  onLoad: function(options) {
    info('上传页面加载');
  },

  // 检查登录状态
  checkLoginStatus: function() {

    const userInfo = app.globalData.userInfo;
    if (!userInfo || !userInfo.openid) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再上传文件',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/user/user'
            });
          }
        }
      });
      return false;
    }
    return true;
  },

  // 选择文件
  handleChooseFile: function() {
    // 检查登录状态
    if (!this.checkLoginStatus()) {
      return;
    }

    const that = this;
    
    info('选择文件');
    
    chooseFile()
      .then(res => {
        info('选择文件成功', res);
        
        // 检查文件类型
        const fileName = res.name || '未知文件';
        const fileType = getFileType(fileName);
        const fileSize = res.size || 0;
        
        // 检查文件大小（限制20MB）
        if (fileSize > 20 * 1024 * 1024) {
          that.setData({
            step: 'error',
            errorMessage: '文件大小超过限制（20MB），请重新选择'
          });
          that.showToast('文件大小超过限制', 'error');
          return;
        }
        
        // 检查文件类型（支持 PDF, DOC, DOCX, PPT, PPTX, TXT）
        if (!isSupportedFileType(fileType)) {
          that.setData({
            step: 'error',
            errorMessage: '不支持的文件格式，请选择PDF、Word、PPT或TXT文件'
          });
          that.showToast('不支持的文件格式', 'error');
          return;
        }
        
        // 保存文件信息
        that.setData({
          step: 'choose',
          file: {
            name: fileName,
            size: fileSize,
            sizeText: formatFileSize(fileSize),
            type: fileType,
            path: res.path,
            time: formatCurrentTime()
          },
          uploadProgress: 0,
          errorMessage: ''
        });
      })
      .catch(err => {
        error('选择文件失败', err);
        // 用户取消选择不显示错误
        if (err.errMsg && err.errMsg.indexOf('cancel') > -1) {
          return;
        }
        
        that.setData({
          step: 'error',
          errorMessage: '选择文件失败: ' + (err.errMsg || JSON.stringify(err))
        });
        that.showToast('选择文件失败', 'error');
      });
  },
  
  // 上传文件
  handleUploadFile: function() {
    // 检查登录状态
    if (!this.checkLoginStatus()) {
      return;
    }

    if (!this.data.file.path || this.data.isUploading) {
      return;
    }
    
    this.setData({
      isUploading: true,
      step: 'uploading',
      uploadProgress: 0
    });
    
    info('开始上传文件', {
      fileName: this.data.file.name,
      fileSize: this.data.file.size
    });
    
    // 调用实际上传API
    uploadFile(this.data.file.path, this.data.file.name)
      .then(res => {
        info('文件上传成功', res);
        
        // 更新文件id和url
        this.setData({
          'file.id': res.fileId || '',
          'file.url': res.fileUrl || '',
          isUploading: false,
          step: 'success',
          uploadProgress: 100
        });
        
        this.showToast('文件上传成功', 'success');
      })
      .catch(err => {
        error('文件上传失败', err);
        
        this.setData({
          isUploading: false,
          step: 'error',
          errorMessage: '文件上传失败: ' + (err.errMsg || JSON.stringify(err))
        });
        
        this.showToast('文件上传失败', 'error');
      });
  },
  
  // 开始分析
  handleStartAnalysis: function() {
    // 检查登录状态
    if (!this.checkLoginStatus()) {
      return;
    }

    info('开始分析', { fileId: this.data.file.id, fileName: this.data.file.name });

    aiService.callCozeWorkflow({
      fileUrl: this.data.file.url,
      onChunk: (chunk) => {
        // 使用setData更新reports对象
        const fileId = this.data.file.id;
        const currentReport = this.data.reports[fileId] || '';
        const updatedReport = currentReport + chunk;
        
        // 构建更新对象
        const reportUpdate = {};
        reportUpdate[`reports.${fileId}`] = updatedReport;
        
        // 使用setData更新
        this.setData(reportUpdate);

      },
      onComplete: () => {
        this.setData({
          step: 'success',
          uploadProgress: 100
        });
      },
      onError: (err) => {
        error('文件分析失败', err);
        this.setData({
          step: 'error',
          errorMessage: '文件分析失败: ' + (err.errMsg || JSON.stringify(err))
        });
        this.showToast('文件分析失败', 'error');
      }
    });
    
    // 跳转到分析结果页
    wx.navigateTo({
      url: `/pages/analysis-result/analysis-result?fileId=${this.data.file.id}&analysisId=`,
      success: () => {
        info('跳转到分析结果页成功');
      },
      fail: (err) => {
        error('跳转到分析结果页失败', err);
        this.showToast('跳转失败，请重试', 'error');
      }
    });
  },
  
  // 重新选择
  handleReset: function() {
    this.setData({
      step: 'choose',
      file: {
        id: '',
        name: '',
        size: '',
        sizeText: '',
        type: '',
        path: '',
        url: '',
        time: ''
      },
      uploadProgress: 0,
      errorMessage: '',
      isUploading: false
    });
    
    if (this.progressTimer) {
      clearTimeout(this.progressTimer);
    }
  },
  
  // 查看历史
  handleViewHistory: function() {
    wx.navigateTo({
      url: '/pages/history/history'
    });
  },
  
  // 显示Toast
  showToast: function(message, type = 'info') {
    // 直接使用导入的toast模块
    if (type === 'success') {
      toast.success(message);
    } else if (type === 'error') {
      toast.error(message);
    } else {
      toast.info(message);
    }
  },
  
  onUnload: function() {
    // 清除计时器
    if (this.progressTimer) {
      clearTimeout(this.progressTimer);
      this.progressTimer = null;
    }
  }
}); 