// app.js
import { info, error, warn } from './utils/logger';

// 初始化云开发
wx.cloud.init({
  env: wx.cloud.DYNAMIC_CURRENT_ENV, // 使用当前环境配置
  traceUser: true
});

// 判断是否为开发环境
const isDev = wx.getAccountInfoSync().miniProgram.envVersion === 'develop' || 
              wx.getAccountInfoSync().miniProgram.envVersion === 'trial';

// 定义应用重置方法，可在需要时调用
function resetAppState() {
  try {
    // 清除所有本地存储
    wx.clearStorageSync();
    
    // 确保全局状态被重置
    if (getApp()) {
      getApp().globalData = {
        userInfo: null,
        currentBP: null,
        uploadedFiles: [],
        analysisList: [],
        isDev: isDev,
        analysisStreams: {}
      };
    }
    
    info('应用状态已重置');
  } catch (e) {
    error('重置应用状态失败', e);
  }
}

// 将重置方法暴露到全局，以便开发阶段使用
if (isDev) {
  wx.__resetAppState = resetAppState;
}

App({
  globalData: {
    userInfo: null,
    currentBP: null,
    uploadedFiles: [],
    analysisList: [],
    isDev: true, // 开发模式标志
    analysisStreams: {}, // 初始化分析流数据容器
    hasUserInfo: false,
    openid: '',
    config: {
      coze: {
        API_URL: 'https://api.coze.cn/v1/workflow/stream_run',
        TOKEN: 'pat_3rj2Yex0Z2I9LxvkfezTxrhPv8wXH0vYx1y5sc1b4XO7kfC4V9iQfSc7Bilffkrl',
        WORKFLOW_ID: '7488013332172193801'
      }
    }
  },

  onLaunch() {
    const that = this;
    
    info('小程序启动');
    
    // 初始化云开发
    if (!wx.cloud) {
      console.error('基础库版本过低，请升级微信');
    } else {
      wx.cloud.init({
        env: wx.cloud.DYNAMIC_CURRENT_ENV,
        traceUser: true,
      });
    }
    
    // 确保保留全局配置的同时初始化其他必要数据
    this.globalData = {
      ...this.globalData,
      userInfo: null,
      hasUserInfo: false,
      uploadedFiles: [],
      // 用于存储分析流数据
      analysisStreams: {}
    };
    
    // 获取设备信息
    wx.getSystemInfo({
      success: e => {
        this.globalData.StatusBar = e.statusBarHeight;
        let capsule = wx.getMenuButtonBoundingClientRect();
        this.globalData.Custom = capsule;
        this.globalData.CustomBar = capsule.bottom + capsule.top - e.statusBarHeight;
        this.globalData.screenHeight = e.screenHeight;
        this.globalData.screenWidth = e.screenWidth;
        this.globalData.windowHeight = e.windowHeight;
      }
    });
    
    // 获取用户的openid
    this._getOpenid();
  },
  
  // 检查更新
  checkUpdate() {
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager();
      updateManager.onCheckForUpdate(function(res) {
        if (res.hasUpdate) {
          updateManager.onUpdateReady(function() {
            wx.showModal({
              title: '更新提示',
              content: '新版本已经准备好，是否重启应用？',
              success: function(res) {
                if (res.confirm) {
                  updateManager.applyUpdate();
                }
              }
            });
          });
          
          updateManager.onUpdateFailed(function() {
            wx.showModal({
              title: '已经有新版本',
              content: '新版本已经上线，请删除当前小程序，重新搜索打开'
            });
          });
        }
      });
    }
  },
  
  // 错误处理
  onError(err) {
    error('应用程序错误', err);
  },
  
  // 页面不存在
  onPageNotFound(res) {
    warn('页面不存在', res);
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  // 检查并修复应用状态
  checkAndFixAppState() {
    try {
      // 检查本地存储中的token与全局状态是否一致
      const token = wx.getStorageSync('token');
      const hasToken = !!token;
      const hasUserInfo = !!this.globalData.userInfo;
      
      // 如果状态不一致，进行修复
      if (hasToken !== hasUserInfo) {
        warn('应用状态不一致，正在修复', { hasToken, hasUserInfo });
        
        if (hasToken) {
          // 有token但无userInfo，尝试验证token
          this.validateToken(token);
        } else {
          // 有userInfo但无token，清除userInfo
          this.globalData.userInfo = null;
          info('已清除不一致的用户信息');
        }
      }
    } catch (e) {
      error('检查应用状态失败', e);
    }
  },

  checkLoginStatus() {
    try {
      const token = wx.getStorageSync('token')
      
      // 增加token有效性的初步检查
      if (token && typeof token === 'string' && token.length > 20) {
        // 验证token有效性
        this.validateToken(token)
      } else {
        // 清除可能存在的无效token
        if (token) {
          warn('发现无效token格式，正在清除', { tokenLength: token.length });
          wx.removeStorageSync('token');
        }
        
        // 引导用户登录
        info('用户未登录，token不存在或无效')
        this.globalData.userInfo = null;
      }
    } catch (e) {
      error('检查登录状态失败', e)
      // 出错时重置登录状态
      this.globalData.userInfo = null;
      try {
        wx.removeStorageSync('token');
      } catch (err) {
        error('清除token失败', err);
      }
    }
  },

  validateToken(token) {
    info('开始验证token', token.substring(0, 10) + '...')
    
    // 使用云函数验证token
    wx.cloud.callFunction({
      name: 'validateToken',
      data: {
        token
      },
      success: (res) => {
        info('验证token返回结果', res.result)
        
        if (res.result && res.result.code === 200) {
          info('Token有效，更新用户信息', res.result.userInfo)
          this.globalData.userInfo = res.result.userInfo
          
          // 触发登录成功事件，供页面响应
          wx.eventCenter = wx.eventCenter || {}
          if (wx.eventCenter.loginSuccess) {
            wx.eventCenter.loginSuccess(res.result.userInfo)
          }
        } else {
          warn('Token无效，需要重新登录', res.result)
          wx.removeStorageSync('token')
          this.globalData.userInfo = null
        }
      },
      fail: (err) => {
        error('验证Token失败', err)
        wx.removeStorageSync('token')
        this.globalData.userInfo = null
      }
    })
  },

  login(callback) {
    info('开始登录流程')
    
    wx.login({
      success: (res) => {
        if (res.code) {
          info('获取微信code成功', res.code)
          
          // 使用云函数登录
          wx.cloud.callFunction({
            name: 'login',
            data: {
              code: res.code
            },
            success: (res) => {
              info('云函数登录返回', res.result)
              
              if (res.result && res.result.token) {
                // 保存token
                wx.setStorageSync('token', res.result.token)
                
                // 保存openid (确保云函数返回了openid)
                if (res.result.openid) {
                  this.globalData.openid = res.result.openid;
                  info('获取openid成功', this.globalData.openid);
                }
                
                // 更新全局用户信息
                if (res.result.userInfo) {
                  this.globalData.userInfo = res.result.userInfo
                  info('用户信息已更新', this.globalData.userInfo)
                } else {
                  warn('云函数返回数据中没有userInfo', res.result)
                }
                
                if (callback) callback(true)
              } else {
                error('登录失败', res.result ? res.result.message : '未知错误')
                this.globalData.userInfo = null
                
                if (callback) callback(false)
              }
            },
            fail: (err) => {
              error('登录请求失败', err)
              this.globalData.userInfo = null
              
              if (callback) callback(false)
            }
          })
        } else {
          error('获取登录code失败', res.errMsg)
          if (callback) callback(false)
        }
      },
      fail: (err) => {
        error('登录失败', err)
        if (callback) callback(false)
      }
    })
  },
  
  // 提供一个清除所有应用状态的方法
  resetAppState,

  onShow() {
    info('小程序进入前台');
  },

  onHide() {
    info('App hidden')
  },
  
  // 获取用户openid
  async _getOpenid() {
    // 如果已经登录并有用户信息，则无需重复获取
    if (this.globalData.openid) {
      return;
    }
    
    // 使用login方法同时获取openid
    this.login((success) => {
      if (success) {
        info('登录成功，同时获取到了openid');
      }
    });
  }
}) 