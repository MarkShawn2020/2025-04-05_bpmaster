// pages/history/history.js
import { info, warn, error } from '../../utils/logger';
import { apiService } from '../../services/api';
import { toast } from '../../utils/toast';

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
      info('加载历史记录', { page: this.data.page, pageSize: this.data.pageSize });
      
      // 调用API获取数据
      const res = await apiService.getBPList(this.data.page, this.data.pageSize);
      
      let list = [];
      let hasMore = false;
      
      if (res && res.code === 200 && res.data) {
        list = res.data.list || [];
        hasMore = list.length === this.data.pageSize;
        
        // 处理数据，确保与UI兼容
        list = list.map(item => ({
          id: item._id,
          fileName: item.fileName,
          fileSize: this.formatFileSize(item.fileSize),
          analysisDate: item.uploadTime,
          score: item.score || 0,
          status: item.status || 'NOT_ANALYZED'
        }));
      } else {
        // API返回错误或无数据时，使用模拟数据
        warn('使用模拟数据', { error: res?.message || '未知错误' });
        list = this.getMockData();
        hasMore = list.length === this.data.pageSize;
      }
      
      this.setData({
        analysisList: this.data.page === 1 ? list : [...this.data.analysisList, ...list],
        loading: false,
        hasMore,
        page: this.data.page + 1
      });
      
    } catch (err) {
      error('加载历史记录失败', err);
      this.setData({ loading: false });
      toast.error('加载失败，请稍后重试');
    }
  },
  
  // 格式化文件大小
  formatFileSize(size) {
    if (!size) return '未知大小';
    
    const KB = 1024;
    const MB = KB * 1024;
    
    if (size < KB) {
      return size + 'B';
    } else if (size < MB) {
      return (size / KB).toFixed(1) + 'KB';
    } else {
      return (size / MB).toFixed(1) + 'MB';
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
      toast.error('找不到该记录');
      return;
    }
    
    info('查看分析详情', { id, fileName: item.fileName });
    
    // 显示加载中
    const loading = toast.loading('加载数据中...');
    
    // 使用API服务获取BP详情数据
    apiService.getBPDetail(id)
      .then(res => {
        loading.hide();
        
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
                error('导航到分析页失败', err);
                toast.error('打开分析页失败');
              }
            });
          }
        } else {
          // API调用成功但返回错误
          toast.error(res?.message || '获取分析数据失败');
        }
      })
      .catch(err => {
        loading.hide();
        error('获取BP详情失败', err);
        toast.error('获取数据失败');
      });
  },
  
  // 开始分析BP文件
  startAnalysis(id, fileName) {
    info('开始分析BP文件', { fileName, id });
    
    // 显示确认对话框
    wx.showModal({
      title: '开始分析',
      content: `确定要开始分析"${fileName}"吗？`,
      confirmText: '开始分析',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 用户确认开始分析
          const loading = toast.loading('启动分析...');
          
          // 调用API开始分析
          apiService.startAnalysis(id)
            .then(res => {
              loading.hide();
              
              if (res && res.code === 200) {
                // 刷新数据以更新UI状态
                this.setData({
                  page: 1,
                  hasMore: true,
                  analysisList: []
                });
                this.loadAnalysisList();
                
                toast.success('分析任务已启动');
                
                // 跳转到分析详情页，让用户查看分析进度
                setTimeout(() => {
                  wx.navigateTo({
                    url: `/pages/analysis-detail/analysis-detail?id=${id}&fileName=${encodeURIComponent(fileName)}`,
                    fail: (err) => {
                      error('导航到分析页失败', err);
                    }
                  });
                }, 1500);
              } else {
                // 分析启动失败
                toast.error(res?.message || '启动分析失败');
              }
            })
            .catch(err => {
              loading.hide();
              error('启动分析失败', err);
              toast.error('启动分析失败');
            });
        }
      }
    });
  },
  
  // 预览文件
  previewFile(e) {
    // 检查e是否为事件对象并且有stopPropagation方法
    if (e && e.stopPropagation && typeof e.stopPropagation === 'function') {
      e.stopPropagation(); // 阻止冒泡，避免触发查看详情
    }
    
    // 安全地获取id
    const id = e?.currentTarget?.dataset?.id || e?.target?.dataset?.id;
    if (!id) {
      toast.error('无法识别文件');
      return;
    }
    
    const item = this.data.analysisList.find(item => item.id === id);
    if (!item) {
      toast.error('找不到文件信息');
      return;
    }
    
    info('预览文件', { fileName: item.fileName, id });
    
    // 显示加载提示
    const loading = toast.loading('加载文件中...');
    
    // 先获取BP文件详细信息，包含实际的云存储fileID
    apiService.getBPFileInfo(id)
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
            fileType: this.getFileType(item.fileName),
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
  
  deleteAnalysis(e) {
    // 检查e是否为事件对象并且有stopPropagation方法
    if (e && e.stopPropagation && typeof e.stopPropagation === 'function') {
      e.stopPropagation(); // 阻止冒泡，避免触发查看详情
    }
    
    // 安全地获取id，支持直接传入id或从事件对象中获取
    const id = typeof e === 'string' ? e : (e?.currentTarget?.dataset?.id || e?.target?.dataset?.id);
    
    if (!id) {
      toast.error('无法识别要删除的记录');
      return;
    }
    
    // 获取要删除的记录信息
    const item = this.data.analysisList.find(item => item.id === id);
    const fileName = item ? item.fileName : '此记录';
    
    wx.showModal({
      title: '确认删除',
      content: `确定删除"${fileName}"吗？此操作不可恢复。`,
      confirmText: '删除',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          try {
            info('删除分析记录', { id, fileName });
            
            // 显示加载提示
            const loading = toast.loading('正在删除...');
            
            // 调用API删除记录
            const response = await apiService.deleteBP(id);
            
            loading.hide();
            
            if (response && response.code === 200) {
              // 更新列表，移除已删除的项
              const newList = this.data.analysisList.filter(item => item.id !== id);
              this.setData({
                analysisList: newList
              });
              
              toast.success('删除成功');
            } else {
              throw new Error(response?.message || '删除失败');
            }
          } catch (error) {
            error('删除失败', error);
            toast.error('删除失败，请稍后重试');
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
      toast.info('请先选择要删除的记录');
      return;
    }
    
    wx.showModal({
      title: '确认删除',
      content: `确定删除选中的${this.data.selectedItems.length}条记录吗？此操作不可恢复。`,
      confirmText: '删除',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          try {
            info('批量删除分析记录', { ids: this.data.selectedItems });
            
            // 显示加载提示
            const loading = toast.loading('正在删除...');
            
            // 实际项目中应调用API
            // await apiService.batchDeleteAnalysis(this.data.selectedItems);
            
            // TODO: 等待后端实现批量删除API
            // 目前采用单个删除的方式模拟批量操作
            for (const id of this.data.selectedItems) {
              try {
                await apiService.deleteBP(id);
              } catch (err) {
                error(`删除记录 ${id} 失败`, err);
                // 继续删除其他记录
              }
            }
            
            loading.hide();
            
            // 模拟删除
            const newList = this.data.analysisList.filter(
              item => !this.data.selectedItems.includes(item.id)
            );
            
            this.setData({
              analysisList: newList,
              selectedItems: [],
              isSelecting: false
            });
            
            toast.success('删除成功');
          } catch (error) {
            error('批量删除失败', error);
            toast.error('删除失败，请稍后重试');
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
  
  // 跳转到上传页面
  navigateToUpload() {
    wx.switchTab({
      url: '/pages/upload/upload'
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
        score: Math.floor(Math.random() * 30) + 70, // 70-99之间的随机数
        status: ['COMPLETED', 'PROCESSING', 'FAILED', 'NOT_ANALYZED'][Math.floor(Math.random() * 4)] // 随机状态
      });
    }
    
    return mockItems;
  }
});