/**
 * 文件服务 - 处理文件上传、下载和处理
 */
import { logger } from '../utils/logger';
import { apiService } from './api';

/**
 * 上传文件到服务器
 * @param {Object} file - 文件对象，包含路径和名称
 * @returns {Promise} 包含上传结果的Promise
 */
export function uploadFile(file) {
  logger.info('开始上传文件', { name: file.name });
  
  return new Promise((resolve, reject) => {
    // 调用微信上传文件API
    const uploadTask = wx.uploadFile({
      url: apiService.getApiUrl('/upload'), // 实际项目中替换为真实的上传URL
      filePath: file.path,
      name: 'file',
      formData: {
        'filename': file.name
      },
      success(res) {
        logger.info('文件上传成功', { name: file.name, status: res.statusCode });
        try {
          if (res.statusCode === 200) {
            // 将返回的字符串数据解析为JSON
            const result = JSON.parse(res.data);
            resolve(result);
          } else {
            reject(new Error(`上传失败: ${res.statusCode}`));
          }
        } catch (error) {
          logger.error('解析上传响应失败', error);
          reject(new Error('解析响应失败'));
        }
      },
      fail(error) {
        logger.error('文件上传失败', { name: file.name, error });
        reject(new Error(error.errMsg || '上传失败'));
      }
    });
    
    // 监听上传进度
    uploadTask.onProgressUpdate((res) => {
      logger.debug('上传进度', { progress: res.progress, name: file.name });
      // 这里可以添加进度回调
    });
  });
}

/**
 * 模拟上传文件（开发环境使用）
 * @param {Object} file - 文件对象
 * @returns {Promise} 模拟的上传结果
 */
export function mockUploadFile(file) {
  logger.info('模拟上传文件', { name: file.name });
  
  return new Promise((resolve) => {
    // 模拟上传延迟
    setTimeout(() => {
      resolve({
        fileId: 'mock-file-' + Date.now(),
        name: file.name,
        url: 'https://example.com/files/' + file.name,
        size: file.size
      });
    }, 2000); // 2秒模拟延迟
  });
}

/**
 * 检查文件是否已存在
 * @param {String} filename - 文件名
 * @returns {Promise<Boolean>} 文件是否存在
 */
export function checkFileExists(filename) {
  return apiService.request({
    url: '/files/check',
    method: 'GET',
    data: { filename }
  }).then(res => res.exists);
}

/**
 * 获取文件下载链接
 * @param {String} fileId - 文件ID
 * @returns {Promise<String>} 文件下载链接
 */
export function getFileDownloadUrl(fileId) {
  return apiService.request({
    url: '/files/download',
    method: 'GET',
    data: { fileId }
  }).then(res => res.downloadUrl);
}

/**
 * 模拟生成分析报告文档
 * @param {Object} analysisResult - 分析结果数据
 * @returns {Promise<String>} 生成的文档URL
 */
export function mockGenerateReportDoc(analysisResult) {
  logger.info('模拟生成分析报告文档', { analysisId: analysisResult.id });
  
  return new Promise((resolve) => {
    // 模拟生成延迟
    setTimeout(() => {
      resolve({
        docUrl: 'https://example.com/reports/report-' + Date.now() + '.docx',
        filename: '商业计划书分析报告.docx'
      });
    }, 3000); // 3秒模拟延迟
  });
}

/**
 * 删除已上传的文件
 * @param {String} fileId - 文件ID
 * @returns {Promise} 删除结果
 */
export function deleteFile(fileId) {
  return apiService.request({
    url: '/files/delete',
    method: 'POST',
    data: { fileId }
  });
}

export default {
  uploadFile,
  mockUploadFile,
  checkFileExists,
  getFileDownloadUrl,
  mockGenerateReportDoc,
  deleteFile
}; 