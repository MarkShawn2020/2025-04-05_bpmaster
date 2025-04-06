// 云函数入口文件
const cloud = require('wx-server-sdk')
const { CozeAPI } = require('@coze/api')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// Coze API配置信息
const COZE_WORKFLOW_ID = '7488013332172193801' // 替换为你的工作流ID
const COZE_API_TOKEN = 'pat_qLidHTjFnf7XlU0UwEz2L2OcWl34KsuSU56X9V1dFDAuhNf3atXTOl2gO5G2laVN' // 云函数中可以安全存储token

// 初始化Coze API客户端
const apiClient = new CozeAPI({
  token: COZE_API_TOKEN,
  baseURL: 'https://api.coze.cn'
})

/**
 * 使用Coze工作流API分析BP文件
 * @param {Object} event 传入的参数
 * @param {string} event.fileURL BP文件的URL
 * @param {boolean} event.useJson 是否使用JSON格式输出
 * @param {string} event.outputFormat 输出格式 (markdown/html)
 * @param {string} event.fileId 上传的文件ID，用于关联分析结果
 * @param {boolean} event.startOnly 是否仅启动分析而不等待结果
 * @returns {Object} 分析结果数据
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { fileURL, useJson = false, outputFormat = 'markdown', fileId, startOnly = false } = event
  
  if (!fileURL) {
    return {
      code: 400,
      message: '文件URL为空',
      data: null
    }
  }
  
  try {
    console.log('开始调用Coze工作流API', { fileURL, fileId, startOnly })
    
    // 如果有fileId，先更新文件状态为分析中
    if (fileId) {
      try {
        await db.collection('bp_files').doc(fileId).update({
          data: {
            status: 'analyzing',
            analysisStartTime: db.serverDate()
          }
        })
        console.log('文件状态已更新为分析中', fileId)
      } catch (dbErr) {
        console.error('更新文件状态失败，但继续进行分析', dbErr)
      }
    }
    
    // 调用Coze API的请求参数
    const requestParams = {
      workflow_id: COZE_WORKFLOW_ID,
      parameters: {
        input: [fileURL],
        useJson,
        outputFormat
      }
    }
    
    // 如果仅启动分析不等待结果，则使用异步模式
    if (startOnly) {
      console.log('使用异步模式启动分析')
      
      try {
        const runResult = await apiClient.workflows.runs.create(requestParams)
        console.log('异步分析任务已提交', runResult)
        
        // 记录工作流执行ID
        if (fileId) {
          await db.collection('bp_files').doc(fileId).update({
            data: {
              cozeWorkflowRunId: runResult.id,
              status: 'analyzing',
              updateTime: db.serverDate()
            }
          })
        }
        
        return {
          code: 200,
          message: '分析任务已提交',
          data: {
            taskId: runResult.id,
            status: 'analyzing'
          }
        }
      } catch (apiErr) {
        console.error('提交异步分析任务失败', apiErr)
        throw apiErr
      }
    }
    
    // 设置超时保护
    const TIMEOUT_MS = 250 * 1000 // 250秒，略小于云函数300秒限制
    let isTimedOut = false
    
    const timeoutPromise = new Promise(resolve => {
      setTimeout(() => {
        isTimedOut = true
        resolve({
          code: 202,
          message: '分析仍在进行中',
          data: {
            status: 'analyzing',
            partial: true
          }
        })
      }, TIMEOUT_MS)
    })
    
    // 使用SDK创建流式响应
    console.log('开始流式请求', new Date().toISOString())
    const analysisPromise = (async () => {
      try {
        const streamResponse = await apiClient.workflows.runs.stream(requestParams)
        console.log('已获取流式响应对象', new Date().toISOString())
        
        // 收集完整的分析结果
        let analysisResult = ''
        let contentType = 'text'
        let workflowRunId = null
        let lastChunkTime = Date.now()
        
        // 处理流式响应事件
        for await (const event of streamResponse) {
          lastChunkTime = Date.now()
          
          if (event.type === 'content') {
            try {
              // 尝试解析内容
              if (typeof event.content === 'string') {
                try {
                  // 尝试解析为JSON
                  const contentObj = JSON.parse(event.content)
                  if (contentObj.output) {
                    analysisResult += contentObj.output
                  }
                } catch (e) {
                  // 不是JSON格式，直接添加
                  analysisResult += event.content
                }
              }
              
              // 记录内容类型
              if (event.contentType) {
                contentType = event.contentType
              }
              
              // 记录工作流ID
              if (event.workflowRunId) {
                workflowRunId = event.workflowRunId
              }
              
              console.log('收到内容片段', {
                contentType: event.contentType,
                contentLength: event.content ? event.content.length : 0,
                time: new Date().toISOString(),
                resultLength: analysisResult.length
              })
              
              // 检查是否已超时
              if (isTimedOut) {
                console.log('检测到超时标志，中断流式处理')
                break
              }
            } catch (e) {
              console.error('处理内容片段失败', e)
            }
          } else if (event.type === 'done') {
            console.log('工作流执行完成', event)
          }
        }
        
        console.log('流式响应处理完成', {
          resultLength: analysisResult.length,
          isTimedOut,
          processingTime: (Date.now() - lastChunkTime) + 'ms'
        })
        
        // 如果有文件ID，更新文件记录中的分析结果
        if (fileId && analysisResult) {
          try {
            await db.collection('bp_files').doc(fileId).update({
              data: {
                analysisResults: {
                  markdownContent: analysisResult,
                  contentType,
                  analysisDate: db.serverDate(),
                  workflowRunId
                },
                status: isTimedOut ? 'analyzing' : 'analyzed',
                updateTime: db.serverDate(),
                analysisComplete: !isTimedOut
              }
            })
            console.log('分析结果已更新到文件记录', fileId)
          } catch (dbErr) {
            console.error('更新文件分析结果失败', dbErr)
          }
        }
        
        // 返回分析结果
        return {
          code: isTimedOut ? 202 : 200,
          message: isTimedOut ? '分析仍在进行中' : '分析完成',
          data: {
            content: analysisResult,
            contentType,
            workflowRunId,
            status: isTimedOut ? 'analyzing' : 'completed',
            partial: isTimedOut
          }
        }
      } catch (streamErr) {
        console.error('流式处理失败', streamErr)
        throw streamErr
      }
    })()
    
    // 两个Promise竞争，看哪个先完成
    return Promise.race([analysisPromise, timeoutPromise])
    
  } catch (error) {
    console.error('调用Coze工作流API失败', error)
    
    // 如果有文件ID，更新文件状态为失败
    if (fileId) {
      try {
        await db.collection('bp_files').doc(fileId).update({
          data: {
            status: 'failed',
            error: error.message || '分析失败',
            updateTime: db.serverDate()
          }
        })
      } catch (dbErr) {
        console.error('更新文件状态失败', dbErr)
      }
    }
    
    return {
      code: 500,
      message: '调用Coze工作流API失败',
      error: error.message || '未知错误'
    }
  }
} 