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
    // 简单的show方法，方便外部调用
    show(message, type = 'info') {
      console.log('Toast show method called:', message, type);
      this.setData({
        type,
        message,
        show: true
      });
      this._autoHide();
    },

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
    
    // 显示成功提示
    success(message) {
      console.log('Toast success:', message);
      this.setData({
        type: 'success',
        message,
        show: true
      });
      this._autoHide();
    },
    
    // 显示错误提示
    error(message) {
      console.log('Toast error:', message);
      this.setData({
        type: 'error',
        message,
        show: true
      });
      this._autoHide();
    },
    
    // 显示信息提示
    info(message) {
      console.log('Toast info:', message);
      this.setData({
        type: 'info',
        message,
        show: true
      });
      this._autoHide();
    },
    
    // 显示加载提示
    loading(message) {
      console.log('Toast loading:', message);
      this.setData({
        type: 'loading',
        message,
        show: true
      });
      // 返回一个对象，便于控制隐藏
      return {
        hide: () => this.hide()
      };
    },

    // 清除定时器
    _clearTimer() {
      if (this.data.timer) {
        clearTimeout(this.data.timer);
        this.data.timer = null;
      }
    },

    // 自动隐藏
    _autoHide() {
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
      }
      this.hideTimeout = setTimeout(() => {
        this.hide();
      }, this.data.duration);
    },
    
    // 隐藏提示
    hide() {
      console.log('Toast hide');
      this.setData({
        show: false
      });
    }
  },
  
  // 组件生命周期
  lifetimes: {
    detached() {
      this._clearTimer();
    }
  }
}) 