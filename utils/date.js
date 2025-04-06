/**
 * 日期时间工具函数模块
 */
import { error } from './logger.js';

/**
 * 格式化当前时间
 * @returns {string} 格式化后的当前时间
 */
function formatCurrentTime() {
  const now = new Date();
  return formatDate(now);
}

/**
 * 格式化日期对象
 * @param {Date} date 日期对象
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}年${month}月${day}日 ${hour}:${minute}`;
}

/**
 * 格式化日期显示
 * @param {string} timeString 时间字符串
 * @returns {string} 格式化后的日期
 */
function formatDisplayTime(timeString) {
  if (!timeString) return '';
  
  try {
    // 尝试解析不同格式的日期
    const dateMatch = timeString.match(/(\d{4})[-年](\d{2})[-月](\d{2})[\s日]\s*(\d{2}):(\d{2})/);
    if (dateMatch) {
      const [_, year, month, day, hour, minute] = dateMatch;
      return `${year}年${month}月${day}日 ${hour}:${minute}`;
    }
    
    // 如果是ISO格式
    if (timeString.match(/^\d{4}-\d{2}-\d{2}T/)) {
      const date = new Date(timeString);
      if (!isNaN(date.getTime())) {
        return formatDate(date);
      }
    }
    
    // 如果是时间戳
    if (/^\d+$/.test(timeString)) {
      const date = new Date(parseInt(timeString));
      if (!isNaN(date.getTime())) {
        return formatDate(date);
      }
    }
    
    // 尝试标准日期格式
    const date = new Date(timeString);
    if (!isNaN(date.getTime())) {
      return formatDate(date);
    }
    
    // 其他情况直接返回原字符串
    return timeString;
  } catch (err) {
    error('格式化日期失败', { timeString, error: err });
    return timeString;
  }
}

export {
  formatCurrentTime,
  formatDate,
  formatDisplayTime
};
