/**
 * 文件相关工具函数
 */
import { error } from './logger.js';

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
    return 'xls';
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

export {
  chooseFile,
  formatFileSize,
  getFileType,
  isSupportedFileType,
  getFileIcon
};