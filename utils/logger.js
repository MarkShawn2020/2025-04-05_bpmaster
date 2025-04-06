/**
 * 日志工具类
 * 提供统一的日志记录接口
 */

// 日志级别
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// 当前日志级别，生产环境可以调高
let currentLogLevel = LogLevel.DEBUG;

// 是否将日志发送到远程服务器
let enableRemoteLogging = false;
let remoteLogUrl = '';

/**
 * 设置日志级别
 * @param {number} level 日志级别
 */
function setLogLevel(level) {
  if (level >= LogLevel.DEBUG && level <= LogLevel.ERROR) {
    currentLogLevel = level;
  }
}

/**
 * 配置远程日志
 * @param {boolean} enable 是否启用
 * @param {string} url 日志服务器地址
 */
function configRemoteLog(enable, url = '') {
  enableRemoteLogging = enable;
  if (url) {
    remoteLogUrl = url;
  }
}

/**
 * 格式化日志内容
 * @param {string} level 日志级别标签
 * @param {string} message 日志消息
 * @param {Object} data 附加数据
 * @returns {string} 格式化后的日志
 */
function formatLog(level, message, data) {
  const timestamp = new Date().toISOString();
  const app = getApp();
  const context = {
    timestamp,
    level,
    page: getCurrentPageName(),
    user: app ? (app.globalData.userInfo ? app.globalData.userInfo.openId : 'unknown') : 'unknown',
    version: app ? app.globalData.version : 'unknown'
  };
  
  let logContent = `[${timestamp}] [${level}] [${context.page}] ${message}`;
  
  if (data) {
    try {
      if (typeof data === 'object') {
        logContent += ` ${JSON.stringify(data)}`;
      } else {
        logContent += ` ${data}`;
      }
    } catch (e) {
      logContent += ' [数据无法序列化]';
    }
  }
  
  return {
    text: logContent,
    context,
    message,
    data
  };
}

/**
 * 获取当前页面名称
 * @returns {string} 页面名称
 */
function getCurrentPageName() {
  const pages = getCurrentPages();
  if (pages.length === 0) {
    return 'app';
  }
  const currentPage = pages[pages.length - 1];
  return currentPage.route || 'unknown';
}

/**
 * 发送远程日志
 * @param {Object} logData 日志数据
 */
function sendRemoteLog(logData) {
  if (!enableRemoteLogging || !remoteLogUrl) {
    return;
  }
  
  wx.request({
    url: remoteLogUrl,
    method: 'POST',
    data: {
      context: logData.context,
      message: logData.message,
      data: logData.data
    },
    fail: () => {
      // 失败时不再重试，避免循环
    }
  });
}

/**
 * 调试日志
 * @param {string} message 日志消息
 * @param {Object} data 附加数据
 */
function debug(message, data) {
  if (currentLogLevel > LogLevel.DEBUG) return;
  
  const logData = formatLog('DEBUG', message, data);
  console.debug(logData.text);
  
  if (enableRemoteLogging) {
    sendRemoteLog(logData);
  }
}

/**
 * 信息日志
 * @param {string} message 日志消息
 * @param {Object} data 附加数据
 */
function info(message, data) {
  if (currentLogLevel > LogLevel.INFO) return;
  
  const logData = formatLog('INFO', message, data);
  console.info(logData.text);
  
  if (enableRemoteLogging) {
    sendRemoteLog(logData);
  }
}

/**
 * 警告日志
 * @param {string} message 日志消息
 * @param {Object} data 附加数据
 */
function warn(message, data) {
  if (currentLogLevel > LogLevel.WARN) return;
  
  const logData = formatLog('WARN', message, data);
  console.warn(logData.text);
  
  if (enableRemoteLogging) {
    sendRemoteLog(logData);
  }
}

/**
 * 错误日志
 * @param {string} message 日志消息
 * @param {Object} data 附加数据
 */
function error(message, data) {
  if (currentLogLevel > LogLevel.ERROR) return;
  
  const logData = formatLog('ERROR', message, data);
  console.error(logData.text);
  
  if (enableRemoteLogging) {
    sendRemoteLog(logData);
  }
}

module.exports = {
  LogLevel,
  setLogLevel,
  configRemoteLog,
  debug,
  info,
  warn,
  error
}; 