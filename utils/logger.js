/**
 * 日志工具
 * 统一管理应用日志，支持不同级别的日志输出
 */

// 日志级别定义
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// 当前日志级别，可以通过环境变量或配置文件设置
const CURRENT_LOG_LEVEL = LOG_LEVELS.DEBUG;

// 是否将日志上报到服务器
const REPORT_TO_SERVER = false;

// 时间格式化
const formatTime = () => {
  const date = new Date();
  return `${date.toISOString()}`;
};

// 生成日志前缀
const prefix = (level) => {
  return `[${formatTime()}][${level}]`;
};

// 发送日志到服务器
const reportToServer = (level, ...args) => {
  if (!REPORT_TO_SERVER) return;
  
  try {
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch (e) {
          return String(arg);
        }
      }
      return arg;
    }).join(' ');
    
    wx.request({
      url: 'https://api.bpmaster.example.com/logs',
      method: 'POST',
      data: {
        level,
        message,
        timestamp: Date.now(),
        platform: 'wxapp',
        version: wx.getAccountInfoSync().miniProgram.version || 'dev'
      },
      fail: (err) => {
        console.error('日志上报失败', err);
      }
    });
  } catch (e) {
    console.error('日志上报异常', e);
  }
};

// 日志实现
export const logger = {
  debug: (...args) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.DEBUG) {
      console.debug(prefix('DEBUG'), ...args);
    }
  },
  
  info: (...args) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.INFO) {
      console.info(prefix('INFO'), ...args);
      reportToServer('info', ...args);
    }
  },
  
  warn: (...args) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.WARN) {
      console.warn(prefix('WARN'), ...args);
      reportToServer('warn', ...args);
    }
  },
  
  error: (...args) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.ERROR) {
      console.error(prefix('ERROR'), ...args);
      reportToServer('error', ...args);
    }
  },
  
  // 特殊场景（如埋点）可以单独设置是否上报
  track: (eventName, params, shouldReport = true) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.INFO) {
      console.info(prefix('TRACK'), eventName, params);
    }
    
    if (shouldReport) {
      try {
        wx.request({
          url: 'https://api.bpmaster.example.com/track',
          method: 'POST',
          data: {
            event: eventName,
            params,
            timestamp: Date.now(),
            platform: 'wxapp',
            version: wx.getAccountInfoSync().miniProgram.version || 'dev'
          },
          fail: (err) => {
            console.error('埋点上报失败', err);
          }
        });
      } catch (e) {
        console.error('埋点上报异常', e);
      }
    }
  }
}; 