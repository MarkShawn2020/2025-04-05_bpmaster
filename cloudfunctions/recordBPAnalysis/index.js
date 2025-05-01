// 云函数入口文件
const cloud = require("wx-server-sdk")

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()

// 专业的日志记录工具
const logger = {
  info: (message, data) => {
    console.log(`[INFO] ${message}`, data || "")
  },
  error: (message, err) => {
    console.error(`[ERROR] ${message}`, err || "")
  }
}

/**
 * 记录BP分析任务（仅用于数据记录，实际分析由前端直接调用Coze API）
 * @param {Object} event 
 * @param {string} event.fileId - 文件ID
 * @param {string} event.fileUrl - 文件URL
 * @returns {Object} 记录结果
 */
exports.main = async (event, context) => {
  const { fileId, fileUrl } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  logger.info("记录BP分析任务", { fileId, openid })
  
  try {
    // 参数校验
    if (!fileId || !fileUrl) {
      logger.error("缺少必要参数", { fileId, fileUrl })
      return { 
        code: 400, 
        message: "缺少必要参数" 
      }
    }
    
    // 查询文件是否存在
    const fileInfo = await db.collection("bp_files")
      .doc(fileId)
      .get()
      .then(res => res.data)
      .catch(err => {
        logger.error("获取文件信息失败", err)
        return null
      })
    
    if (!fileInfo) {
      logger.error("文件不存在", { fileId })
      return { 
        code: 404, 
        message: "文件不存在" 
      }
    }
    
    // 检查权限（只能操作自己的文件）
    if (fileInfo.openid !== openid) {
      logger.error("无权限操作此文件", { fileId, openid, fileOpenid: fileInfo.openid })
      return { 
        code: 403, 
        message: "无权限操作此文件" 
      }
    }
    
    // 创建分析记录
    const now = db.serverDate()
    const recordResult = await db.collection("analysis_records").add({
      data: {
        fileId: fileId,
        fileUrl: fileUrl,
        openid: openid,
        createTime: now,
        updateTime: now,
        status: "pending", // 初始状态为待处理
        content: "",       // 初始内容为空
        errorMessage: "",  // 初始无错误信息
      }
    })
    
    logger.info("创建分析记录成功", { recordId: recordResult._id })
    
    return {
      code: 0,
      message: "创建分析记录成功",
      recordId: recordResult._id
    }
  } catch (err) {
    logger.error("记录BP分析任务失败", err)
    return {
      code: 500,
      message: "记录BP分析任务失败: " + err.message,
      error: err
    }
  }
}
