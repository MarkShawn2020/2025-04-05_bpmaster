import { logger } from '../../utils/logger';
import { chooseFile, isValidBPFile, formatFileSize } from '../../utils/file';
import { apiService } from '../../services/api';
import Toast from '../../components/toast/toast';
import { formatDate, getFileTypeByName } from '../../utils/fileUtils';
import { uploadFile } from '../../services/fileService';
import { sleep, markdownToHtml } from '../../utils/util';

Page({
  data: {
    fileList: [],
    selectedCount: 0,
    uploading: false,
    uploadProgress: 0,
    uploadSuccess: false,
    analyzing: false,
    analysisProgress: 0,
    analysisStage: '正在分析文档',
    error: '',
    showUploadBtn: true,
    showResetBtn: false,
    showAnalysisResult: false,
    analysisResult: null,
  },

  onLoad: function() {
    this.toast = this.selectComponent('#toast');
    console.log('[onLoad] 上传页面加载完成');
  },

  /**
   * 选择文件
   */
  handleChooseFile: function() {
    console.log('[handleChooseFile] 用户点击选择文件');
    
    wx.chooseMessageFile({
      count: 10,
      type: 'file',
      extension: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt'],
      success: (res) => {
        console.log('[handleChooseFile] 用户已选择文件', res.tempFiles.length);
        
        const selectedFiles = res.tempFiles;
        let newFileList = [...this.data.fileList];
        let duplicateCount = 0;
        
        // 检查重复文件
        selectedFiles.forEach(file => {
          // 判断文件是否已存在
          const fileExists = newFileList.some(
            existingFile => existingFile.name === file.name && existingFile.size === file.size
          );
          
          if (!fileExists) {
            // 文件类型
            const fileExtension = file.name.split('.').pop().toLowerCase();
            let fileType = 'doc';
            
            if (fileExtension === 'pdf') {
              fileType = 'pdf';
            } else if (['doc', 'docx'].includes(fileExtension)) {
              fileType = 'doc';
            } else if (['ppt', 'pptx'].includes(fileExtension)) {
              fileType = 'ppt';
            } else if (fileExtension === 'txt') {
              fileType = 'txt';
            }
            
            // 格式化文件大小
            const formattedSize = this.formatFileSize(file.size);
            
            // 格式化上传时间
            const now = new Date();
            const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            // 添加到文件列表
            newFileList.push({
              ...file,
              type: fileType,
              size: formattedSize,
              time: time,
              selected: true,
            });
          } else {
            duplicateCount++;
          }
        });
        
        // 更新文件列表和选中数量
        const selectedCount = newFileList.filter(file => file.selected).length;
        
        this.setData({
          fileList: newFileList,
          selectedCount,
        });
        
        // 如果有重复文件，提示用户
        if (duplicateCount > 0) {
          this.toast.show({
            icon: 'warn',
            content: `已跳过 ${duplicateCount} 个重复文件`,
          });
        }
      },
      fail: (err) => {
        console.warn('[handleChooseFile] 选择文件失败', err);
        if (err.errMsg !== 'chooseMessageFile:fail cancel') {
          this.toast.show({
            icon: 'error',
            content: '选择文件失败，请重试',
          });
        }
      }
    });
  },

  /**
   * 处理文件选择状态切换
   */
  toggleFileSelection: function(e) {
    const index = e.currentTarget.dataset.index;
    const fileList = [...this.data.fileList];
    fileList[index].selected = !fileList[index].selected;
    
    const selectedCount = fileList.filter(file => file.selected).length;
    
    this.setData({
      fileList,
      selectedCount,
    });
  },

  /**
   * 删除文件
   */
  removeFile: function(e) {
    const index = e.currentTarget.dataset.index;
    const fileList = [...this.data.fileList];
    fileList.splice(index, 1);
    
    const selectedCount = fileList.filter(file => file.selected).length;
    
    this.setData({
      fileList,
      selectedCount,
    });
  },

  /**
   * 重置上传状态
   */
  handleReset: function() {
    console.log('[handleReset] 用户重置上传状态');
    this.setData({
      fileList: [],
      selectedCount: 0,
      uploading: false,
      uploadProgress: 0,
      uploadSuccess: false,
      analyzing: false,
      analysisProgress: 0,
      error: '',
      showAnalysisResult: false,
      analysisResult: null,
    });
  },

  /**
   * 上传文件
   */
  handleUploadFile: function() {
    console.log('[handleUploadFile] 用户点击上传文件');
    
    // 检查是否有选中的文件
    const selectedFiles = this.data.fileList.filter(file => file.selected);
    if (selectedFiles.length === 0) {
      this.toast.show({
        icon: 'error',
        content: '请至少选择一个文件',
      });
      return;
    }
    
    // 开始上传
    this.setData({
      uploading: true,
      uploadProgress: 0,
      error: '',
    });
    
    // 模拟上传进度
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(progressInterval);
        
        // 模拟上传完成
        setTimeout(() => {
          // 为选中的文件添加fileId
          const fileList = this.data.fileList.map(file => {
            if (file.selected) {
              return {
                ...file,
                fileId: this.generateFileId(),
                uploadTime: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
              };
            }
            return file;
          });
          
          this.setData({
            uploading: false,
            uploadProgress: 0,
            uploadSuccess: true,
            fileList,
          });
          
          console.log('[handleUploadFile] 文件上传成功');
        }, 500);
      } else {
        this.setData({
          uploadProgress: progress,
        });
      }
    }, 300);
  },

  /**
   * 分析文件
   */
  handleAnalyzeFile: function() {
    console.log('[handleAnalyzeFile] 用户点击分析文件');
    
    // 检查是否有上传成功的文件
    const uploadedFiles = this.data.fileList.filter(file => file.fileId);
    if (uploadedFiles.length === 0) {
      this.toast.show({
        icon: 'error',
        content: '没有可分析的文件',
      });
      return;
    }
    
    // 开始分析
    this.setData({
      analyzing: true,
      analysisProgress: 0,
      analysisStage: '正在解析文档内容',
    });
    
    // 模拟分析进度
    this.simulateAnalysisProgress();
  },

  /**
   * 模拟分析进度
   */
  simulateAnalysisProgress: function() {
    let progress = 0;
    const stages = [
      { progress: 0, stage: '正在解析文档内容' },
      { progress: 20, stage: '分析商业模式和市场定位' },
      { progress: 40, stage: '评估财务计划可行性' },
      { progress: 60, stage: '分析团队背景和优势' },
      { progress: 80, stage: '生成综合评估报告' }
    ];
    
    let currentStageIndex = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 2;
      
      // 更新分析阶段
      if (progress > stages[currentStageIndex].progress && currentStageIndex < stages.length - 1) {
        currentStageIndex++;
        this.setData({
          analysisStage: stages[currentStageIndex].stage
        });
      }
      
      if (progress >= 100) {
        progress = 100;
        clearInterval(progressInterval);
        
        // 模拟分析完成，导航到分析结果页面
        setTimeout(() => {
          console.log('[simulateAnalysisProgress] 文件分析完成，导航到结果页面');
          
          // 用户体验提升：分析完成后直接跳转到分析结果页面，而不是在当前页面展示
          const fileIds = this.data.fileList
            .filter(file => file.fileId)
            .map(file => file.fileId)
            .join(',');
            
          wx.navigateTo({
            url: `/pages/analysis-result/analysis-result?fileIds=${fileIds}`,
            success: () => {
              // 导航成功后重置状态，方便用户再次上传
              this.setData({
                uploading: false,
                uploadSuccess: false,
                analyzing: false,
                analysisProgress: 0,
              });
            }
          });
        }, 1000);
      } else {
        this.setData({
          analysisProgress: progress,
        });
      }
    }, 150);
  },

  /**
   * 生成随机文件ID
   */
  generateFileId: function() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  },

  /**
   * 格式化文件大小
   */
  formatFileSize: function(size) {
    if (size < 1024) {
      return size + 'B';
    } else if (size < 1024 * 1024) {
      return (size / 1024).toFixed(2) + 'KB';
    } else {
      return (size / (1024 * 1024)).toFixed(2) + 'MB';
    }
  },

  onShareAppMessage() {
    return {
      title: 'BP小诸葛 - 商业计划书智能评估专家',
      path: '/pages/index/index',
      imageUrl: '/assets/images/share.png'
    };
  }
}) 