// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const BP_COLLECTION = 'bp_files'

/**
 * 保存BP文件信息的云函数
 * @param {Object} event 
 * @param {string} event.fileID 文件云存储ID
 * @param {string} event.fileName 文件名
 * @param {number} event.fileSize 文件大小
 * @param {string} event.fileType 文件类型
 * @param {string} event.cloudPath 文件云存储路径
 * @returns {Object} 保存结果
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  
  // 支持旧的参数名和新的参数名，确保向后兼容
  const fileID = event.fileID;
  const fileName = event.fileName || event.name;
  const fileSize = event.fileSize || event.size;
  const fileType = event.fileType || event.type;
  const cloudPath = event.cloudPath;

  if (!fileID) {
    return {
      code: 400,
      message: '文件ID不能为空'
    }
  }

  try {
    console.log(`保存BP文件信息，文件名: ${fileName}, 用户: ${OPENID}`)
    
    // 准备要保存的文件数据，统一使用新的字段命名
    const fileData = {
      fileID,
      fileName,         // 使用统一的字段名
      name: fileName,   // 保留旧字段以兼容现有代码
      fileSize,         // 使用统一的字段名
      size: fileSize,   // 保留旧字段以兼容现有代码
      fileType,         // 使用统一的字段名
      type: fileType,   // 保留旧字段以兼容现有代码
      cloudPath,
      openid: OPENID,
      uploadDate: new Date(),
      status: 'uploaded',
      _updateTime: db.serverDate()
    }
    
    // 保存到数据库
    const result = await db.collection(BP_COLLECTION).add({
      data: fileData
    })
    
    if (!result._id) {
      throw new Error('保存文件信息失败')
    }
    
    console.log(`文件信息保存成功，文件ID: ${result._id}`)
    
    return {
      code: 200,
      message: '保存成功',
      fileId: result._id
    }
  } catch (err) {
    console.error('保存BP文件信息失败', err)
    return {
      code: 500,
      message: '保存失败',
      error: err
    }
  }
} 