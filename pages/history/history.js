// pages/history/history.js
import Logger from '../../utils/logger';
import apiService from '../../services/api-service';

const logger = new Logger('History');

Page({
  data: {
    analysisList: [],
    loading: false,
    page: 1,
    pageSize: 10,
    hasMore: true,
    selectedItems: [],
    isSelecting: false
  },

  onLoad() {
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
      
      // 实际项目中应从API获取数据
      // const res = await apiService.getAnalysisList({ 
      //   page: this.data.page, 
      //   pageSize: this.data.pageSize 
      // });
      
      // 模拟数据
      const mockData = this.getMockData();
      
      // 模拟延迟
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const hasMore = mockData.length === this.data.pageSize;
      
      this.setData({
        analysisList: this.data.page === 1 ? mockData : [...this.data.analysisList, ...mockData],
        loading: false,
        hasMore,
        page: this.data.page + 1
      });
      
    } catch (error) {
      logger.error('加载历史记录失败', error);
      this.setData({ loading: false });
      // 应显示toast提示
      const toast = this.selectComponent('#toast');
      if (toast) {
        toast.showToast({
          title: '加载失败，请稍后重试',
          icon: 'error'
        });
      }
    }
  },
  
  viewAnalysisDetail(e) {
    if (this.data.isSelecting) {
      this.toggleSelectItem(e);
      return;
    }
    
    const id = e.currentTarget.dataset.id;
    logger.info('查看分析详情', { id });
    
    wx.navigateTo({
      url: `/pages/analysis-detail/analysis-detail?id=${id}`
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
            // 实际项目中应调用API
            // await apiService.deleteAnalysis(id);
            
            // 模拟删除
            const newList = this.data.analysisList.filter(item => item.id !== id);
            this.setData({
              analysisList: newList
            });
            
            // 显示成功提示
            const toast = this.selectComponent('#toast');
            if (toast) {
              toast.showToast({
                title: '删除成功',
                icon: 'success'
              });
            }
          } catch (error) {
            logger.error('删除失败', error);
            // 显示错误提示
            const toast = this.selectComponent('#toast');
            if (toast) {
              toast.showToast({
                title: '删除失败，请稍后重试',
                icon: 'error'
              });
            }
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
      const toast = this.selectComponent('#toast');
      if (toast) {
        toast.showToast({
          title: '请先选择要删除的记录',
          icon: 'none'
        });
      }
      return;
    }
    
    wx.showModal({
      title: '确认删除',
      content: `确定删除选中的${this.data.selectedItems.length}条记录吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            logger.info('批量删除分析记录', { ids: this.data.selectedItems });
            // 实际项目中应调用API
            // await apiService.batchDeleteAnalysis(this.data.selectedItems);
            
            // 模拟删除
            const newList = this.data.analysisList.filter(
              item => !this.data.selectedItems.includes(item.id)
            );
            
            this.setData({
              analysisList: newList,
              selectedItems: [],
              isSelecting: false
            });
            
            // 显示成功提示
            const toast = this.selectComponent('#toast');
            if (toast) {
              toast.showToast({
                title: '删除成功',
                icon: 'success'
              });
            }
          } catch (error) {
            logger.error('批量删除失败', error);
            // 显示错误提示
            const toast = this.selectComponent('#toast');
            if (toast) {
              toast.showToast({
                title: '删除失败，请稍后重试',
                icon: 'error'
              });
            }
          }
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
  
  // 模拟数据
  getMockData() {
    const mockItems = [];
    const baseTime = new Date();
    
    for (let i = 0; i < this.data.pageSize; i++) {
      const id = `record_${this.data.page}_${i}`;
      const date = new Date(baseTime);
      date.setDate(date.getDate() - (i + (this.data.page - 1) * this.data.pageSize));
      
      // 如果已经生成了足够多的记录，就不再生成
      if (this.data.page > 1 && i > 3) break;
      
      mockItems.push({
        id,
        fileName: `商业计划书V${Math.floor(Math.random() * 5) + 1}.${Math.random() > 0.5 ? 'pdf' : 'docx'}`,
        fileSize: `${(Math.random() * 10 + 1).toFixed(1)}MB`,
        analysisDate: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
        score: Math.floor(Math.random() * 30) + 70 // 70-99之间的随机数
      });
    }
    
    return mockItems;
  }
});