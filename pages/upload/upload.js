import { logger } from '../../utils/logger';
import { chooseFile, isValidBPFile, formatFileSize } from '../../utils/file';
import { apiService } from '../../services/api';
import Toast from '../../components/toast/toast';
import { formatDate, getFileTypeByName } from '../../utils/fileUtils';
import { uploadFile } from '../../services/fileService';
import { sleep, markdownToHtml } from '../../utils/util';

Page({
  data: {
    fileList: [], // 多文件列表
    selectedCount: 0, // 选中的文件数量
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
  },

  // 更新选中文件计数
  _updateSelectedCount() {
    const selectedCount = this.data.fileList.filter(file => file.selected).length;
    this.setData({ selectedCount });
  },

  // 选择文件
  async handleChooseFile() {
    try {
      logger.info('开始选择文件...');
      const file = await chooseFile();
      logger.info('选择文件成功', {name: file.name, size: file.size, type: file.name.split('.').pop().toLowerCase()});

      // 检查是否已存在相同文件
      const existingIndex = this.data.fileList.findIndex(item => item.name === file.name);
      if (existingIndex !== -1) {
        // 替换已有文件
        let newFileList = [...this.data.fileList];
        newFileList[existingIndex] = {
          name: file.name,
          size: formatFileSize(file.size),
          path: file.path,
          time: new Date().toLocaleString(),
          type: file.name.split('.').pop().toLowerCase(),
          selected: true,
          originalFile: file
        };
        this.setData({
          fileList: newFileList,
          uploadSuccess: false,
          error: ''
        }, () => {
          this._updateSelectedCount();
        });
      } else {
        // 添加新文件
        this.setData({
          fileList: [...this.data.fileList, {
            name: file.name,
            size: formatFileSize(file.size),
            path: file.path,
            time: new Date().toLocaleString(),
            type: file.name.split('.').pop().toLowerCase(),
            selected: true,
            originalFile: file
          }],
          uploadSuccess: false,
          error: ''
        }, () => {
          this._updateSelectedCount();
        });
      }
    } catch (error) {
      logger.error('选择文件失败', error);
      // 显示更具体的错误信息
      if (error.errMsg && error.errMsg.includes('cancel')) {
        // 用户取消选择
        this.toast.info('已取消选择文件');
      } else {
        this.toast.error('选择文件失败，请确保微信聊天记录中有PDF文件');
      }
    }
  },

  // 切换文件选择状态
  toggleFileSelection(e) {
    const index = e.currentTarget.dataset.index;
    let fileList = [...this.data.fileList];
    fileList[index].selected = !fileList[index].selected;
    this.setData({ fileList }, () => {
      this._updateSelectedCount();
    });
  },

  // 删除文件
  removeFile(e) {
    const index = e.currentTarget.dataset.index;
    let fileList = [...this.data.fileList];
    fileList.splice(index, 1);
    this.setData({ fileList }, () => {
      this._updateSelectedCount();
    });
  },

  // 上传文件
  async handleUploadFile() {
    // 检查是否有选中的文件
    const selectedFiles = this.data.fileList.filter(file => file.selected);
    if (selectedFiles.length === 0) {
      this.toast.error('请选择至少一个文件');
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

      // 实际上传文件 - 这里只上传选中的文件
      const uploadPromises = selectedFiles.map(file => {
        return apiService.uploadBP({
          name: file.name,
          path: file.path
        });
      });

      const results = await Promise.all(uploadPromises);
      logger.info('文件上传成功', results);

      // 停止模拟进度
      clearInterval(this.uploadProgressInterval);

      this.setData({
        uploading: false,
        uploadProgress: 100,
        uploadSuccess: true,
        fileIds: results.map(result => result.fileId)
      });

      this.toast.success('上传成功');

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
      this.toast.error('上传失败');
    }
  },

  // 分析文件
  async handleAnalyzeFile() {
    if (!this.data.fileIds || this.data.fileIds.length === 0 || this.data.analyzing) {
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

      // 实际分析文件 - 传入文件ID列表进行分析
      const result = await this._mockAnalyzeBP(this.data.fileIds);

      logger.info('文件分析成功', result);

      // 停止模拟进度
      clearInterval(this.analysisProgressInterval);

      this.setData({
        analyzing: false,
        analysisProgress: 100,
        analysisStage: '分析完成',
        analysisResult: result,
        showAnalysisResult: true
      });

      this.toast.success('分析完成');
    } catch (error) {
      // 停止模拟进度
      clearInterval(this.analysisProgressInterval);

      logger.error('文件分析失败', error);
      this.setData({
        analyzing: false,
        error: error.message || '分析失败，请重试'
      });
      this.toast.error('分析失败');
    }
  },

  // Mock分析BP文件 - 模拟API调用
  _mockAnalyzeBP(fileIds) {
    return new Promise((resolve) => {
      // 模拟分析延时
      setTimeout(() => {
        // 生成示例分析结果
        const result = {
          id: 'mock-analysis-' + Date.now(),
          summary: '# BP分析摘要\n\n您上传的商业计划书总体质量良好，详细阐述了业务模型和市场机会，但在财务预测和竞争分析方面有提升空间。\n\n## 主要优势\n\n- 产品概念创新，解决了明确的市场痛点\n- 目标市场规模大，且有持续增长趋势\n- 团队背景较强，具备相关行业经验\n\n## 需要改进\n\n- 财务预测缺乏详细的成本结构分析\n- 竞争壁垒描述不够具体\n- 销售渠道策略可进一步细化',
          
          detailedAnalysis: {
            businessModel: {
              score: 85,
              strength: '- 商业模式清晰，收入来源多元化\n- 客户获取成本与客户终身价值比例合理',
              weakness: '- 盈利能力尚待验证\n- 可扩展性考虑不足',
              recommendations: '建议提供更多关于单位经济性的详细数据，并说明规模化后的成本优势'
            },
            market: {
              score: 80,
              strength: '- 目标市场规模达到100亿级别\n- 用户需求明确，痛点突出',
              weakness: '- 市场竞争情况分析不够深入\n- 市场进入策略过于笼统',
              recommendations: '建议详细分析3-5个主要竞争对手，并精确说明差异化优势'
            },
            team: {
              score: 90,
              strength: '- 核心团队具备相关行业背景\n- 技术与商业能力互补',
              weakness: '- 高管团队经验相对集中，缺乏多元化视角',
              recommendations: '考虑引入具有销售或市场经验的合伙人以增强团队综合能力'
            },
            financials: {
              score: 75,
              strength: '- 收入增长预期合理\n- 资金使用计划明确',
              weakness: '- 成本结构分析不足\n- 资本支出预测缺乏详细说明',
              recommendations: '建议提供更详细的月度现金流预测和成本构成分析'
            }
          },
          
          overallScore: 82.5,
          
          recommendations: '# 改进建议\n\n1. **完善财务模型**：在商业计划书中增加详细的单位经济学分析，包括用户获取成本(CAC)与终身价值(LTV)的比较\n\n2. **增强竞争分析**：针对主要竞争对手进行SWOT分析，明确说明您的产品/服务的核心竞争力\n\n3. **细化执行策略**：提供更具体的市场进入策略，包括具体的营销渠道、预算及预期效果\n\n4. **提升风险管理**：增加风险识别与应对章节，展示团队对潜在问题的预见性\n\n5. **优化投资者价值主张**：更清晰地阐述投资回报周期和退出策略',
          
          timestamp: new Date().toISOString()
        };
        
        resolve(result);
      }, 3000); // 模拟3秒钟的分析时间
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
      this.toast.error('预览失败');
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
      selectedCount: 0,
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
  }
}) 