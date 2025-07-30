/**
 * 文件相关工具函数
 */
import { error, info, warn } from './logger.js';


/**
 * 选择文件
 * @returns {Promise} 返回文件信息的Promise
 */
function chooseFile() {
  return new Promise((resolve, reject) => {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success: (res) => {
        if (res.tempFiles && res.tempFiles.length > 0) {
          const file = res.tempFiles[0];
          resolve({
            name: file.name,
            size: file.size,
            path: file.path,
            time: new Date().getTime()
          });
        } else {
          reject(new Error('未选择任何文件'));
        }
      },
      fail: (err) => {
        error('选择文件失败', err);
        reject(err);
      }
    });
  });
}

/**
 * 格式化文件大小
 * @param {number} size 文件大小（字节）
 * @returns {string} 格式化后的文件大小
 */
function formatFileSize(size) {
  if (!size || size === 0) return '0B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let index = 0;
  let fileSize = size;
  
  while (fileSize >= 1024 && index < units.length - 1) {
    fileSize /= 1024;
    index++;
  }
  
  return fileSize.toFixed(2) + units[index];
}

/**
 * 根据文件名获取文件类型
 * @param {string} fileName 文件名
 * @returns {string} 文件类型
 */
function getFileType(fileName) {
  if (!fileName) return 'unknown';
  
  // 获取文件扩展名
  const extension = fileName.split('.').pop().toLowerCase();
  
  // 根据扩展名返回文件类型
  if (['pdf'].includes(extension)) {
    return 'pdf';
  } else if (['doc', 'docx'].includes(extension)) {
    return 'doc';
  } else if (['ppt', 'pptx'].includes(extension)) {
    return 'ppt';
  } else if (['xls', 'xlsx'].includes(extension)) {
    return 'unknown'; // Fallback to unknown since xls icon is missing
  } else if (['txt'].includes(extension)) {
    return 'txt';
  } else {
    return 'unknown';
  }
}

/**
 * 判断文件类型是否支持
 * @param {string} fileType 文件类型
 * @returns {boolean} 是否支持
 */
function isSupportedFileType(fileType) {
  const supportedTypes = ['pdf', 'doc', 'ppt', 'txt'];
  return supportedTypes.includes(fileType);
}

/**
 * 根据文件类型获取图标
 * @param {string} fileType 文件类型
 * @returns {string} 图标路径
 */
function getFileIcon(fileType) {
  return `/images/file-icons/${fileType}.png`;
}

/**
 * 获取BP文件详细信息
 * @param {string} fileId - 文件ID
 * @returns {Promise<Object>} 返回文件信息的Promise
 */
async function getBPFileInfo(fileId) {
  try {
    info('获取文件详细信息', { fileId });
    if (!fileId) {
      throw new Error('缺少文件ID');
    }
    
    const db = wx.cloud.database();
    const fileRes = await db.collection('bp_files').doc(fileId).get();
    info('获取文件详细信息', fileRes);
    
    if (!fileRes || !fileRes.data) {
      throw new Error('文件不存在');
    }
    
    return fileRes.data;
  } catch (err) {
    error('获取文件详细信息失败', err);
    throw err;
  }
}

/**
 * 获取文件的临时访问URL
 * @param {string} fileID - 文件在云存储中的ID
 * @returns {Promise<string>} 返回文件临时URL的Promise
 */
async function getFileUrl(fileID) {
  try {
    info('获取文件临时URL', { fileID });
    if (!fileID) {
      throw new Error('缺少文件云存储ID');
    }
    
    const result = await wx.cloud.getTempFileURL({
      fileList: [fileID]
    });
    
    const tempUrl = result?.fileList?.[0]?.tempFileURL;
    if(!tempUrl){
      error('获取文件临时URL失败', result);
      throw new Error('获取文件临时URL失败');
    }
    info('获取文件临时URL成功', tempUrl);
    return tempUrl;
  } catch (err) {
    error('获取文件临时URL失败', err);
    throw err;
  }
}

/**
 * 获取BP文件列表
 * @param {number} page - 页码
 * @param {number} pageSize - 每页数量
 * @returns {Promise<Object>} 返回文件列表的Promise
 */
async function getBPList(page, pageSize) {
  try {
    info('获取BP文件列表', { page, pageSize });
    
    const db = wx.cloud.database();
    // 计算跳过的数量
    const skip = (page - 1) * pageSize;
    
    // 获取当前用户ID
    const userInfo = wx.getStorageSync('userInfo') || {};
    const openid = userInfo.openid;
    
    if (!openid) {
      throw new Error('用户未登录');
    }
    
    // 查询条件：当前用户的文件
    const query = {
      openid: openid
    };
    
    // 使用count方法获取总数
    const countResult = await db.collection('bp_files').where(query).count();
    
    // 获取文件列表，按上传时间降序排列
    const listResult = await db.collection('bp_files')
      .where(query)
      .orderBy('uploadTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();
    
    // 返回结果
    return {
      code: 200,
      message: '获取成功',
      data: {
        list: listResult.data || [],
        total: countResult.total || 0,
        page,
        pageSize
      }
    };
  } catch (err) {
    error('获取BP文件列表失败', err);
    return {
      code: 500,
      message: err.message || '获取列表失败',
      error: err
    };
  }
}

/**
 * 获取BP文件详情
 * @param {string} fileId - 文件ID
 * @returns {Promise<Object>} 返回文件详情的Promise
 */
async function getBPDetail(fileId) {
  try {
    info('获取BP详情', { fileId });
    if (!fileId) {
      throw new Error('文件ID不能为空');
    }
    
    const db = wx.cloud.database();
    
    // 查询BP文件信息
    const fileRes = await db.collection('bp_files').doc(fileId).get();
    if (!fileRes || !fileRes.data) {
      throw new Error('找不到文件信息');
    }
    
    // 查询BP分析报告（如果存在）
    let report = null;
    try {
      const reportRes = await db.collection('reports')
        .where({ fileId: fileId })
        .get();
      
      if (reportRes && reportRes.data && reportRes.data.length > 0) {
        report = reportRes.data[0];
      }
    } catch (e) {
      // 报告可能不存在，不影响主流程
      warn('查询报告失败', e);
    }
    
    // 返回完整的数据
    return {
      code: 200,
      message: '获取成功',
      data: {
        ...fileRes.data,
        report
      }
    };
  } catch (err) {
    error('获取BP详情失败', err);
    return {
      code: 500,
      message: err.message || '获取详情失败',
      error: err
    };
  }
}

export {
  chooseFile,
  formatFileSize,
  getFileType,
  isSupportedFileType,
  getFileIcon,
  getBPFileInfo,
  getFileUrl,
  getBPList,
  getBPDetail
};