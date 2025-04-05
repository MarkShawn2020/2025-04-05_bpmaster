/**
 * API服务
 * 封装所有与云开发的交互
 */
import { logger } from '../utils/logger';

// API服务
export const apiService = {
  /**
   * 登录
   * @param {string} code 微信登录code
   * @returns {Promise} 登录结果
   */
  login(code) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'login',
        data: { code },
        success: (res) => {
          logger.info('云函数登录成功', res);
          resolve(res.result);
        },
        fail: (err) => {
          logger.error('云函数登录失败', err);
          reject(err);
        }
      });
    });
  },
  
  /**
   * 验证token
   * @returns {Promise} 验证结果
   */
  verifyToken() {
    const token = wx.getStorageSync('token') || '';
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'validateToken',
        data: { token },
        success: (res) => {
          logger.info('验证Token成功', res);
          resolve(res.result);
        },
        fail: (err) => {
          logger.error('验证Token失败', err);
          reject(err);
        }
      });
    });
  },
  
  /**
   * 登出
   * @returns {Promise} 登出结果
   */
  logout() {
    return new Promise((resolve) => {
      wx.removeStorageSync('token');
      resolve({ success: true });
    });
  },
  
  /**
   * 上传BP文件
   * @param {Object} file 文件对象
   * @returns {Promise} 上传结果
   */
  uploadBP(file) {
    return new Promise((resolve, reject) => {
      logger.info('开始上传BP文件到云存储', file.name);
      
      // 生成云存储路径
      const cloudPath = `bp_files/${Date.now()}_${file.name}`;
      
      // 上传到云存储
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: file.path,
        success: (res) => {
          logger.info('文件上传到云存储成功', res);
          
          // 调用云函数记录文件信息
          wx.cloud.callFunction({
            name: 'saveBPFile',
            data: {
              fileID: res.fileID,
              fileName: file.name,
              fileSize: file.size,
              fileType: file.name.split('.').pop().toLowerCase()
            },
            success: (result) => {
              logger.info('保存文件信息成功', result);
              resolve({
                fileId: result.result.fileId,
                fileUrl: res.fileID
              });
            },
            fail: (err) => {
              logger.error('保存文件信息失败', err);
              reject(err);
            }
          });
        },
        fail: (err) => {
          logger.error('文件上传到云存储失败', err);
          reject(err);
        }
      });
    });
  },
  
  /**
   * 分析BP
   * @param {string} fileId 文件ID
   * @returns {Promise} 分析结果
   */
  analyzeBP(fileId) {
    logger.info('调用云函数分析BP文件', fileId);
    
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'analyzeBP',
        data: { fileId },
        success: (res) => {
          logger.info('云函数分析BP返回结果', res.result);
          
          if (res.result && res.result.code === 200) {
            resolve(res.result.results);
          } else {
            reject(new Error(res.result?.message || '分析失败'));
          }
        },
        fail: (err) => {
          logger.error('调用分析BP云函数失败', err);
          reject(err);
        }
      });
    });
  },
  
  /**
   * 开始分析任务
   * @param {string} fileId 文件ID
   * @returns {Promise} 分析结果
   */
  startAnalysis(fileId) {
    logger.info('开始BP分析任务', fileId);
    
    return this.analyzeBP(fileId).then(result => {
      return {
        code: 200,
        message: '分析成功',
        results: result
      };
    }).catch(error => {
      // 分析失败，返回标准化错误对象
      logger.error('BP分析失败', error);
      return {
        code: 500,
        message: error.message || '分析失败',
        error: error
      };
    });
  },
  
  /**
   * 获取BP列表
   * @param {number} page 页码
   * @param {number} pageSize 每页数量
   * @returns {Promise} BP列表
   */
  getBPList(page = 1, pageSize = 10) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'getBPList',
        data: { page, pageSize },
        success: (res) => {
          logger.info('获取BP列表成功', res);
          resolve(res.result);
        },
        fail: (err) => {
          logger.error('获取BP列表失败', err);
          reject(err);
        }
      });
    });
  },
  
  /**
   * 获取BP详情
   * @param {string} id BP ID
   * @returns {Promise} BP详情
   */
  getBPDetail(id) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'getBPDetail',
        data: { id },
        success: (res) => {
          logger.info('获取BP详情成功', res);
          resolve(res.result);
        },
        fail: (err) => {
          logger.error('获取BP详情失败', err);
          reject(err);
        }
      });
    });
  },
  
  /**
   * 删除BP
   * @param {string} id BP ID
   * @returns {Promise} 删除结果
   */
  deleteBP(id) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'deleteBP',
        data: { id },
        success: (res) => {
          logger.info('删除BP成功', res);
          resolve(res.result);
        },
        fail: (err) => {
          logger.error('删除BP失败', err);
          reject(err);
        }
      });
    });
  },
  
  /**
   * 生成报告
   * @param {string} bpId BP ID
   * @param {Object} options 报告选项
   * @returns {Promise} 生成结果
   */
  generateReport(bpId, options = {}) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'generateReport',
        data: { bpId, options },
        success: (res) => {
          logger.info('生成报告成功', res);
          resolve(res.result);
        },
        fail: (err) => {
          logger.error('生成报告失败', err);
          reject(err);
        }
      });
    });
  },
  
  /**
   * 获取报告列表
   * @param {number} page 页码
   * @param {number} pageSize 每页数量
   * @returns {Promise} 报告列表
   */
  getReportList(page = 1, pageSize = 10) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'getReportList',
        data: { page, pageSize },
        success: (res) => {
          logger.info('获取报告列表成功', res);
          resolve(res.result);
        },
        fail: (err) => {
          logger.error('获取报告列表失败', err);
          reject(err);
        }
      });
    });
  },
  
  /**
   * 获取报告详情
   * @param {string} id 报告ID
   * @returns {Promise} 报告详情
   */
  getReportDetail(id) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'getReportDetail',
        data: { id },
        success: (res) => {
          logger.info('获取报告详情成功', res);
          resolve(res.result);
        },
        fail: (err) => {
          logger.error('获取报告详情失败', err);
          reject(err);
        }
      });
    });
  },
  
  /**
   * 下载报告
   * @param {string} id 报告ID
   * @returns {Promise} 下载结果
   */
  downloadReport(id) {
    return new Promise((resolve, reject) => {
      // 先获取报告文件ID
      wx.cloud.callFunction({
        name: 'getReportFileID',
        data: { id },
        success: (res) => {
          if (res.result && res.result.fileID) {
            // 从云存储下载文件
            wx.cloud.downloadFile({
              fileID: res.result.fileID,
              success: (downloadRes) => {
                logger.info('报告下载成功');
                resolve(downloadRes.tempFilePath);
              },
              fail: (err) => {
                logger.error('报告下载失败', err);
                reject(err);
              }
            });
          } else {
            logger.error('获取报告文件ID失败');
            reject(new Error('获取报告文件ID失败'));
          }
        },
        fail: (err) => {
          logger.error('获取报告文件ID失败', err);
          reject(err);
        }
      });
    });
  },
  
  /**
   * 获取BP文件信息
   * @param {string} id 文件ID (数据库ID)
   * @returns {Promise} 文件信息，包含实际的云存储fileID
   */
  getBPFileInfo(id) {
    return new Promise((resolve, reject) => {
      if (!id) {
        reject(new Error('文件ID不能为空'));
        return;
      }
      
      logger.info('获取BP文件信息', id);
      
      // 正式环境调用云函数
      wx.cloud.callFunction({
        name: 'getBPDetail',
        data: { id },
        success: (res) => {
          logger.info('获取BP文件信息成功', res);
          if (res.result && res.result.code === 200 && res.result.data) {
            resolve(res.result.data);
          } else {
            logger.error('获取BP文件信息失败：无效的响应数据', res);
            reject(new Error('获取文件信息失败'));
          }
        },
        fail: (err) => {
          logger.error('获取BP文件信息失败', err);
          reject(err);
        }
      });
    });
  },
  
  /**
   * 获取文件临时访问URL
   * @param {string} fileID 云存储文件ID
   * @returns {Promise} 文件临时访问URL
   */
  getFileUrl(fileID) {
    return new Promise((resolve, reject) => {
      if (!fileID) {
        logger.error('获取文件URL失败：文件ID为空');
        reject(new Error('文件ID不能为空'));
        return;
      }
      
      logger.info('正在获取文件临时访问URL', fileID);
      
      // 直接调用云API获取临时URL，不再使用模拟数据
      wx.cloud.getTempFileURL({
        fileList: [{ fileID, maxAge: 3600 }]
      }).then(res => {
        if (res.fileList && res.fileList.length > 0) {
          const fileInfo = res.fileList[0];
          if (fileInfo.tempFileURL) {
            logger.info('获取文件URL成功', fileInfo.tempFileURL);
            resolve(fileInfo.tempFileURL);
          } else {
            logger.error('获取文件URL失败：返回的URL为空');
            reject(new Error('获取文件URL失败'));
          }
        } else {
          logger.error('获取文件URL失败：返回数据不完整', res);
          reject(new Error('获取文件URL失败'));
        }
      }).catch(err => {
        logger.error('获取文件URL失败', err);
        reject(err);
      });
    });
  }
}; 