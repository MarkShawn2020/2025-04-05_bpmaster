// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

/**
 * 获取报告列表的云函数
 * 分页获取当前用户的报告列表
 */
exports.main = async (event, context) => {
  console.log('获取报告列表云函数被调用', event)
  
  const { page = 1, pageSize = 10 } = event
  
  const wxContext = cloud.getWXContext()
  const { OPENID } = wxContext
  
  try {
    const db = cloud.database()
    const reportCollection = db.collection('reports')
    
    // 计算总数
    const countResult = await reportCollection.where({
      openid: OPENID
    }).count()
    
    const total = countResult.total
    
    // 计算跳过的数量
    const skip = (page - 1) * pageSize
    
    // 查询数据
    const listResult = await reportCollection
      .where({
        openid: OPENID
      })
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    
    return {
      code: 200,
      message: '获取成功',
      data: {
        list: listResult.data,
        pagination: {
          total,
          page,
          pageSize,
          pages: Math.ceil(total / pageSize)
        }
      }
    }
  } catch (err) {
    console.error('获取报告列表失败', err)
    return {
      code: 500,
      message: '获取失败: ' + err.message
    }
  }
} 