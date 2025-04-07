// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

/**
 * 获取最近分析列表云函数
 * @param {number} limit - 获取数量，默认6条
 * @param {string} openid - 用户openid（可选，不传则获取所有用户数据）
 */
exports.main = async (event, context) => {
  console.log('获取最近分析列表云函数被调用', event)
  
  // 获取调用用户的 openid
  const wxContext = cloud.getWXContext()
  const { OPENID } = wxContext
  
  // 获取参数
  const limit = event.limit || 6
  const openid = event.openid || OPENID
  
  const db = cloud.database()
  
  try {
    let query = db.collection('analysis_tasks')
    
    // 如果传入了特定用户的openid，则只查询该用户的数据
    if (openid && !event.all) {
      query = query.where({
        openid: openid
      })
    }
    
    // 获取分析总数
    const countResult = await query.count()
    const total = countResult.total
    
    // 获取最近分析列表
    const recentAnalysis = await query
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
    
    // 处理数据，格式化日期和分数
    const analysisList = recentAnalysis.data.map(item => {
      // 格式化日期
      let dateStr = '未知时间'
      if (item.createdAt) {
        const date = new Date(item.createdAt)
        dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
      }
      
      // 格式化分数
      const score = item.score ? parseFloat(item.score.toFixed(1)) : 0
      
      return {
        id: item._id,
        fileName: item.fileName || '未命名文件',
        analysisDate: dateStr,
        score: score,
        fileType: (item.fileName || '').split('.').pop().toLowerCase()
      }
    })
    
    // 获取统计数据
    // 1. 用户总数
    const userCountResult = await db.collection('users').count()
    const userCount = userCountResult.total || 0
    
    // 2. 文件总数
    const fileCountResult = await db.collection('bp_files').count()
    const fileCount = fileCountResult.total || 0
    
    // 3. 分析任务总数 (已经通过上面的countResult获取)
    const analysisCount = total
    
    // 返回结果
    return {
      code: 0,
      message: '获取最近分析列表成功',
      data: {
        list: analysisList,
        total: total,
        statistics: {
          userCount: userCount,
          fileCount: fileCount,
          analysisCount: analysisCount,
          totalAnalysis: analysisCount // 兼容原有字段
        }
      }
    }
  } catch (err) {
    console.error('获取最近分析列表失败', err)
    return {
      code: 500,
      message: '获取最近分析列表失败: ' + err.message
    }
  }
} 