// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

/**
 * 获取报告文件ID的云函数
 * 用于下载报告前获取文件ID
 */
exports.main = async (event, context) => {
  console.log('获取报告文件ID云函数被调用', event)
  
  const { id } = event
  
  if (!id) {
    return {
      code: 400,
      message: '报告ID不能为空'
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
        message: '无权限下载此报告'
      }
    }
    
    // 获取文件临时下载链接
    const result = await cloud.getTempFileURL({
      fileList: [reportInfo.data.fileID]
    })
    
    return {
      code: 200,
      message: '获取成功',
      data: {
        fileID: reportInfo.data.fileID,
        tempFileURL: result.fileList[0].tempFileURL,
        fileName: reportInfo.data.fileName
      }
    }
  } catch (err) {
    console.error('获取报告文件ID失败', err)
    return {
      code: 500,
      message: '获取失败: ' + err.message
    }
  }
} 