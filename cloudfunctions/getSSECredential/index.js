// 云函数入口文件
const cloud = require('wx-server-sdk')
const jwt = require('jsonwebtoken')

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

// 密钥，用于生成JWT令牌
// 注意：实际生产环境应使用安全存储的环境变量
const JWT_SECRET = 'bp_analysis_sse_secret_key_2025'

/**
 * 获取SSE连接凭证
 * @param {Object} event 
 * @param {string} event.taskId - 分析任务ID
 * @returns {Object} SSE连接凭证
 */
exports.main = async (event, context) => {
  const { taskId } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const appid = wxContext.APPID

  logger.info('获取SSE连接凭证', { taskId, openid })

  try {
    // 参数校验
    if (!taskId) {
      logger.error('缺少必要参数', { taskId })
      return { 
        code: 400, 
        message: '缺少必要参数 taskId' 
      }
    }

    // 查询任务是否存在，并确认是否为当前用户的任务
    const task = await db.collection('analysis_tasks').doc(taskId).get()
      .then(res => res.data)
      .catch(err => {
        logger.error('查询任务失败', err)
        return null
      })

    if (!task) {
      logger.error('分析任务不存在', { taskId })
      return {
        code: 404,
        message: '分析任务不存在'
      }
    }

    if (task.openid !== openid) {
      logger.error('无权访问该分析任务', { taskId, taskOpenid: task.openid, requesterOpenid: openid })
      return {
        code: 403,
        message: '无权访问该分析任务'
      }
    }

    // 生成JWT凭证，有效期5分钟
    // 包含必要的用户和任务信息
    const payload = {
      openid,
      appid,
      taskId,
      fileId: task.fileId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (5 * 60) // 5分钟过期
    }

    const credential = jwt.sign(payload, JWT_SECRET)
    
    logger.info('SSE凭证生成成功')

    return {
      code: 0,
      message: '获取SSE凭证成功',
      credential
    }
  } catch (err) {
    logger.error('获取SSE凭证失败', err)
    return {
      code: 500,
      message: '获取SSE凭证失败: ' + err.message,
      error: err
    }
  }
}
