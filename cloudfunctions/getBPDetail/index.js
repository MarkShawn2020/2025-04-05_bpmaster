// 云函数入口文件
const cloud = require('wx-server-sdk')
const { CozeAPI } = require('@coze/api')

// Coze API配置信息
const COZE_WORKFLOW_ID = '7488013332172193801' // 工作流ID
const COZE_API_TOKEN = 'pat_qLidHTjFnf7XlU0UwEz2L2OcWl34KsuSU56X9V1dFDAuhNf3atXTOl2gO5G2laVN' // API令牌

// 初始化Coze API客户端
const apiClient = new CozeAPI({
  token: COZE_API_TOKEN,
  baseURL: 'https://api.coze.cn'
})

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command
const BP_COLLECTION = 'bp_files'

/**
 * 获取BP文件详情的云函数
 * 根据ID获取BP文件的详细信息及分析结果
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { id } = event

  if (!id) {
    return {
      code: 400,
      message: '文件ID不能为空'
    }
  }

  try {
    console.log(`查询BP文件，文件ID: ${id}, 用户: ${OPENID}`)
    
    // 从数据库获取文件记录
    const fileRecord = await db.collection(BP_COLLECTION)
      .doc(id)
      .get()
    
    if (!fileRecord || !fileRecord.data) {
      return {
        code: 404,
        message: '文件不存在'
      }
    }
    
    const fileData = fileRecord.data
    
    // 如果文件状态是"分析中"，且有工作流ID，尝试查询工作流状态
    if (fileData.status === 'analyzing' && fileData.cozeWorkflowRunId) {
      try {
        console.log(`查询工作流执行状态，工作流ID: ${COZE_WORKFLOW_ID}, 执行ID: ${fileData.cozeWorkflowRunId}`)
        
        // 使用工作流历史API查询执行结果
        const workflowResult = await apiClient.workflows.runs.history(
          COZE_WORKFLOW_ID,
          fileData.cozeWorkflowRunId
        )
        
        console.log('获取到工作流执行结果:', {
          status: workflowResult.status,
          hasOutput: !!workflowResult.output,
          executeTime: workflowResult.execute_time
        })
        
        // 检查工作流执行是否已完成
        if (workflowResult.status === 'completed' && workflowResult.output) {
          console.log('工作流执行已完成，提取输出结果')
          
          // 尝试解析输出内容
          let outputContent = ''
          
          try {
            // 如果输出是JSON字符串,尝试解析
            const outputObj = typeof workflowResult.output === 'string' 
              ? JSON.parse(workflowResult.output)
              : workflowResult.output
              
            // 提取实际内容
            if (outputObj.output) {
              outputContent = outputObj.output
            } else if (typeof outputObj === 'string') {
              outputContent = outputObj
            } else {
              outputContent = JSON.stringify(outputObj)
            }
          } catch (parseErr) {
            // 如果解析失败，直接使用原始输出
            console.error('解析工作流输出失败，使用原始内容', parseErr)
            outputContent = workflowResult.output
          }
          
          // 确保我们有内容可以保存
          if (outputContent) {
            // 更新数据库中的分析结果
            await db.collection(BP_COLLECTION).doc(id).update({
              data: {
                analysisResults: {
                  markdownContent: outputContent,
                  contentType: 'text',
                  analysisDate: db.serverDate(),
                  workflowRunId: fileData.cozeWorkflowRunId,
                  executeTime: workflowResult.execute_time
                },
                status: 'analyzed',
                updateTime: db.serverDate(),
                analysisComplete: true
              }
            })
            
            // 更新文件数据对象，用于后续返回
            fileData.analysisResults = {
              markdownContent: outputContent,
              contentType: 'text',
              analysisDate: new Date(),
              workflowRunId: fileData.cozeWorkflowRunId
            }
            fileData.status = 'analyzed'
            
            console.log('已更新分析结果到数据库')
          } else {
            console.warn('工作流执行完成但无有效输出内容')
          }
        } else if (workflowResult.status === 'failed') {
          // 工作流执行失败
          console.error('工作流执行失败', workflowResult.error || '未知错误')
          
          // 更新文件状态为失败
          await db.collection(BP_COLLECTION).doc(id).update({
            data: {
              status: 'failed',
              error: workflowResult.error || '分析过程失败',
              updateTime: db.serverDate()
            }
          })
          
          // 更新文件数据对象
          fileData.status = 'failed'
          fileData.error = workflowResult.error || '分析过程失败'
        } else {
          console.log('工作流仍在执行中或状态未知', workflowResult.status)
        }
      } catch (cozeErr) {
        console.error('查询工作流状态失败', cozeErr)
        // 此处不抛出错误，仍返回文件当前状态
      }
    }
    
    // 整理返回的文件信息
    const result = {
      _id: fileData._id,
      name: fileData.name,
      size: fileData.size,
      type: fileData.type,
      fileID: fileData.fileID,
      cloudPath: fileData.cloudPath,
      uploadDate: fileData.createTime || fileData.uploadDate,
      analysisResults: fileData.analysisResults || null,
      status: fileData.status || 'uploaded',
      error: fileData.error,
      cozeWorkflowRunId: fileData.cozeWorkflowRunId
    }
    
    console.log(`文件记录获取成功，文件名: ${result.name}, 状态: ${result.status}`)
    
    return {
      code: 200,
      message: '获取成功',
      data: result
    }
  } catch (err) {
    console.error('获取BP文件详情失败', err)
    return {
      code: 500,
      message: '查询文件失败',
      error: err
    }
  }
} 