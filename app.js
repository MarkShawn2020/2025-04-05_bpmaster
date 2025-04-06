// app.js
import { logger } from './utils/logger'

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
    
    logger.info('应用状态已重置');
  } catch (e) {
    logger.error('重置应用状态失败', e);
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
    analysisStreams: {} // 初始化分析流数据容器
  },

  onLaunch() {
    logger.info('应用启动');
    
    // 初始化云函数
    if (!wx.cloud) {
      logger.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      try {
        wx.cloud.init({
          env: cloud.DYNAMIC_CURRENT_ENV, // 请更改为你自己的云开发环境ID
          traceUser: true
        });
        logger.info('云函数环境初始化成功');
      } catch (e) {
        logger.error('云函数环境初始化失败', e);
      }
    }
    
    // 检查更新
    this.checkUpdate();
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
  onError(error) {
    logger.error('应用程序错误', error);
  },
  
  // 页面不存在
  onPageNotFound(res) {
    logger.warn('页面不存在', res);
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
        logger.warn('应用状态不一致，正在修复', { hasToken, hasUserInfo });
        
        if (hasToken) {
          // 有token但无userInfo，尝试验证token
          this.validateToken(token);
        } else {
          // 有userInfo但无token，清除userInfo
          this.globalData.userInfo = null;
          logger.info('已清除不一致的用户信息');
        }
      }
    } catch (e) {
      logger.error('检查应用状态失败', e);
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
          logger.warn('发现无效token格式，正在清除', { tokenLength: token.length });
          wx.removeStorageSync('token');
        }
        
        // 引导用户登录
        logger.info('用户未登录，token不存在或无效')
        this.globalData.userInfo = null;
      }
    } catch (e) {
      logger.error('检查登录状态失败', e)
      // 出错时重置登录状态
      this.globalData.userInfo = null;
      try {
        wx.removeStorageSync('token');
      } catch (err) {
        logger.error('清除token失败', err);
      }
    }
  },

  validateToken(token) {
    logger.info('开始验证token', token.substring(0, 10) + '...')
    
    // 使用云函数验证token
    wx.cloud.callFunction({
      name: 'validateToken',
      data: {
        token
      },
      success: (res) => {
        logger.info('验证token返回结果', res.result)
        
        if (res.result && res.result.code === 200) {
          logger.info('Token有效，更新用户信息', res.result.userInfo)
          this.globalData.userInfo = res.result.userInfo
          
          // 触发登录成功事件，供页面响应
          wx.eventCenter = wx.eventCenter || {}
          if (wx.eventCenter.loginSuccess) {
            wx.eventCenter.loginSuccess(res.result.userInfo)
          }
        } else {
          logger.warn('Token无效，需要重新登录', res.result)
          wx.removeStorageSync('token')
          this.globalData.userInfo = null
        }
      },
      fail: (err) => {
        logger.error('验证Token失败', err)
        wx.removeStorageSync('token')
        this.globalData.userInfo = null
      }
    })
  },

  login(callback) {
    logger.info('开始登录流程')
    
    wx.login({
      success: (res) => {
        if (res.code) {
          logger.info('获取微信code成功', res.code)
          
          // 使用云函数登录
          wx.cloud.callFunction({
            name: 'login',
            data: {
              code: res.code
            },
            success: (res) => {
              logger.info('云函数登录返回', res.result)
              
              if (res.result && res.result.token) {
                // 保存token
                wx.setStorageSync('token', res.result.token)
                
                // 更新全局用户信息
                if (res.result.userInfo) {
                  this.globalData.userInfo = res.result.userInfo
                  logger.info('用户信息已更新', this.globalData.userInfo)
                } else {
                  logger.warn('云函数返回数据中没有userInfo', res.result)
                }
                
                if (callback) callback(true)
              } else {
                logger.error('登录失败', res.result ? res.result.message : '未知错误')
                this.globalData.userInfo = null
                
                if (callback) callback(false)
              }
            },
            fail: (err) => {
              logger.error('登录请求失败', err)
              this.globalData.userInfo = null
              
              if (callback) callback(false)
            }
          })
        } else {
          logger.error('获取登录code失败', res.errMsg)
          if (callback) callback(false)
        }
      },
      fail: (err) => {
        logger.error('登录失败', err)
        if (callback) callback(false)
      }
    })
  },
  
  // 提供一个清除所有应用状态的方法
  resetAppState,

  onShow() {
    logger.info('App shown')
  },

  onHide() {
    logger.info('App hidden')
  },
}) 