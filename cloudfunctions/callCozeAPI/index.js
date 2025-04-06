// 云函数入口文件
const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('接收到的参数:', event)
  
  // 参数检查
  if (!event.url || !event.token || !event.workflow_id) {
    return {
      code: 400,
      message: '缺少必要参数'
    }
  }

  const taskId = `task_${Date.now()}_${Math.floor(Math.random() * 10000)}`
  const fileId = event.fileId
  
  // 创建任务记录
  try {
    await db.collection('analysis_tasks').add({
      data: {
        taskId,
        fileId,
        status: 'pending',
        progress: 0,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        result: null,
        error: null
      }
    })
    
    // 立即返回任务ID，让前端可以开始轮询
    const response = {
      code: 200,
      message: '分析任务已创建',
      data: {
        taskId,
        status: 'pending',
        progress: 0
      }
    }
    
    // 异步执行Coze API调用，不阻塞云函数返回
    startCozeWorkflow(event, taskId, fileId).catch(error => {
      console.error('启动Coze工作流失败:', error)
    })
    
    return response
  } catch (error) {
    console.error('创建分析任务失败:', error)
    return {
      code: 500,
      message: '创建分析任务失败',
      error: error.message
    }
  }
}

// 异步启动Coze工作流并处理结果
async function startCozeWorkflow(event, taskId, fileId) {
  try {
    // 更新任务状态为进行中
    await db.collection('analysis_tasks').where({
      taskId: taskId
    }).update({
      data: {
        status: 'running',
        progress: 10,
        updateTime: db.serverDate()
      }
    })
    
    // 将Coze API调用模式改为非流式
    const url = event.url.replace('/stream_run', '/run')
    
    // 准备请求参数
    const requestData = {
      workflow_id: event.workflow_id,
      parameters: event.parameters || {}
    }
    
    console.log('准备调用Coze API', {
      url: url,
      workflow_id: event.workflow_id,
      taskId: taskId
    })
    
    // 设置API请求配置
    const requestConfig = {
      method: 'POST',
      url: url,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${event.token}`
      },
      data: requestData,
      timeout: 60000 // 60秒超时
    }
    
    // 更新进度到30%
    await updateTaskProgress(taskId, 30, '正在分析文档')
    
    // 发起API请求
    const response = await axios(requestConfig)
    
    console.log('Coze API调用成功', {
      taskId: taskId,
      status: response.status,
      hasData: !!response.data
    })
    
    // 更新进度到70%
    await updateTaskProgress(taskId, 70, '解析分析结果')
    
    // 从响应中提取数据
    let resultData = ''
    
    if (response.data && response.data.output) {
      resultData = response.data.output
    } else if (response.data && response.data.results) {
      resultData = response.data.results
    } else {
      resultData = JSON.stringify(response.data)
    }
    
    console.log('任务结果数据大小:', resultData.length, '字节')
    
    // 更新任务状态为完成
    await db.collection('analysis_tasks').where({
      taskId: taskId
    }).update({
      data: {
        status: 'completed',
        progress: 100,
        result: resultData,
        updateTime: db.serverDate()
      }
    })
    
    // 如果提供了fileId，更新BP文件分析结果
    if (fileId) {
      try {
        // 尝试解析结果为JSON
        let analysisData = null
        
        try {
          const jsonMatch = resultData.match(/```json\s*([\s\S]*?)\s*```/)
          if (jsonMatch && jsonMatch[1]) {
            analysisData = JSON.parse(jsonMatch[1])
          } else {
            analysisData = JSON.parse(resultData)
          }
        } catch (parseError) {
          console.error('解析结果JSON失败:', parseError)
          analysisData = { rawContent: resultData }
        }
        
        // 更新BP文件分析结果
        await db.collection('bp_files').doc(fileId).update({
          data: {
            analysisResults: analysisData,
            analysisDate: db.serverDate(),
            status: 'analyzed'
          }
        })
        
        console.log('更新BP文件分析结果成功:', fileId)
      } catch (updateError) {
        console.error('更新BP文件分析结果失败:', updateError)
      }
    }
    
    return resultData
  } catch (error) {
    console.error('Coze工作流执行失败:', error.message)
    
    // 更新任务状态为失败
    try {
      await db.collection('analysis_tasks').where({
        taskId: taskId
      }).update({
        data: {
          status: 'failed',
          error: error.message || '未知错误',
          updateTime: db.serverDate()
        }
      })
    } catch (updateError) {
      console.error('更新任务状态失败:', updateError)
    }
    
    throw error
  }
}

// 更新任务进度
async function updateTaskProgress(taskId, progress, message) {
  try {
    await db.collection('analysis_tasks').where({
      taskId: taskId
    }).update({
      data: {
        progress: progress,
        message: message,
        updateTime: db.serverDate()
      }
    })
    
    console.log(`任务 ${taskId} 进度更新为 ${progress}%: ${message}`)
  } catch (error) {
    console.error('更新任务进度失败:', error)
  }
}
