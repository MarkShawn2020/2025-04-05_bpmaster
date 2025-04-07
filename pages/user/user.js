import { apiService } from '../../services/api';
import { info, error } from '../../utils/logger.js';
import { toast } from '../../utils/toast';
import { formatDisplayTime } from '../../utils/date';

const app = getApp();

const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0';

Page({
  data: {
    userInfo: null,
    loading: true,
    bpCount: 0,
    reportCount: 0,
    bpList: [],  // 最近上传的BP
    isDev: getApp().globalData.isDev,
    version: '1.0.0',
    defaultAvatarUrl: defaultAvatarUrl
  },

  onLoad() {
    info('用户中心页面加载');
    this.checkLoginStatus();
  },

  onShow() {
    // 每次显示页面时都刷新数据
    this.loadUserInfo();  // 添加这里以确保每次进入页面都重新获取用户信息
    
    // 检查是否有正在进行的分析
    this._checkOngoingAnalysis();
  },

  // 获取用户信息
  loadUserInfo() {
    const userInfo = getApp().globalData.userInfo;
    info('当前用户信息', userInfo);
    
    this.setData({ userInfo }); // 无论是否为null，都要更新UI
    
    if (userInfo) {
      // 加载用户数据
      this.loadUserData();
    } else {
      // 尝试重新验证登录状态
      getApp().checkLoginStatus();
      this.setData({ loading: false }); // 确保加载状态更新
      toast.info('请先登录');
    }
  },
  
  // 加载用户数据
  async loadUserData() {
    try {
      this.setData({ loading: true });
      
      // 获取BP列表数据
      const bpResponse = await apiService.getBPList(1, 5);
      if (bpResponse && bpResponse.code === 200) {
        const { list, pagination } = bpResponse.data;
        
        // 处理文件名和时间格式化
        const processedList = list.map(item => {
          return {
            ...item,
            displayName: item.fileName,
            uploadTime: this._formatTime(item.uploadDate)
          };
        });
        
        this.setData({
          bpList: processedList,
          bpCount: pagination.total
        });
      }
      
      // 获取报告数量
      const reportResponse = await apiService.getReportList(1, 1);
      if (reportResponse && reportResponse.code === 200) {
        this.setData({
          reportCount: reportResponse.data.pagination.total
        });
      }
    } catch (err) {
      error('加载用户数据失败', err);
      toast.error('数据加载失败');
    } finally {
      this.setData({ loading: false });
    }
  },
  
  // 跳转到BP历史页面
  navToBpHistory() {
    wx.navigateTo({
      url: '/pages/history/history'
    });
  },
  
  // 跳转到报告历史页面
  navToReportHistory() {
    wx.navigateTo({
      url: '/pages/report/report'
    });
  },
  
  // 导航到文件分析页面
  navigateToAnalysis(e) {
    const fileId = e.currentTarget.dataset.fileId;
    const fileName = e.currentTarget.dataset.fileName;
    
    info('查看分析报告', { fileName, fileId });
    
    if (fileId) {
      // 先显示加载中的提示
      wx.showLoading({
        title: '加载分析数据...',
        mask: true
      });
      
      // 使用API服务获取BP详情数据，确保获取真实数据
      apiService.getBPDetail(fileId)
        .then(res => {
          wx.hideLoading();
          
          if (res && res.code === 200 && res.data) {
            const bpData = res.data;
            
            // 检查是否有分析结果
            if (!bpData.analysisResults || Object.keys(bpData.analysisResults).length === 0) {
                    // 用户选择开始分析
                    this.startAnalysis({ 
                      currentTarget: { 
                        dataset: { 
                          fileId: fileId, 
                          fileName: fileName 
                        } 
                      }
                    });
            } else {
              // 有分析结果，跳转到分析详情页
              wx.navigateTo({
                url: `/pages/analysis-result/analysis-result?id=${fileId}&fileName=${encodeURIComponent(fileName)}`,
                fail: (err) => {
                  error('导航到分析页失败', err);
                  wx.showToast({
                    title: '打开分析页失败',
                    icon: 'error'
                  });
                }
              });
            }
          } else {
            // API调用成功但返回错误
            wx.showToast({
              title: res?.message || '获取分析数据失败',
              icon: 'error'
            });
          }
        })
        .catch(err => {
          wx.hideLoading();
          error('获取BP详情失败', err);
          wx.showToast({
            title: '获取数据失败',
            icon: 'error'
          });
        });
    } else {
      wx.showToast({
        title: '文件ID无效',
        icon: 'error'
      });
    }
  },
  
  // 预览文件
  previewFile(e) {
    const fileId = e.currentTarget.dataset.fileId;
    const fileName = e.currentTarget.dataset.fileName;
    
    info('预览文件', { fileName, fileId });
    
    if (fileId) {
      // 显示加载提示
      const loading = toast.loading('加载文件中...');
      
      // 先获取BP文件详细信息，包含实际的云存储fileID
      apiService.getBPFileInfo(fileId)
        .then(fileInfo => {
          if (!fileInfo || !fileInfo.fileID) {
            throw new Error('找不到文件的云存储ID');
          }
          
          info('获取到文件信息', fileInfo);
          
          // 使用真正的云存储fileID获取临时访问URL
          return apiService.getFileUrl(fileInfo.fileID);
        })
        .then(tempUrl => {
          info('获取文件临时URL成功', tempUrl);
          
          // 下载文件到本地
          return new Promise((resolve, reject) => {
            wx.downloadFile({
              url: tempUrl,
              success: res => resolve(res),
              fail: err => reject(err)
            });
          });
        })
        .then(downloadRes => {
          if (downloadRes.statusCode === 200) {
            const filePath = downloadRes.tempFilePath;
            
            // 使用本地路径预览文件
            wx.openDocument({
              filePath: filePath,
              fileType: this.getFileType(fileName),
              showMenu: true,
              success: () => {
                info('文件预览成功');
              },
              fail: (err) => {
                error('文件预览失败', err);
                toast.error('预览失败，请稍后再试');
                
                // 处理权限问题
                if (err.errMsg && err.errMsg.includes('not permission')) {
                  setTimeout(() => {
                    wx.showModal({
                      title: '需要权限',
                      content: '预览文件需要授权，请在设置中允许使用文档预览功能',
                      confirmText: '去设置',
                      success: (modalRes) => {
                        if (modalRes.confirm) {
                          wx.openSetting();
                        }
                      }
                    });
                  }, 1000);
                }
              }
            });
          } else {
            error('下载文件失败', downloadRes);
            toast.error('文件下载失败');
          }
        })
        .catch(err => {
          error('获取或下载文件失败', err);
          toast.error('无法预览文件，请稍后再试');
          
          // 显示更详细的错误提示
          setTimeout(() => {
            wx.showModal({
              title: '预览失败',
              content: '无法预览文件，可能是网络问题或文件格式不支持。',
              showCancel: false
            });
          }, 500);
        })
        .finally(() => {
          loading.hide();
        });
    } else {
      toast.error('文件信息有误');
    }
  },
  
  // 开始分析BP文件
  startAnalysis(e) {
    const fileId = e.currentTarget.dataset.fileId;
    const fileName = e.currentTarget.dataset.fileName;
    
    info('开始分析BP文件', { fileName, fileId });
    
    // 显示确认对话框
    wx.showModal({
      title: '启动分析',
      content: `确定调用 AI 分析\n"${fileName}"吗？`,
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 用户确认开始分析
          wx.showLoading({
            title: '启动分析...',
            mask: true
          });
          
          // 调用API开始分析
          apiService.startAnalysis(fileId)
            .then(res => {
              wx.hideLoading();
              
              if (res && res.code === 200) {
                // 刷新数据以更新UI状态
                this.loadUserData();
                
                wx.showToast({
                  title: '分析任务已启动',
                  icon: 'success'
                });
                
                // 跳转到分析详情页，让用户查看分析进度
                setTimeout(() => {
                  wx.navigateTo({
                    url: `/pages/analysis-result/analysis-result?id=${fileId}&fileName=${encodeURIComponent(fileName)}`,
                    fail: (err) => {
                      error('导航到分析页失败', err);
                    }
                  });
                }, 1500);
              } else {
                // 分析启动失败
                wx.showToast({
                  title: res?.message || '启动分析失败',
                  icon: 'error'
                });
              }
            })
            .catch(err => {
              wx.hideLoading();
              error('启动分析失败', err);
              wx.showToast({
                title: '启动分析失败',
                icon: 'error'
              });
            });
        }
      }
    });
  },
  
  // 重试分析
  retryAnalysis(e) {
    const fileId = e.currentTarget.dataset.fileId;
    const fileName = e.currentTarget.dataset.fileName;
    
    info('重试分析BP文件', { fileName, fileId });
    
    // 直接调用开始分析函数
    this.startAnalysis(e);
  },
  
  // 获取文件类型
  getFileType(fileName) {
    const ext = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
    const typeMap = {
      'pdf': 'pdf',
      'doc': 'doc',
      'docx': 'docx',
      'xls': 'xls',
      'xlsx': 'xlsx',
      'ppt': 'ppt',
      'pptx': 'pptx',
      'txt': 'txt'
    };
    return typeMap[ext] || 'pdf'; // 默认返回pdf
  },
  
  // 重新登录
  handleLogin() {
    info('开始登录流程');
    
    wx.showLoading({ title: '登录中...' });
    
    // 使用云函数登录，只获取openid
    wx.cloud.callFunction({
      name: 'login',
      success: (res) => {
        wx.hideLoading();
        info('云函数登录返回', res.result);

        const userInfo = res.result.userInfo;
        this.setData({ userInfo });
        wx.setStorageSync('userInfo', userInfo);
        
      },
      fail: (err) => {
        wx.hideLoading();
        error('云函数调用失败', err);
        wx.showToast({
          title: '登录失败',
          icon: 'error'
        });
      }
    });
  },
  
  // 退出登录
  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          info('用户确认退出登录');
          
          // 清除用户信息
          wx.removeStorageSync('userInfo');
          this.setData({ userInfo: null });
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
        }
      }
    });
  },
  
  // 清理缓存 - 添加更强力的清理选项
  handleClearCache() {
    try {
      // 显示清理选项
      wx.showActionSheet({
        itemList: ['普通清理', '强力清理(完全重置)'],
        success: (res) => {
          if (res.tapIndex === 0) {
            // 普通清理
            this.normalClearCache();
          } else if (res.tapIndex === 1) {
            // 强力清理
            this.forceClearCache();
          }
        }
      });
    } catch (error) {
      error('清理缓存操作失败', error);
      toast.error('操作失败');
    }
  },
  
  // 普通清理缓存
  normalClearCache() {
    try {
      // 清理本地存储
      wx.clearStorageSync();
      
      // 重置全局用户信息
      getApp().globalData.userInfo = null;
      
      this.setData({
        userInfo: null,
        bpList: [],
        bpCount: 0,
        reportCount: 0
      });
      
      toast.success('缓存已清理');
      
      // 提示可以重新登录
      wx.showModal({
        title: '清理完成',
        content: '缓存已清理，是否重新登录？',
        confirmText: '重新登录',
        cancelText: '稍后登录',
        success: (res) => {
          if (res.confirm) {
            this.handleLogin();
          }
        }
      });
    } catch (error) {
      error('清理缓存失败', error);
      toast.error('清理失败');
    }
  },
  
  // 强力清理缓存 - 完全重置
  forceClearCache() {
    try {
      // 清理本地存储
      wx.clearStorageSync();
      
      // 重置所有全局数据
      const app = getApp();
      app.globalData.userInfo = null;
      app.globalData.currentBP = null;
      app.globalData.uploadedFiles = [];
      app.globalData.analysisList = [];
      
      // 重置页面数据
      this.setData({
        userInfo: null,
        bpList: [],
        bpCount: 0,
        reportCount: 0
      });
      
      toast.success('已完全重置应用');
      
      // 提示用户重启小程序
      wx.showModal({
        title: '强力清理完成',
        content: '应用已完全重置，建议退出并重启小程序以确保所有缓存清除',
        confirmText: '知道了',
        showCancel: false
      });
    } catch (error) {
      error('强力清理失败', error);
      toast.error('重置失败');
    }
  },
  
  // 联系客服
  handleContact() {
    // 微信小程序会自动处理联系客服按钮
    info('用户点击联系客服');
  },
  
  // 关于我们
  handleAbout() {
    wx.navigateTo({
      url: '/pages/about/about'
    });
  },
  
  // 开发工具菜单
  handleDevTools() {
    if (!this.data.isDev) return;
    
    wx.showActionSheet({
      itemList: ['强制重新登录', '清除所有缓存', '重启小程序'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0: // 强制重新登录
            this.handleForceLogin();
            break;
          case 1: // 清除所有缓存
            this.forceClearCache();
            break;
          case 2: // 重启小程序
            this.restartMiniProgram();
            break;
        }
      }
    });
  },
  
  // 强制重新登录
  handleForceLogin() {
    // 清除token
    wx.removeStorageSync('token');
    // 清除全局用户信息
    getApp().globalData.userInfo = null;
    // 重置页面数据
    this.setData({
      userInfo: null
    });
    // 执行登录
    setTimeout(() => {
      this.handleLogin();
    }, 500);
  },
  
  // 重置整个应用
  handleResetApp() {
    wx.showModal({
      title: '确认重置',
      content: '这将清除所有数据和登录状态，应用将恢复到初始状态。确定要继续吗？',
      confirmText: '确认重置',
      confirmColor: '#FF6B00',
      success: (res) => {
        if (res.confirm) {
          // 执行重置
          getApp().resetAppState();
          
          // 重置页面状态
          this.setData({
            userInfo: null,
            bpList: [],
            bpCount: 0,
            reportCount: 0
          });
          
          toast.success('应用已重置');
          
          // 建议重启
          setTimeout(() => {
            wx.showModal({
              title: '重置完成',
              content: '建议退出并重新进入小程序，以确保所有状态清除',
              showCancel: false
            });
          }, 1000);
        }
      }
    });
  },
  
  // 重启小程序（仅开发环境下有效）
  restartMiniProgram() {
    toast.loading('正在重启...');
    setTimeout(() => {
      toast.hide();
      wx.reLaunch({
        url: '/pages/index/index',
        success: () => {
          info('小程序已重启');
        }
      });
    }, 1000);
  },
  
  // 检查是否有正在进行的分析任务
  _checkOngoingAnalysis() {
    const app = getApp();
    if (app.globalData.analysisStreams) {
      const streamIds = Object.keys(app.globalData.analysisStreams);
      
      // 如果有分析流，检查状态
      if (streamIds.length > 0) {
        info('检测到分析流:', streamIds.length);
        
        // 遍历所有分析流
        streamIds.forEach(streamId => {
          const stream = app.globalData.analysisStreams[streamId];
          
          // 如果分析已完成或失败，更新文件状态
          if (stream.status === 'completed' || stream.status === 'failed') {
            // 立即刷新BP列表数据
            this.loadUserData();
          }
        });
      }
    }
  },
  
  // 格式化时间显示
  _formatTime(timestamp) {
    if (!timestamp) return '';
    
    // 如果是毫秒时间戳
    if (typeof timestamp === 'number' || /^\d+$/.test(timestamp)) {
      return formatDisplayTime(timestamp);
    }
    
    // 尝试使用日期工具格式化
    return formatDisplayTime(timestamp);
  },

  // 检查登录状态
  checkLoginStatus: function() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({ userInfo });
    } else {
      this.setData({ userInfo: null });
    }
  },

  // 选择头像
  onChooseAvatar: function(e) {
    const { avatarUrl } = e.detail;
    info('用户选择头像', { avatarUrl });
    
    const userInfo = this.data.userInfo || {};
    userInfo.avatarUrl = avatarUrl;
    
    this.setData({ userInfo });
    this.saveUserInfo();
  },

  // 昵称输入框失去焦点
  onNicknameBlur: function(e) {
    const nickName = e.detail.value;
    info('用户输入昵称', { nickName });
    
    if (!nickName) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }
    
    const userInfo = this.data.userInfo || {};
    userInfo.nickName = nickName;
    
    this.setData({ userInfo });
    this.saveUserInfo();
  },

  // 保存用户信息
  saveUserInfo: function() {
    const userInfo = this.data.userInfo;
    if (!userInfo) return;
    
    try {
      // 保存到本地
      wx.setStorageSync('userInfo', userInfo);
      info('用户信息保存到本地成功', userInfo);
      
      // 如果有 openId，同时保存到云端
      if (userInfo.openId) {
        this.updateUserInfoToCloud(userInfo);
      } else {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
      }
    } catch (err) {
      error('保存用户信息失败', err);
      wx.showToast({
        title: '保存失败',
        icon: 'error'
      });
    }
  },
  
  // 更新用户信息到云端
  updateUserInfoToCloud: function(userInfo) {
    wx.cloud.callFunction({
      name: 'updateUserInfo',
      data: {
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl
      },
      success: (res) => {
        info('用户信息更新到云端成功', res.result);
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
      },
      fail: (err) => {
        error('用户信息更新到云端失败', err);
        // 即使云端更新失败，本地已保存成功，也显示成功提示
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
      }
    });
  },
  
  // 查看历史
  handleViewHistory: function() {
    if (!this.data.userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    
    wx.navigateTo({
      url: '/pages/history/history'
    });
  },

  // 查看收藏
  handleViewFavorites: function() {
    if (!this.data.userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    
    wx.navigateTo({
      url: '/pages/favorites/favorites'
    });
  },

  // 查看设置
  handleViewSettings: function() {
    wx.navigateTo({
      url: '/pages/settings/settings'
    });
  }
}); 