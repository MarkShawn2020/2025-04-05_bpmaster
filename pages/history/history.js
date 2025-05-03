// pages/history/history.js
import { error, info, warn } from "../../utils/logger";
import { toast } from "../../utils/toast";
import { getBPFileInfo, getFileUrl, getFileType, formatFileSize, getBPList, getBPDetail } from "../../utils/file";

Page({
  data: {
    analysisList: [],
    loading: false,
    page: 1,
    pageSize: 10,
    hasMore: true,
    selectedItems: [],
    isSelecting: false,
  },

  onLoad() {
    this.loadAnalysisList();
  },

  onShow() {
    // 重新加载数据，以防有新的分析记录
    this.setData({
      page: 1,
      hasMore: true,
      analysisList: [],
    });
    this.loadAnalysisList();
  },

  async loadAnalysisList() {
    try {
      if (!this.data.hasMore || this.data.loading) return;

      this.setData({ loading: true });
      info("加载历史记录", {
        page: this.data.page,
        pageSize: this.data.pageSize,
      });

      // 调用云函数获取数据
      const res = await getBPList(
        this.data.page,
        this.data.pageSize
      );

      let list = [];
      let hasMore = false;

      if (res && res.code === 200 && res.data) {
        list = res.data.list || [];
        hasMore = list.length === this.data.pageSize;

        // 处理数据，确保与UI兼容
        list = list.map((item) => ({
          id: item._id,
          fileName: item.fileName,
          fileSize: formatFileSize(item.fileSize),
          analysisDate: item.uploadTime,
          score: item.score || 0,
          status: item.status || "NOT_ANALYZED",
          isSelected: this.data.selectedItems.includes(item._id), // 初始化选中状态
        }));
      } else {
        // API返回错误或无数据时，使用模拟数据
        warn("无数据");
      }

      this.setData({
        analysisList:
          this.data.page === 1 ? list : [...this.data.analysisList, ...list],
        loading: false,
        hasMore,
        page: this.data.page + 1,
      });
    } catch (error) {
      error("加载历史记录失败", error);
      this.setData({ loading: false });
      toast.error("加载失败，请稍后重试");
    }
  },

  viewAnalysisDetail(e) {
    if (this.data.isSelecting) {
      // 在选择模式下，直接调用toggleSelectItem
      // 如果e不是有效事件对象，构造一个简单对象传递ID
      if (e && e.currentTarget && e.currentTarget.dataset) {
        this.toggleSelectItem(e);
      } else {
        const id = e?.currentTarget?.dataset?.id;
        if (id) {
          this.toggleSelectItem({ currentTarget: { dataset: { id } } });
        }
      }
      return;
    }

    const id = e.currentTarget.dataset.id;
    const item = this.data.analysisList.find((item) => item.id === id);

    if (!item) {
      toast.error("找不到该记录");
      return;
    }

    info("查看分析详情", { id, fileName: item.fileName });

    // 显示加载中
    const loading = toast.loading("加载数据中...");

    // 使用云数据库获取BP详情数据
    getBPDetail(id)
      .then((res) => {
        loading.hide();

        // 有分析结果，跳转到分析详情页
        wx.navigateTo({
          url: `/pages/analysis-result/analysis-result?id=${id}&fileName=${encodeURIComponent(
            item.fileName
          )}`,
          fail: (err) => {
            error("导航到分析页失败", err);
            toast.error("打开分析页失败");
          },
        });
      })
      .catch((err) => {
        loading.hide();
        error("获取BP详情失败", err);
        toast.error("获取数据失败");
      });
  },

  // 预览文件
  previewFile(e) {
    // 检查e是否为事件对象并且有stopPropagation方法
    if (e && e.stopPropagation && typeof e.stopPropagation === "function") {
      e.stopPropagation(); // 阻止冒泡，避免触发查看详情
    }

    // 安全地获取id
    const id = e?.currentTarget?.dataset?.id || e?.target?.dataset?.id;
    if (!id) {
      toast.error("无法识别文件");
      return;
    }

    const item = this.data.analysisList.find((item) => item.id === id);
    if (!item) {
      toast.error("找不到文件信息");
      return;
    }

    info("预览文件", { fileName: item.fileName, id });

    // 显示加载提示
    const loading = toast.loading("加载文件中...");

    // 先获取BP文件详细信息，包含实际的云存储fileID
    getBPFileInfo(id)
      .then((fileInfo) => {
        if (!fileInfo || !fileInfo.fileID) {
          throw new Error("找不到文件的云存储ID");
        }

        info("获取到文件信息", fileInfo);

        // 使用真正的云存储fileID获取临时访问URL
        return getFileUrl(fileInfo.fileID);
      })
      .then((tempUrl) => {
        info("获取文件临时URL成功", tempUrl);

        // 下载文件到本地
        return new Promise((resolve, reject) => {
          wx.downloadFile({
            url: tempUrl,
            success: (res) => resolve(res),
            fail: (err) => reject(err),
          });
        });
      })
      .then((downloadRes) => {
        if (downloadRes.statusCode === 200) {
          const filePath = downloadRes.tempFilePath;

          // 使用本地路径预览文件
          wx.openDocument({
            filePath: filePath,
            fileType: getFileType(item.fileName),
            showMenu: true,
            success: () => {
              info("文件预览成功");
            },
            fail: (err) => {
              error("文件预览失败", err);
              toast.error("预览失败，请稍后再试");

              // 处理权限问题
              if (err.errMsg && err.errMsg.includes("not permission")) {
                setTimeout(() => {
                  wx.showModal({
                    title: "需要权限",
                    content: "预览文件需要授权，请在设置中允许使用文档预览功能",
                    confirmText: "去设置",
                    success: (modalRes) => {
                      if (modalRes.confirm) {
                        wx.openSetting();
                      }
                    },
                  });
                }, 1000);
              }
            },
          });
        } else {
          error("下载文件失败", downloadRes);
          toast.error("文件下载失败");
        }
      })
      .catch((err) => {
        error("获取或下载文件失败", err);
        toast.error("无法预览文件，请稍后再试");

        // 显示更详细的错误提示
        setTimeout(() => {
          wx.showModal({
            title: "预览失败",
            content: "无法预览文件，可能是网络问题或文件格式不支持。",
            showCancel: false,
          });
        }, 500);
      })
      .finally(() => {
        loading.hide();
      });
  },

  // 获取文件类型
  getFileType(fileName) {
    const ext = fileName.substring(fileName.lastIndexOf(".") + 1).toLowerCase();
    const typeMap = {
      pdf: "pdf",
      doc: "doc",
      docx: "docx",
      xls: "xls",
      xlsx: "xlsx",
      ppt: "ppt",
      pptx: "pptx",
      txt: "txt",
    };
    return typeMap[ext] || "pdf"; // 默认返回pdf
  },

  deleteAnalysis(e) {
    // 检查e是否为事件对象并且有stopPropagation方法
    if (e && e.stopPropagation && typeof e.stopPropagation === "function") {
      e.stopPropagation(); // 阻止冒泡，避免触发查看详情
    }

    // 安全地获取id，支持直接传入id或从事件对象中获取
    const id =
      typeof e === "string"
        ? e
        : e?.currentTarget?.dataset?.id || e?.target?.dataset?.id;

    if (!id) {
      toast.error("无法识别要删除的记录");
      return;
    }

    // 获取要删除的记录信息
    const item = this.data.analysisList.find((item) => item.id === id);
    const fileName = item ? item.fileName : "此记录";

    wx.showModal({
      title: "确认删除",
      content: `确定删除"${fileName}"吗？此操作不可恢复。`,
      confirmText: "删除",
      confirmColor: "#ff4d4f",
      success: async (res) => {
        if (res.confirm) {
          try {
            info("删除分析记录", { id, fileName });

            // 显示加载提示
            const loading = toast.loading("正在删除...");

            // 调用API删除记录
            const response = await apiService.deleteBP(id);

            loading.hide();

            if (response && response.code === 200) {
              // 更新列表，移除已删除的项
              const newList = this.data.analysisList.filter(
                (item) => item.id !== id
              );
              this.setData({
                analysisList: newList,
              });

              toast.success("删除成功");
            } else {
              throw new Error(response?.message || "删除失败");
            }
          } catch (error) {
            error("删除失败", error);
            toast.error("删除失败，请稍后重试");
          }
        }
      },
    });
  },

  // 启用选择模式
  enableSelectMode() {
    // 重置所有项的选中状态
    const analysisList = this.data.analysisList.map((item) => ({
      ...item,
      isSelected: false,
    }));

    this.setData({
      isSelecting: true,
      selectedItems: [],
      analysisList,
    });
  },

  // 取消选择模式
  cancelSelectMode() {
    // 重置所有项的选中状态
    const analysisList = this.data.analysisList.map((item) => ({
      ...item,
      isSelected: false,
    }));

    this.setData({
      isSelecting: false,
      selectedItems: [],
      analysisList,
    });
  },

  // 切换选择项
  toggleSelectItem(e) {
    // 安全地阻止事件冒泡
    if (e && e.stopPropagation && typeof e.stopPropagation === "function") {
      e.stopPropagation();
    }

    const id = e?.currentTarget?.dataset?.id || e?.target?.dataset?.id;

    if (!id) {
      warn("无法获取ID，选择操作取消");
      return;
    }

    info("切换选择项", {
      id,
      isAlreadySelected: this.data.selectedItems.includes(id),
    });

    const selectedItems = [...this.data.selectedItems];
    const index = selectedItems.indexOf(id);

    if (index > -1) {
      selectedItems.splice(index, 1);
    } else {
      selectedItems.push(id);
    }

    // 强制更新：先创建新的分析列表，复制所有属性
    const analysisList = JSON.parse(JSON.stringify(this.data.analysisList));

    // 找到并更新目标项
    const itemIndex = analysisList.findIndex((item) => item.id === id);
    if (itemIndex !== -1) {
      // 直接设置isSelected属性
      analysisList[itemIndex].isSelected = !analysisList[itemIndex].isSelected;
      info("切换选中状态", {
        id,
        isNowSelected: analysisList[itemIndex].isSelected,
      });
    }

    // 使用nextTick确保DOM更新
    this.setData(
      {
        selectedItems,
        analysisList,
      },
      () => {
        // 在setData回调中检查状态，确保更新完成
        info("UI更新后的状态", {
          selectedItems,
          selectedCount: selectedItems.length,
          selectedItemStates: analysisList.map((item) => ({
            id: item.id,
            isSelected: item.isSelected,
          })),
        });
      }
    );
  },

  // 切换全选
  toggleSelectAll() {
    const allSelected =
      this.data.selectedItems.length === this.data.analysisList.length;
    info("全选操作", { currentlyAllSelected: allSelected });

    // 创建新的列表和选中项数组
    const analysisList = JSON.parse(JSON.stringify(this.data.analysisList));
    let selectedItems = [];

    // 如果当前全部选中，则全部取消；否则全部选中
    const newSelectedState = !allSelected;

    // 更新每个项目的选中状态
    analysisList.forEach((item) => {
      item.isSelected = newSelectedState;
      if (newSelectedState) {
        selectedItems.push(item.id);
      }
    });

    // 使用nextTick确保DOM更新
    this.setData(
      {
        selectedItems,
        analysisList,
      },
      () => {
        info("全选操作完成", {
          allSelected: newSelectedState,
          selectedCount: selectedItems.length,
        });
      }
    );
  },

  // 删除选中项
  deleteSelected() {
    if (this.data.selectedItems.length === 0) {
      toast.info("请先选择要删除的记录");
      return;
    }

    wx.showModal({
      title: "确认删除",
      content: `确定删除选中的${this.data.selectedItems.length}条记录吗？此操作不可恢复。`,
      confirmText: "删除",
      confirmColor: "#ff4d4f",
      success: async (res) => {
        if (res.confirm) {
          try {
            info("批量删除分析记录", { ids: this.data.selectedItems });

            // 显示加载提示
            const loading = toast.loading("正在删除...");

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
              (item) => !this.data.selectedItems.includes(item.id)
            );

            this.setData({
              analysisList: newList,
              selectedItems: [],
              isSelecting: false,
            });

            toast.success("删除成功");
          } catch (error) {
            error("批量删除失败", error);
            toast.error("删除失败，请稍后重试");
          }
        }
      },
    });
  },

  // 加载更多
  loadMore() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadAnalysisList();
    }
  },

  // 跳转到上传页面
  navigateToUpload() {
    wx.switchTab({
      url: "/pages/upload/upload",
    });
  },
});
