// pages/user/user.js
import { info, error, warn } from '../../utils/logger.js';
import { toast } from '../../utils/toast.js';
import { formatFileSize, getFileType } from '../../utils/file.js';

const app = getApp();

Page({
  data: {
    userInfo: null,
    defaultAvatarUrl: '/assets/images/default-avatar.png',
    version: app.globalData.version || '1.0.0',
    uploadHistory: [], // 用户上传的文件历史
    loading: false,
    page: 1,
    pageSize: 10,
    hasMore: true
  },

  onLoad: function (options) {
    info('用户页面加载');
    this.getUserInfo();
  },

  onShow: function() {
    // 每次页面显示时，重新加载文件历史
    this.loadUserFiles();
  },

  /**
   * 获取用户信息
   */
  getUserInfo: function () {
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({ userInfo });
      info('获取用户信息成功', userInfo);
    } else {
      warn('用户未登录');
    }
  },

  /**
   * 格式化日期对象
   */
  formatDateObject: function(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return '未知时间';
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  /**
   * 加载用户文件历史
   */
  loadUserFiles: async function() {
    if (this.data.loading || !this.data.hasMore) return;
    
    try {
      this.setData({ loading: true });
      info('加载用户文件历史', { page: this.data.page, pageSize: this.data.pageSize });
      
      // 直接从云数据库获取用户上传的文件列表
      const db = wx.cloud.database();
      // 获取当前用户ID
      const userId = this.data.userInfo ? this.data.userInfo.openid : '';
      
      if (!userId) {
        warn('用户未登录，无法获取文件列表');
        this.setData({ loading: false });
        return;
      }
      
      // 从bp_files集合查询当前用户的文件
      const filesResult = await db.collection('bp_files')
        .where({ openid: userId })
        .orderBy('uploadDate', 'desc')
        .skip((this.data.page - 1) * this.data.pageSize)
        .limit(this.data.pageSize)
        .get();
      
      let list = [];
      let hasMore = false;
      
      if (filesResult && filesResult.data) {
        list = filesResult.data || [];
        hasMore = list.length === this.data.pageSize;
        
        // 处理数据，格式化文件大小和上传时间
        list = list.map(item => {
          // 处理日期 - 可能是 Date 对象、时间戳或字符串
          let formattedTime = '未知时间';
          const dateValue = item.uploadDate || item.uploadTime;
          if (dateValue) {
            if (dateValue instanceof Date) {
              // 如果是 Date 对象
              formattedTime = this.formatDateObject(dateValue);
            } else if (typeof dateValue === 'object' && dateValue.$date) {
              // 如果是 MongoDB 风格的日期对象
              formattedTime = this.formatDateObject(new Date(dateValue.$date));
            } else if (typeof dateValue === 'number') {
              // 如果是时间戳
              formattedTime = this.formatDateObject(new Date(dateValue));
            } else if (typeof dateValue === 'string') {
              // 如果是字符串
              formattedTime = dateValue;
            }
          }
          
          return {
            id: item._id,
            fileName: item.fileName || item.name || '未命名文件',
            fileSize: formatFileSize(item.fileSize || item.size || 0),
            uploadTime: formattedTime,
            fileType: getFileType(item.fileName || item.name) || 'unknown',
            hasAnalysis: !!item.analysisId, // 是否已有分析
            analysisStatus: item.analysisStatus || 'NOT_ANALYZED' // 分析状态
          };
        });
      } else {
        warn('获取文件列表失败或无数据');
      }
      
      this.setData({
        uploadHistory: this.data.page === 1 ? list : [...this.data.uploadHistory, ...list],
        loading: false,
        hasMore,
        page: this.data.page + 1
      });
      
    } catch (err) {
      error('加载用户文件历史失败', err);
      this.setData({ loading: false });
      toast.error('加载失败，请稍后重试');
    }
  },

  /**
   * 加载更多文件
   */
  loadMoreFiles: function() {
    if (!this.data.loading && this.data.hasMore) {
      this.loadUserFiles();
    }
  },

  /**
   * 预览文件
   */
  previewFile: async function(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      toast.error('无法识别文件');
      return;
    }
    
    const file = this.data.uploadHistory.find(item => item.id === id);
    if (!file) {
      toast.error('找不到文件信息');
      return;
    }
    
    info('预览文件', { fileName: file.fileName, id });
    
    // 显示加载提示
    const loading = toast.loading('加载文件中...');
    
    try {
      // 直接从数据库获取文件信息
      const db = wx.cloud.database();
      const fileResult = await db.collection('bp_files').doc(id).get();
      
      if (!fileResult || !fileResult.data || !fileResult.data.fileID) {
        throw new Error('找不到文件的云存储ID');
      }
      
      // 获取云存储文件的临时访问链接
      const fileID = fileResult.data.fileID;
      const tempUrlResult = await wx.cloud.getTempFileURL({
        fileList: [fileID]
      });
      
      if (!tempUrlResult || !tempUrlResult.fileList || tempUrlResult.fileList.length === 0) {
        throw new Error('获取文件临时URL失败');
      }
      
      const tempUrl = tempUrlResult.fileList[0].tempFileURL;
      info('获取文件临时URL成功', tempUrl);
      
      // 下载文件到本地
      const downloadRes = await new Promise((resolve, reject) => {
        wx.downloadFile({
          url: tempUrl, 
          success: res => resolve(res), 
          fail: err => reject(err)
        });
      });
      
      if (downloadRes.statusCode === 200) {
        const filePath = downloadRes.tempFilePath;
        
        // 使用本地路径预览文件
        wx.openDocument({
          filePath: filePath, 
          fileType: getFileType(file.fileName),
          showMenu: true,
          success: () => {
            info('文件预览成功');
          },
          fail: (err) => {
            error('文件预览失败', err);
            toast.error('预览失败，请稍后再试');
          }
        });
      } else {
        error('下载文件失败', downloadRes);
        toast.error('文件下载失败');
      }
    } catch (err) {
      error('获取或下载文件失败', err);
      toast.error('无法预览文件，请稍后再试');
    } finally {
      loading.hide();
    }
  },

  /**
   * 进入分析页面
   */
  goToAnalysis: async function(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      toast.error('无法识别文件');
      return;
    }
    
    const file = this.data.uploadHistory.find(item => item.id === id);
    if (!file) {
      toast.error('找不到文件信息');
      return;
    }
    
    info('进入分析页面', { fileName: file.fileName, id });
    
    // 显示加载提示
    const loading = toast.loading('正在准备分析...');
    
    try {
      // 直接跳转到分析结果页，让分析结果页自己判断是否需要创建新的分析
      wx.navigateTo({
        url: `/pages/analysis-result/analysis-result?fileId=${id}`,
        success: () => {
          info('导航到分析页面成功');
        },
        fail: (err) => {
          error('导航到分析页面失败', err);
          toast.error('无法打开分析页面');
        }
      });
    } catch (err) {
      error('准备分析时发生错误', err);
      toast.error('准备分析失败');
    } finally {
      loading.hide();
    }
  },

  /**
   * 头像选择处理
   */
  onChooseAvatar: function(e) {
    const avatarUrl = e.detail.avatarUrl;
    if (avatarUrl) {
      this.setData({
        'userInfo.avatarUrl': avatarUrl
      });
      
      // 更新本地存储和全局数据
      const userInfo = this.data.userInfo;
      app.globalData.userInfo = userInfo;
      wx.setStorageSync('userInfo', userInfo);
      
      // 将头像信息直接存入云数据库
      wx.cloud.database().collection('users').where({
        _openid: userInfo.openid
      }).update({
        data: {
          avatarUrl: avatarUrl,
          updatedAt: new Date()
        }
      })
        .then(res => {
          info('头像更新成功', res);
        })
        .catch(err => {
          error('头像更新失败', err);
        });
    }
  },

  /**
   * 昵称输入处理
   */
  onNicknameBlur: function(e) {
    const nickname = e.detail.value.trim();
    if (nickname && nickname !== this.data.userInfo.nickname) {
      this.setData({
        'userInfo.nickname': nickname
      });
      
      // 更新本地存储和全局数据
      const userInfo = this.data.userInfo;
      app.globalData.userInfo = userInfo;
      wx.setStorageSync('userInfo', userInfo);
      
      // 将昵称信息直接存入云数据库
      wx.cloud.database().collection('users').where({
        _openid: userInfo.openid
      }).update({
        data: {
          nickname: nickname,
          updatedAt: new Date()
        }
      })
        .then(res => {
          info('昵称更新成功', res);
        })
        .catch(err => {
          error('昵称更新失败', err);
        });
    }
  },

  /**
   * 处理登录
   */
  handleLogin: function() {
    // 使用小程序云开发的登录方式
    wx.cloud.callFunction({
      name: 'login',
      success: (res) => {
        if (res && res.result && res.result.openid) {
          // 获取openid成功
          const openid = res.result.openid;
          info('获取openid成功', { openid });
          
          // 初始化用户信息
          const userInfo = {
            openid: openid,
            nickname: '用户' + openid.substring(openid.length - 6),
            avatarUrl: this.data.defaultAvatarUrl
          };
          
          // 更新全局数据和本地存储
          app.globalData.userInfo = userInfo;
          wx.setStorageSync('userInfo', userInfo);
          
          // 更新页面数据
          this.setData({ userInfo });
          
          // 查询用户是否已存在，不存在则创建
          wx.cloud.database().collection('users').where({
            _openid: openid
          }).get().then(userRes => {
            if (!userRes.data || userRes.data.length === 0) {
              // 用户不存在，创建新用户
              return wx.cloud.database().collection('users').add({
                data: {
                  nickname: userInfo.nickname,
                  avatarUrl: userInfo.avatarUrl,
                  createdAt: new Date(),
                  updatedAt: new Date()
                }
              });
            }
          }).then(() => {
            // 加载用户文件
            this.setData({
              page: 1,
              hasMore: true,
              uploadHistory: []
            });
            this.loadUserFiles();
          }).catch(err => {
            error('处理用户数据失败', err);
          });
          
          toast.success('登录成功');
        } else {
          error('登录失败', res);
          toast.error('登录失败，请稍后重试');
        }
      },
      fail: (err) => {
        error('调用登录云函数失败', err);
        toast.error('登录失败，请稍后重试');
      }
    });
  },

  /**
   * 处理退出登录
   */
  handleLogout: function() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除用户信息
          app.globalData.userInfo = null;
          wx.removeStorageSync('userInfo');
          
          this.setData({
            userInfo: null,
            uploadHistory: []
          });
          
          toast.success('已退出登录');
        }
      }
    });
  },

  /**
   * 查看分析历史
   */
  handleViewHistory: function() {
    wx.navigateTo({
      url: '/pages/history/history',
      fail: (err) => {
        error('导航到历史页面失败', err);
        toast.error('无法打开历史页面');
      }
    });
  },

  /**
   * 查看收藏报告
   */
  handleViewFavorites: function() {
    toast.info('收藏功能开发中');
  },

  /**
   * 查看设置
   */
  handleViewSettings: function() {
    wx.navigateTo({
      url: '/pages/settings/settings',
      fail: (err) => {
        error('导航到设置页面失败', err);
        toast.info('设置功能开发中');
      }
    });
  },

  /**
   * 导航到上传页面
   */
  navigateToUpload: function() {
    wx.switchTab({
      url: '/pages/upload/upload',
      fail: (err) => {
        error('导航到上传页面失败', err);
        toast.error('无法打开上传页面');
      }
    });
  }
});
