// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const bpFilesCollection = db.collection('bp_files')

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { id } = event
  
  try {
    if (!id) {
      return {
        code: 400,
        message: '文件ID不能为空'
      }
    }
    
    // 获取分析详情
    const fileInfo = await bpFilesCollection.doc(id).get()
    
    if (!fileInfo.data) {
      return {
        code: 404,
        message: '文件不存在'
      }
    }
    
    // 检查权限
    const openid = wxContext.OPENID
    if (fileInfo.data._openid && fileInfo.data._openid !== openid) {
      return {
        code: 403,
        message: '没有权限查看此文件'
      }
    }
    
    return {
      code: 200,
      message: '获取分析详情成功',
      data: {
        id: fileInfo.data._id,
        fileName: fileInfo.data.fileName,
        fileSize: fileInfo.data.fileSize,
        fileType: fileInfo.data.fileType,
        uploadDate: fileInfo.data.createDate,
        fileID: fileInfo.data.fileID,
        status: fileInfo.data.status || 'pending',
        analysis: fileInfo.data.analysis || null,
        result: fileInfo.data.analysis ? fileInfo.data.analysis.result : null,
        analysisDate: fileInfo.data.analysis ? fileInfo.data.analysis.analysisDate : null
      }
    }
  } catch (error) {
    console.error('获取分析详情失败', error)
    return {
      code: 500,
      message: '获取分析详情失败',
      error: error
    }
  }
} 