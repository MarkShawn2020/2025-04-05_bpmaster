// 云函数入口文件
const cloud = require('wx-server-sdk')

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
      status: fileData.status || 'uploaded'
    }
    
    console.log(`文件记录获取成功，文件名: ${result.name}`)
    
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