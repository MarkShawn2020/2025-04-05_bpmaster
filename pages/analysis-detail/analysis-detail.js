import { logger } from '../../utils/logger';
import { apiService } from '../../services/api';

Page({
  data: {
    id: '',                 // 文件ID
    streamId: '',           // 流式分析ID
    loading: true,          // 加载状态
    error: '',              // 错误信息
    isStreamMode: false,    // 是否为流式模式
    markdownContent: '',    // 原始markdown内容
    renderedContent: [],    // 渲染后的内容结构
    sections: {},           // 按类别划分的内容
    activeTab: 'overview',  // 当前激活的标签
    tabs: [
      { id: 'overview', name: '概览' },
      { id: 'business', name: '商业分析' },
      { id: 'market', name: '市场分析' },
      { id: 'team', name: '团队评估' },
      { id: 'financial', name: '财务分析' }
    ]
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const { id, streamId } = options;
    
    logger.info('分析详情页加载', { id, streamId });
    
    // 初始化页面数据
    this.setData({
      id: id || '',
      streamId: streamId || '',
      isStreamMode: !!streamId,
      loading: true
    });
    
    // 根据模式选择加载方式
    if (this.data.isStreamMode && this.data.streamId) {
      // 流式模式 - 实时监听数据流
      this._startStreamListener();
    } else if (this.data.id) {
      // 普通模式 - 加载已保存的分析结果
      this._loadAnalysisResult();
    } else {
      // 无效参数
      this.setData({
        loading: false,
        error: '无效的分析参数'
      });
    }
  },
  
  /**
   * 开始监听流式数据
   * 从全局数据中监听并更新流式分析结果
   */
  _startStreamListener() {
    const app = getApp();
    
    // 确保全局数据结构已初始化
    if (!app.globalData) {
      app.globalData = {};
    }
    
    if (!app.globalData.analysisStreams) {
      app.globalData.analysisStreams = {};
    }
    
    // 获取初始数据
    const streamData = app.globalData.analysisStreams[this.data.streamId];
    
    if (!streamData) {
      logger.error('未找到流式数据', this.data.streamId);
      this.setData({
        loading: false,
        error: '未找到流式数据'
      });
      return;
    }
    
    // 设置初始内容
    this.setData({
      loading: false,
      markdownContent: streamData.content || ''
    });
    
    // 渲染初始内容
    if (streamData.content) {
      this._renderMarkdown(streamData.content);
    }
    
    logger.info('开始流式数据监听', {
      streamId: this.data.streamId,
      initialContentLength: streamData.content ? streamData.content.length : 0
    });
    
    // 设置轮询更新
    this.streamInterval = setInterval(() => {
      const currentData = app.globalData.analysisStreams[this.data.streamId];
      
      if (!currentData) {
        logger.warn('流式数据已丢失', this.data.streamId);
        clearInterval(this.streamInterval);
        return;
      }
      
      // 检查内容是否有更新
      if (currentData.content !== this.data.markdownContent) {
        logger.debug('流式内容已更新', {
          streamId: this.data.streamId,
          newLength: currentData.content.length,
          oldLength: this.data.markdownContent.length
        });
        
        // 更新内容
        this.setData({
          markdownContent: currentData.content
        });
        
        // 渲染更新后的内容
        this._renderMarkdown(currentData.content);
      }
      
      // 检查是否完成
      if (currentData.isComplete) {
        logger.info('流式分析已完成', this.data.streamId);
        clearInterval(this.streamInterval);
      }
      
      // 检查是否有错误
      if (currentData.error) {
        logger.error('流式分析出错', currentData.error);
        this.setData({
          error: '分析过程出错: ' + currentData.error
        });
        clearInterval(this.streamInterval);
      }
    }, 1000); // 每秒更新一次
  },
  
  /**
   * 加载已保存的分析结果
   */
  _loadAnalysisResult() {
    logger.info('加载分析结果', this.data.id);
    
    wx.cloud.callFunction({
      name: 'getAnalysisDetail',
      data: { id: this.data.id },
      success: (res) => {
        if (res.result && res.result.code === 200 && res.result.data) {
          const analysisData = res.result.data;
          
          logger.info('获取分析结果成功', {
            id: this.data.id,
            hasResult: !!analysisData.result
          });
          
          this.setData({
            loading: false,
            analysisData: analysisData
          });
          
          // 如果有markdown内容，渲染它
          if (analysisData.result && analysisData.result.markdown) {
            const markdown = analysisData.result.markdown;
            this.setData({ markdownContent: markdown });
            this._renderMarkdown(markdown);
          } else {
            this.setData({
              error: '分析结果为空'
            });
          }
        } else {
          logger.error('获取分析结果失败', res.result);
          this.setData({
            loading: false,
            error: res.result?.message || '获取分析结果失败'
          });
        }
      },
      fail: (err) => {
        logger.error('调用获取分析结果云函数失败', err);
        this.setData({
          loading: false,
          error: err.errMsg || '获取分析结果失败'
        });
      }
    });
  },
  
  /**
   * 渲染Markdown内容
   * @param {string} markdown Markdown文本
   */
  _renderMarkdown(markdown) {
    if (!markdown) return;
    
    try {
      // 解析Markdown
      const renderedContent = [];
      const lines = markdown.split('\n');
      let currentSection = { title: '', content: [], type: 'text' };
      
      // 逐行解析
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // 解析各级标题
        if (line.startsWith('# ')) {
          // 保存之前的部分
          if (currentSection.content.length > 0) {
            renderedContent.push(currentSection);
          }
          
          // 创建新的一级标题部分
          currentSection = {
            title: line.substring(2),
            content: [],
            type: 'heading1'
          };
        } 
        else if (line.startsWith('## ')) {
          // 保存之前的部分
          if (currentSection.content.length > 0) {
            renderedContent.push(currentSection);
          }
          
          // 创建新的二级标题部分
          currentSection = {
            title: line.substring(3),
            content: [],
            type: 'heading2'
          };
        }
        else if (line.startsWith('### ')) {
          // 保存之前的部分
          if (currentSection.content.length > 0) {
            renderedContent.push(currentSection);
          }
          
          // 创建新的三级标题部分
          currentSection = {
            title: line.substring(4),
            content: [],
            type: 'heading3'
          };
        }
        // 解析列表项
        else if (line.startsWith('- ') || line.startsWith('* ')) {
          currentSection.content.push({
            text: line.substring(2),
            type: 'listItem'
          });
        }
        // 解析普通段落
        else if (line !== '') {
          currentSection.content.push({
            text: line,
            type: 'paragraph'
          });
        }
      }
      
      // 添加最后一个部分
      if (currentSection.content.length > 0) {
        renderedContent.push(currentSection);
      }
      
      // 更新渲染结果
      this.setData({
        renderedContent: renderedContent
      });
      
      // 按内容类型分类
      this._categorizeContent(renderedContent);
      
    } catch (error) {
      logger.error('渲染Markdown失败', error);
    }
  },
  
  /**
   * 将内容按主题分类到不同的标签页
   * @param {Array} content 已解析的内容
   */
  _categorizeContent(content) {
    // 初始化分类
    const sections = {
      overview: [],     // 概览
      business: [],     // 商业分析
      market: [],       // 市场分析
      team: [],         // 团队评估
      financial: []     // 财务分析
    };
    
    // 用于匹配内容类型的关键词
    const keywords = {
      '概述': 'overview',
      '概览': 'overview',
      '总览': 'overview',
      '简介': 'overview',
      '总结': 'overview',
      '商业': 'business',
      '商业模式': 'business',
      '产品': 'business',
      '服务': 'business',
      '模式': 'business',
      '市场': 'market',
      '行业': 'market',
      '竞争': 'market',
      '用户': 'market',
      '客户': 'market',
      '需求': 'market',
      '团队': 'team',
      '人员': 'team',
      '成员': 'team',
      '管理': 'team',
      '财务': 'financial',
      '融资': 'financial',
      '资金': 'financial',
      '投资': 'financial',
      '收入': 'financial',
      '成本': 'financial'
    };
    
    // 分类内容
    for (const section of content) {
      let category = null;
      
      // 根据标题匹配分类
      if (section.title) {
        for (const [key, value] of Object.entries(keywords)) {
          if (section.title.includes(key)) {
            category = value;
            break;
          }
        }
      }
      
      // 未匹配到分类，默认放入概览
      if (!category) {
        category = 'overview';
      }
      
      // 添加到对应分类
      sections[category].push(section);
    }
    
    // 确保每个分类至少有一个空占位
    for (const key of Object.keys(sections)) {
      if (sections[key].length === 0) {
        sections[key] = [{ 
          title: '暂无数据', 
          content: [{ text: '该部分暂无分析内容', type: 'paragraph' }],
          type: 'empty'
        }];
      }
    }
    
    // 更新分类结果
    this.setData({ sections });
  },
  
  /**
   * 切换标签页
   */
  switchTab(e) {
    const tabId = e.currentTarget.dataset.id;
    this.setData({ activeTab: tabId });
  },
  
  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack();
  },
  
  /**
   * 导出分析报告
   */
  exportReport() {
    wx.showToast({
      title: '导出功能开发中',
      icon: 'none'
    });
  },
  
  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    // 清除定时器
    if (this.streamInterval) {
      clearInterval(this.streamInterval);
    }
  },
  
  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: '商业计划书智能分析报告',
      path: `/pages/analysis-detail/analysis-detail?id=${this.data.id}`
    };
  }
}); 