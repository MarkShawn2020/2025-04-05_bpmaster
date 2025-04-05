// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

/**
 * 生成分析报告的云函数
 * 根据BP文件ID和选项生成详细报告
 */
exports.main = async (event, context) => {
  console.log('生成报告云函数被调用', event)
  
  const { bpId, options = {} } = event
  
  if (!bpId) {
    return {
      code: 400,
      message: 'BP文件ID不能为空'
    }
  }
  
  const wxContext = cloud.getWXContext()
  const { OPENID } = wxContext
  
  try {
    const db = cloud.database()
    const bpCollection = db.collection('bp_files')
    const reportCollection = db.collection('reports')
    
    // 查询BP文件信息
    const bpFile = await bpCollection.doc(bpId).get()
    
    if (!bpFile.data) {
      return {
        code: 404,
        message: 'BP文件不存在'
      }
    }
    
    // 检查文件所有者
    if (bpFile.data.openid !== OPENID) {
      return {
        code: 403,
        message: '无权限生成此文件的报告'
      }
    }
    
    // 检查文件是否已分析
    if (!bpFile.data.isAnalyzed || bpFile.data.status !== 'completed') {
      return {
        code: 400,
        message: '文件尚未完成分析，无法生成报告'
      }
    }
    
    // 生成报告内容（这里是模拟生成）
    const reportContent = {
      title: `${bpFile.data.fileName} - 分析报告`,
      summary: bpFile.data.analysisResults.summary,
      score: bpFile.data.analysisResults.score,
      detailedAnalysis: [
        {
          section: '市场分析',
          content: '市场潜力评估与竞争格局分析...',
          score: 85
        },
        {
          section: '商业模式',
          content: '商业模式可行性与盈利能力分析...',
          score: 80
        },
        {
          section: '团队评估',
          content: '团队背景与执行力分析...',
          score: 90
        },
        {
          section: '财务预测',
          content: '财务模型与预测合理性分析...',
          score: 75
        }
      ],
      strengths: bpFile.data.analysisResults.strengths,
      weaknesses: bpFile.data.analysisResults.weaknesses,
      recommendations: bpFile.data.analysisResults.recommendations,
      generatedOptions: options
    }
    
    // 创建报告文件内容（这里简化为JSON字符串）
    const reportFileContent = JSON.stringify(reportContent, null, 2)
    
    // 上传报告文件到云存储
    const cloudPath = `reports/${OPENID}/${Date.now()}_${bpFile.data.fileName}_report.json`
    const uploadResult = await cloud.uploadFile({
      cloudPath,
      fileContent: Buffer.from(reportFileContent)
    })
    
    // 保存报告信息到数据库
    const reportData = {
      bpId: bpId,
      fileID: uploadResult.fileID,
      fileName: `${bpFile.data.fileName}_report`,
      fileType: 'json',
      openid: OPENID,
      createdAt: db.serverDate(),
      options: options,
      summary: reportContent.summary,
      score: reportContent.score
    }
    
    const reportResult = await reportCollection.add({
      data: reportData
    })
    
    return {
      code: 200,
      message: '报告生成成功',
      data: {
        reportId: reportResult._id,
        ...reportData
      }
    }
  } catch (err) {
    console.error('生成报告失败', err)
    return {
      code: 500,
      message: '生成报告失败: ' + err.message
    }
  }
} 