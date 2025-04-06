// 云函数入口文件
const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// Coze API配置信息
const COZE_API_URL = 'https://api.coze.cn/v1/workflow/stream_run'
const COZE_WORKFLOW_ID = '7488013332172193801' // 替换为你的工作流ID
const COZE_API_TOKEN = 'pat_qLidHTjFnf7XlU0UwEz2L2OcWl34KsuSU56X9V1dFDAuhNf3atXTOl2gO5G2laVN' // 云函数中可以安全存储token

/**
 * 使用Coze工作流API分析BP文件
 * @param {Object} event 传入的参数
 * @param {string} event.fileURL BP文件的URL
 * @param {boolean} event.useJson 是否使用JSON格式输出
 * @param {string} event.outputFormat 输出格式 (markdown/html)
 * @returns {Object} 分析结果数据
 */
exports.main = async (event, context) => {
  const { fileURL, useJson = false, outputFormat = 'markdown' } = event
  
  if (!fileURL) {
    return {
      code: 400,
      message: '文件URL为空',
      data: null
    }
  }
  
  try {
    console.log('开始调用Coze工作流API', { fileURL })
    
    // 调用Coze API的请求参数
    const requestParams = {
      workflow_id: COZE_WORKFLOW_ID,
      parameters: {
        input: [fileURL],
        useJson,
        outputFormat
      }
    }
    
    // 发送请求到Coze API
    const response = await axios({
      method: 'post',
      url: COZE_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'token': COZE_API_TOKEN
      },
      data: requestParams,
      responseType: 'stream'
    })
    
    // 处理流式响应
    let analysisResult = ''
    let contentType = 'text'
    let analysisData = null
    
    // 手动解析流数据
    return new Promise((resolve, reject) => {
      const chunks = []
      
      response.data.on('data', (chunk) => {
        const chunkStr = chunk.toString()
        chunks.push(chunkStr)
        
        // 尝试从数据块中提取内容
        try {
          // 流式响应格式是: event: type\ndata: {...}\n\n
          const lines = chunkStr.split('\n')
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim()
            
            if (line.startsWith('data:')) {
              const dataStr = line.slice(5).trim()
              if (dataStr) {
                try {
                  const dataObj = JSON.parse(dataStr)
                  if (dataObj.content) {
                    try {
                      // 尝试解析content为JSON
                      const contentObj = JSON.parse(dataObj.content)
                      if (contentObj.output) {
                        analysisResult += contentObj.output
                      }
                    } catch (e) {
                      // 不是JSON格式，直接添加
                      analysisResult += dataObj.content
                    }
                  }
                  
                  // 更新内容类型
                  if (dataObj.content_type) {
                    contentType = dataObj.content_type
                  }
                } catch (e) {
                  console.error('解析数据块失败', e)
                }
              }
            }
            
            // 检测工作流执行完成事件
            if (line.startsWith('event:') && line.includes('Done')) {
              console.log('工作流执行完成')
            }
          }
        } catch (e) {
          console.error('处理数据块异常', e)
        }
      })
      
      response.data.on('end', () => {
        console.log('流式响应接收完成')
        
        // 提取最终结果
        if (useJson) {
          try {
            analysisData = JSON.parse(analysisResult)
          } catch (e) {
            console.error('解析JSON结果失败', e)
            analysisData = null
          }
        }
        
        // 保存分析记录到数据库
        try {
          const bpFilesCollection = db.collection('bp_files')
          bpFilesCollection.add({
            data: {
              fileURL,
              analysisResult: analysisResult,
              contentType,
              analysisDate: db.serverDate(),
              createdBy: event.userInfo && event.userInfo.openId ? event.userInfo.openId : 'anonymous'
            }
          }).then(res => {
            console.log('分析记录已保存到数据库', res)
          }).catch(err => {
            console.error('保存分析记录失败', err)
          })
        } catch (dbErr) {
          console.error('数据库操作异常', dbErr)
        }
        
        // 返回结果
        resolve({
          code: 200,
          message: '分析完成',
          data: {
            contentType,
            content: analysisResult,
            data: analysisData
          }
        })
      })
      
      response.data.on('error', (err) => {
        console.error('流式响应接收出错', err)
        reject({
          code: 500,
          message: '处理流式响应失败',
          error: err.message
        })
      })
    })
    
  } catch (error) {
    console.error('调用Coze工作流API失败', error)
    return {
      code: 500,
      message: '调用Coze工作流API失败',
      error: error.message
    }
  }
} 