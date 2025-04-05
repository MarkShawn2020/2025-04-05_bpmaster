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
    suggestionsList: []
  },

  onLoad(options) {
    const { id } = options;
    
    if (!id) {
      wx.showToast({
        title: '参数错误',
        icon: 'error'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    this.setData({
      analysisId: id
    });

    this.loadAnalysisDetail();
  },

  async loadAnalysisDetail() {
    try {
      this.setData({ loading: true });
      logger.info('加载分析详情', { id: this.data.analysisId });

      // 实际项目中应从API获取数据
      // const analysisDetail = await apiService.getAnalysisDetail(this.data.analysisId);
      
      // 模拟数据
      const analysisDetail = this.getMockAnalysisDetail();
      
      // 更新雷达图数据
      const radarData = {
        ...this.data.radarData,
        series: [
          {
            name: '评分',
            data: [
              analysisDetail.scores.marketAnalysis,
              analysisDetail.scores.productPositioning,
              analysisDetail.scores.teamCapability,
              analysisDetail.scores.financialForecast,
              analysisDetail.scores.riskAssessment
            ]
          }
        ]
      };
      
      // 更新柱状图数据
      const barData = {
        ...this.data.barData,
        series: [
          {
            name: '得分',
            data: [
              analysisDetail.scores.marketAnalysis,
              analysisDetail.scores.productPositioning,
              analysisDetail.scores.teamCapability,
              analysisDetail.scores.financialForecast,
              analysisDetail.scores.riskAssessment
            ]
          },
          {
            name: '行业平均',
            data: [75, 68, 82, 70, 65]
          }
        ]
      };
      
      this.setData({
        analysisDetail,
        radarData,
        barData,
        issuesList: analysisDetail.issues,
        suggestionsList: analysisDetail.suggestions,
        loading: false
      });
      
    } catch (error) {
      logger.error('加载分析详情失败', error);
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
      this.setData({ loading: false });
    }
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
  }
}); 