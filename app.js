// app.js
import { logger } from './utils/logger'

// 初始化云开发
wx.cloud.init({
  env: 'cloud1-7gfmwz4qfae46e0', // 默认环境配置，请修改为你的云开发环境ID
  traceUser: true
});

App({
  globalData: {
    userInfo: null,
    currentBP: null,
    uploadedFiles: [],
    analysisList: [],
  },

  onLaunch() {
    logger.info('App launched')
    
    // 检查更新
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager()
      updateManager.onCheckForUpdate(function (res) {
        if (res.hasUpdate) {
          logger.info('有新版本')
          updateManager.onUpdateReady(function () {
            wx.showModal({
              title: '更新提示',
              content: '新版本已经准备好，是否重启应用？',
              success: function (res) {
                if (res.confirm) {
                  updateManager.applyUpdate()
                }
              }
            })
          })
          updateManager.onUpdateFailed(function () {
            wx.showModal({
              title: '更新提示',
              content: '新版本下载失败，请检查网络后重试'
            })
          })
        }
      })
    }
    
    // 获取用户登录状态
    this.checkLoginStatus()
  },

  checkLoginStatus() {
    try {
      const token = wx.getStorageSync('token')
      if (token) {
        // 验证token有效性
        this.validateToken(token)
      } else {
        // 引导用户登录
        logger.info('用户未登录')
      }
    } catch (e) {
      logger.error('检查登录状态失败', e)
    }
  },

  validateToken(token) {
    // 使用云函数验证token
    wx.cloud.callFunction({
      name: 'validateToken',
      data: {
        token
      },
      success: (res) => {
        if (res.result && res.result.valid) {
          logger.info('Token有效')
          this.globalData.userInfo = res.result.userInfo
        } else {
          logger.warn('Token无效，需要重新登录')
          wx.removeStorageSync('token')
        }
      },
      fail: (err) => {
        logger.error('验证Token失败', err)
      }
    })
  },

  login(callback) {
    wx.login({
      success: (res) => {
        if (res.code) {
          // 使用云函数登录
          wx.cloud.callFunction({
            name: 'login',
            data: {
              code: res.code
            },
            success: (res) => {
              if (res.result && res.result.token) {
                wx.setStorageSync('token', res.result.token)
                this.globalData.userInfo = res.result.userInfo
                if (callback) callback(true)
              } else {
                logger.error('登录失败', res.result ? res.result.message : '未知错误')
                if (callback) callback(false)
              }
            },
            fail: (err) => {
              logger.error('登录请求失败', err)
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

  onShow() {
    logger.info('App shown')
  },

  onHide() {
    logger.info('App hidden')
  },

  onError(err) {
    logger.error('App error:', err)
  }
}) 