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
  const { fileId, result } = event
  
  console.log('保存分析结果', { fileId, resultLength: result ? result.markdown.length : 0 })
  
  try {
    if (!fileId) {
      return {
        code: 400,
        message: '文件ID不能为空'
      }
    }
    
    // 获取当前文件信息
    const fileInfo = await bpFilesCollection.doc(fileId).get()
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
        message: '没有权限修改此文件'
      }
    }
    
    // 更新文件分析结果
    await bpFilesCollection.doc(fileId).update({
      data: {
        analysis: {
          result: result,
          analysisDate: db.serverDate()
        },
        status: 'analyzed'
      }
    })
    
    return {
      code: 200,
      message: '保存分析结果成功',
      fileId
    }
  } catch (error) {
    console.error('保存分析结果失败', error)
    return {
      code: 500,
      message: '保存分析结果失败',
      error: error
    }
  }
} 