// pages/test-page/test-page.js
import { info, debug } from '../../utils/logger.js';

Page({
  data: {
    pageType: '', // 'A' 或 'B'
    elapsedTime: 0, // 已经打开的时间(秒)
    startTime: 0, // 页面打开的时间戳
    formattedTime: '00:00:00' // 格式化的时间 (HH:MM:SS)
  },

  onLoad: function(options) {
    // 获取页面类型参数
    const pageType = options.type || 'unknown';
    const startTime = Date.now();
    
    info('测试页面加载', { pageType, startTime });
    
    this.setData({
      pageType: pageType,
      startTime: startTime
    });
    
    // 启动定时器，每秒更新一次
    this.startTimer();
  },
  
  onShow: function() {
    info('测试页面显示', { pageType: this.data.pageType, timer: !!this.timer });
    // 如果计时器不存在则启动它
    if (!this.timer) {
      this.startTimer();
    }
  },
  
  onHide: function() {
    info('测试页面隐藏', { pageType: this.data.pageType });
    // 页面隐藏时不停止计时器，让它继续运行
  },
  
  onUnload: function() {
    info('测试页面卸载', { pageType: this.data.pageType, elapsedTime: this.data.elapsedTime });
    // 页面卸载时清除计时器
    this.clearTimer();
  },
  
  // 启动计时器
  startTimer: function() {
    // 清除可能存在的旧计时器
    this.clearTimer();
    
    // 创建新计时器，每秒更新一次
    this.timer = setInterval(() => {
      const now = Date.now();
      const elapsedTime = Math.floor((now - this.data.startTime) / 1000);
      
      // 计算时、分、秒
      const hours = Math.floor(elapsedTime / 3600);
      const minutes = Math.floor((elapsedTime % 3600) / 60);
      const seconds = elapsedTime % 60;
      
      // 格式化时间 HH:MM:SS
      const formattedTime = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      // 更新数据
      this.setData({
        elapsedTime: elapsedTime,
        formattedTime: formattedTime
      });
      
      // 每10秒记录一次日志
      if (elapsedTime % 10 === 0) {
        debug('测试页面计时更新', { 
          pageType: this.data.pageType, 
          elapsedTime: elapsedTime,
          formattedTime: formattedTime
        });
      }
    }, 1000);
    
    info('计时器已启动', { pageType: this.data.pageType });
  },
  
  // 清除计时器
  clearTimer: function() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      info('计时器已清除', { pageType: this.data.pageType });
    }
  },
  
  // 返回首页
  handleBackToHome: function() {
    info('用户点击返回首页', { pageType: this.data.pageType, elapsedTime: this.data.elapsedTime });
    wx.navigateBack({
      delta: 1
    });
  },
  
  // 打开另一个测试页
  handleOpenOtherPage: function() {
    const currentType = this.data.pageType;
    const targetType = currentType === 'A' ? 'B' : 'A';
    
    info('用户点击打开另一个测试页', { 
      currentType: currentType, 
      targetType: targetType,
      elapsedTime: this.data.elapsedTime 
    });
    
    this.pageRouter.navigateTo({
      url: `./test-page?type=${targetType}`
    });
  }
});


