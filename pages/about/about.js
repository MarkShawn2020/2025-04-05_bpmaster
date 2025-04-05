import { logger } from '../../utils/logger';

Page({
  data: {
    version: '1.0.0',
    appName: 'BP小诸葛',
    description: 'BP小诸葛是一款商业计划书智能评估工具，通过AI技术对商业计划书进行全面分析，提供专业评估和改进建议。',
    features: [
      '智能解析商业计划书内容',
      '多维度评估商业模型可行性',
      '提供针对性的改进建议',
      '生成标准化分析报告'
    ],
    contactInfo: {
      email: 'support@bpmaster.com',
      website: 'https://www.bpmaster.com'
    }
  },

  onLoad() {
    logger.info('关于页面加载');
  },

  // 复制联系方式
  copyContact(e) {
    const type = e.currentTarget.dataset.type;
    const content = this.data.contactInfo[type];
    
    wx.setClipboardData({
      data: content,
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        });
      }
    });
  }
}) 