/**
 * 日志工具模块
 * 统一管理日志记录，支持不同级别日志
 */

// 日志级别定义
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 100
};

// 判断是否为开发环境
const isDev = wx.getAccountInfoSync().miniProgram.envVersion === 'develop' || 
              wx.getAccountInfoSync().miniProgram.envVersion === 'trial';

// 当前环境日志级别
const currentLevel = isDev ? LogLevel.DEBUG : LogLevel.INFO;

// 是否将日志上报到服务器
const shouldReportToServer = !isDev;

/**
 * 格式化日志信息
 * @param {string} level 日志级别
 * @param {string} message 日志消息
 * @param {any} data 额外数据
 * @returns {string} 格式化后的日志字符串
 */
function formatLog(level, message, data) {
  const time = new Date().toISOString();
  const formattedData = data !== undefined ? `, ${JSON.stringify(data)}` : '';
  return `[${time}][${level}] ${message}${formattedData}`;
}

/**
 * 输出日志
 * @param {string} level 日志级别
 * @param {LogLevel} levelValue 日志级别值
 * @param {string} message 日志消息
 * @param {any} data 额外数据
 */
function log(level, levelValue, message, data) {
  if (levelValue < currentLevel) return;
  
  const logText = formatLog(level, message, data);
  
  switch (level) {
    case 'DEBUG':
      console.debug(logText);
      break;
    case 'INFO':
      console.info(logText);
      break;
    case 'WARN':
      console.warn(logText);
      break;
    case 'ERROR':
      console.error(logText);
      // 错误日志可以考虑上报到服务器
      if (shouldReportToServer) {
        reportErrorToServer(message, data);
      }
      break;
    default:
      console.log(logText);
  }
}

/**
 * 上报错误到服务器
 * @param {string} message 错误消息
 * @param {any} data 错误数据
 */
function reportErrorToServer(message, data) {
  // 实际项目中可以通过云函数上报错误
  // 此处只是示例
  try {
    /* 使用云函数上报错误
    wx.cloud.callFunction({
      name: 'reportError',
      data: {
        message,
        data,
        timestamp: Date.now(),
        platform: 'mini-program',
        version: '1.0.0'
      }
    });
    */
  } catch (err) {
    console.error('上报错误失败', err);
  }
}

/**
 * 日志工具对象
 */
export const logger = {
  /**
   * 记录调试日志
   * @param {string} message 日志消息
   * @param {any} data 额外数据
   */
  debug(message, data) {
    log('DEBUG', LogLevel.DEBUG, message, data);
  },
  
  /**
   * 记录信息日志
   * @param {string} message 日志消息
   * @param {any} data 额外数据
   */
  info(message, data) {
    log('INFO', LogLevel.INFO, message, data);
  },
  
  /**
   * 记录警告日志
   * @param {string} message 日志消息
   * @param {any} data 额外数据
   */
  warn(message, data) {
    log('WARN', LogLevel.WARN, message, data);
  },
  
  /**
   * 记录错误日志
   * @param {string} message 日志消息
   * @param {any} data 额外数据
   */
  error(message, data) {
    log('ERROR', LogLevel.ERROR, message, data);
  }
}; 