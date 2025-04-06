// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const BP_COLLECTION = 'bp_files';

// 云函数入口函数
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { fileId } = event;

  if (!fileId) {
    return {
      code: 400,
      message: '文件ID不能为空'
    };
  }

  try {
    console.log(`获取BP文件基本信息，文件ID: ${fileId}, 用户: ${OPENID}`);
    
    // 从数据库获取文件记录
    const fileRecord = await db.collection(BP_COLLECTION)
      .doc(fileId)
      .get();
    
    if (!fileRecord || !fileRecord.data) {
      return {
        code: 404,
        message: '文件不存在'
      };
    }
    
    const fileData = fileRecord.data;
    
    // 返回基本信息
    return {
      code: 200,
      message: '获取成功',
      data: {
        _id: fileData._id,
        name: fileData.name,
        size: fileData.size,
        type: fileData.type,
        fileID: fileData.fileID,
        uploadDate: fileData.uploadDate || fileData.createTime,
        status: fileData.status || 'uploaded'
      }
    };
  } catch (err) {
    console.error('获取BP文件基本信息失败', err);
    return {
      code: 500,
      message: '查询失败',
      error: err
    };
  }
}; 