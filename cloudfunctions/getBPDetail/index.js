// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

/**
 * 获取BP文件详情的云函数
 * 根据ID获取BP文件的详细信息及分析结果
 */
exports.main = async (event, context) => {
  console.log('获取BP文件详情云函数被调用', event)
  
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
    
    // 查询文件详情
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
        message: '无权限查看此文件'
      }
    }
    
    // 获取临时文件URL（有效期一小时）
    let tempFileURL = null
    try {
      const result = await cloud.getTempFileURL({
        fileList: [fileInfo.data.fileID]
      })
      tempFileURL = result.fileList[0].tempFileURL
    } catch (err) {
      console.error('获取临时文件URL失败', err)
    }
    
    // 返回文件详情
    return {
      code: 200,
      message: '获取成功',
      data: {
        ...fileInfo.data,
        tempFileURL
      }
    }
  } catch (err) {
    console.error('获取BP文件详情失败', err)
    return {
      code: 500,
      message: '获取失败: ' + err.message
    }
  }
} 