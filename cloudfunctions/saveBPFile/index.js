// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

/**
 * 保存BP文件信息的云函数
 * 接收文件信息并存储到数据库
 */
exports.main = async (event, context) => {
  console.log('保存BP文件云函数被调用', event)
  
  const { fileID, fileName, fileSize, fileType } = event
  
  if (!fileID || !fileName) {
    return {
      code: 400,
      message: '文件ID和文件名不能为空'
    }
  }
  
  const wxContext = cloud.getWXContext()
  const { OPENID } = wxContext
  
  try {
    const db = cloud.database()
    const bpCollection = db.collection('bp_files')
    
    // 保存文件信息
    const result = await bpCollection.add({
      data: {
        fileID,
        fileName,
        fileSize: fileSize || 0,
        fileType: fileType || 'unknown',
        uploadTime: db.serverDate(),
        openid: OPENID,
        status: 'pending', // pending, analyzing, completed, failed
        isAnalyzed: false,
        analysisResults: null
      }
    })
    
    return {
      code: 200,
      message: '文件信息保存成功',
      fileId: result._id
    }
  } catch (err) {
    console.error('保存BP文件信息失败', err)
    return {
      code: 500,
      message: '保存失败: ' + err.message
    }
  }
} 