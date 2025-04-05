/**
 * 通用工具函数
 */

/**
 * 格式化时间为可读字符串
 * @param {Date} date - 日期对象
 * @returns {String} 格式化后的时间字符串
 */
export function formatTime(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  return (
    [year, month, day].map(formatNumber).join('/') +
    ' ' +
    [hour, minute, second].map(formatNumber).join(':')
  );
}

/**
 * 格式化数字为两位数
 * @param {Number} n - 数字
 * @returns {String} 格式化后的字符串
 */
export function formatNumber(n) {
  n = n.toString();
  return n[1] ? n : '0' + n;
}

/**
 * 睡眠函数 - 用于异步等待
 * @param {Number} ms - 等待的毫秒数
 * @returns {Promise} 等待指定时间后resolve的Promise
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 将Markdown文本转换为适用于小程序rich-text的HTML
 * @param {String} markdown - Markdown格式文本
 * @returns {String} 转换后的HTML
 */
export function markdownToHtml(markdown) {
  if (!markdown) return '';
  
  // 简单的Markdown转HTML规则
  let html = markdown;
  
  // 标题转换
  html = html.replace(/#{6}\s+([^\n]+)/g, '<h6>$1</h6>');
  html = html.replace(/#{5}\s+([^\n]+)/g, '<h5>$1</h5>');
  html = html.replace(/#{4}\s+([^\n]+)/g, '<h4>$1</h4>');
  html = html.replace(/#{3}\s+([^\n]+)/g, '<h3>$1</h3>');
  html = html.replace(/#{2}\s+([^\n]+)/g, '<h2>$1</h2>');
  html = html.replace(/#{1}\s+([^\n]+)/g, '<h1>$1</h1>');
  
  // 粗体和斜体
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // 列表
  html = html.replace(/^\s*-\s+([^\n]+)/gm, '<li>$1</li>');
  html = html.replace(/(<li>[^<]+<\/li>)\n+(?=<li>)/g, '$1');
  html = html.replace(/(<li>[^<]+<\/li>)+/g, '<ul>$&</ul>');
  
  // 有序列表
  html = html.replace(/^\s*(\d+)\.\s+([^\n]+)/gm, '<li>$2</li>');
  html = html.replace(/(<li>[^<]+<\/li>)\n+(?=<li>)/g, '$1');
  html = html.replace(/(<li>[^<]+<\/li>)+/g, '<ol>$&</ol>');
  
  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // 段落
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = html.replace(/^(.+)$/m, '<p>$1</p>');
  
  return html;
}

/**
 * 生成随机字符串ID
 * @param {Number} length - ID长度
 * @returns {String} 随机字符串ID
 */
export function generateRandomId(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 格式化货币
 * @param {Number} amount - 金额
 * @param {String} currency - 货币符号，默认为 '¥'
 * @returns {String} 格式化后的货币字符串
 */
export function formatCurrency(amount, currency = '¥') {
  return `${currency}${amount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
}

/**
 * 深拷贝对象
 * @param {Object} obj - 要拷贝的对象
 * @returns {Object} 拷贝后的新对象
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }
  
  if (obj instanceof Object) {
    const copy = {};
    Object.keys(obj).forEach(key => {
      copy[key] = deepClone(obj[key]);
    });
    return copy;
  }
  
  throw new Error('Unable to copy obj! Its type isn\'t supported.');
}

export default {
  formatTime,
  formatNumber,
  sleep,
  markdownToHtml,
  generateRandomId,
  formatCurrency,
  deepClone
}; 