// 云函数入口文件
const cloud = require('wx-server-sdk')
const axios = require('axios')
const FormData = require('form-data')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command

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
 * 启动BP分析任务
 * @param {Object} event 
 * @param {string} event.fileId - BP文件ID
 * @param {string} event.fileUrl - BP文件URL
 * @param {boolean} event.restart - 是否重新启动分析（可选）
 * @returns {Object} 包含taskId的分析任务信息
 */
exports.main = async (event, context) => {
  const { fileId, fileUrl, restart = false } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  logger.info('启动BP分析任务', { fileId, openid, restart })

  try {
    // 1. 参数校验
    if (!fileId || !fileUrl) {
      logger.error('缺少必要参数', { fileId, fileUrl })
      return { 
        code: 400, 
        message: '缺少必要参数 fileId 或 fileUrl' 
      }
    }

    // 2. 获取文件信息
    const fileInfo = await db.collection('bp_files').doc(fileId).get()
      .then(res => res.data)
      .catch(err => {
        logger.error('获取文件信息失败', err)
        throw new Error('获取文件信息失败')
      })

    if (!fileInfo) {
      logger.error('文件不存在', { fileId })
      return { 
        code: 404, 
        message: '文件不存在' 
      }
    }

    // 3. 检查是否已有分析任务且不是重启
    if (!restart) {
      const existingTask = await db.collection('analysis_tasks')
        .where({
          fileId: fileId,
          status: 'processing'
        })
        .get()

      if (existingTask.data && existingTask.data.length > 0) {
        logger.info('分析任务已在进行中', existingTask.data[0])
        return {
          code: 0,
          message: '分析任务已在进行中',
          data: {
            taskId: existingTask.data[0]._id
          }
        }
      }
    }

    // 4. 创建新的分析任务记录
    const taskData = {
      fileId,
      fileUrl,
      fileName: fileInfo.fileName || fileInfo.name || '未知文件',
      openid,
      status: 'processing',
      content: '',
      progress: 0,
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }

    // 保存到数据库
    const result = await db.collection('analysis_tasks').add({
      data: taskData
    })

    const taskId = result._id
    logger.info('创建分析任务成功', { taskId })

    // 5. 启动异步工作流程
    // 注意：这里使用云函数中的 callFunction 方法启动异步处理
    // 由于云函数有执行时间限制，长时间运行的 Coze 通信需要放在单独的云函数中
    cloud.callFunction({
      name: 'processBPAnalysis',
      data: {
        taskId,
        fileId,
        fileUrl
      }
    }).catch(err => {
      // 即使异步处理启动失败，我们也会返回任务ID
      // 前端可以通过轮询获取任务状态
      logger.error('启动异步分析处理失败', err)
      
      // 更新任务状态为错误
      db.collection('analysis_tasks').doc(taskId).update({
        data: {
          status: 'error',
          errorMessage: '启动分析处理失败: ' + err.message,
          updateTime: db.serverDate()
        }
      }).catch(updateErr => {
        logger.error('更新任务状态失败', updateErr)
      })
    })

    // 6. 更新文件状态
    await db.collection('bp_files').doc(fileId).update({
      data: {
        status: 'analyzing',
        _updateTime: db.serverDate()
      }
    })

    // 7. 返回任务ID
    return {
      code: 0,
      message: '分析任务已启动',
      data: {
        taskId
      }
    }
  } catch (err) {
    logger.error('启动BP分析失败', err)
    return {
      code: 500,
      message: '启动分析失败: ' + err.message,
      error: err
    }
  }
}
