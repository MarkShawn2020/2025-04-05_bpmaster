// 云函数入口文件
const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command

// 专业的日志记录工具，确保每个关键的功能点都有log
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

// 从环境变量或配置文件中获取Coze API配置
// 注意：实际生产环境中应从安全的环境变量或配置系统获取
const getCozeConfig = async () => {
  try {
    // 从数据库获取配置
    const configData = await db.collection('system_config')
      .where({ type: 'coze' })
      .get()
      .then(res => res.data && res.data.length > 0 ? res.data[0] : null)
    
    if (configData && configData.config) {
      return configData.config
    }
    
    // 如果数据库没有配置，返回默认配置
    // 注意：实际生产中应确保这些值安全存储
    return {
      WORKFLOW_ID: process.env.COZE_WORKFLOW_ID || 'your_workflow_id_here',
      TOKEN: process.env.COZE_TOKEN || 'your_token_here',
      API_URL: process.env.COZE_API_URL || 'https://api.coze.com/v1/workflow/invoke'
    }
  } catch (err) {
    logger.error('获取Coze配置失败', err)
    throw new Error('获取Coze配置失败: ' + err.message)
  }
}

/**
 * 处理BP分析任务
 * @param {Object} event 
 * @param {string} event.taskId - 分析任务ID
 * @param {string} event.fileId - 文件ID
 * @param {string} event.fileUrl - 文件URL
 * @returns {Object} 处理结果
 */
exports.main = async (event, context) => {
  const { taskId, fileId, fileUrl } = event
  const wxContext = cloud.getWXContext()
  
  logger.info('开始处理BP分析任务', { taskId, fileId })
  
  try {
    // 1. 参数校验
    if (!taskId || !fileId || !fileUrl) {
      logger.error('缺少必要参数', { taskId, fileId, fileUrl })
      return { 
        code: 400, 
        message: '缺少必要参数' 
      }
    }
    
    // 2. 获取任务信息
    const task = await db.collection('analysis_tasks').doc(taskId).get()
      .then(res => res.data)
      .catch(err => {
        logger.error('获取任务信息失败', err)
        throw new Error('获取任务信息失败')
      })
    
    if (!task) {
      logger.error('任务不存在', { taskId })
      return { 
        code: 404, 
        message: '任务不存在' 
      }
    }
    
    // 3. 获取Coze配置
    const cozeConfig = await getCozeConfig()
    
    if (!cozeConfig.WORKFLOW_ID || !cozeConfig.TOKEN || !cozeConfig.API_URL) {
      logger.error('Coze配置不完整', cozeConfig)
      
      // 更新任务状态为错误
      await updateTaskStatus(taskId, 'error', '系统配置错误：缺少Coze API配置')
      
      return { 
        code: 500, 
        message: '系统配置错误：缺少Coze API配置' 
      }
    }
    
    // 4. 调用Coze API并处理响应
    await processCozeWorkflow(taskId, fileUrl, cozeConfig)
    
    return {
      code: 0,
      message: '分析任务处理成功'
    }
  } catch (err) {
    logger.error('处理BP分析任务失败', err)
    
    // 更新任务状态为错误
    try {
      await updateTaskStatus(taskId, 'error', '处理分析任务失败: ' + err.message)
    } catch (updateErr) {
      logger.error('更新任务状态失败', updateErr)
    }
    
    return {
      code: 500,
      message: '处理分析任务失败: ' + err.message,
      error: err
    }
  }
}

/**
 * 更新任务状态
 * @param {string} taskId - 任务ID
 * @param {string} status - 任务状态
 * @param {string} errorMessage - 错误信息（可选）
 * @param {string} content - 分析内容（可选）
 * @param {number} progress - 进度（可选）
 */
async function updateTaskStatus(taskId, status, errorMessage = '', content = null, progress = null) {
  const updateData = {
    status,
    updateTime: db.serverDate()
  }
  
  if (errorMessage) {
    updateData.errorMessage = errorMessage
  }
  
  if (content !== null) {
    updateData.content = content
  }
  
  if (progress !== null) {
    updateData.progress = progress
  }
  
  await db.collection('analysis_tasks').doc(taskId).update({
    data: updateData
  })
  
  logger.info('更新任务状态成功', { taskId, status })
}

/**
 * 处理Coze工作流
 * @param {string} taskId - 任务ID
 * @param {string} fileUrl - 文件URL
 * @param {Object} cozeConfig - Coze配置
 */
async function processCozeWorkflow(taskId, fileUrl, cozeConfig) {
  logger.info('开始处理Coze工作流', { taskId })
  
  // 准备请求参数
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${cozeConfig.TOKEN}`
  }
  
  const data = {
    workflow_id: cozeConfig.WORKFLOW_ID,
    parameters: { 
      files: [fileUrl]
      // 可根据需要添加其他参数
    }
  }
  
  try {
    // 发起请求到Coze API
    const response = await axios({
      method: 'post',
      url: cozeConfig.API_URL,
      headers: headers,
      data: data,
      responseType: 'stream'
    })
    
    // 进度计数
    let currentContentLength = 0
    let totalContentLength = 0
    let buffer = ''
    let progress = 0
    
    // 处理响应流
    return new Promise((resolve, reject) => {
      // 监听数据块
      response.data.on('data', async (chunk) => {
        try {
          // 将二进制数据转换为字符串
          const chunkStr = chunk.toString('utf-8')
          buffer += chunkStr
          
          // 处理SSE格式数据
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // 保留最后一个可能不完整的行
          
          for (const line of lines) {
            if (!line.trim()) continue
            
            if (line.startsWith('data: ')) {
              const dataStr = line.substring(6)
              
              // 检查是否为[DONE]标记
              if (dataStr === '[DONE]') {
                logger.info('收到[DONE]标记，工作流结束', { taskId })
                
                // 标记任务完成
                await updateTaskStatus(taskId, 'completed', '', null, 100)
                resolve()
                return
              }
              
              try {
                // 解析JSON数据
                const jsonData = JSON.parse(dataStr)
                
                // 处理消息类型
                if (jsonData.event === 'Message' && jsonData.data && jsonData.data.content) {
                  const content = jsonData.data.content
                  totalContentLength += content.length
                  
                  // 更新任务内容，使用累加方式
                  await db.collection('analysis_tasks').doc(taskId).update({
                    data: {
                      content: _.concat(content),
                      updateTime: db.serverDate()
                    }
                  })
                  
                  // 计算进度
                  currentContentLength += content.length
                  if (totalContentLength > 0) {
                    progress = Math.min(Math.floor((currentContentLength / 2000) * 100), 99)
                    
                    // 每更新100个字符更新一次进度
                    if (currentContentLength % 100 === 0) {
                      await updateTaskStatus(taskId, 'processing', '', null, progress)
                    }
                  }
                  
                  logger.debug('处理Coze内容更新', { 
                    contentLength: content.length,
                    totalLength: totalContentLength,
                    progress 
                  })
                } else if (jsonData.event === 'Error') {
                  // 处理错误
                  const errorMessage = jsonData.data?.message || '工作流执行出错'
                  logger.error('Coze工作流错误', { 
                    taskId, 
                    error: errorMessage 
                  })
                  
                  await updateTaskStatus(taskId, 'error', errorMessage)
                  reject(new Error(errorMessage))
                  return
                }
              } catch (err) {
                logger.error('解析Coze返回的JSON数据失败', { 
                  err, 
                  dataStr 
                })
              }
            }
          }
        } catch (err) {
          logger.error('处理Coze数据块失败', err)
        }
      })
      
      // 监听错误
      response.data.on('error', async (err) => {
        logger.error('Coze流式请求出错', err)
        
        await updateTaskStatus(taskId, 'error', '连接Coze服务时出错: ' + err.message)
        reject(err)
      })
      
      // 监听结束
      response.data.on('end', async () => {
        logger.info('Coze流结束', { taskId })
        
        // 获取当前任务状态
        const task = await db.collection('analysis_tasks').doc(taskId).get()
          .then(res => res.data)
          .catch(err => {
            logger.error('获取任务状态失败', err)
            return null
          })
        
        // 如果任务仍在处理中，则标记为完成
        if (task && task.status === 'processing') {
          await updateTaskStatus(taskId, 'completed', '', null, 100)
        }
        
        resolve()
      })
    })
  } catch (err) {
    logger.error('Coze API请求失败', err)
    await updateTaskStatus(taskId, 'error', '请求Coze API失败: ' + err.message)
    throw err
  }
}
