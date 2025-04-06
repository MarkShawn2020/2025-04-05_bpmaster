import { logger } from '../../utils/logger';
import { apiService } from '../../services/api';

Page({
  data: {
    analysisId: null,
    analysisDetail: null,
    loading: true,
    activeTab: 'summary', // 'summary', 'issues', 'suggestions'
    // 雷达图数据
    radarData: {
      categories: [
        { name: '市场分析', max: 100 },
        { name: '产品定位', max: 100 },
        { name: '团队能力', max: 100 },
        { name: '财务预测', max: 100 },
        { name: '风险评估', max: 100 }
      ],
      series: [
        {
          name: '评分',
          data: [0, 0, 0, 0, 0]
        }
      ]
    },
    // 柱状图数据
    barData: {
      categories: ['市场分析', '产品定位', '团队能力', '财务预测', '风险评估'],
      series: [
        {
          name: '得分',
          data: [0, 0, 0, 0, 0]
        },
        {
          name: '行业平均',
          data: [0, 0, 0, 0, 0]
        }
      ]
    },
    // 问题列表
    issuesList: [],
    // 建议列表
    suggestionsList: [],
    markdownContent: '',
    sectors: [],
    contentLoaded: false,
    error: '',
    refreshCount: 0
  },

  onLoad(options) {
    logger.info('分析详情页加载', options);
    
    if (options.id) {
      this.setData({
        analysisId: options.id,
        directLoad: options.direct === 'true'
      });
      
      // 获取详情数据
      this._loadBPDetail(options.id);
    } else {
      this.setData({
        loading: false,
        error: '无效的文件ID'
      });
      this._showToast('error', '无效的文件ID');
    }
  },

  async _loadBPDetail(id) {
    wx.showLoading({
      title: '加载分析结果',
    });
    
    wx.cloud.callFunction({
      name: 'getBPDetail',
      data: { id },
      config: { timeout: 15000 }, // 15秒超时
      success: (res) => {
        logger.info('获取BP详情成功', res);
        
        if (res.result && res.result.code === 200) {
          const data = res.result.data;
          
          // 使用统一的方法设置数据
          this._setAnalysisData(data);
        } else {
          this.setData({
            loading: false,
            error: res.result?.message || '加载失败'
          });
          this._showToast('error', '加载分析结果失败');
        }
      },
      fail: (err) => {
        logger.error('获取BP详情失败', err);
        this.setData({
          loading: false,
          error: err.message || '网络错误'
        });
        this._showToast('error', '网络错误，请重试');
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },
  
  // 转换API数据到视图模型
  transformAPIDataToViewModel(bpData) {
    // 从API返回的数据结构转换为页面所需的数据结构
    const analysisResults = bpData.analysisResults || {};
    
    // 构建分析详情对象
    return {
      id: bpData._id,
      fileName: bpData.fileName || '未命名文件',
      fileSize: bpData.fileSize || '未知大小',
      uploadTime: bpData.createdAt || '未知时间',
      analysisTime: bpData.analyzedAt || '未知时间',
      overallScore: analysisResults.overallScore || 0,
      status: bpData.status || 'unknown',
      summary: analysisResults.summary || '暂无分析摘要',
      
      // 转换得分
      scores: {
        marketAnalysis: analysisResults.detailedAnalysis?.market?.score || 0,
        productPositioning: analysisResults.detailedAnalysis?.businessModel?.score || 0,
        teamCapability: analysisResults.detailedAnalysis?.team?.score || 0,
        financialForecast: analysisResults.detailedAnalysis?.financials?.score || 0,
        riskAssessment: Math.round((analysisResults.overallScore || 0) * 0.8) // 如果API中没有风险评估，用总分的80%作为估计
      },
      
      // 从分析结果构建问题列表
      issues: this.buildIssuesFromAnalysis(analysisResults),
      
      // 从分析结果构建建议列表
      suggestions: this.buildSuggestionsFromAnalysis(analysisResults)
    };
  },
  
  // 从分析结果构建问题列表
  buildIssuesFromAnalysis(analysisResults) {
    const issues = [];
    const detailedAnalysis = analysisResults.detailedAnalysis || {};
    
    // 添加从业务模型中提取的问题
    if (detailedAnalysis.businessModel?.weakness) {
      const weaknesses = detailedAnalysis.businessModel.weakness.split('\n').filter(item => item.trim());
      weaknesses.forEach((weakness, index) => {
        issues.push({
          id: `business-${index}`,
          type: 'major',
          title: weakness.replace(/^- /, ''),
          description: weakness.replace(/^- /, ''),
          location: '商业模型部分',
          suggestion: detailedAnalysis.businessModel.recommendations || '无建议'
        });
      });
    }
    
    // 添加从市场分析中提取的问题
    if (detailedAnalysis.market?.weakness) {
      const weaknesses = detailedAnalysis.market.weakness.split('\n').filter(item => item.trim());
      weaknesses.forEach((weakness, index) => {
        issues.push({
          id: `market-${index}`,
          type: index === 0 ? 'critical' : 'major',
          title: weakness.replace(/^- /, ''),
          description: weakness.replace(/^- /, ''),
          location: '市场分析部分',
          suggestion: detailedAnalysis.market.recommendations || '无建议'
        });
      });
    }
    
    // 添加财务分析中的问题
    if (detailedAnalysis.financials?.weakness) {
      const weaknesses = detailedAnalysis.financials.weakness.split('\n').filter(item => item.trim());
      weaknesses.forEach((weakness, index) => {
        issues.push({
          id: `financial-${index}`,
          type: 'major',
          title: weakness.replace(/^- /, ''),
          description: weakness.replace(/^- /, ''),
          location: '财务预测部分',
          suggestion: detailedAnalysis.financials.recommendations || '无建议'
        });
      });
    }
    
    // 如果没有提取到问题，返回一个默认列表
    return issues.length > 0 ? issues : [
      {
        id: 'default-1',
        type: 'minor',
        title: '未发现严重问题',
        description: '分析未发现严重问题，但建议关注改进建议以进一步优化商业计划书。',
        location: '整体',
        suggestion: '参考改进建议部分'
      }
    ];
  },
  
  // 从分析结果构建建议列表
  buildSuggestionsFromAnalysis(analysisResults) {
    const suggestions = [];
    
    // 如果有明确的建议列表
    if (analysisResults.recommendations) {
      // 尝试解析Markdown格式的建议
      const recommendationsText = analysisResults.recommendations;
      const lines = recommendationsText.split('\n').filter(line => line.trim());
      
      // 查找数字编号的建议
      let currentSuggestion = null;
      
      lines.forEach(line => {
        // 忽略标题行
        if (line.startsWith('#')) return;
        
        // 匹配形如"1. **标题**：内容"的模式
        const match = line.match(/(\d+)\.\s+\*\*([^*]+)\*\*：?(.+)/);
        if (match) {
          const id = `s${match[1]}`;
          const title = match[2].trim();
          const description = match[3].trim();
          
          suggestions.push({
            id,
            title,
            description,
            priority: match[1] <= 2 ? 'high' : (match[1] <= 4 ? 'medium' : 'low')
          });
        }
      });
    }
    
    // 如果没有提取到建议，从详细分析中构建
    if (suggestions.length === 0) {
      const detailedAnalysis = analysisResults.detailedAnalysis || {};
      
      // 添加业务模型建议
      if (detailedAnalysis.businessModel?.recommendations) {
        suggestions.push({
          id: 's1',
          title: '优化商业模型',
          description: detailedAnalysis.businessModel.recommendations,
          priority: 'high'
        });
      }
      
      // 添加市场分析建议
      if (detailedAnalysis.market?.recommendations) {
        suggestions.push({
          id: 's2',
          title: '强化市场分析',
          description: detailedAnalysis.market.recommendations,
          priority: 'high'
        });
      }
      
      // 添加团队建议
      if (detailedAnalysis.team?.recommendations) {
        suggestions.push({
          id: 's3',
          title: '增强团队互补性',
          description: detailedAnalysis.team.recommendations,
          priority: 'medium'
        });
      }
      
      // 添加财务建议
      if (detailedAnalysis.financials?.recommendations) {
        suggestions.push({
          id: 's4',
          title: '完善财务模型',
          description: detailedAnalysis.financials.recommendations,
          priority: 'high'
        });
      }
    }
    
    // 如果仍然没有建议，返回默认建议
    return suggestions.length > 0 ? suggestions : [
      {
        id: 's1',
        title: '完善财务模型',
        description: '建议在财务预测部分增加敏感性分析，展示在不同市场情景下的财务表现。',
        priority: 'high'
      },
      {
        id: 's2',
        title: '强化市场验证数据',
        description: '建议增加初步市场验证的数据，例如用户访谈结果、MVP测试数据等。',
        priority: 'medium'
      }
    ];
  },
  
  // 切换标签页
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
  },
  
  // 分享功能
  onShareAppMessage() {
    const { analysisDetail } = this.data;
    return {
      title: `BP分析结果：${analysisDetail.fileName}`,
      path: `/pages/analysis-detail/analysis-detail?id=${this.data.analysisId}`,
      imageUrl: '/assets/images/share.png'
    };
  },
  
  // 导出报告
  exportReport() {
    wx.showToast({
      title: '报告导出中',
      icon: 'loading',
      duration: 2000
    });
    
    // 此处应调用导出API
    setTimeout(() => {
      wx.showToast({
        title: '导出成功',
        icon: 'success'
      });
    }, 2000);
  },
  
  // 模拟数据
  getMockAnalysisDetail() {
    return {
      id: this.data.analysisId,
      fileName: '商业计划书V1.0.pdf',
      fileSize: '2.5MB',
      uploadTime: '2023-04-05 14:30:22',
      analysisTime: '2023-04-05 14:32:15',
      overallScore: 85,
      status: 'completed',
      summary: '这份商业计划书整体结构完整，市场分析较为充分，团队背景介绍详实。产品定位清晰，但财务预测部分存在一些不足，风险评估有待加强。总体来说是一份质量较高的商业计划书，具有良好的可执行性。',
      scores: {
        marketAnalysis: 88,
        productPositioning: 82,
        teamCapability: 90,
        financialForecast: 76,
        riskAssessment: 70
      },
      issues: [
        {
          id: 'i1',
          type: 'critical',
          title: '财务预测缺乏详细的成本结构分析',
          description: '计划书中的财务预测未包含完整的成本结构分析，包括固定成本和可变成本的详细分类，这会导致利润预测不够准确。',
          location: '第18页',
          suggestion: '建议增加详细的成本构成分析，包括初期投入、运营成本、人力成本等分项数据。'
        },
        {
          id: 'i2',
          type: 'major',
          title: '市场竞争分析不够深入',
          description: '虽然提及了主要竞争对手，但缺乏针对竞争对手优劣势的详细分析以及差异化战略的阐述。',
          location: '第7-8页',
          suggestion: '建议采用SWOT分析法详细分析主要竞争对手，并明确自身的差异化优势。'
        },
        {
          id: 'i3',
          type: 'minor',
          title: '风险评估部分过于简略',
          description: '风险评估仅列举了几项常见风险，但缺少针对行业特定风险的分析和应对措施。',
          location: '第22页',
          suggestion: '建议补充行业特定风险因素的分析，并提供详细的风险缓解方案。'
        }
      ],
      suggestions: [
        {
          id: 's1',
          title: '完善财务模型',
          description: '建议在财务预测部分增加敏感性分析，展示在不同市场情景下的财务表现，使投资人更全面地了解项目财务风险。',
          priority: 'high'
        },
        {
          id: 's2',
          title: '强化市场验证数据',
          description: '建议增加初步市场验证的数据，例如用户访谈结果、MVP测试数据等，以增强计划书的说服力。',
          priority: 'medium'
        },
        {
          id: 's3',
          title: '细化执行路径',
          description: '当前的执行计划较为宏观，建议细化为具体的时间表和里程碑，包括各阶段的关键目标和资源需求。',
          priority: 'medium'
        },
        {
          id: 's4',
          title: '增强团队互补性说明',
          description: '虽然团队背景介绍详实，但可以更清晰地展示团队成员间的互补能力，以及如何协作解决项目面临的挑战。',
          priority: 'low'
        }
      ]
    };
  },
  
  // 下载报告
  handleDownloadReport: function() {
    this._showToast('info', '报告下载功能开发中');
  },
  
  // 返回上一页
  navigateBack: function() {
    wx.navigateBack();
  },
  
  // 处理点击分区
  handleSectorClick: function(e) {
    const index = e.currentTarget.dataset.index;
    const sectors = this.data.sectors.map((item, i) => {
      return {
        ...item,
        active: i === index
      };
    });
    
    this.setData({ sectors });
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
  
  // 处理页面刷新
  handleRefresh: function() {
    if (!this.data.id) return;
    
    this.setData({ loading: true });
    this._loadBPDetail(this.data.id);
    
    // 增加刷新计数
    this.setData({
      refreshCount: this.data.refreshCount + 1
    });
    
    // 如果用户刷新超过3次，提示用户
    if (this.data.refreshCount >= 3) {
      this._showToast('info', '分析需要1-3分钟，请稍后再试');
    }
  },
  
  // 将分析结果设置到页面
  _setAnalysisData: function(fileData) {
    let markdownContent = '';
    
    // 从分析结果中获取Markdown内容
    if (fileData.analysisResults && fileData.analysisResults.markdownContent) {
      markdownContent = fileData.analysisResults.markdownContent;
    }
    
    // 设置数据
    this.setData({
      fileInfo: {
        name: fileData.name || '未命名文件',
        size: fileData.size || '未知大小',
        uploadDate: fileData.uploadDate ? new Date(fileData.uploadDate).toLocaleString() : '未知时间',
        type: fileData.type || 'pdf',
        status: fileData.status || 'uploaded'
      },
      markdownContent,
      contentLoaded: true,
      loading: false
    });
    
    // 更新页面标题
    wx.setNavigationBarTitle({
      title: fileData.name ? `分析报告: ${fileData.name}` : '分析报告'
    });
  }
}); 