// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()

// 日志记录工具
const logger = {
  info: (message, data) => {
    console.log(`[INFO] ${message}`, data || '')
  },
  error: (message, err) => {
    console.error(`[ERROR] ${message}`, err || '')
  },
  debug: (message, data) => {
    console.log(`[DEBUG] ${message}`, data || '')
  },
  warn: (message, data) => {
    console.warn(`[WARN] ${message}`, data || '')
  }
}

/**
 * 获取BP分析任务状态
 * @param {Object} event 
 * @param {string} event.taskId - 分析任务ID
 * @param {string} event.fileId - BP文件ID (可选，当提供时会查找文件关联的最新任务)
 * @returns {Object} 分析任务状态和内容
 */
exports.main = async (event, context) => {
  const { taskId, fileId } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  logger.info('获取BP分析任务状态', { taskId, fileId, openid })

  try {
    // 参数校验
    if (!taskId && !fileId) {
      logger.error('缺少必要参数', { taskId, fileId })
      return { 
        code: 400, 
        message: '缺少必要参数 taskId 或 fileId' 
      }
    }

    let task = null;

    // 根据任务ID查询
    if (taskId) {
      task = await db.collection('analysis_tasks').doc(taskId).get()
        .then(res => res.data)
        .catch(err => {
          logger.error('查询任务失败', err)
          return null
        })
    } 
    // 根据文件ID查询最新的任务
    else if (fileId) {
      const tasks = await db.collection('analysis_tasks')
        .where({
          fileId: fileId,
          openid: openid
        })
        .orderBy('createTime', 'desc')
        .limit(1)
        .get()
        .then(res => res.data)
        .catch(err => {
          logger.error('查询任务失败', err)
          return []
        })
      
      if (tasks && tasks.length > 0) {
        task = tasks[0]
      }
    }

    // 未找到任务
    if (!task) {
      logger.warn('未找到分析任务', { taskId, fileId })
      return {
        code: 0,
        data: {
          status: 'notfound',
          message: '未找到分析任务'
        }
      }
    }

    // 返回任务状态和内容
    logger.info('任务状态', { 
      status: task.status, 
      progress: task.progress,
      contentLength: task.content ? task.content.length : 0 
    })

    return {
      code: 0,
      data: {
        status: task.status,
        content: task.content || '',
        progress: task.progress || 0,
        message: task.errorMessage || '',
        updateTime: task.updateTime
      }
    }
  } catch (err) {
    logger.error('获取BP分析任务状态失败', err)
    return {
      code: 500,
      message: '获取分析任务状态失败: ' + err.message,
      error: err
    }
  }
}
