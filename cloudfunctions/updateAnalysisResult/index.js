// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('接收到的参数:', event)
  
  // 参数检查
  if (!event.fileId || !event.analysisResults) {
    return {
      code: 400,
      message: '缺少必要参数',
      success: false
    }
  }

  try {
    // 更新数据库中的分析结果
    const result = await db.collection('bp_files').doc(event.fileId).update({
      data: {
        analysisResults: event.analysisResults,
        analysisDate: db.serverDate(),
        status: 'analyzed'
      }
    })

    console.log('更新分析结果成功', result)

    return {
      code: 200,
      message: '更新分析结果成功',
      success: true,
      data: result
    }
  } catch (error) {
    console.error('更新分析结果失败', error)
    return {
      code: 500,
      message: '更新分析结果失败: ' + error.message,
      success: false,
      error: error
    }
  }
}
