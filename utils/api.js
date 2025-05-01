/**
 * API服务工具类
 * 提供与云端API交互的方法
 */
import { info, error } from './logger.js';
const app = getApp();

/**
 * 上传文件到云存储
 * @param {string} filePath 文件临时路径
 * @param {string} originalFileName 原始文件名，可选
 * @returns {Promise} 上传结果
 */
function uploadFile(filePath, originalFileName) {
  return new Promise((resolve, reject) => {
    if (!filePath) {
      reject(new Error('文件路径不能为空'));
      return;
    }
    
    // 获取最终文件名：优先使用传入的原始文件名，否则从路径提取
    const pathFileName = filePath.split('/').pop();
    const fileName = originalFileName || pathFileName;
    
    info('开始上传文件', { filePath, originalFileName, fileName });
    
    // 生成云存储路径
    const cloudPath = `bp_files/${Date.now()}_${pathFileName}`;
    
    // 调用微信云开发API上传文件
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath,
      success: (res) => {
        info('文件上传成功', { fileID: res.fileID });
        
        if (!res.fileID) {
          reject(new Error('上传失败，未获取到文件ID'));
          return;
        }
        
        // 获取文件临时下载链接
        wx.cloud.getTempFileURL({
          fileList: [res.fileID],
          success: (result) => {
            if (result.fileList && result.fileList.length > 0) {
              const fileInfo = result.fileList[0];
              
              // 调用云函数保存文件信息
              wx.cloud.callFunction({
                name: 'saveBPFile',
                data: {
                  fileID: res.fileID,
                  fileUrl: fileInfo.tempFileURL,
                  fileName: fileName, // 使用原始文件名
                  originalName: originalFileName || '', // 同时保存原始文件名字段
                  uploadTime: new Date().getTime()
                },
                success: (callRes) => {
                  info('保存文件信息成功', callRes.result);
                  resolve({
                    fileId: callRes.result.fileId || res.fileID,
                    fileUrl: fileInfo.tempFileURL
                  });
                },
                fail: (err) => {
                  error('保存文件信息失败', err);
                  // 即使保存信息失败，也返回上传成功信息
                  resolve({
                    fileId: res.fileID,
                    fileUrl: fileInfo.tempFileURL
                  });
                }
              });
            } else {
              reject(new Error('获取文件临时链接失败'));
            }
          },
          fail: (err) => {
            error('获取文件临时链接失败', err);
            reject(err);
          }
        });
      },
      fail: (err) => {
        error('文件上传失败', err);
        reject(err);
      }
    });
  });
}

/**
 * 调用Coze工作流
 * @param {string} workflowId 工作流ID
 * @param {Object} inputs 输入参数
 * @returns {Promise} 执行结果
 */
function callCozeWorkflow(workflowId, inputs) {
  return new Promise((resolve, reject) => {
    if (!workflowId) {
      reject(new Error('工作流ID不能为空'));
      return;
    }
    
    const token = app.globalData.config.cozeApiToken;
    if (!token) {
      reject(new Error('API Token未配置'));
      return;
    }
    
    info('调用Coze工作流', { workflowId });
    
    wx.request({
      url: 'https://api.coze.cn/v1/workflow/run',
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      data: {
        workflow_id: workflowId,
        inputs: inputs
      },
      success: (res) => {
        if (res.statusCode === 200) {
          info('工作流调用成功', res.data);
          resolve(res.data);
        } else {
          error('工作流调用失败', res);
          reject(new Error(`工作流调用失败: ${res.statusCode}`));
        }
      },
      fail: (err) => {
        error('工作流调用请求失败', err);
        reject(err);
      }
    });
  });
}



export {
  uploadFile,
  callCozeWorkflow,
}; 