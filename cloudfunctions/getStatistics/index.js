// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

/**
 * 获取平台统计数据云函数
 * 返回平台统计信息，如：总分析次数、本周分析、平均分、最高分、行业分布等
 */
exports.main = async (event, context) => {
  console.log('获取统计数据云函数被调用', event);
  
  const db = cloud.database();
  const _ = db.command;
  const $ = db.command.aggregate;
  
  try {
    // 获取用户总数
    const userCountResult = await db.collection('users').count();
    const totalUsers = userCountResult.total;
    
    // 获取分析总次数
    const analysisCountResult = await db.collection('bp_analysis').count();
    const totalAnalysis = analysisCountResult.total;
    
    // 获取本周分析次数
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const weeklyAnalysisResult = await db.collection('bp_analysis')
      .where({
        createdAt: _.gte(oneWeekAgo)
      })
      .count();
    const weeklyAnalysis = weeklyAnalysisResult.total;
    
    // 获取平均分
    const avgScoreResult = await db.collection('bp_analysis')
      .aggregate()
      .group({
        _id: null,
        averageScore: $.avg('$score')
      })
      .end();
    
    let averageScore = 0;
    if (avgScoreResult.list.length > 0) {
      averageScore = parseFloat(avgScoreResult.list[0].averageScore.toFixed(1));
    }
    
    // 获取最高分
    const highestScoreResult = await db.collection('bp_analysis')
      .orderBy('score', 'desc')
      .limit(1)
      .get();
    
    let highestScore = {
      score: 0,
      fileName: ''
    };
    
    if (highestScoreResult.data.length > 0) {
      highestScore = {
        score: parseFloat(highestScoreResult.data[0].score.toFixed(1)),
        fileName: highestScoreResult.data[0].fileName || '未命名文件'
      };
    }
    
    // 获取行业分布
    const industryResult = await db.collection('bp_analysis')
      .aggregate()
      .group({
        _id: '$industry',
        count: $.sum(1)
      })
      .end();
    
    const industryMap = {
      'tech': 0,
      'finance': 0,
      'healthcare': 0,
      'education': 0,
      'other': 0
    };
    
    if (industryResult.list.length > 0) {
      // 计算各行业占比
      const totalCount = industryResult.list.reduce((sum, item) => sum + item.count, 0);
      
      industryResult.list.forEach(item => {
        const industry = item._id;
        const percentage = Math.round((item.count / totalCount) * 100);
        
        // 映射到我们的行业分类
        if (industry === '科技' || industry === 'tech' || industry === '互联网') {
          industryMap.tech += percentage;
        } else if (industry === '金融' || industry === 'finance') {
          industryMap.finance += percentage;
        } else if (industry === '医疗' || industry === 'healthcare' || industry === '健康') {
          industryMap.healthcare += percentage;
        } else if (industry === '教育' || industry === 'education') {
          industryMap.education += percentage;
        } else {
          industryMap.other += percentage;
        }
      });
      
      // 确保总和为100%
      const sum = Object.values(industryMap).reduce((a, b) => a + b, 0);
      if (sum !== 100) {
        industryMap.other += (100 - sum);
      }
    } else {
      // 无数据时的默认分布
      industryMap.tech = 35;
      industryMap.finance = 25;
      industryMap.healthcare = 20;
      industryMap.education = 15;
      industryMap.other = 5;
    }
    
    // 返回统计数据
    return {
      code: 0,
      message: '获取统计数据成功',
      data: {
        totalUsers,
        totalAnalysis,
        weeklyAnalysis,
        averageScore,
        highestScore,
        industryDistribution: industryMap
      }
    };
    
  } catch (err) {
    console.error('获取统计数据失败', err);
    return {
      code: 500,
      message: '获取统计数据失败: ' + err.message
    };
  }
} 