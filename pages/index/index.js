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
  },
  
  // 获取统计数据
  getStatisticsData() {
    // 显示加载状态
    this.setData({ loadingStats: true });
    
    // 使用前端数据库访问获取数据
    const db = wx.cloud.database();
    const _ = db.command;
    const $ = db.command.aggregate;
    
    // 并行获取多种统计数据
    db.collection('users').count()
    .then(res => {
      console.log('getUsersCount', res);
      this.setData({
        statistics: {
          ...this.data.statistics,
          totalUsers: res.total
        }
      });
    })
    .catch(err => {
      error('getUsersCount', err);
    });

    db.collection('analysis_tasks').count()
    .then(res => {
      console.log('getAnalysisCount', res);
      this.setData({
        statistics: {
          ...this.data.statistics,
          totalAnalysis: res.total
        }
      });
    })
    .catch(err => {
      error('getAnalysisCount', err);
    });

    db.collection('bp_files').count()
    .then(res => {
      console.log('getFileCount', res);
      this.setData({
        statistics: {
          ...this.data.statistics,
          fileCount: res.total
        }
      });
    })
    .catch(err => {
      error('getFileCount', err);
    });
    
  
  },
  
  onShow() {
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

  onShareAppMessage() {
    return {
      title: 'BP小诸葛 - 商业计划书智能评估专家',
      path: '/pages/index/index',
      imageUrl: '/assets/images/share.png'
    };
  }
}) 