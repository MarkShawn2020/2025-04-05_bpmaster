/**
 * AI分析服务
 * 负责BP文件的AI智能分析逻辑
 */
import { logger } from '../utils/logger';
import { apiService } from './api';

// BP分析结果数据结构
export const BP_STRUCTURE = {
  projectInfo: {
    projectName: "", // 项目名称
    companyName: "", // 企业名称
    companyCode: "", // 统一社会信用代码(如有)
    industryCategory: "", // 行业分类
    developmentStage: "", // 发展阶段
    projectManager: "", // 项目负责人
    contactPerson: "", // 项目联系人
    contactPhone: "" // 联系电话
  },
  businessPlan: {
    projectSummary: "", // 项目简介
    productsAndServices: "", // 产品与服务
    industryAndMarket: "", // 行业与市场
    coreTechnology: "", // 核心技术
    businessModel: "", // 商业模式
    coreTeam: "", // 核心团队
    strategicPlanning: "" // 战略规划
  },
  patents: [
    // {
    //   patentNumber: "", // 专利号
    //   patentName: "", // 专利名称
    //   inventors: [""] // 发明人
    // }
  ],
  teamMembers: [
    // {
    //   name: "", // 姓名
    //   organization: "", // 单位
    //   position: "", // 职务
    //   education: "", // 学历
    //   experience: "" // 履历
    // }
  ],
  financials: {
    revenueProjections: [
      // {
      //   year: 0,
      //   amount: 0
      // }
    ],
    expenseProjections: [
      // {
      //   year: 0,
      //   amount: 0
      // }
    ],
    profitProjections: [
      // {
      //   year: 0,
      //   amount: 0
      // }
    ]
  }
};

// AI分析服务
export const aiService = {
  /**
   * 分析BP文件
   * @param {string} fileId 文件ID
   * @param {Function} progressCallback 进度回调
   * @returns {Promise} 分析结果
   */
  async analyzeBP(fileId, progressCallback = null) {
    logger.info('开始分析BP文件', fileId);
    
    try {
      // 调用后端分析接口
      if (progressCallback) progressCallback(10, '准备分析...');
      
      const result = await apiService.analyzeBP(fileId);
      
      if (progressCallback) progressCallback(100, '分析完成');
      
      logger.info('BP分析完成', result);
      return result;
    } catch (error) {
      logger.error('BP分析失败', error);
      throw error;
    }
  },
  
  /**
   * 生成BP报告
   * @param {Object} analysisData 分析数据
   * @param {Object} options 生成选项
   * @returns {Promise} 生成结果
   */
  async generateReport(analysisData, options = {}) {
    logger.info('开始生成BP报告');
    
    try {
      // 调用后端报告生成接口
      const result = await apiService.generateReport(analysisData.id, options);
      
      logger.info('BP报告生成完成', result);
      return result;
    } catch (error) {
      logger.error('BP报告生成失败', error);
      throw error;
    }
  },
  
  /**
   * 评估BP得分
   * @param {Object} analysisData 分析数据
   * @returns {Object} 评估结果
   */
  evaluateBP(analysisData) {
    logger.info('开始评估BP得分');
    
    // 这里仅为示例，实际应从后端获取或基于复杂规则计算
    const scores = {
      businessModel: this._calculateScore(analysisData.businessPlan.businessModel, 100),
      market: this._calculateScore(analysisData.businessPlan.industryAndMarket, 100),
      technology: this._calculateScore(analysisData.businessPlan.coreTechnology, 100),
      team: this._evaluateTeam(analysisData.teamMembers),
      financials: this._evaluateFinancials(analysisData.financials)
    };
    
    // 计算总分
    const totalScore = (
      scores.businessModel * 0.25 +
      scores.market * 0.25 +
      scores.technology * 0.2 +
      scores.team * 0.2 +
      scores.financials * 0.1
    ).toFixed(1);
    
    const result = {
      totalScore,
      categoryScores: scores,
      recommendations: this._generateRecommendations(scores, analysisData)
    };
    
    logger.info('BP评估完成', result);
    return result;
  },
  
  /**
   * 计算简单得分
   * @private
   * @param {string} text 文本内容
   * @param {number} maxLength 最大长度
   * @returns {number} 得分
   */
  _calculateScore(text, maxLength) {
    // 示例：简单基于内容长度和关键词计算得分
    if (!text) return 60;
    
    const length = text.length;
    const lengthScore = Math.min(length / maxLength * 100, 85);
    
    const keywords = ['创新', '优势', '技术', '市场', '核心', '团队', '专利', '盈利'];
    const keywordCount = keywords.filter(keyword => text.includes(keyword)).length;
    const keywordScore = keywordCount / keywords.length * 15;
    
    return Math.min(lengthScore + keywordScore, 100).toFixed(1);
  },
  
  /**
   * 评估团队
   * @private
   * @param {Array} teamMembers 团队成员
   * @returns {number} 团队得分
   */
  _evaluateTeam(teamMembers) {
    if (!teamMembers || !teamMembers.length) return 60;
    
    // 根据团队规模、经验等评估
    const size = Math.min(teamMembers.length, 10);
    const sizeScore = size / 10 * 40;
    
    let experienceScore = 0;
    teamMembers.forEach(member => {
      if (member.experience && member.experience.length > 50) {
        experienceScore += 6;
      }
    });
    
    experienceScore = Math.min(experienceScore, 60);
    
    return Math.min(sizeScore + experienceScore, 100).toFixed(1);
  },
  
  /**
   * 评估财务
   * @private
   * @param {Object} financials 财务数据
   * @returns {number} 财务得分
   */
  _evaluateFinancials(financials) {
    if (!financials) return 60;
    
    const hasRevenue = financials.revenueProjections && financials.revenueProjections.length > 0;
    const hasExpense = financials.expenseProjections && financials.expenseProjections.length > 0;
    const hasProfit = financials.profitProjections && financials.profitProjections.length > 0;
    
    let score = 60; // 基础分
    
    if (hasRevenue) score += 10;
    if (hasExpense) score += 10;
    if (hasProfit) score += 10;
    
    // 简单检查收入是否随时间增长
    if (hasRevenue && financials.revenueProjections.length > 1) {
      const firstYear = financials.revenueProjections[0].amount;
      const lastYear = financials.revenueProjections[financials.revenueProjections.length - 1].amount;
      
      if (lastYear > firstYear) {
        score += 10;
      }
    }
    
    return Math.min(score, 100).toFixed(1);
  },
  
  /**
   * 生成建议
   * @private
   * @param {Object} scores 评分
   * @param {Object} analysisData 分析数据
   * @returns {Array} 建议列表
   */
  _generateRecommendations(scores, analysisData) {
    const recommendations = [];
    
    // 商业模式建议
    if (scores.businessModel < 70) {
      recommendations.push({
        category: '商业模式',
        content: '商业模式描述不够清晰，建议明确说明如何获取客户、创造价值和实现盈利。'
      });
    }
    
    // 市场建议
    if (scores.market < 70) {
      recommendations.push({
        category: '市场分析',
        content: '市场分析不够深入，建议增加目标市场规模、增长率、竞争格局和进入壁垒等信息。'
      });
    }
    
    // 技术建议
    if (scores.technology < 70) {
      recommendations.push({
        category: '核心技术',
        content: '核心技术优势不够突出，建议详细说明技术创新点、专利保护和技术壁垒。'
      });
    }
    
    // 团队建议
    if (scores.team < 70) {
      recommendations.push({
        category: '团队组成',
        content: '团队介绍不够完善，建议突出团队成员的专业背景、行业经验和互补优势。'
      });
    }
    
    // 财务建议
    if (scores.financials < 70) {
      recommendations.push({
        category: '财务规划',
        content: '财务预测不够具体，建议提供更详细的收入来源、成本结构和盈利模型。'
      });
    }
    
    return recommendations;
  }
};