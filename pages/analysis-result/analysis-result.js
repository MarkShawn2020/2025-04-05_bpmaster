Page({
  data: {
    fileIds: [],
    loading: true,
    analysisResult: null,
    activeTab: 'summary',
    tabs: [
      { id: 'summary', name: '摘要' },
      { id: 'details', name: '详细分析' },
      { id: 'recommendations', name: '改进建议' }
    ]
  },

  onLoad: function(options) {
    // 使用console代替wx.getLogger
    console.log('[analysis-result] 页面加载', options);
    this.toast = this.selectComponent('#toast');
    
    if (options.fileIds) {
      const fileIds = options.fileIds.split(',');
      this.setData({ fileIds });
      console.log('[onLoad] 接收到文件ID:', fileIds);
      this.fetchAnalysisResult(fileIds);
    } else {
      this.setData({ 
        loading: false,
        error: '未找到分析的文件'
      });
      this.toast.show({
        icon: 'error',
        content: '未找到分析的文件'
      });
    }
  },

  // 获取分析结果
  fetchAnalysisResult: function(fileIds) {
    // 这里应该调用实际的API服务获取分析结果
    // 目前使用模拟数据
    console.log('[fetchAnalysisResult] 开始获取分析结果');
    
    setTimeout(() => {
      // 模拟API请求延迟
      const mockResult = this.generateMockResult(fileIds[0]);
      
      this.setData({
        loading: false,
        analysisResult: mockResult
      });
      
      console.log('[fetchAnalysisResult] 分析结果获取成功');
    }, 1000);
  },

  // 生成模拟分析结果
  generateMockResult: function(fileId) {
    return {
      id: fileId || 'mock-analysis-' + Date.now(),
      fileName: '商业计划书.pdf',
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
      
      analysisDate: new Date().toLocaleDateString('zh-CN'),
      timestamp: new Date().toISOString()
    };
  },

  // 切换标签页
  handleTabChange: function(e) {
    const tabId = e.currentTarget.dataset.id;
    this.setData({ activeTab: tabId });
  },

  // 下载报告
  handleDownloadReport: function() {
    this.toast.show({
      icon: 'info',
      content: '报告下载功能开发中，请稍后再试'
    });
  },

  // 分享报告
  handleShareReport: function() {
    // 微信小程序的分享功能
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  // 返回上传页
  handleBackToUpload: function() {
    wx.navigateBack();
  },

  // 用于分享的事件处理函数
  onShareAppMessage: function() {
    return {
      title: '商业计划书分析报告 - 得分' + this.data.analysisResult?.overallScore.toFixed(1),
      path: '/pages/index/index',
      imageUrl: '/assets/images/share-image.png'
    };
  }
}); 