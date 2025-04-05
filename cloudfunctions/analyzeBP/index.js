// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const bpFilesCollection = db.collection('bp_files')

/**
 * 分析BP文件云函数
 * @param {Object} event 
 * @param {string} event.fileId BP文件ID
 * @returns {Object} 分析结果
 */
exports.main = async (event, context) => {
  const { fileId } = event
  const { OPENID, APPID } = cloud.getWXContext()
  
  console.log('分析BP文件云函数被调用', {
    fileId,
    tcbContext: context,
    userInfo: {
      appId: APPID,
      openId: OPENID
    }
  })

  if (!fileId) {
    return {
      code: 400,
      message: '缺少必要参数fileId'
    }
  }

  try {
    // 查询文件信息
    const fileInfo = await bpFilesCollection.doc(fileId).get()
    .then(res => res.data)
    
    if (!fileInfo) {
      return {
        code: 404,
        message: '文件不存在'
      }
    }
    
    console.log('文件信息:', fileInfo)
    
    // 更新文件状态为分析中
    await bpFilesCollection.doc(fileId).update({
      data: {
        status: 'analyzing'
      }
    })
    
    console.log('已更新文件状态为analyzing')
    
    // 获取文件下载链接
    const fileID = fileInfo.fileID
    console.log('开始分析文件:', fileID)
    
    // 在此处执行实际的文件分析逻辑
    // 1. 下载文件
    // 2. 调用OCR或AI服务提取内容
    // 3. 分析内容并生成结构化数据
    
    // 模拟分析过程
    const analysisResults = {
      projectInfo: {
        projectName: fileInfo.fileName.replace(/\.[^/.]+$/, ''), // 移除扩展名
        companyName: '示例公司',
        industryCategory: '信息技术',
        developmentStage: '成长期'
      },
      businessPlan: {
        projectSummary: '这是一个基于AI的项目，提供智能分析服务。',
        productsAndServices: '提供智能分析服务和数据洞察。',
        industryAndMarket: '目标市场是企业客户，市场规模约100亿。',
        coreTechnology: '使用先进的机器学习和自然语言处理技术。',
        businessModel: '订阅制和按需付费相结合的商业模式。',
        coreTeam: '由行业专家和技术大牛组成的专业团队。',
        strategicPlanning: '未来三年计划拓展国际市场，提升市场份额。'
      },
      teamMembers: [
        {
          name: '张三',
          position: 'CEO',
          education: '北京大学博士',
          experience: '10年创业经验'
        },
        {
          name: '李四',
          position: 'CTO',
          education: '清华大学硕士',
          experience: '15年技术开发经验'
        }
      ],
      financials: {
        revenueProjections: [
          { year: 2023, amount: 1000000 },
          { year: 2024, amount: 5000000 },
          { year: 2025, amount: 15000000 }
        ],
        expenseProjections: [
          { year: 2023, amount: 2000000 },
          { year: 2024, amount: 4000000 },
          { year: 2025, amount: 10000000 }
        ]
      }
    }
    
    // 重要：准备完整的更新数据，不要向null对象添加字段
    console.log('准备更新完整的分析结果')
    
    // 更新文件分析结果
    await bpFilesCollection.doc(fileId).update({
      data: {
        status: 'analyzed',
        isAnalyzed: true,
        analysisResults: analysisResults,  // 一次性设置完整对象
        analysisDate: db.serverDate(),     // 不是添加到analysisResults中
        lastUpdated: db.serverDate()
      }
    })
    
    return {
      code: 200,
      message: '分析成功',
      results: analysisResults,
      id: fileId
    }
  } catch (error) {
    console.log('分析BP文件失败', error)
    
    // 更新文件状态为分析失败
    try {
      await bpFilesCollection.doc(fileId).update({
        data: {
          status: 'failed'
        }
      })
    } catch (updateError) {
      console.error('更新状态失败', updateError)
    }
    
    return {
      code: 500,
      message: `分析失败: ${error.message || error}`
    }
  }
} 