const app = getApp();
import { debug, error, info, warn } from '../../utils/logger.js';
import {getBPFileInfo, getFileType, getFileUrl} from '../../utils/file.js';
import { formatCurrentTime, formatDisplayTime } from '../../utils/date.js';
import { aiService } from '../../utils/ai.js';

Page({
  data: {
    fileId: '', // 文件ID
    curFileId: '', // 当前正在处理的文件ID，用于处理多个分析任务的情况
    fileName: '',
    fileSize: '',
    fileTime: '',
    fileUrl: '',
    fileType: 'unknown',
    analysisId: '', // 分析任务ID
    mdContent: '', // 分析报告内容（对应WXML中的mdContent）
    
    isAnalyzing: true,
    isCompleted: false,
    hasError: false,
    errorMessage: '',
    isImageExists: false,
    
    loadingTip: '正在分析您的商业计划书...',
    statusText: '分析中...',
    
    tocItems: [], // 目录项
    savingToHistory: false,
    requestTask: null, // 存储请求任务对象，用于中断请求
    isRequestAborted: false, // 标记请求是否已被中断
    lineBuffer: '' // 用于缓冲不完整的行
  },

  // 页面加载时执行
  onLoad: async function(options) {
    info('分析结果页面加载', options);
    
    try {
      if (!options.fileId) {
        this.setData({
          isAnalyzing: false,
          hasError: true,
          errorMessage: '缺少必要的文件信息'
        });
        this.showToast('缺少必要的文件信息', 'error');
        return;
      }


      // 从云数据库获取文件信息
      const fileInfo = await getBPFileInfo(options.fileId);

      // 设置当前处理的文件ID
      this.setData({
        fileId: options.fileId,
        curFileId: options.fileId,
        fileUrl: await getFileUrl(fileInfo.fileID), // 使用云存储文件ID而不是文档ID
        ...fileInfo
      });

      
      // 检查是否强制重新分析
      const forceReanalyze = options.forceReanalyze === 'true';
      
      if (forceReanalyze) {
        // 强制重新分析
        info('强制重新分析文件');
        await this.createAnalysisTask(options.fileId);
        this.startAnalysis();
      } else {
        // 检查是否已有分析任务
        const hasAnalysis = await this.checkAnalysisTask(options.fileId);
        
        if (!hasAnalysis) {
          // 如果没有分析任务，创建新的分析任务并开始分析
          await this.createAnalysisTask(options.fileId);
          this.startAnalysis();
        }
      }
      
    } catch (err) {
      error('分析结果页面加载异常', err);
      this.setData({
        isAnalyzing: false,
        hasError: true,
        errorMessage: '加载异常，请返回重试'
      });
      this.showToast('加载异常，请返回重试', 'error');
    }
  },


  // 检查是否已有分析任务
  checkAnalysisTask: async function(fileId) {
    try {
      const db = wx.cloud.database();
      const analysisList = await db.collection("analysis_tasks").where({
        fileId: fileId
      }).orderBy('createdAt', 'desc').limit(1).get();
      
      if (analysisList && analysisList.data && analysisList.data.length > 0) {
        const analysis = analysisList.data[0];
        info('发现已有分析任务', analysis);
        
        this.setData({
          analysisId: analysis._id,
          mdContent: analysis.content || '',
          isAnalyzing: analysis.status !== 'completed',
          isCompleted: analysis.status === 'completed',
          statusText: analysis.status === 'completed' ? '分析完成' : '分析中...'
        });
        
        // 如果有内容，提取目录
        if (analysis.content) {
          this.extractTocItems(analysis.content);
          
          // 如果分析未完成，需要继续监听更新
          if (analysis.status !== 'completed') {
            this.checkAnalysisStatus();
          }
        }
        
        return true;
      }
      
      return false;
    } catch (err) {
      error('检查分析任务失败', err);
      return false;
    }
  },
  
  // 创建分析任务
  createAnalysisTask: async function(fileId) {
    try {
      const db = wx.cloud.database();
      const taskRes = await db.collection("analysis_tasks").add({
        data: {
          fileId: fileId,
          status: "pending",
          content: "",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      if (taskRes && taskRes._id) {
        info('创建分析任务成功', taskRes);
        this.setData({
          analysisId: taskRes._id
        });
        
        // 更新bp_files集合中的analysisId字段
        try {
          await db.collection("bp_files").doc(fileId).update({
            data: {
              analysisId: taskRes._id,
              analysisStatus: 'pending',
              analysisUpdatedAt: new Date()
            }
          });
          info('已更新文件的分析状态');
        } catch (updateErr) {
          error('更新文件分析状态失败', updateErr);
          // 不影响主流程，继续执行
        }
        
        return taskRes._id;
      } else {
        throw new Error('创建分析任务失败');
      }
    } catch (err) {
      error('创建分析任务失败', err);
      throw err;
    }
  },
  
  // 定期检查分析状态
  checkAnalysisStatus: function() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    // 每10秒检查一次分析状态
    this.checkInterval = setInterval(async () => {
      try {
        if (!this.data.analysisId || this.data.isCompleted) {
          clearInterval(this.checkInterval);
          return;
        }
        
        const db = wx.cloud.database();
        const analysis = await db.collection("analysis_tasks").doc(this.data.analysisId).get();
        
        if (analysis && analysis.data) {
          // 如果数据库中的内容有更新，则更新页面内容
          if (analysis.data.content && analysis.data.content !== this.data.mdContent) {
            this.setData({
              mdContent: analysis.data.content
            });
            this.extractTocItems(analysis.data.content);
          }
          
          // 如果状态已完成，更新状态
          if (analysis.data.status === 'completed' && !this.data.isCompleted) {
            this.setData({
              isAnalyzing: false,
              isCompleted: true,
              statusText: '分析完成'
            });
            clearInterval(this.checkInterval);
          }
        }
      } catch (err) {
        error('检查分析状态失败', err);
      }
    }, 10000); // 10秒检查一次
  },

  // 开始分析
  startAnalysis: async function() {
    info('开始AI分析', { fileId: this.data.fileId, fileUrl: this.data.fileUrl });
    
    // 如果有之前的请求，先中断
    if (this.data.requestTask) {
      try {
        this.data.requestTask.abort();
        info('已中断之前的请求');
      } catch (err) {
        error('中断之前的请求失败', err);
      }
    }
    
    // 清空之前的结果
    this.setData({
      mdContent: '',
      tocItems: [],
      isAnalyzing: true,
      hasError: false,
      errorMessage: '',
      statusText: '分析中...',
      loadingTip: '正在分析您的商业计划书...',
      requestTask: null,
      isRequestAborted: false, // 重置中断标志
      lineBuffer: '' // 清空行缓冲区
    });
    
    // 调用Coze工作流API
    this.callCozeWorkflow();
  },
  
  // 调用Coze工作流API
  callCozeWorkflow: function() {
    const that = this;
    
    // 获取配置
    const cozeConfig = app.globalData.config.coze;
    
    // 记录当前文件ID，用于判断回调时是否需要更新UI
    const curFileId = this.data.curFileId;
    
    // 调用AI服务并保存请求任务
    const requestTask = aiService.callCozeWorkflow({
      fileUrl: this.data.fileUrl,
      onEvent: async (event) => {
        // 如果请求已被中断，不再处理新数据
        if (that.data.isRequestAborted) {
          // 静默返回，避免日志噪音
          return;
        }
        
        // 如果用户已停止分析，不再处理新数据
        if (!that.data.isAnalyzing) {
          // 静默返回
          return;
        }
        
        // 处理SSE事件数据
        if (curFileId === that.data.curFileId) {
          debug('接收到SSE事件', { 
            event: event.event, 
            hasData: !!event.data,
            nodeType: event.data?.node_type,
            nodeId: event.data?.node_id,
            hasContent: !!(event.data?.content)
          });
          
          // 处理不同类型的事件
          if (event.event === 'Done') {
            info('接收到Done事件，分析即将完成');
            return;
          }
          
          // 记录所有节点信息以便调试
          if (event.data) {
            const contentField = event.data.content || event.data.mdContent || '';
            info('节点信息', {
              nodeId: event.data.node_id,
              nodeType: event.data.node_type,
              nodeTitle: event.data.node_title,
              hasContent: !!(contentField && contentField.trim()),
              contentLength: contentField ? contentField.length : 0,
              contentPreview: contentField ? contentField.substring(0, 50) : '',
              isFinish: event.data.node_is_finish
            });
          }
          
          // 从事件数据中提取实际内容
          // 支持多种事件类型
          if (event.data && (event.event === 'Message' || event.event === 'message' || event.event === 'chunk' || event.event === 'data')) {
            
            let chunk = '';
            
            // 根据Coze API响应格式提取内容，检查更多可能的字段
            // 首先检查 content 字段（这是实际返回的字段）
            if (event.data.content && typeof event.data.content === 'string' && event.data.content.trim()) {
              chunk = event.data.content;
            } else if (event.data.mdContent && typeof event.data.mdContent === 'string' && event.data.mdContent.trim()) {
              chunk = event.data.mdContent;
            } else if (event.data.output && typeof event.data.output === 'string') {
              chunk = event.data.output;
            } else if (event.data.response && typeof event.data.response === 'string') {
              chunk = event.data.response;
            } else if (event.data.result && typeof event.data.result === 'string') {
              chunk = event.data.result;
            } else if (event.data.message && typeof event.data.message === 'string') {
              chunk = event.data.message;
            } else if (event.data.text && typeof event.data.text === 'string') {
              chunk = event.data.text;
            } else if (event.data.data && typeof event.data.data === 'string') {
              chunk = event.data.data;
            } else if (typeof event.data === 'string') {
              chunk = event.data;
            } else {
              // 记录完整的事件数据结构以便调试
              debug('未找到文本内容，事件数据详情', { 
                event: event.event, 
                dataKeys: Object.keys(event.data || {}),
                nodeType: event.data.node_type,
                nodeTitle: event.data.node_title,
                fullData: JSON.stringify(event.data)
              });
            }
            
            // 清理chunk中可能存在的JSON格式数据
            if (chunk && chunk.trim()) {
              // 检查是否包含JSON格式的节点信息
              const jsonPattern = /\{"content":\s*"[^"]*",\s*"content_type":[^}]+\}/g;
              if (jsonPattern.test(chunk)) {
                // 如果包含JSON，尝试提取其中的content字段
                try {
                  const matches = chunk.match(jsonPattern);
                  if (matches) {
                    matches.forEach(match => {
                      try {
                        const jsonData = JSON.parse(match);
                        if (jsonData.content) {
                          // 替换JSON为实际内容
                          chunk = chunk.replace(match, jsonData.content);
                        }
                      } catch (e) {
                        // 解析失败，移除整个JSON块
                        chunk = chunk.replace(match, '');
                      }
                    });
                  }
                } catch (e) {
                  warn('清理JSON数据失败', e);
                }
              }
              
              // 额外清理：移除可能残留的节点标识
              chunk = chunk.replace(/\bid:\s*[\w-]+\b/g, ''); // 移除 id: xxx
              chunk = chunk.replace(/\bnode_id:\s*"\d+"/g, ''); // 移除 node_id: "xxx"
              chunk = chunk.replace(/\s{2,}/g, ' '); // 合并多余空格
            }
            
            if (chunk && chunk.trim()) {
              info('提取到内容片段', { 
                chunkLength: chunk.length,
                chunkPreview: chunk.substring(0, 100),
                nodeId: event.data.node_id,
                nodeTitle: event.data.node_title
              });
              
              // 使用行缓冲机制处理内容，避免破坏markdown结构
              let bufferedContent = that.data.lineBuffer + chunk;
              let lines = bufferedContent.split('\n');
              
              // 保留最后一行（可能不完整）到缓冲区
              let incompleteLastLine = '';
              if (!bufferedContent.endsWith('\n')) {
                incompleteLastLine = lines.pop() || '';
              }
              
              // 处理完整的行
              let linesToProcess = [];
              let tableBuffer = []; // 用于缓冲表格行
              let inTable = false;
              
              // 检查当前内容是否在表格中
              const currentContent = that.data.mdContent;
              if (currentContent) {
                const currentLines = currentContent.split('\n');
                const lastCompleteLine = currentLines[currentLines.length - 1];
                inTable = lastCompleteLine && lastCompleteLine.includes('|');
              }
              
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmedLine = line.trim();
                
                // 检测表格开始
                if (!inTable && trimmedLine.includes('|') && !trimmedLine.startsWith('#')) {
                  inTable = true;
                  tableBuffer = [line];
                }
                // 在表格中
                else if (inTable) {
                  // 检查是否是表格分隔符行
                  const isSeparator = trimmedLine.split('|').filter(c => c).every(c => c.trim().match(/^[-:]+$/));
                  
                  if (trimmedLine.includes('|') || isSeparator || trimmedLine === '') {
                    tableBuffer.push(line);
                  } else {
                    // 表格结束，处理缓冲的表格
                    if (tableBuffer.length > 0) {
                      // 确保表格结构完整
                      let processedTable = that.processTableBuffer(tableBuffer);
                      linesToProcess.push(...processedTable);
                      
                      // 添加空行分隔
                      if (trimmedLine !== '') {
                        linesToProcess.push('');
                      }
                    }
                    
                    inTable = false;
                    tableBuffer = [];
                    linesToProcess.push(line);
                  }
                }
                // 普通行
                else {
                  linesToProcess.push(line);
                }
              }
              
              // 如果还在表格中，保留表格行到下次处理
              if (inTable && incompleteLastLine) {
                // 将表格缓冲区的内容和不完整的最后一行合并到lineBuffer
                that.data.lineBuffer = tableBuffer.join('\n') + (tableBuffer.length > 0 ? '\n' : '') + incompleteLastLine;
              } else {
                // 如果有剩余的表格缓冲，处理它
                if (tableBuffer.length > 0) {
                  let processedTable = that.processTableBuffer(tableBuffer);
                  linesToProcess.push(...processedTable);
                }
                that.data.lineBuffer = incompleteLastLine;
              }
              
              // 只有当有完整的行时才更新内容
              if (linesToProcess.length > 0) {
                let content = that.data.mdContent;
                
                // 智能添加内容
                if (content && !content.endsWith('\n')) {
                  content += '\n';
                }
                
                content += linesToProcess.join('\n');
                
                // 确保内容以换行结束（如果有内容的话）
                if (content && linesToProcess[linesToProcess.length - 1] !== '') {
                  content += '\n';
                }
                
                that.setData({
                  mdContent: content,
                  lineBuffer: that.data.lineBuffer
                });
                
                // 提取目录项
                that.extractTocItems(content);
              }
              
              // 更新分析任务内容
              try {
                const db = wx.cloud.database();
                await db.collection("analysis_tasks").doc(that.data.analysisId).update({
                  data: {
                    content: content,  // 数据库字段仍保持为content
                    updatedAt: new Date()
                  }
                });
              } catch (err) {
                error('更新分析任务内容失败', err);
              }
            }
          } else if (!event.event) {
            // 如果没有事件类型，可能是纯文本内容
            warn('接收到无事件类型的数据', event);
          }
        }
      },
      onChunk: (chunk) => {
        // 如果请求已被中断，不再处理
        if (that.data.isRequestAborted) {
          // 静默返回
          return;
        }
        
        // 保留原始数据块处理，用于调试和兜底
        debug('接收到原始数据块', { 
          length: chunk.length,
          preview: chunk.substring(0, 100)
        });
        
        // 如果原始数据看起来像是纯文本内容（不是SSE格式），直接更新
        if (curFileId === that.data.curFileId && chunk && !chunk.includes('event:') && !chunk.includes('data:')) {
          // 可能是非SSE格式的纯文本响应
          const content = that.data.mdContent + chunk;
          that.setData({
            mdContent: content
          });
          that.extractTocItems(content);
        }
      },
      onComplete: async () => {
        // 如果请求已被中断，不再处理
        if (that.data.isRequestAborted) {
          // 静默返回
          return;
        }
        
        // 同样需要判断回调时文件ID是否一致
        if (curFileId === that.data.curFileId) {
          info('分析完成', { fileId: that.data.fileId });
          
          // 处理剩余的缓冲内容
          if (that.data.lineBuffer && that.data.lineBuffer.trim()) {
            let content = that.data.mdContent;
            if (content && !content.endsWith('\n')) {
              content += '\n';
            }
            
            // 处理剩余的缓冲行
            const remainingLines = that.data.lineBuffer.split('\n').filter(line => line.trim());
            if (remainingLines.length > 0) {
              // 检查是否是表格内容
              if (remainingLines.some(line => line.includes('|'))) {
                // 处理表格
                const processedTable = that.processTableBuffer(remainingLines);
                content += processedTable.join('\n') + '\n';
              } else {
                // 普通内容
                content += remainingLines.join('\n') + '\n';
              }
            }
            
            that.setData({
              mdContent: content,
              lineBuffer: '' // 清空缓冲区
            });
            
            // 提取目录项
            that.extractTocItems(content);
          }
          
          that.setData({
            isAnalyzing: false,
            isCompleted: true,
            statusText: '分析完成'
          });
          
          // 更新分析任务状态为已完成
          try {
            const db = wx.cloud.database();
            await db.collection("analysis_tasks").doc(that.data.analysisId).update({
              data: {
                status: 'completed',
                updatedAt: new Date()
              }
            });
            
            // 同时更新文件的分析状态
            await db.collection("bp_files").doc(that.data.fileId).update({
              data: {
                analysisStatus: 'completed',
                analysisUpdatedAt: new Date()
              }
            });
            info('已更新文件分析状态为完成');
          } catch (err) {
            error('更新分析任务状态失败', err);
          }
        }
      },
      onError: (err) => {
        if (curFileId === that.data.curFileId) {
          error('分析失败', err);
          
          that.setData({
            isAnalyzing: false,
            hasError: true,
            errorMessage: '分析失败，请稍后重试'
          });
          
          that.showToast('分析失败，请稍后重试', 'error');
        }
      },
      // 检查是否仍在分析中的回调函数
      isAnalyzing: () => {
        return that.data.isAnalyzing && curFileId === that.data.curFileId;
      }
    });
    
    // 保存请求任务对象
    if (requestTask) {
      this.setData({
        requestTask: requestTask
      });
    }
  },
  
  // 提取目录项
  extractTocItems: function(content) {
    // 简单匹配所有的标题行
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const tocItems = [];
    let match;
    
    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const title = match[2].trim();
      
      // 只提取前三级标题
      if (level <= 3) {
        tocItems.push({
          level: level,
          title: title
        });
      }
    }
    
    this.setData({
      tocItems: tocItems
    });
  },
  
  // 停止分析
  handleStopAnalysis: function() {
    info('用户请求停止分析');
    
    // 设置中断标志
    this.setData({
      isRequestAborted: true
    });
    
    // 中断请求
    if (this.data.requestTask) {
      try {
        this.data.requestTask.abort();
        info('已中断AI请求');
      } catch (err) {
        error('中断请求失败', err);
      }
      this.setData({
        requestTask: null
      });
    }
    
    // 设置停止标志
    this.setData({
      isAnalyzing: false,
      isCompleted: true,
      statusText: '已停止',
      loadingTip: '分析已停止'
    });
    
    // 清除检查定时器
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    // 更新数据库状态为用户中断
    if (this.data.analysisId) {
      const db = wx.cloud.database();
      db.collection("analysis_tasks").doc(this.data.analysisId).update({
        data: {
          status: 'stopped',
          stoppedAt: new Date(),
          updatedAt: new Date()
        }
      }).then(() => {
        info('分析任务状态已更新为停止');
        
        // 同时更新文件的分析状态
        return db.collection("bp_files").doc(this.data.fileId).update({
          data: {
            analysisStatus: 'stopped',
            analysisUpdatedAt: new Date()
          }
        });
      }).then(() => {
        info('已更新文件分析状态为停止');
      }).catch(err => {
        error('更新分析任务状态失败', err);
      });
    }
    
    // 显示提示
    wx.showToast({
      title: '已停止生成',
      icon: 'none',
      duration: 2000
    });
  },
  
  // 重新分析
  handleReAnalyze: function() {
    wx.showModal({
      title: '重新分析',
      content: '确定要重新分析该文件吗？当前分析结果将被覆盖。',
      success: (res) => {
        if (res.confirm) {
          this.startAnalysis();
        }
      }
    });
  },
  
  // 保存报告
  handleSaveReport: async function() {
    if (!this.data.mdContent || this.data.savingToHistory) {
      return;
    }
    
    this.setData({
      savingToHistory: true
    });
    
    try {
      const db = wx.cloud.database();
      await db.collection("reports").add({
        data: {
          fileId: this.data.fileId,
          analysisId: this.data.analysisId,
          content: this.data.mdContent,  // 保存的是mdContent字段的内容
          createdAt: new Date()
        }
      });
      
      this.showToast('报告保存成功', 'success');
    } catch (err) {
      error('保存报告失败', err);
      this.showToast('保存失败，请稍后重试', 'error');
    } finally {
      this.setData({
        savingToHistory: false
      });
    }
  },
  
  // 清理Markdown内容中的异常数据
  cleanMarkdownContent: function(content) {
    if (!content) return content;
    
    let cleanedContent = content;
    
    // 1. 清理JSON格式的节点信息
    const jsonPattern = /\{"content":\s*"[^"]*",\s*"content_type":[^}]+\}/g;
    const matches = cleanedContent.match(jsonPattern);
    if (matches) {
      matches.forEach(match => {
        try {
          const jsonData = JSON.parse(match);
          if (jsonData.content) {
            // 替换JSON为实际内容
            cleanedContent = cleanedContent.replace(match, jsonData.content);
          }
        } catch (e) {
          // 解析失败，移除整个JSON块
          cleanedContent = cleanedContent.replace(match, '');
        }
      });
    }
    
    // 2. 移除残留的节点标识
    cleanedContent = cleanedContent.replace(/\bid:\s*[\w-]+\b/g, ''); // 移除 id: xxx
    cleanedContent = cleanedContent.replace(/\bnode_id:\s*"\d+"/g, ''); // 移除 node_id: "xxx"
    cleanedContent = cleanedContent.replace(/\bnode_execute_uuid:\s*"[\d]+"/g, ''); // 移除 node_execute_uuid
    cleanedContent = cleanedContent.replace(/\bnode_seq_id:\s*"[\d]+"/g, ''); // 移除 node_seq_id
    cleanedContent = cleanedContent.replace(/\bnode_type:\s*"[\w]+"/g, ''); // 移除 node_type
    cleanedContent = cleanedContent.replace(/\bnode_title:\s*"[^"]+"/g, ''); // 移除 node_title
    cleanedContent = cleanedContent.replace(/\bnode_is_finish:\s*(true|false)/g, ''); // 移除 node_is_finish
    
    // 3. 修复合并的标题
    // 修复形如 "# 标题1 ## 标题2" 的情况
    cleanedContent = cleanedContent.replace(/(#{1,6}\s+[^#\n]+)\s*(#{1,6}\s+)/gm, '$1\n\n$2');
    
    // 修复表格行后面紧跟标题的情况（如 "| 联系电话 | 未提供 | # 商业计划书摘要 |"）
    cleanedContent = cleanedContent.replace(/(\|[^#\n]+)\s*(#{1,6}\s+[^|]+)\s*\|/gm, '$1 |\n\n$2');
    // 修复更一般的情况：表格行中包含标题
    cleanedContent = cleanedContent.replace(/\|\s*(#{1,6}\s+[^|]+)\s*$/gm, '|\n\n$1');
    
    // 4. 修复被截断的内容
    cleanedContent = cleanedContent.replace(/未\s+未提供/g, '未提供');
    
    // 5. 处理水平分隔线
    // 将段落之间的 --- 确保前后有空行，使其被正确识别为水平线
    cleanedContent = cleanedContent.replace(/([^\n])\s*\n\s*---\s*\n\s*([^\n])/gm, '$1\n\n---\n\n$2');
    // 确保独立的 --- 行前后有空行
    cleanedContent = cleanedContent.replace(/^\s*---\s*$/gm, '\n---\n');
    
    // 7. 重建表格结构
    const lines = cleanedContent.split('\n');
    const fixedLines = [];
    let i = 0;
    
    while (i < lines.length) {
      let line = lines[i].trim();
      
      // 跳过只包含 | 的空行
      if (line === '|' || line === '||') {
        i++;
        continue;
      }
      
      // 处理标题行
      if (line.startsWith('#')) {
        // 检查是否有表格头紧跟在标题后面
        if (line.includes('|')) {
          const parts = line.split('|');
          const titlePart = parts[0].trim();
          const tablePart = '|' + parts.slice(1).join('|');
          
          // 添加标题
          if (fixedLines.length > 0 && fixedLines[fixedLines.length - 1].trim() !== '') {
            fixedLines.push('');
          }
          fixedLines.push(titlePart);
          fixedLines.push('');
          
          // 开始处理表格
          line = tablePart;
        } else {
          // 普通标题，确保前后有空行
          if (fixedLines.length > 0 && fixedLines[fixedLines.length - 1].trim() !== '') {
            fixedLines.push('');
          }
          fixedLines.push(line);
          i++;
          continue;
        }
      }
      
      // 处理表格
      if (line.includes('|')) {
        // 收集表格的所有行
        const tableRows = [];
        
        // 添加当前行（可能是表头）
        if (!line.startsWith('|')) line = '| ' + line;
        if (!line.endsWith('|')) line = line + ' |';
        tableRows.push(line);
        
        // 向前查看，收集属于同一表格的所有行
        let j = i + 1;
        let foundSeparator = false;
        let separatorParts = []; // 收集分割的分隔符部分
        
        while (j < lines.length) {
          const nextLine = lines[j].trim();
          
          // 跳过只包含 | 的空行
          if (nextLine === '|' || nextLine === '||') {
            j++;
            continue;
          }
          
          // 如果是空行，检查下一行是否还是表格
          if (nextLine === '') {
            // 查看空行后面是否还有表格行
            if (j + 1 < lines.length) {
              const lineAfterEmpty = lines[j + 1].trim();
              // 如果空行后面是分隔符行或普通表格行，继续收集
              if (lineAfterEmpty.includes('|') && !lineAfterEmpty.startsWith('#')) {
                j++;
                continue;
              }
            }
            break;
          }
          
          // 如果是标题，表格结束
          if (nextLine.startsWith('#')) {
            break;
          }
          
          // 如果包含管道符，是表格行
          if (nextLine.includes('|')) {
            let tableLine = nextLine;
            if (!tableLine.startsWith('|')) tableLine = '| ' + tableLine;
            if (!tableLine.endsWith('|')) tableLine = tableLine + ' |';
            
            // 检查是否是分隔符行（包括被拆分的情况）
            const cellContent = tableLine.split('|').filter(c => c).map(c => c.trim());
            
            // 如果所有单元格都只包含 --- 或为空，这是分隔符行的一部分
            if (cellContent.length > 0 && cellContent.every(c => c === '' || c.match(/^[-:]+$/))) {
              separatorParts.push(cellContent);
              foundSeparator = true;
              j++;
              continue;
            }
            
            // 如果已经收集了分隔符部分，先处理它们
            if (separatorParts.length > 0) {
              // 合并所有分隔符部分
              const maxCells = Math.max(...separatorParts.map(p => p.length));
              const separatorRow = '|' + Array(maxCells).fill(' --- ').join('|') + '|';
              tableRows.push(separatorRow);
              separatorParts = [];
            }
            
            tableRows.push(tableLine);
            j++;
          } else {
            // 不是表格行，结束收集
            break;
          }
        }
        
        // 处理剩余的分隔符部分
        if (separatorParts.length > 0) {
          const maxCells = Math.max(...separatorParts.map(p => p.length));
          const separatorRow = '|' + Array(maxCells).fill(' --- ').join('|') + '|';
          tableRows.push(separatorRow);
        }
        
        // 如果收集到了有效的表格（至少有表头和分隔符）
        if (tableRows.length >= 2) {
          // 确保表格前有空行
          if (fixedLines.length > 0 && fixedLines[fixedLines.length - 1].trim() !== '') {
            fixedLines.push('');
          }
          
          // 分析和修复表格结构
          let finalTableRows = [];
          let headerRow = null;
          let separatorRow = null;
          let dataRows = [];
          
          // 查找表头、分隔符和数据行
          for (let k = 0; k < tableRows.length; k++) {
            const row = tableRows[k];
            const cells = row.split('|').filter(c => c);
            
            if (cells.every(c => c.trim().match(/^[-:]+$/))) {
              // 这是分隔符行
              if (!separatorRow) separatorRow = row;
            } else if (!headerRow && !separatorRow) {
              // 第一个非分隔符行是表头
              headerRow = row;
            } else {
              // 数据行
              dataRows.push(row);
            }
          }
          
          // 确定表格的列数（基于表头或第一个有效行）
          let columnCount = 2; // 默认2列
          if (headerRow) {
            columnCount = headerRow.split('|').filter(c => c.trim()).length;
          }
          
          // 重建表格
          if (headerRow) {
            finalTableRows.push(headerRow);
          }
          
          // 添加分隔符行
          if (!separatorRow || separatorRow.split('|').filter(c => c.trim()).length < columnCount) {
            separatorRow = '|' + Array(columnCount).fill(' --- ').join('|') + '|';
          }
          finalTableRows.push(separatorRow);
          
          // 处理数据行，合并被错误拆分的行
          let mergedDataRows = [];
          let currentRow = null;
          
          for (let k = 0; k < dataRows.length; k++) {
            const row = dataRows[k];
            const cells = row.split('|').filter(c => c);
            
            if (cells.length === columnCount) {
              // 完整的行
              if (currentRow) {
                mergedDataRows.push(currentRow);
              }
              currentRow = row;
            } else if (cells.length < columnCount && currentRow) {
              // 可能是被拆分的行，尝试合并
              const currentCells = currentRow.split('|').filter(c => c);
              if (currentCells.length + cells.length <= columnCount) {
                // 合并到当前行
                const mergedCells = [...currentCells, ...cells];
                currentRow = '| ' + mergedCells.map(c => c.trim()).join(' | ') + ' |';
              } else {
                // 无法合并，作为独立行处理
                mergedDataRows.push(currentRow);
                currentRow = row;
              }
            } else {
              // 独立的不完整行
              if (currentRow) {
                mergedDataRows.push(currentRow);
              }
              currentRow = row;
            }
          }
          
          // 添加最后一行
          if (currentRow) {
            mergedDataRows.push(currentRow);
          }
          
          // 添加所有处理后的数据行
          finalTableRows.push(...mergedDataRows);
          
          // 添加到最终结果
          finalTableRows.forEach(row => fixedLines.push(row));
          
          // 更新索引
          i = j;
          continue;
        } else {
          // 不是有效表格，当作普通文本处理
          fixedLines.push(line);
          i++;
        }
      } else if (line !== '') {
        // 普通文本行
        fixedLines.push(line);
        i++;
      } else {
        // 空行，但要避免过多空行
        if (fixedLines.length === 0 || fixedLines[fixedLines.length - 1] !== '') {
          fixedLines.push('');
        }
        i++;
      }
    }
    
    cleanedContent = fixedLines.join('\n');
    
    // 8. 最终清理
    // 清理多余的空行
    cleanedContent = cleanedContent.replace(/\n{4,}/g, '\n\n');
    
    // 确保文档结尾干净
    cleanedContent = cleanedContent.trim();
    
    // 移除末尾可能残留的 id: 标记
    cleanedContent = cleanedContent.replace(/id:\s*。?\s*$/gi, '。');
    cleanedContent = cleanedContent.replace(/\s*\.\s*$/, '。');
    
    return cleanedContent;
  },
  
  // 复制Markdown报告内容
  handleCopyMarkdown: function() {
    if (!this.data.mdContent) {
      this.showToast('暂无报告内容', 'error');
      return;
    }
    
    // 清理内容
    const cleanedContent = this.cleanMarkdownContent(this.data.mdContent);
    
    // 复制到剪贴板
    wx.setClipboardData({
      data: cleanedContent,
      success: () => {
        info('报告已复制到剪贴板', { 
          contentLength: cleanedContent.length 
        });
        
        // 显示成功提示
        wx.showToast({
          title: '报告已复制',
          icon: 'success',
          duration: 2000
        });
        
        // 同时在控制台输出，方便调试
        console.log('==================== 报告内容（Markdown格式）====================');
        console.log(cleanedContent);
        console.log('================================================================');
      },
      fail: (err) => {
        error('复制报告失败', err);
        this.showToast('复制失败，请重试', 'error');
      }
    });
  },
  
  // 分享报告
  handleShareReport: function() {
    // 可以实现分享逻辑
    this.showToast('分享功能开发中', 'info');
  },
  
  // 查看文件
  handleOpenFile: function() {
    // 可以实现打开文件逻辑
    this.showToast('文件查看功能开发中', 'info');
  },
  
  // 处理表格缓冲区，确保表格结构完整
  processTableBuffer: function(tableLines) {
    if (!tableLines || tableLines.length === 0) return tableLines;
    
    let processedLines = [];
    let headerLine = null;
    let separatorLine = null;
    let dataLines = [];
    
    // 分析表格结构
    for (let i = 0; i < tableLines.length; i++) {
      const line = tableLines[i];
      const trimmedLine = line.trim();
      
      // 跳过空行和只有 | 的行
      if (trimmedLine === '' || trimmedLine === '|' || trimmedLine === '||') {
        continue;
      }
      
      // 检查是否是分隔符行
      const cells = trimmedLine.split('|').filter(c => c);
      const isSeparator = cells.length > 0 && cells.every(c => c.trim().match(/^[-:]+$/));
      
      if (isSeparator) {
        if (!separatorLine) {
          separatorLine = line;
        }
      } else if (!headerLine && !separatorLine) {
        // 第一个非分隔符行是表头
        headerLine = line;
      } else {
        // 数据行
        dataLines.push(line);
      }
    }
    
    // 重建表格
    if (headerLine) {
      // 确保表头格式正确
      if (!headerLine.trim().startsWith('|')) {
        headerLine = '| ' + headerLine.trim();
      }
      if (!headerLine.trim().endsWith('|')) {
        headerLine = headerLine.trim() + ' |';
      }
      processedLines.push(headerLine);
      
      // 计算列数
      const columnCount = headerLine.split('|').filter(c => c.trim()).length;
      
      // 添加分隔符行
      if (!separatorLine || separatorLine.split('|').filter(c => c.trim()).length < columnCount) {
        separatorLine = '|' + Array(columnCount).fill(' --- ').join('|') + '|';
      }
      processedLines.push(separatorLine);
      
      // 处理数据行
      for (const dataLine of dataLines) {
        let line = dataLine;
        if (!line.trim().startsWith('|')) {
          line = '| ' + line.trim();
        }
        if (!line.trim().endsWith('|')) {
          line = line.trim() + ' |';
        }
        processedLines.push(line);
      }
    }
    
    return processedLines.length > 0 ? processedLines : tableLines;
  },
  
  // 显示Toast
  showToast: function(message, type = 'info') {
    const toast = this.selectComponent('#toast');
    if (toast) {
      toast[type](message);
    } else {
      console.log('Toast组件不存在');
      wx.showToast({
        title: message,
        icon: type === 'success' ? 'success' : 'none'
      });
    }
  },
  
  onUnload: function() {
    // 清除定时器
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    // 中断请求
    if (this.data.requestTask) {
      try {
        this.data.requestTask.abort();
        info('页面卸载，已中断请求');
      } catch (err) {
        error('页面卸载时中断请求失败', err);
      }
    }
  }
});