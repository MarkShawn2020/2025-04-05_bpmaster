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
        imageUrl: '/assets/images/banner1.png',
        title: 'BP小诸葛 - 让AI为你的商业计划书保驾护航'
      },
      {
        id: 2,
        imageUrl: '/assets/images/banner2.png',
        title: '一键生成专业的BP评估报告'
      },
      {
        id: 3,
        imageUrl: '/assets/images/banner3.png',
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
  },
  
  onShow() {
    // 如果已登录，获取最近分析列表
    if (this.data.isLoggedIn) {
      this.getRecentAnalysisList();
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    try {
      const app = getApp();
      const token = wx.getStorageSync('token');
      
      if (token && app.globalData.userInfo) {
        this.setData({
          isLoggedIn: true,
          userInfo: app.globalData.userInfo,
          loading: false
        });
        
        // 获取最近分析列表
        this.getRecentAnalysisList();
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
    if (!this.data.isLoggedIn) {
      this.showLoginPanel();
      return;
    }
    
    wx.switchTab({
      url: '/pages/upload/upload'
    });
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
        this.getRecentAnalysisList();
        
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
    if (!this.data.isLoggedIn) {
      this.showLoginPanel();
      return;
    }
    
    wx.switchTab({
      url: '/pages/history/history'
    });
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
    
    logger.info('点击功能', id);
    
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