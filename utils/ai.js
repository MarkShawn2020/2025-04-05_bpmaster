/**
 * AI服务
 * 提供与AI相关的服务接口
 */

const app = getApp();
import { info, error, debug, warn } from '../utils/logger.js';

/**
 * 调用Coze流式工作流API并处理SSE响应
 * @param {Object} options 选项
 * @param {string} options.fileUrl 文件URL
 * @param {Function} options.onChunk 接收原始数据块的回调
 * @param {Function} options.onEvent 接收格式化事件的回调，如 {event: 'Message', data: {...}}
 * @param {Function} options.onComplete 完成时的回调
 * @param {Function} options.onError 错误时的回调
 * @param {Function} options.isAnalyzing 可选，用于检查当前是否仍在分析中的回调函数
 * @param {Object} options.parameters 可选，传递给Coze工作流的额外参数
 * @returns {Object} 请求任务对象
 */
function callCozeWorkflow(options) {
  // 检查选项
  if (!options || !options.fileUrl) {
    const error = new Error('缺少必要参数');
    if (options.onError) options.onError(error);
    return;
  }

  // 获取配置
  const cozeConfig = app.globalData.config.coze;
  const workflowId = cozeConfig.WORKFLOW_ID;
  const token = cozeConfig.TOKEN;
  const apiUrl = cozeConfig.API_URL;

  info('Coze配置信息', { workflowId, apiUrl, tokenLength: token ? token.length : 0 });

  // 检查配置
  if (!workflowId || !token || !apiUrl) {
    const configError = new Error('系统配置错误，缺少Coze必要配置项');
    error('缺少Coze必要配置项', { workflowId, hasToken: !!token, apiUrl });
    if (options.onError) options.onError(configError);
    return;
  }

  const headers = {
    // 不能用 application/x-www-form-urlencoded;charset=utf-8，否则会导致 coze 收不到消息
    "Content-Type": "application/json", 
    'Authorization': `Bearer ${token}`
  };

  const data = {
    workflow_id: workflowId, 
    parameters: {
      files: [options.fileUrl]
      // 可以添加更多参数
    }
  };

  // 如果有额外参数，合并到parameters中
  if (options.parameters) {
    Object.assign(data.parameters, options.parameters);
  }

  info('调用Coze工作流', data);

  // 请求任务对象
  const requestTask = wx.request({
    url: apiUrl, 
    method: 'POST', 
    header: headers, 
    data: data, 
    enableChunked: true, // 启用分块接收
    responseType: 'arraybuffer', // 重要：确保以ArrayBuffer格式接收数据
    success: function (res) {
      // 请求成功只表示请求已经发出
      info('Coze工作流请求成功', res.statusCode);
    }, 
    fail: function (err) {
      // 请求失败
      error('Coze工作流请求失败', err);
      if (options.onError) options.onError(err);
    }, 
    complete: function () {
      // 请求完成，但可能没收到[DONE]标记，启动一个短超时
      // 如果提供了onComplete回调，在5秒后如果仍在分析中且有内容，则自动调用
      if (options.onComplete) {
        setTimeout(() => {
          // 这里需要通过回调获取当前状态，因为服务函数无法访问页面的data
          if (options.isAnalyzing && options.isAnalyzing()) {
            info('工作流数据接收完毕但未收到完成标记，自动完成');
            options.onComplete();
          }
        }, 5000); // 5秒后如果仍在分析中，则自动完成
      }
    }
  });

  // 监听分块数据
  requestTask.onChunkReceived(function (res) {
    try {
      // 记录接收到的原始数据块信息
      debug('接收数据块', {
        chunkSize: res.data.byteLength, 
        isLastChunk: res.isLastChunk || false
      });

      // 解析ArrayBuffer数据为文本（使用内部实现的ab2str函数）
      const chunk = ab2str(res.data);

      // 如果是最后一个块，记录日志
      if (res.isLastChunk) {
        info('接收到最后一个数据块');
      }

      // 处理数据块
      if (options.onChunk) {
        options.onChunk(chunk);
      }
      
      // 内部使用processSSEChunk处理SSE格式数据
      processSSEChunk(chunk, 
        // 事件回调
        (event) => {
          if (options.onEvent) options.onEvent(event);
        }, 
        // 完成回调
        () => {
          if (options.onComplete) options.onComplete();
        }
      );
    } catch (err) {
      error('处理Coze响应块数据失败', err);
      if (options.onError) options.onError(err);
    }
  });

  return requestTask;
}

/**
 * ArrayBuffer转字符串，确保中文不乱码
 * @param {ArrayBuffer} buf ArrayBuffer数据
 * @returns {string} 转换后的字符串
 */
function ab2str(buf) {
  try {
    // 使用TextDecoder指定UTF-8编码，确保中文正确解码
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(new Uint8Array(buf));
    
    // 检查内容，记录是否包含中文(用于调试)
    const hasChinese = /[\u4e00-\u9fa5]/.test(text);
    const preview = text.length > 20 ? text.substring(0, 20) + '...' : text;
    
    debug('解码ArrayBuffer结果', {
      byteLength: buf.byteLength,
      textLength: text.length,
      hasChinese: hasChinese,
      preview: preview
    });
    
    return text;
  } catch (err) {
    error('TextDecoder解码失败', err);
    
    // 兼容性方案1：手动解码UTF-8
    try {
      const bytes = new Uint8Array(buf);
      let result = '';
      let i = 0;
      while (i < bytes.length) {
        if (bytes[i] < 128) {
          // ASCII字符，直接添加
          result += String.fromCharCode(bytes[i]);
          i++;
        } else if (bytes[i] >= 192 && bytes[i] < 224) {
          // 2字节UTF-8
          const code = ((bytes[i] & 0x1f) << 6) | (bytes[i+1] & 0x3f);
          result += String.fromCharCode(code);
          i += 2;
        } else if (bytes[i] >= 224 && bytes[i] < 240) {
          // 3字节UTF-8
          const code = ((bytes[i] & 0x0f) << 12) | 
                     ((bytes[i+1] & 0x3f) << 6) | 
                     (bytes[i+2] & 0x3f);
          result += String.fromCharCode(code);
          i += 3;
        } else if (bytes[i] >= 240) {
          // 4字节UTF-8，需要拆成两个UTF-16字符
          const codePoint = ((bytes[i] & 0x07) << 18) | 
                         ((bytes[i+1] & 0x3f) << 12) | 
                         ((bytes[i+2] & 0x3f) << 6) | 
                         (bytes[i+3] & 0x3f);
          
          // 从代码点计算UTF-16代理对
          const highSurrogate = Math.floor((codePoint - 0x10000) / 0x400) + 0xD800;
          const lowSurrogate = ((codePoint - 0x10000) % 0x400) + 0xDC00;
          
          result += String.fromCharCode(highSurrogate, lowSurrogate);
          i += 4;
        } else {
          // 无效字节，跳过
          i++;
        }
      }
      
      info('手动UTF-8解码成功');
      return result;
    } catch (decodeErr) {
      error('手动UTF-8解码失败', decodeErr);
      
      // 最后的兜底方案：逐字节转换，可能会乱码
      try {
        const bytes = new Uint8Array(buf);
        let result = '';
        for (let i = 0; i < bytes.length; i++) {
          result += String.fromCharCode(bytes[i]);
        }
        
        // 尝试使用encodeURIComponent和decodeURIComponent修复UTF-8编码
        try {
          const fixed = decodeURIComponent(escape(result));
          info('URI编码修复成功');
          return fixed;
        } catch (e) {
          info('URI编码修复失败，返回原始结果');
          return result;
        }
      } catch (finalErr) {
        error('所有解码方法都失败', finalErr);
        return ''; // 返回空字符串避免报错
      }
    }
  }
}

/**
 * 处理SSE格式数据
 * @param {string} chunk 数据块 
 * @param {Function} onEvent 事件回调
 * @param {Function} onComplete 完成回调
 */
function processSSEChunk(chunk, onEvent, onComplete) {
  try {
    // 按行分割，处理SSE格式
    const lines = chunk.split('\n');
    let currentEvent = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // 解析SSE格式的行
      if (line.startsWith('id: ')) {
        currentEvent.id = parseInt(line.substring(4));
      } else if (line.startsWith('event: ')) {
        currentEvent.event = line.substring(7);
      } else if (line.startsWith('data: ')) {
        const jsonStr = line.substring(6);
        
        // 特殊情况: [DONE]标记，表示流结束
        if (jsonStr === '[DONE]') {
          info('收到[DONE]标记，流式传输完成');
          if (onComplete) onComplete();
          continue;
        }
        
        try {
          // 尝试解析JSON数据
          const data = JSON.parse(jsonStr);
          currentEvent.data = data;
          
          // 如果有完整事件（至少包含event和data），回调处理
          if (currentEvent.event && onEvent) {
            onEvent(currentEvent);
            // 重置当前事件对象
            currentEvent = {};
          }
        } catch (jsonErr) {
          error('解析SSE数据JSON失败', { jsonStr, error: jsonErr });
        }
      }
    }

    // 检查纯文本[DONE]标记
    if (chunk.trim() === '[DONE]') {
      info('收到纯文本[DONE]标记');
      if (onComplete) onComplete();
    }
  } catch (err) {
    error('处理SSE数据块失败', err);
    throw err;
  }
}

/**
 * AI服务模块
 * 注意：模块内部使用了以下辅助函数，但不对外暴露：
 * - ab2str: 用于ArrayBuffer转字符串，确保中文不乱码
 * - processSSEChunk: 处理SSE格式数据
 */
export const aiService = {
  callCozeWorkflow
};