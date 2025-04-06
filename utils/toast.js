/**
 * Toast提示工具模块
 * 封装显示各种类型提示的方法
 */
const logger = require('./logger');

const defaultDuration = 1500; // 默认显示时间（毫秒）

/**
 * 显示提示
 * @param {string} title 提示内容
 * @param {string} icon 图标类型，可选值：success, error, loading, none
 * @param {number} duration 显示时间（毫秒）
 * @returns {Promise} Promise对象
 */
function showToast(title, icon = 'none', duration = defaultDuration) {
  logger.debug(`显示Toast: ${title}, 类型: ${icon}`);
  
  return new Promise((resolve) => {
    wx.showToast({
      title,
      icon,
      duration,
      mask: true,
      success: () => {
        setTimeout(resolve, duration);
      },
      fail: (err) => {
        logger.error('显示Toast失败', err);
        resolve();
      }
    });
  });
}

/**
 * Toast工具对象
 */
export const toast = {
  /**
   * 显示成功提示
   * @param {string} title 提示内容
   * @param {number} duration 显示时间（毫秒）
   */
  success(title, duration) {
    return showToast(title, 'success', duration);
  },
  
  /**
   * 显示错误提示
   * @param {string} title 提示内容
   * @param {number} duration 显示时间（毫秒）
   */
  error(title, duration) {
    return showToast(title, 'error', duration);
  },
  
  /**
   * 显示加载提示
   * @param {string} title 提示内容
   */
  loading(title = '加载中...') {
    wx.showLoading({
      title,
      mask: true
    });
    
    return {
      hide: () => wx.hideLoading()
    };
  },
  
  /**
   * 显示信息提示
   * @param {string} title 提示内容
   * @param {number} duration 显示时间（毫秒）
   */
  info(title, duration) {
    return showToast(title, 'none', duration);
  },
  
  /**
   * 显示警告提示
   * @param {string} title 提示内容
   * @param {number} duration 显示时间（毫秒）
   */
  warning(title, duration) {
    // 微信原生toast没有warning类型，使用none类型
    return showToast(title, 'none', duration);
  },
  
  /**
   * 隐藏提示
   */
  hide() {
    wx.hideToast();
  }
}; 