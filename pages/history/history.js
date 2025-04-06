// pages/history/history.js
import { logger } from '../../utils/logger';
import { apiService } from '../../services/api';

Page({
  data: {
    analysisList: [],
    loading: false,
    page: 1,
    pageSize: 10,
    hasMore: true,
    selectedItems: [],
    isSelecting: false,
    total: 0
  },

  onLoad() {
    logger.info('历史记录页面加载');
    this.loadAnalysisList();
  },

  onShow() {
    // 重新加载数据，以防有新的分析记录
    this.setData({
      page: 1,
      hasMore: true,
      analysisList: []
    });
    this.loadAnalysisList();
  },

  async loadAnalysisList() {
    try {
      if (!this.data.hasMore || this.data.loading) return;
      
      this.setData({ loading: true });
      logger.info('加载历史记录', { page: this.data.page, pageSize: this.data.pageSize });
      
      // 调用API获取BP列表数据
      const response = await apiService.getBPList(this.data.page, this.data.pageSize);
      
      if (response && response.code === 200) {
        const { list, pagination } = response.data;
        
        // 判断是否还有更多数据
        const hasMore = this.data.page < pagination.totalPages;
        
        // 对数据进行转换，确保字段名称一致
        const formattedList = list.map(item => ({
          id: item._id || item.id,
          fileName: item.fileName,
          fileSize: item.fileSize,
          fileType: item.fileType,
          analysisDate: item.analysisDate || item.createTime,
          status: item.status,
          score: item.analysisResults?.overallScore || 0,
          fileId: item.fileID
        }));
        
        this.setData({
          analysisList: this.data.page === 1 ? formattedList : [...this.data.analysisList, ...formattedList],
          loading: false,
          hasMore,
          page: this.data.page + 1,
          total: pagination.total
        });
      } else {
        throw new Error(response?.message || '获取数据失败');
      }
      
    } catch (error) {
      logger.error('加载历史记录失败', error);
      this.setData({ loading: false });
      this.showToast('加载失败，请稍后重试', 'error');
    }
  },
  
  viewAnalysisDetail(e) {
    if (this.data.isSelecting) {
      this.toggleSelectItem(e);
      return;
    }
    
    const id = e.currentTarget.dataset.id;
    const item = this.data.analysisList.find(item => item.id === id);
    
    if (!item) {
      this.showToast('找不到文件信息', 'error');
      return;
    }
    
    logger.info('查看分析详情', { id, fileName: item.fileName });
    
    // 先显示加载中的提示
    wx.showLoading({
      title: '加载分析数据...',
      mask: true
    });
    
    // 使用API服务获取BP详情数据
    apiService.getBPDetail(id)
      .then(res => {
        wx.hideLoading();
        
        if (res && res.code === 200 && res.data) {
          const bpData = res.data;
          
          // 检查是否有分析结果
          if (!bpData.analysisResults || Object.keys(bpData.analysisResults).length === 0) {
            // 如果没有分析结果，提示用户并询问是否要开始分析
            wx.showModal({
              title: '暂无分析结果',
              content: '该BP文件尚未进行分析，是否立即开始分析？',
              confirmText: '开始分析',
              cancelText: '稍后再说',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  // 用户选择开始分析
                  this.startAnalysis(id, item.fileName);
                }
              }
            });
          } else {
            // 有分析结果，跳转到分析详情页
            wx.navigateTo({
              url: `/pages/analysis-detail/analysis-detail?id=${id}&fileName=${encodeURIComponent(item.fileName)}`,
              fail: (err) => {
                logger.error('导航到分析页失败', err);
                this.showToast('打开分析页失败', 'error');
              }
            });
          }
        } else {
          // API调用成功但返回错误
          this.showToast(res?.message || '获取分析数据失败', 'error');
        }
      })
      .catch(err => {
        wx.hideLoading();
        logger.error('获取BP详情失败', err);
        this.showToast('获取数据失败', 'error');
      });
  },
  
  // 开始分析文件
  startAnalysis(fileId, fileName) {
    // 显示加载提示
    wx.showLoading({
      title: '准备分析...',
      mask: true
    });
    
    // 调用API开始分析
    apiService.startAnalysis(fileId).then(res => {
      wx.hideLoading();
      
      if (res && res.code === 200) {
        this.showToast('分析任务已提交', 'success');
        
        // 导航到分析详情页面
        setTimeout(() => {
          wx.navigateTo({
            url: `/pages/analysis-detail/analysis-detail?id=${fileId}&fileName=${encodeURIComponent(fileName)}`,
            fail: (err) => {
              logger.error('导航到分析页失败', err);
              this.showToast('打开分析页失败', 'error');
            }
          });
        }, 1000);
      } else {
        this.showToast(res?.message || '提交分析任务失败', 'error');
      }
    }).catch(err => {
      wx.hideLoading();
      logger.error('开始分析失败', err);
      this.showToast('分析失败，请稍后再试', 'error');
    });
  },
  
  deleteAnalysis(e) {
    e.stopPropagation(); // 阻止冒泡，避免触发查看详情
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定删除这条分析记录吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            logger.info('删除分析记录', { id });
            // 调用API删除记录
            const response = await apiService.deleteBP(id);
            
            if (response && response.code === 200) {
              // 更新列表，移除已删除的项
              const newList = this.data.analysisList.filter(item => item.id !== id);
              this.setData({
                analysisList: newList,
                total: this.data.total - 1
              });
              
              this.showToast('删除成功', 'success');
            } else {
              throw new Error(response?.message || '删除失败');
            }
          } catch (error) {
            logger.error('删除失败', error);
            this.showToast('删除失败，请稍后重试', 'error');
          }
        }
      }
    });
  },
  
  // 启用选择模式
  enableSelectMode() {
    this.setData({
      isSelecting: true,
      selectedItems: []
    });
  },
  
  // 取消选择模式
  cancelSelectMode() {
    this.setData({
      isSelecting: false,
      selectedItems: []
    });
  },
  
  // 切换选择项
  toggleSelectItem(e) {
    const id = e.currentTarget.dataset.id;
    const selectedItems = [...this.data.selectedItems];
    const index = selectedItems.indexOf(id);
    
    if (index > -1) {
      selectedItems.splice(index, 1);
    } else {
      selectedItems.push(id);
    }
    
    this.setData({
      selectedItems
    });
  },
  
  // 切换全选
  toggleSelectAll() {
    if (this.data.selectedItems.length === this.data.analysisList.length) {
      // 取消全选
      this.setData({
        selectedItems: []
      });
    } else {
      // 全选
      this.setData({
        selectedItems: this.data.analysisList.map(item => item.id)
      });
    }
  },
  
  // 删除选中项
  deleteSelected() {
    if (this.data.selectedItems.length === 0) {
      this.showToast('请先选择要删除的记录', 'none');
      return;
    }
    
    wx.showModal({
      title: '确认删除',
      content: `确定删除选中的${this.data.selectedItems.length}条记录吗？`,
      success: (res) => {
        if (res.confirm) {
          // 显示加载中
          wx.showLoading({
            title: '正在删除...',
            mask: true
          });
          
          // 逐个删除选中的项目
          const deletePromises = this.data.selectedItems.map(id => 
            apiService.deleteBP(id)
          );
          
          Promise.all(deletePromises)
            .then(results => {
              wx.hideLoading();
              
              // 检查是否所有请求都成功
              const allSuccess = results.every(res => res && res.code === 200);
              
              if (allSuccess) {
                // 更新列表，移除已删除的项
                const newList = this.data.analysisList.filter(
                  item => !this.data.selectedItems.includes(item.id)
                );
                
                this.setData({
                  analysisList: newList,
                  selectedItems: [],
                  isSelecting: false,
                  total: this.data.total - this.data.selectedItems.length
                });
                
                this.showToast('删除成功', 'success');
              } else {
                throw new Error('部分删除失败');
              }
            })
            .catch(error => {
              wx.hideLoading();
              logger.error('批量删除失败', error);
              this.showToast('删除失败，请稍后重试', 'error');
            });
        }
      }
    });
  },
  
  // 加载更多
  loadMore() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadAnalysisList();
    }
  },
  
  // 下拉刷新
  onPullDownRefresh() {
    this.setData({
      page: 1,
      hasMore: true,
      analysisList: []
    });
    
    this.loadAnalysisList().then(() => {
      wx.stopPullDownRefresh();
    });
  },
  
  onShareAppMessage() {
    return {
      title: 'BP小诸葛 - 分析历史记录',
      path: '/pages/index/index'
    };
  },
  
  // 导航到上传页面
  navigateToUpload() {
    wx.switchTab({
      url: '/pages/index/index',
      success: () => {
        logger.info('从历史页面导航到首页');
      },
      fail: (err) => {
        logger.error('导航到首页失败', err);
        this.showToast('导航失败', 'error');
      }
    });
  },
  
  // 使用Toast组件显示提示
  showToast(title, icon) {
    const toast = this.selectComponent('#toast');
    if (toast) {
      toast.showToast({
        title,
        icon: icon || 'none'
      });
    }
  }
});