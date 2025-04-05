import { apiService } from '../../services/api';
import { logger } from '../../utils/logger';
import { toast } from '../../utils/toast';

Page({
  data: {
    userInfo: null,
    loading: true,
    bpCount: 0,
    reportCount: 0,
    bpList: [],  // 最近上传的BP
    isDev: getApp().globalData.isDev,
  },

  onLoad() {
    logger.info('用户中心页面加载');
    this.loadUserInfo();
  },

  onShow() {
    // 每次显示页面时都刷新数据
    this.loadUserInfo();  // 添加这里以确保每次进入页面都重新获取用户信息
  },

  // 获取用户信息
  loadUserInfo() {
    const userInfo = getApp().globalData.userInfo;
    logger.info('当前用户信息', userInfo);
    
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
        
        this.setData({
          bpList: list,
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
    } catch (error) {
      logger.error('加载用户数据失败', error);
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
    
    logger.info('查看分析报告', { fileName, fileId });
    
    if (fileId) {
      wx.navigateTo({
        url: `/pages/analysis-detail/analysis-detail?id=${fileId}&fileName=${encodeURIComponent(fileName)}`,
        fail: (err) => {
          logger.error('导航到分析页失败', err);
          toast.error('打开分析页失败');
        }
      });
    } else {
      toast.info('此文件暂无分析数据');
    }
  },
  
  // 预览文件
  previewFile(e) {
    const fileId = e.currentTarget.dataset.fileId;
    const fileName = e.currentTarget.dataset.fileName;
    
    logger.info('预览文件', { fileName, fileId });
    
    if (fileId) {
      // 显示加载提示
      toast.loading('加载文件中...');
      
      // 先获取BP文件详细信息，包含实际的云存储fileID
      apiService.getBPFileInfo(fileId)
        .then(fileInfo => {
          if (!fileInfo || !fileInfo.fileID) {
            throw new Error('找不到文件的云存储ID');
          }
          
          logger.info('获取到文件信息', fileInfo);
          
          // 使用真正的云存储fileID获取临时访问URL
          return apiService.getFileUrl(fileInfo.fileID);
        })
        .then(tempUrl => {
          logger.info('获取文件临时URL成功', tempUrl);
          
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
          toast.hide();
          
          if (downloadRes.statusCode === 200) {
            const filePath = downloadRes.tempFilePath;
            
            // 使用本地路径预览文件
            wx.openDocument({
              filePath: filePath,
              fileType: this.getFileType(fileName),
              showMenu: true,
              success: () => {
                logger.info('文件预览成功');
              },
              fail: (err) => {
                logger.error('文件预览失败', err);
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
            logger.error('下载文件失败', downloadRes);
            toast.error('文件下载失败');
          }
        })
        .catch(err => {
          toast.hide();
          logger.error('获取或下载文件失败', err);
          toast.error('无法预览文件，请稍后再试');
          
          // 显示更详细的错误提示
          setTimeout(() => {
            wx.showModal({
              title: '文件预览失败',
              content: '无法获取文件信息或预览权限。原因：' + (err.message || '未知错误'),
              showCancel: false
            });
          }, 1000);
        });
    } else {
      toast.info('文件不存在或已被删除');
    }
  },
  
  // 开始分析文件
  startAnalysis(e) {
    const fileId = e.currentTarget.dataset.fileId;
    const fileName = e.currentTarget.dataset.fileName;
    
    logger.info('开始分析文件', { fileName, fileId });
    
    wx.showModal({
      title: '开始分析',
      content: `确定开始分析"${fileName}"吗？`,
      confirmText: '开始分析',
      success: (res) => {
        if (res.confirm) {
          toast.loading('准备分析...');
          
          // 调用API开始分析
          apiService.startAnalysis(fileId).then(res => {
            if (res && res.code === 200) {
              toast.success('分析任务已提交');
              
              // 更新当前文件状态为分析中
              const updatedList = this.data.bpList.map(item => {
                if (item._id === fileId) {
                  return { ...item, status: 'analyzing' };
                }
                return item;
              });
              
              this.setData({ bpList: updatedList });
              
              // 可以选择导航到分析页面查看进度
              setTimeout(() => {
                wx.showModal({
                  title: '分析已开始',
                  content: '是否前往查看分析进度？',
                  confirmText: '前往',
                  cancelText: '留在此页',
                  success: (modalRes) => {
                    if (modalRes.confirm) {
                      this.navigateToAnalysis(e);
                    }
                  }
                });
              }, 1000);
            } else {
              toast.error(res?.message || '提交分析任务失败');
            }
          }).catch(err => {
            logger.error('开始分析失败', err);
            toast.error('分析失败，请稍后再试');
          });
        }
      }
    });
  },
  
  // 重试分析
  retryAnalysis(e) {
    // 实现与startAnalysis基本相同，但提示信息不同
    const fileId = e.currentTarget.dataset.fileId;
    const fileName = e.currentTarget.dataset.fileName;
    
    logger.info('重试分析文件', { fileName, fileId });
    
    wx.showModal({
      title: '重试分析',
      content: `确定重新开始分析"${fileName}"吗？`,
      confirmText: '确定重试',
      success: (res) => {
        if (res.confirm) {
          // 基本逻辑与startAnalysis相同
          this.startAnalysis(e);
        }
      }
    });
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
    toast.loading('登录中...');
    
    getApp().login((success) => {
      toast.hide(); // 隐藏加载提示
      
      if (success) {
        // 获取最新的用户信息
        const userInfo = getApp().globalData.userInfo;
        
        logger.info('登录成功，用户信息:', userInfo);
        toast.success('登录成功');
        
        // 更新页面数据并重新加载用户数据
        this.setData({ userInfo }, () => {
          this.loadUserData();
        });
      } else {
        toast.error('登录失败');
      }
    });
  },
  
  // 退出登录
  async handleLogout() {
    try {
      // 先调用API的登出方法
      await apiService.logout();
      
      // 清除全部本地存储，而不仅仅是token
      wx.clearStorageSync();
      
      // 重置全局数据
      getApp().globalData.userInfo = null;
      getApp().globalData.currentBP = null;
      getApp().globalData.uploadedFiles = [];
      getApp().globalData.analysisList = [];
      
      // 重置页面数据
      this.setData({
        userInfo: null,
        bpList: [],
        bpCount: 0,
        reportCount: 0
      });
      
      // 提示用户
      toast.success('已退出登录');
      
      // 显示提示，建议用户重启或重新编译小程序
      wx.showModal({
        title: '退出成功',
        content: '为确保完全退出，建议重启小程序或重新编译',
        showCancel: false
      });
    } catch (error) {
      logger.error('退出登录失败', error);
      toast.error('退出失败');
    }
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
      logger.error('清理缓存操作失败', error);
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
      logger.error('清理缓存失败', error);
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
      logger.error('强力清理失败', error);
      toast.error('重置失败');
    }
  },
  
  // 联系客服
  handleContact() {
    // 微信小程序会自动处理联系客服按钮
    logger.info('用户点击联系客服');
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
          logger.info('小程序已重启');
        }
      });
    }, 1000);
  }
}) 