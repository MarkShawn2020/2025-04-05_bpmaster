// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

/**
 * 删除BP文件的云函数
 * 根据ID删除BP文件及相关数据
 */
exports.main = async (event, context) => {
  console.log('删除BP文件云函数被调用', event)
  
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
    const bpCollection = db.collection('bp_files')
    
    // 查询文件信息
    const fileInfo = await bpCollection.doc(id).get()
    
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
        message: '无权限删除此文件'
      }
    }
    
    // 删除云存储中的文件
    await cloud.deleteFile({
      fileList: [fileInfo.data.fileID]
    })
    
    // 删除数据库中的记录
    await bpCollection.doc(id).remove()
    
    return {
      code: 200,
      message: '删除成功'
    }
  } catch (err) {
    console.error('删除BP文件失败', err)
    return {
      code: 500,
      message: '删除失败: ' + err.message
    }
  }
} 