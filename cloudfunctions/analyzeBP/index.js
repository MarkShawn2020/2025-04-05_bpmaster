// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

/**
 * 分析BP文件的云函数
 * 接收文件ID，读取文件并进行AI分析
 */
exports.main = async (event, context) => {
  console.log('分析BP文件云函数被调用', event)
  
  const { fileId } = event
  
  if (!fileId) {
    return {
      code: 400,
      message: '文件ID不能为空'
    }
  }
  
  const wxContext = cloud.getWXContext()
  const { OPENID } = wxContext
  
  try {
    const db = cloud.database()
    const bpCollection = db.collection('bp_files')
    
    // 查询文件信息
    const fileInfo = await bpCollection.doc(fileId).get()
    
    if (!fileInfo.data) {
      return {
        code: 404,
        message: '文件不存在'
      }
    }
    
    // 检查文件所有者
    if (fileInfo.data.openid !== OPENID) {
      return {
        code: 403,
        message: '无权限分析此文件'
      }
    }
    
    // 更新文件状态为分析中
    await bpCollection.doc(fileId).update({
      data: {
        status: 'analyzing'
      }
    })
    
    // 获取文件
    const fileID = fileInfo.data.fileID
    
    // 这里应该实现文件内容的获取和分析逻辑
    // 本示例使用模拟分析结果
    const analysisResults = {
      summary: '这是一个商业计划书的分析摘要',
      score: 85,
      strengths: [
        '市场定位清晰',
        '商业模式可行',
        '团队背景匹配'
      ],
      weaknesses: [
        '财务预测不够详细',
        '竞争分析有待加强'
      ],
      recommendations: [
        '建议完善财务模型',
        '深入分析竞争对手',
        '明确用户获取策略'
      ],
      analysisDate: new Date()
    }
    
    // 更新分析结果
    await bpCollection.doc(fileId).update({
      data: {
        status: 'completed',
        isAnalyzed: true,
        analysisResults: analysisResults,
        analyzedAt: db.serverDate()
      }
    })
    
    return {
      code: 200,
      message: '分析完成',
      results: analysisResults
    }
    
  } catch (err) {
    console.error('分析BP文件失败', err)
    
    // 如果出错，更新文件状态为失败
    try {
      const db = cloud.database()
      await db.collection('bp_files').doc(fileId).update({
        data: {
          status: 'failed',
          error: err.message
        }
      })
    } catch (updateErr) {
      console.error('更新文件状态失败', updateErr)
    }
    
    return {
      code: 500,
      message: '分析失败: ' + err.message
    }
  }
} 