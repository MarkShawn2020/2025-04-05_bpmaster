// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

/**
 * 获取报告详情的云函数
 * 根据ID获取报告的详细信息
 */
exports.main = async (event, context) => {
  console.log('获取报告详情云函数被调用', event)
  
  const { id } = event
  
  if (!id) {
    return {
      code: 400,
      message: 'ID不能为空'
    }
  }
  
  const wxContext = cloud.getWXContext()
  const { OPENID } = wxContext
  
  try {
    const db = cloud.database()
    const reportCollection = db.collection('reports')
    
    // 查询报告信息
    const reportInfo = await reportCollection.doc(id).get()
    
    if (!reportInfo.data) {
      return {
        code: 404,
        message: '报告不存在'
      }
    }
    
    // 检查报告所有者
    if (reportInfo.data.openid !== OPENID) {
      return {
        code: 403,
        message: '无权限查看此报告'
      }
    }
    
    // 获取报告文件内容
    const fileID = reportInfo.data.fileID
    const tempFileRes = await cloud.getTempFileURL({
      fileList: [fileID]
    })
    
    const tempFileURL = tempFileRes.fileList[0].tempFileURL
    
    // 获取相关BP文件信息
    let bpInfo = null
    try {
      const bpCollection = db.collection('bp_files')
      const bpResult = await bpCollection.doc(reportInfo.data.bpId).get()
      bpInfo = bpResult.data
    } catch (err) {
      console.error('获取BP信息失败', err)
    }
    
    // 返回报告详情
    return {
      code: 200,
      message: '获取成功',
      data: {
        ...reportInfo.data,
        tempFileURL,
        bpInfo
      }
    }
  } catch (err) {
    console.error('获取报告详情失败', err)
    return {
      code: 500,
      message: '获取失败: ' + err.message
    }
  }
} 