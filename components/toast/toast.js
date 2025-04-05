/**
 * Toast组件
 * 轻量级提示组件，支持成功、失败、警告、加载等类型
 */
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    type: {
      type: String,
      value: 'info' // info, success, error, warning, loading
    },
    duration: {
      type: Number,
      value: 2000 // 持续时间，毫秒
    },
    message: {
      type: String,
      value: ''
    },
    position: {
      type: String,
      value: 'center' // top, center, bottom
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    timer: null,
    iconMap: {
      info: 'info-circle',
      success: 'success',
      error: 'close-circle',
      warning: 'warning',
      loading: 'loading'
    }
  },

  /**
   * 组件的方法列表
   */
  methods: {
    showToast(options) {
      // 清除之前的定时器
      this._clearTimer();
      
      const { type = 'info', message = '', duration = 2000, position = 'center' } = options;
      
      // 设置新的数据
      this.setData({
        show: true,
        type,
        message,
        duration,
        position
      });
      
      // 自动关闭
      if (type !== 'loading' && duration > 0) {
        this.data.timer = setTimeout(() => {
          this.hideToast();
        }, duration);
      }
    },

    hideToast() {
      this._clearTimer();
      this.setData({
        show: false
      });
    },
    
    // 信息提示
    info(message, duration = 2000) {
      this.showToast({ type: 'info', message, duration });
    },
    
    // 成功提示
    success(message, duration = 2000) {
      this.showToast({ type: 'success', message, duration });
    },
    
    // 错误提示
    error(message, duration = 2000) {
      this.showToast({ type: 'error', message, duration });
    },
    
    // 警告提示
    warning(message, duration = 2000) {
      this.showToast({ type: 'warning', message, duration });
    },
    
    // 加载提示
    loading(message = '加载中...') {
      this.showToast({ type: 'loading', message, duration: 0 });
    },

    // 清除定时器
    _clearTimer() {
      if (this.data.timer) {
        clearTimeout(this.data.timer);
        this.data.timer = null;
      }
    }
  },
  
  // 组件生命周期
  lifetimes: {
    detached() {
      this._clearTimer();
    }
  }
}) 