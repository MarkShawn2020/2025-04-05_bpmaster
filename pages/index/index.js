import { logger } from '../../utils/logger';

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    recentAnalysisList: [],
    totalAnalysisCount: 0,
    loading: true,
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
    logger.info('首页加载', options);
    
    // 检查是否需要显示登录面板
    if (options && options.auth === '1') {
      this.setData({
        showLoginPanel: true
      });
    }

    // 获取用户登录状态
    this.checkLoginStatus();
    
    // 测试空状态显示
    this.testEmptyState();
  },
  
  // 临时函数：测试空状态显示
  testEmptyState() {
    this.setData({
      recentAnalysisList: [], // 设置为空数组
      loading: false         // 确保loading为false
    });
    console.log('测试空状态显示');
  },
  
  onShow() {
    // 如果已登录，获取最近分析列表
    if (this.data.isLoggedIn) {
      // 注释掉这行以测试空状态
      // this.getRecentAnalysisList();
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
        // 注释掉这行以测试空状态
        // this.getRecentAnalysisList();
      } else if (isDev) {
        // 在开发环境中自动登录
        logger.info('开发环境自动登录检查');
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
      logger.error('检查登录状态失败', e);
      this.setData({
        isLoggedIn: false,
        loading: false
      });
    }
  },

  // 获取最近分析列表
  getRecentAnalysisList() {
    this.setData({ loading: true });
    
    const app = getApp();
    
    // 模拟获取数据，实际应调用API
    setTimeout(() => {
      // 使用模拟数据，实际开发中应使用api请求
      this.setData({
        recentAnalysisList: [
          {
            id: '1',
            fileName: '字节跳动商业计划书.pdf',
            analysisDate: '2023-09-15 14:30',
            score: 92.5
          },
          {
            id: '2',
            fileName: '美团商业计划书.pdf',
            analysisDate: '2023-09-10 10:15',
            score: 88.3
          },
          {
            id: '3',
            fileName: '小红书产品方案.docx',
            analysisDate: '2023-09-05 16:45',
            score: 85.7
          },
          {
            id: '4',
            fileName: '知乎社区运营方案.pptx',
            analysisDate: '2023-08-28 09:20',
            score: 79.2
          },
          {
            id: '5',
            fileName: '阿里巴巴电商发展规划.pdf',
            analysisDate: '2023-08-22 11:05',
            score: 90.1
          },
          {
            id: '6',
            fileName: '滴滴出行商业模式分析.doc',
            analysisDate: '2023-08-15 13:40',
            score: 82.6
          }
        ],
        totalAnalysisCount: 6,
        loading: false
      });
    }, 1000);
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
      logger.info('开发环境上传页面自动登录');
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
        
        // 获取最近分析列表
        // this.getRecentAnalysisList(); // 注释掉以测试空状态
        
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
      logger.info('开发环境历史页面自动登录');
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
    
    logger.info('点击Banner', banner);
    
    // 可以根据不同的banner进行不同的操作
    if (index === 0) {
      this.goToUpload();
    }
  },

  // 点击功能
  onFeatureTap(e) {
    const id = e.currentTarget.dataset.id;
    const app = getApp();
    
    logger.info('点击功能', id);
    
    // 如果在开发环境中但未登录，先尝试自动登录
    if (app.globalData.isDev && !this.data.isLoggedIn) {
      logger.info('开发环境功能点击自动登录');
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