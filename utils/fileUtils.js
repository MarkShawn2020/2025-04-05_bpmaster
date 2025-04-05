/**
 * 文件工具类 - 处理文件相关的通用函数
 */

/**
 * 格式化文件大小
 * @param {Number} size - 文件大小（字节）
 * @returns {String} 格式化后的文件大小
 */
export function formatFileSize(size) {
  if (size < 1024) {
    return size + 'B';
  } else if (size < 1024 * 1024) {
    return (size / 1024).toFixed(2) + 'KB';
  } else if (size < 1024 * 1024 * 1024) {
    return (size / (1024 * 1024)).toFixed(2) + 'MB';
  } else {
    return (size / (1024 * 1024 * 1024)).toFixed(2) + 'GB';
  }
}

/**
 * 格式化日期为可读字符串
 * @param {Date} date - 日期对象
 * @returns {String} 格式化后的日期字符串
 */
export function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 根据文件名获取文件类型
 * @param {String} fileName - 文件名
 * @returns {String} 文件类型
 */
export function getFileTypeByName(fileName) {
  if (!fileName) return 'unknown';
  
  const extension = fileName.split('.').pop().toLowerCase();
  
  const typeMap = {
    'pdf': 'pdf',
    'doc': 'doc',
    'docx': 'doc',
    'ppt': 'ppt',
    'pptx': 'ppt',
    'xls': 'xls',
    'xlsx': 'xls',
    'txt': 'txt',
    'md': 'txt',
    'jpg': 'img',
    'jpeg': 'img',
    'png': 'img',
    'gif': 'img'
  };
  
  return typeMap[extension] || 'unknown';
}

/**
 * 获取文件的MIME类型
 * @param {String} fileName - 文件名
 * @returns {String} 文件的MIME类型
 */
export function getMimeType(fileName) {
  if (!fileName) return 'application/octet-stream';
  
  const extension = fileName.split('.').pop().toLowerCase();
  
  const mimeMap = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'txt': 'text/plain',
    'md': 'text/markdown',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif'
  };
  
  return mimeMap[extension] || 'application/octet-stream';
}

/**
 * 根据文件扩展名判断是否为有效的BP文件
 * @param {String} fileName - 文件名
 * @returns {Boolean} 是否为有效的BP文件
 */
export function isValidBPFile(fileName) {
  if (!fileName) return false;
  
  const extension = fileName.split('.').pop().toLowerCase();
  const validExtensions = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt'];
  
  return validExtensions.includes(extension);
}

export default {
  formatFileSize,
  formatDate,
  getFileTypeByName,
  getMimeType,
  isValidBPFile
}; 