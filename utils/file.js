/**
 * 文件处理工具
 * 提供文件上传、下载、预览等功能
 */
import { logger } from './logger';

// 支持的文件类型
const SUPPORTED_FILE_TYPES = {
  PDF: {
    extension: 'pdf',
    mimeType: 'application/pdf'
  },
  WORD: {
    extension: ['doc', 'docx'],
    mimeType: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  },
  EXCEL: {
    extension: ['xls', 'xlsx'],
    mimeType: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
  },
  PPT: {
    extension: ['ppt', 'pptx'],
    mimeType: ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
  }
};

// 最大文件大小(20MB)
const MAX_FILE_SIZE = 20 * 1024 * 1024;

/**
 * 检查文件是否是有效的BP文件
 * @param {Object} file 文件对象
 * @returns {boolean} 是否有效
 */
export const isValidBPFile = (file) => {
  // 检查文件大小
  if (file.size > MAX_FILE_SIZE) {
    logger.warn('文件过大', file.size);
    return false;
  }

  // 检查文件类型
  const fileExtension = file.name.split('.').pop().toLowerCase();
  const isSupported = Object.values(SUPPORTED_FILE_TYPES).some(type => {
    if (Array.isArray(type.extension)) {
      return type.extension.includes(fileExtension);
    }
    return type.extension === fileExtension;
  });

  if (!isSupported) {
    logger.warn('不支持的文件类型', fileExtension);
  }

  return isSupported;
};

/**
 * 选择文件
 * @returns {Promise} 文件选择结果
 */
export const chooseFile = () => {
  return new Promise((resolve, reject) => {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: [
        ...SUPPORTED_FILE_TYPES.PDF.extension,
        ...(Array.isArray(SUPPORTED_FILE_TYPES.WORD.extension) ? SUPPORTED_FILE_TYPES.WORD.extension : [SUPPORTED_FILE_TYPES.WORD.extension]),
        ...(Array.isArray(SUPPORTED_FILE_TYPES.EXCEL.extension) ? SUPPORTED_FILE_TYPES.EXCEL.extension : [SUPPORTED_FILE_TYPES.EXCEL.extension]),
        ...(Array.isArray(SUPPORTED_FILE_TYPES.PPT.extension) ? SUPPORTED_FILE_TYPES.PPT.extension : [SUPPORTED_FILE_TYPES.PPT.extension])
      ],
      success(res) {
        logger.info('文件选择成功', res.tempFiles[0].name);
        const file = res.tempFiles[0];
        if (isValidBPFile(file)) {
          resolve(file);
        } else {
          reject(new Error('选择的文件无效'));
        }
      },
      fail(err) {
        logger.error('文件选择失败', err);
        reject(err);
      }
    });
  });
};

/**
 * 上传文件到服务器
 * @param {Object} file 文件对象
 * @param {string} url 上传地址
 * @param {Object} data 附加数据
 * @returns {Promise} 上传结果
 */
export const uploadFile = (file, url, data = {}) => {
  return new Promise((resolve, reject) => {
    logger.info('开始上传文件', file.name);
    
    const uploadTask = wx.uploadFile({
      url: url,
      filePath: file.path,
      name: 'file',
      formData: data,
      header: {
        'content-type': 'multipart/form-data',
        'authorization': `Bearer ${wx.getStorageSync('token') || ''}`
      },
      success(res) {
        try {
          logger.info('文件上传成功', res);
          
          if (res.statusCode === 200) {
            const result = JSON.parse(res.data);
            resolve(result);
          } else {
            logger.error('上传接口返回错误', res);
            reject(new Error(`上传失败: ${res.statusCode}`));
          }
        } catch (error) {
          logger.error('解析上传结果失败', error);
          reject(error);
        }
      },
      fail(err) {
        logger.error('文件上传失败', err);
        reject(err);
      }
    });
    
    // 上传进度监听
    uploadTask.onProgressUpdate((res) => {
      logger.debug('上传进度', res.progress);
      // 可以在这里更新UI上的进度条
    });
  });
};

/**
 * 预览文件
 * @param {string} url 文件URL
 * @returns {Promise} 预览结果
 */
export const previewFile = (url) => {
  return new Promise((resolve, reject) => {
    logger.info('预览文件', url);
    
    wx.downloadFile({
      url: url,
      success(res) {
        const filePath = res.tempFilePath;
        wx.openDocument({
          filePath: filePath,
          showMenu: true,
          success() {
            logger.info('打开文档成功');
            resolve();
          },
          fail(err) {
            logger.error('打开文档失败', err);
            reject(err);
          }
        });
      },
      fail(err) {
        logger.error('下载文件失败', err);
        reject(err);
      }
    });
  });
};

/**
 * 获取文件信息
 * @param {string} filePath 文件路径
 * @returns {Promise} 文件信息
 */
export const getFileInfo = (filePath) => {
  return new Promise((resolve, reject) => {
    wx.getFileInfo({
      filePath,
      success(res) {
        logger.info('获取文件信息成功', res);
        resolve(res);
      },
      fail(err) {
        logger.error('获取文件信息失败', err);
        reject(err);
      }
    });
  });
};

/**
 * 格式化文件大小
 * @param {number} size 文件大小（字节）
 * @returns {string} 格式化后的文件大小
 */
export const formatFileSize = (size) => {
  if (size < 1024) {
    return size + 'B';
  } else if (size < 1024 * 1024) {
    return (size / 1024).toFixed(2) + 'KB';
  } else if (size < 1024 * 1024 * 1024) {
    return (size / (1024 * 1024)).toFixed(2) + 'MB';
  } else {
    return (size / (1024 * 1024 * 1024)).toFixed(2) + 'GB';
  }
}; 