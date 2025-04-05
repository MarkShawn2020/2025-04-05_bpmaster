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
    this.loadUserData();
  },

  // 获取用户信息
  loadUserInfo() {
    const userInfo = getApp().globalData.userInfo;
    logger.info('当前用户信息', userInfo);
    
    if (userInfo) {
      this.setData({ userInfo });
    } else {
      // 尝试重新验证登录状态
      getApp().checkLoginStatus();
      toast.info('请先登录');
    }
    
    // 加载用户数据
    this.loadUserData();
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
  
  // 重新登录
  handleLogin() {
    getApp().login((success) => {
      if (success) {
        toast.success('登录成功');
        this.setData({
          userInfo: getApp().globalData.userInfo
        });
        this.loadUserData();
      } else {
        toast.error('登录失败');
      }
    });
  },
  
  // 退出登录
  async handleLogout() {
    try {
      await apiService.logout();
      getApp().globalData.userInfo = null;
      wx.removeStorageSync('token');
      
      this.setData({
        userInfo: null,
        bpList: [],
        bpCount: 0,
        reportCount: 0
      });
      
      toast.success('已退出登录');
    } catch (error) {
      logger.error('退出登录失败', error);
      toast.error('退出失败');
    }
  },
  
  // 清理缓存
  handleClearCache() {
    try {
      // 清理本地存储
      wx.clearStorageSync();
      
      // 重新登录
      this.handleLogin();
      
      toast.success('清理成功，请重新登录');
    } catch (error) {
      logger.error('清理缓存失败', error);
      toast.error('清理失败');
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
  }
}) 