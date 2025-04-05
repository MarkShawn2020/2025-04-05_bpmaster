// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const bpFilesCollection = db.collection('bp_files')

/**
 * 保存BP文件信息的云函数
 * @param {Object} event 
 * @param {string} event.fileID 文件云存储ID
 * @param {string} event.fileName 文件名
 * @param {number} event.fileSize 文件大小
 * @param {string} event.fileType 文件类型
 * @returns {Object} 保存结果
 */
exports.main = async (event, context) => {
  const { fileID, fileName, fileSize, fileType } = event
  const { OPENID } = cloud.getWXContext()
  
  console.log('保存BP文件信息', {
    fileID,
    fileName,
    fileSize,
    fileType,
    openid: OPENID
  })
  
  if (!fileID || !fileName) {
    return {
      code: 400,
      message: '缺少必要参数'
    }
  }
  
  try {
    // 记录文件信息到数据库
    const result = await bpFilesCollection.add({
      data: {
        fileID,
        fileName,
        fileSize: fileSize || 0,
        fileType: fileType || fileName.split('.').pop().toLowerCase(),
        uploadTime: db.serverDate(),
        openid: OPENID,
        status: 'pending',
        isAnalyzed: false,
        analysisResults: {},
        createTime: db.serverDate()
      }
    })
    
    console.log('文件信息保存成功', result)
    
    return {
      code: 200,
      message: '保存成功',
      fileId: result._id
    }
  } catch (error) {
    console.error('保存BP文件信息失败', error)
    return {
      code: 500,
      message: `保存失败: ${error.message || error}`
    }
  }
} 