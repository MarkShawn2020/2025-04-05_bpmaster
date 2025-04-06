// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const BP_COLLECTION = 'bp_files';

/**
 * 获取文件临时下载地址
 * 参数：fileId - 文件ID
 * 返回：临时下载URL
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { fileId } = event;

  console.log(`获取文件下载地址，文件ID: ${fileId}, 用户: ${OPENID}`);

  if (!fileId) {
    return {
      code: 400,
      message: '文件ID不能为空',
      fileUrl: ''
    };
  }

  try {
    // 1. 从数据库获取文件记录
    const fileRecord = await db.collection(BP_COLLECTION)
      .doc(fileId)
      .get();
    
    if (!fileRecord || !fileRecord.data) {
      return {
        code: 404,
        message: '文件不存在',
        fileUrl: ''
      };
    }
    
    const fileData = fileRecord.data;
    
    // 2. 检查是否有cloudFileID
    if (!fileData.fileID) {
      console.error('文件记录中缺少fileID', fileData);
      return {
        code: 400,
        message: '文件数据不完整',
        fileUrl: ''
      };
    }

    // 3. 获取文件临时下载地址
    const result = await cloud.getTempFileURL({
      fileList: [fileData.fileID]
    });

    console.log('获取临时下载URL结果', result);

    if (result.fileList && result.fileList.length > 0) {
      const fileInfo = result.fileList[0];
      
      if (fileInfo.status === 0 && fileInfo.tempFileURL) {
        // 4. 返回临时URL
        return {
          code: 200,
          message: '获取成功',
          fileUrl: fileInfo.tempFileURL,
          fileName: fileData.name || '',
          expiresIn: 3600 // URL有效期（秒）
        };
      } else {
        console.error('获取临时URL失败', fileInfo);
        return {
          code: 500,
          message: fileInfo.errMsg || '获取下载地址失败',
          fileUrl: ''
        };
      }
    } else {
      console.error('获取临时URL未返回结果', result);
      return {
        code: 500,
        message: '获取下载地址失败',
        fileUrl: ''
      };
    }
  } catch (err) {
    console.error('获取文件下载地址失败', err);
    return {
      code: 500,
      message: '处理失败: ' + err.message,
      fileUrl: '',
      error: err
    };
  }
}; 