// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const BP_COLLECTION = 'bp_files'

/**
 * 保存BP文件信息的云函数
 * @param {Object} event 
 * @param {string} event.fileID 文件云存储ID
 * @param {string} event.name 文件名
 * @param {number} event.size 文件大小
 * @param {string} event.type 文件类型
 * @param {string} event.cloudPath 文件云存储路径
 * @returns {Object} 保存结果
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { fileID, name, size, type, cloudPath } = event

  if (!fileID) {
    return {
      code: 400,
      message: '文件ID不能为空'
    }
  }

  try {
    console.log(`保存BP文件信息，文件名: ${name}, 用户: ${OPENID}`)
    
    // 准备要保存的文件数据
    const fileData = {
      fileID,
      name,
      size,
      type,
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