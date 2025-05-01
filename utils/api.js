/**
 * API服务工具类
 * 提供与云端API交互的方法
 */
import { info, error, warn, debug } from './logger.js';

// 获取全局应用实例
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
 * 启动BP分析工作流（直接使用Coze API）
 * @param {string} fileId 文件ID
 * @param {string} fileUrl 文件URL
 * @returns {Promise<Object>} 包含文件信息的对象
 */
function startBPAnalysis(fileId, fileUrl) {
  return new Promise((resolve, reject) => {
    if (!fileId || !fileUrl) {
      reject(new Error('文件信息不完整'));
      return;
    }
    
    info('启动BP分析', { fileId, fileUrl });
    
    // 保存文件分析记录到云数据库（仅用于记录，主要分析使用Coze API）
    wx.cloud.callFunction({
      name: 'recordBPAnalysis',
      data: {
        fileId: fileId,
        fileUrl: fileUrl
      },
      success: (res) => {
        if (res.result && res.result.code === 0) {
          info('BP分析记录保存成功', res.result);
          resolve({
            fileId: fileId,
            fileUrl: fileUrl,
            recordId: res.result.recordId
          });
        } else {
          // 即使记录失败，也继续分析，只是发出警告
          warn('BP分析记录保存失败', res.result);
          resolve({
            fileId: fileId,
            fileUrl: fileUrl
          });
        }
      },
      fail: (err) => {
        // 记录失败但不影响分析功能
        warn('BP分析记录请求失败', err);
        resolve({
          fileId: fileId,
          fileUrl: fileUrl
        });
      }
    });
  });
}

/**
 * 获取BP分析状态
 * @param {string} taskId 分析任务ID
 * @returns {Promise} 查询结果
 */
function getBPAnalysisStatus(taskId) {
  return new Promise((resolve, reject) => {
    if (!taskId) {
      reject(new Error('任务ID不能为空'));
      return;
    }
    
    info('查询BP分析状态', { taskId });
    
    wx.cloud.callFunction({
      name: 'getBPAnalysisStatus',
      data: {
        taskId: taskId
      },
      success: (res) => {
        info('查询BP分析状态成功', res.result);
        resolve(res.result);
      },
      fail: (err) => {
        error('查询BP分析状态失败', err);
        reject(err);
      }
    });
  });
}

/**
 * 直接连接到Coze的BP分析流
 * @param {string} fileUrl 文件URL
 * @param {function} onMessage 接收消息的回调函数
 * @param {function} onComplete 完成时的回调函数
 * @param {function} onError 错误时的回调函数
 * @returns {object} 连接对象，包含close方法
 */
function connectToCozeStream(fileUrl, onMessage, onComplete, onError) {
  if (!fileUrl) {
    if (onError) onError(new Error('文件URL不能为空'));
    return null;
  }
  
  info('连接到Coze流式API', { fileUrl });
  
  // 从全局配置获取Coze API信息
  const cozeConfig = app.globalData.config.coze;
  
  if (!cozeConfig || !cozeConfig.API_URL || !cozeConfig.TOKEN || !cozeConfig.WORKFLOW_ID) {
    const errMsg = 'Coze API配置不完整';
    error(errMsg, cozeConfig);
    if (onError) onError(new Error(errMsg));
    return null;
  }
  
  // 准备请求参数
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${cozeConfig.TOKEN}`
  };
  
  const data = {
    workflow_id: cozeConfig.WORKFLOW_ID,
    parameters: { 
      files: [fileUrl]
      // 可根据需要添加其他参数
    }
  };
  
  // 使用请求的方式实现流式连接
  const requestTask = wx.request({
    url: cozeConfig.API_URL,
    method: 'POST',
    header: headers,
    data: JSON.stringify(data),
    enableChunked: true, // 启用分块接收
    responseType: 'arraybuffer', // 以ArrayBuffer格式接收数据
    success: (res) => {
      info('Coze流式API连接成功', res.statusCode);
    },
    fail: (err) => {
      error('Coze流式API连接失败', err);
      if (onError) onError(err);
    }
  });
  
  // 监听分块数据
  requestTask.onChunkReceived(function(res) {
    try {
      // 解析ArrayBuffer数据为文本
      const decoder = new TextDecoder('utf-8');
      const chunk = decoder.decode(new Uint8Array(res.data));
      
      debug('接收Coze数据块', { 
        chunkSize: res.data.byteLength,
        isLastChunk: res.isLastChunk || false
      });
      
      // 处理SSE格式数据
      const lines = chunk.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('data: ')) {
          // 提取数据部分
          const data = line.substring(6);
          if (data === '[DONE]') {
            // 接收完成
            info('Coze数据接收完成');
            if (onComplete) onComplete();
            continue;
          }
          
          try {
            // 解析JSON数据
            const eventData = JSON.parse(data);
            
            if (eventData.event === 'Message' && eventData.data && eventData.data.content) {
              const content = eventData.data.content;
              
              // 提供消息给回调函数
              if (onMessage) onMessage(content);
            } else if (eventData.event === 'Error') {
              const errorMessage = eventData.data?.message || '流处理错误';
              error('Coze错误事件', errorMessage);
              
              if (onError) onError(new Error(errorMessage));
            }
          } catch (jsonErr) {
            error('解析Coze数据失败', { data, error: jsonErr });
          }
        }
      }
    } catch (chunkErr) {
      error('处理Coze数据块错误', chunkErr);
      if (onError) onError(chunkErr);
    }
  });
  
  // 监听错误事件
  requestTask.onError(function(err) {
    error('Coze流式API连接错误', err);
    if (onError) onError(err);
  });
  
  // 返回包含close方法的对象
  return {
    close: function() {
      info('关闭Coze流式API连接');
      try {
        requestTask.abort();
      } catch (err) {
        error('关闭Coze流式API连接失败', err);
      }
    }
  };
}

/**
 * 保存分析结果到全局状态和本地存储
 * @param {string} fileId 文件ID
 * @param {string} content 分析内容
 * @param {boolean} isComplete 是否完成
 * @param {Error} error 错误信息
 */
function saveAnalysisContent(fileId, content, isComplete = false, error = null) {
  if (!fileId) {
    warn('保存分析内容失败：文件ID为空');
    return;
  }
  
  const streamId = `analysis_${fileId}`;
  
  // 更新全局状态
  if (!app.globalData.analysisStreams) {
    app.globalData.analysisStreams = {};
  }
  
  app.globalData.analysisStreams[streamId] = {
    content: content || '',
    isComplete: isComplete,
    error: error,
    fileId: fileId,
    updateTime: new Date().getTime()
  };
  
  // 保存到本地存储
  try {
    wx.setStorageSync(`analysis_stream_${fileId}`, content || '');
  } catch (err) {
    error('保存分析内容到本地存储失败', err);
  }
  
  debug('已保存分析内容', { 
    fileId, 
    contentLength: (content || '').length, 
    isComplete 
  });
}

export {
  uploadFile,
  startBPAnalysis,
  getBPAnalysisStatus,
  connectToCozeStream,
  saveAnalysisContent
};