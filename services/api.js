/**
 * API服务
 * 封装所有与后端API的交互
 */
import { logger } from '../utils/logger';

// 基础URL
const BASE_URL = 'https://api.bpmaster.example.com';

// API路径
const API = {
  AUTH: {
    LOGIN: '/auth/login',
    VERIFY: '/auth/verify',
    LOGOUT: '/auth/logout',
  },
  BP: {
    UPLOAD: '/bp/upload',
    ANALYZE: '/bp/analyze',
    LIST: '/bp/list',
    DETAIL: '/bp/detail',
    DELETE: '/bp/delete',
  },
  REPORT: {
    GENERATE: '/report/generate',
    LIST: '/report/list',
    DETAIL: '/report/detail',
    DOWNLOAD: '/report/download',
  }
};

/**
 * 发送请求
 * @param {string} url 请求地址
 * @param {string} method 请求方法
 * @param {Object} data 请求数据
 * @param {Object} options 其他选项
 * @returns {Promise} 请求结果
 */
const request = (url, method = 'GET', data = {}, options = {}) => {
  const token = wx.getStorageSync('token') || '';
  
  return new Promise((resolve, reject) => {
    logger.debug(`发起请求: ${method} ${url}`);
    
    wx.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: {
        'content-type': 'application/json',
        'authorization': token ? `Bearer ${token}` : '',
        ...options.header
      },
      success(res) {
        logger.debug(`请求成功: ${method} ${url}`, res.statusCode);
        
        // 处理HTTP状态码
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          // 未授权，可能是token过期
          logger.warn('未授权，需要重新登录');
          wx.removeStorageSync('token');
          reject(new Error('登录已过期，请重新登录'));
          
          // 跳转到登录页面
          wx.navigateTo({
            url: '/pages/index/index?auth=1'
          });
        } else {
          const errorMsg = res.data && res.data.message ? res.data.message : `请求失败: ${res.statusCode}`;
          logger.error(`请求失败: ${method} ${url}`, res.statusCode, errorMsg);
          reject(new Error(errorMsg));
        }
      },
      fail(err) {
        logger.error(`请求异常: ${method} ${url}`, err);
        reject(err);
      }
    });
  });
};

// API服务
export const apiService = {
  /**
   * 登录
   * @param {string} code 微信登录code
   * @returns {Promise} 登录结果
   */
  login(code) {
    return request(API.AUTH.LOGIN, 'POST', { code });
  },
  
  /**
   * 验证token
   * @returns {Promise} 验证结果
   */
  verifyToken() {
    return request(API.AUTH.VERIFY, 'POST');
  },
  
  /**
   * 登出
   * @returns {Promise} 登出结果
   */
  logout() {
    return request(API.AUTH.LOGOUT, 'POST');
  },
  
  /**
   * 上传BP文件
   * @param {Object} file 文件对象
   * @returns {Promise} 上传结果
   */
  uploadBP(file) {
    return new Promise((resolve, reject) => {
      logger.info('开始上传BP文件', file.name);
      
      const uploadTask = wx.uploadFile({
        url: `${BASE_URL}${API.BP.UPLOAD}`,
        filePath: file.path,
        name: 'file',
        header: {
          'authorization': `Bearer ${wx.getStorageSync('token') || ''}`,
        },
        success(res) {
          try {
            logger.info('BP文件上传成功', res);
            
            if (res.statusCode === 200) {
              const result = JSON.parse(res.data);
              resolve(result);
            } else if (res.statusCode === 401) {
              // 未授权，可能是token过期
              logger.warn('未授权，需要重新登录');
              wx.removeStorageSync('token');
              reject(new Error('登录已过期，请重新登录'));
              
              // 跳转到登录页面
              wx.navigateTo({
                url: '/pages/index/index?auth=1'
              });
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
  },
  
  /**
   * 分析BP
   * @param {string} fileId 文件ID
   * @returns {Promise} 分析结果
   */
  analyzeBP(fileId) {
    return request(API.BP.ANALYZE, 'POST', { fileId });
  },
  
  /**
   * 获取BP列表
   * @param {number} page 页码
   * @param {number} pageSize 每页数量
   * @returns {Promise} BP列表
   */
  getBPList(page = 1, pageSize = 10) {
    return request(API.BP.LIST, 'GET', { page, pageSize });
  },
  
  /**
   * 获取BP详情
   * @param {string} id BP ID
   * @returns {Promise} BP详情
   */
  getBPDetail(id) {
    return request(`${API.BP.DETAIL}/${id}`, 'GET');
  },
  
  /**
   * 删除BP
   * @param {string} id BP ID
   * @returns {Promise} 删除结果
   */
  deleteBP(id) {
    return request(`${API.BP.DELETE}/${id}`, 'POST');
  },
  
  /**
   * 生成报告
   * @param {string} bpId BP ID
   * @param {Object} options 报告选项
   * @returns {Promise} 生成结果
   */
  generateReport(bpId, options = {}) {
    return request(API.REPORT.GENERATE, 'POST', { bpId, options });
  },
  
  /**
   * 获取报告列表
   * @param {number} page 页码
   * @param {number} pageSize 每页数量
   * @returns {Promise} 报告列表
   */
  getReportList(page = 1, pageSize = 10) {
    return request(API.REPORT.LIST, 'GET', { page, pageSize });
  },
  
  /**
   * 获取报告详情
   * @param {string} id 报告ID
   * @returns {Promise} 报告详情
   */
  getReportDetail(id) {
    return request(`${API.REPORT.DETAIL}/${id}`, 'GET');
  },
  
  /**
   * 下载报告
   * @param {string} id 报告ID
   * @returns {Promise} 下载结果
   */
  downloadReport(id) {
    return new Promise((resolve, reject) => {
      const downloadUrl = `${BASE_URL}${API.REPORT.DOWNLOAD}/${id}`;
      logger.info('开始下载报告', downloadUrl);
      
      wx.downloadFile({
        url: downloadUrl,
        header: {
          'authorization': `Bearer ${wx.getStorageSync('token') || ''}`,
        },
        success(res) {
          if (res.statusCode === 200) {
            logger.info('报告下载成功');
            resolve(res.tempFilePath);
          } else {
            logger.error('报告下载失败', res);
            reject(new Error(`下载失败: ${res.statusCode}`));
          }
        },
        fail(err) {
          logger.error('报告下载异常', err);
          reject(err);
        }
      });
    });
  }
}; 