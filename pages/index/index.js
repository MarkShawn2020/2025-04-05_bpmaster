import { info, error } from '../../utils/logger';

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    recentAnalysisList: [],
    totalAnalysisCount: 0,
    loading: true,
    loadingStats: false,
    // 添加统计数据
    statistics: {
      totalAnalysis: 0,
      weeklyAnalysis: 0,
      averageScore: 0,
      totalUsers: 0, // 添加用户数统计项
      fileCount: 0,  // 添加文件数统计项
      // 添加每日活跃度数据
      dailyActivity: [0, 5, 12, 8, 15, 20, 10],
      maxDailyActivity: 20, // 最大日活跃度，用于计算柱状图高度
      highestScore: {
        score: 0,
        fileName: ''
      },
      industryDistribution: {
        tech: 35,
        finance: 25,
        healthcare: 20,
        education: 15,
        other: 5
      }
    },
    bannerList: [
      {
        id: 1,
        imageUrl: '/assets/images/banner1.jpeg',
        title: 'BP小诸葛 - 让AI为你的商业计划书保驾护航'
      },
      {
        id: 2,
        imageUrl: '/assets/images/banner2.jpeg',
        title: '一键生成专业的BP评估报告'
      },
      {
        id: 3,
        imageUrl: '/assets/images/banner3.jpeg',
        title: '基于海量数据，洞察商业趋势'
      }
    ],
    featureList: [
      {
        id: 1,
        icon: '/assets/icons/feature-upload.png',
        title: '快速上传',
        desc: '支持PDF, Word等多种格式'
      },
      {
        id: 2,
        icon: '/assets/icons/feature-analysis.png',
        title: '智能分析',
        desc: '大模型解析BP内容与结构'
      },
      {
        id: 3,
        icon: '/assets/icons/feature-report.png',
        title: '专业报告',
        desc: '全面评估与改进建议'
      },
      {
        id: 4,
        icon: '/assets/icons/feature-compare.png',
        title: '对比评估',
        desc: '多维度对比与打分'
      }
    ]
  },

  onLoad(options) {
    info('首页加载', options);
    
    // 检查是否需要显示登录面板
    if (options && options.auth === '1') {
      this.setData({
        showLoginPanel: true
      });
    }

    // 获取用户登录状态
    this.checkLoginStatus();
    
    // 获取统计数据
    this.getStatisticsData();

    // 不再测试空状态
    // this.testEmptyState();
  },
  
  // 获取统计数据
  getStatisticsData() {
    // 显示加载状态
    this.setData({ loadingStats: true });
    
    // 调用云函数获取真实数据
    wx.cloud.callFunction({
      name: 'getStatistics',
      success: res => {
        info('获取统计数据成功', res);
        
        // 如果云函数返回成功
        if (res.result && res.result.code === 0) {
          // 处理从云函数返回的数据
          const statsData = res.result.data;
          
          // 如果返回了每日活跃度数据，计算最大值
          if (statsData.dailyActivity && Array.isArray(statsData.dailyActivity)) {
            statsData.maxDailyActivity = Math.max(...statsData.dailyActivity, 1); // 至少为1，避免除以0
          } else {
            // 如果没有返回活跃度数据，使用默认值
            statsData.dailyActivity = [0, 5, 12, 8, 15, 20, 10];
            statsData.maxDailyActivity = 20;
          }
          
          this.setData({
            statistics: statsData,
            loadingStats: false
          });
          
          info('首页统计数据更新', {
            totalUsers: statsData.totalUsers,
            totalAnalysis: statsData.totalAnalysis,
            fileCount: statsData.fileCount,
            maxDailyActivity: statsData.maxDailyActivity
          });
        } else {
          // 返回失败，显示错误信息
          error('获取统计数据失败', res.result);
          this.setData({ loadingStats: false });
          wx.showToast({
            title: '获取统计数据失败',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: err => {
        error('获取统计数据失败', err);
        this.setData({ loadingStats: false });
        wx.showToast({
          title: '获取统计数据失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },
  
  onShow() {
    // 如果已登录，获取最近分析列表
    if (this.data.isLoggedIn) {
      // 获取最近分析列表
      this.getRecentAnalysisList();
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    try {
      const app = getApp();
      const token = wx.getStorageSync('token');
      const isDev = app.globalData.isDev;
      
      if (token && app.globalData.userInfo) {
        this.setData({
          isLoggedIn: true,
          userInfo: app.globalData.userInfo,
          loading: false
        });
        // 获取最近分析列表
        this.getRecentAnalysisList();
      } else if (isDev) {
        // 在开发环境中自动登录
        info('开发环境自动登录检查');
        app.login((success) => {
          if (success) {
            this.setData({
              isLoggedIn: true,
              userInfo: app.globalData.userInfo,
              loading: false
            });
            // 在登录成功后获取最近分析列表
            this.getRecentAnalysisList();
          } else {
            this.setData({
              isLoggedIn: false,
              loading: false
            });
          }
        });
      } else {
        this.setData({
          isLoggedIn: false,
          loading: false
        });
      }
    } catch (e) {
      error('检查登录状态失败', e);
      this.setData({
        isLoggedIn: false,
        loading: false
      });
    }
  },

  // 获取最近分析列表
  getRecentAnalysisList() {
    this.setData({ loading: true });
    
    // 调用云函数获取真实数据
    wx.cloud.callFunction({
      name: 'getRecentAnalysis',
      data: {
        limit: 6
      },
      success: res => {
        info('获取最近分析列表成功', res);
        
        // 如果云函数返回成功
        if (res.result && res.result.code === 0) {
          this.setData({
            recentAnalysisList: res.result.data.list,
            totalAnalysisCount: res.result.data.total,
            loading: false
          });
        } else {
          // 返回失败，显示错误信息
          error('获取分析列表失败', res.result);
          this.setData({ 
            recentAnalysisList: [],
            loading: false 
          });
          wx.showToast({
            title: '获取分析列表失败',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: err => {
        error('获取最近分析列表失败', err);
        this.setData({ 
          recentAnalysisList: [],
          loading: false 
        });
        wx.showToast({
          title: '获取分析列表失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 去上传页面
  goToUpload() {
    const app = getApp();
    
    // 如果已登录，直接跳转
    if (this.data.isLoggedIn) {
      wx.switchTab({
        url: '/pages/upload/upload'
      });
      return;
    }
    
    // 开发环境自动登录
    if (app.globalData.isDev) {
      info('开发环境上传页面自动登录');
      app.login((success) => {
        if (success) {
          this.setData({
            isLoggedIn: true,
            userInfo: app.globalData.userInfo
          });
          
          // 登录成功后跳转
          wx.switchTab({
            url: '/pages/upload/upload'
          });
        } else {
          // 即使在开发环境，登录失败也显示登录面板
          this.showLoginPanel();
        }
      });
      return;
    }
    
    // 生产环境显示登录面板
    this.showLoginPanel();
  },

  // 显示登录面板
  showLoginPanel() {
    this.setData({
      showLoginPanel: true
    });
  },

  // 隐藏登录面板
  hideLoginPanel() {
    this.setData({
      showLoginPanel: false
    });
  },

  // 登录
  handleLogin() {
    this.setData({ loginLoading: true });
    
    const app = getApp();
    app.login((success) => {
      this.setData({ loginLoading: false });
      
      if (success) {
        this.setData({
          isLoggedIn: true,
          userInfo: app.globalData.userInfo,
          showLoginPanel: false
        });
      
        
        // 显示登录成功提示
        this.selectComponent('#toast').success('登录成功');
      } else {
        // 显示登录失败提示
        this.selectComponent('#toast').error('登录失败，请重试');
      }
    });
  },

  // 前往历史分析页
  goToHistoryList() {
    const app = getApp();
    
    // 如果已登录，直接跳转
    if (this.data.isLoggedIn) {
      wx.switchTab({
        url: '/pages/history/history'
      });
      return;
    }
    
    // 开发环境自动登录
    if (app.globalData.isDev) {
      info('开发环境历史页面自动登录');
      app.login((success) => {
        if (success) {
          this.setData({
            isLoggedIn: true,
            userInfo: app.globalData.userInfo
          });
          
          // 登录成功后跳转
          wx.switchTab({
            url: '/pages/history/history'
          });
        } else {
          // 即使在开发环境，登录失败也显示登录面板
          this.showLoginPanel();
        }
      });
      return;
    }
    
    // 生产环境显示登录面板
    this.showLoginPanel();
  },

  // 前往分析详情页
  goToAnalysisDetail(e) {
    const id = e.currentTarget.dataset.id;
    
    wx.navigateTo({
      url: `/pages/analysis/analysis?id=${id}`
    });
  },

  // 点击Banner
  onBannerTap(e) {
    const index = e.currentTarget.dataset.index;
    const banner = this.data.bannerList[index];
    
    info('点击Banner', banner);
    
    // 可以根据不同的banner进行不同的操作
    if (index === 0) {
      this.goToUpload();
    }
  },

  // 点击功能
  onFeatureTap(e) {
    const id = e.currentTarget.dataset.id;
    const app = getApp();
    
    info('点击功能', id);
    
    // 如果在开发环境中但未登录，先尝试自动登录
    if (app.globalData.isDev && !this.data.isLoggedIn) {
      info('开发环境功能点击自动登录');
      app.login((success) => {
        if (success) {
          this.setData({
            isLoggedIn: true,
            userInfo: app.globalData.userInfo
          }, () => {
            // 登录成功后继续处理功能点击
            this.handleFeature(id);
          });
        } else {
          // 即使开发环境登录失败，也显示登录面板
          this.showLoginPanel();
        }
      });
      return;
    }
    
    // 正常处理功能点击
    this.handleFeature(id);
  },

  // 处理功能点击的实际逻辑
  handleFeature(id) {
    switch (id) {
      case 1: // 上传
        this.goToUpload();
        break;
      case 2: // 分析
        this.goToUpload();
        break;
      case 3: // 报告
        if (this.data.recentAnalysisList.length > 0) {
          this.goToAnalysisDetail({ currentTarget: { dataset: { id: this.data.recentAnalysisList[0].id } } });
        } else {
          this.goToUpload();
        }
        break;
      case 4: // 对比
        this.goToHistoryList();
        break;
    }
  },

  onShareAppMessage() {
    return {
      title: 'BP小诸葛 - 商业计划书智能评估专家',
      path: '/pages/index/index',
      imageUrl: '/assets/images/share.png'
    };
  }
}) 