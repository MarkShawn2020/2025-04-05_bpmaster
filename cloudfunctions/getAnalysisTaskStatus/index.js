// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('获取任务状态，接收参数:', event)
  
  if (!event.taskId) {
    return {
      code: 400,
      message: '缺少任务ID',
      success: false
    }
  }
  
  try {
    // 查询任务状态
    const result = await db.collection('analysis_tasks').where({
      taskId: event.taskId
    }).get()
    
    // 如果找不到任务
    if (!result.data || result.data.length === 0) {
      return {
        code: 404,
        message: '未找到分析任务',
        success: false
      }
    }
    
    const task = result.data[0]
    
    // 简单的响应结构
    return {
      code: 200,
      message: '获取任务状态成功',
      success: true,
      data: {
        taskId: task.taskId,
        status: task.status,
        progress: task.progress,
        message: task.message || '',
        result: task.result,
        fileId: task.fileId,
        error: task.error,
        createTime: task.createTime,
        updateTime: task.updateTime
      }
    }
  } catch (error) {
    console.error('获取任务状态失败:', error)
    return {
      code: 500,
      message: '查询任务状态失败: ' + error.message,
      success: false,
      error: error
    }
  }
} 