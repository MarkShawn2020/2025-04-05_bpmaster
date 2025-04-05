// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const bpFilesCollection = db.collection('bp_files')
const _ = db.command

/**
 * 修复数据库中analysisResults为null的记录
 * 将所有null值的analysisResults字段更新为空对象
 */
exports.main = async (event, context) => {
  console.log('开始修复数据库中的analysisResults字段')
  
  try {
    // 查找所有analysisResults为null的记录
    const query = { analysisResults: null }
    const nullRecords = await bpFilesCollection.where(query).get()
    
    console.log(`找到${nullRecords.data.length}条记录需要修复`)
    
    if (nullRecords.data.length === 0) {
      return {
        code: 200,
        message: '没有需要修复的记录',
        fixed: 0
      }
    }
    
    // 逐条更新记录
    const updatePromises = nullRecords.data.map(record => {
      return bpFilesCollection.doc(record._id).update({
        data: {
          analysisResults: {}
        }
      }).then(() => {
        console.log(`记录${record._id}修复成功`)
        return true
      }).catch(err => {
        console.error(`记录${record._id}修复失败`, err)
        return false
      })
    })
    
    const results = await Promise.all(updatePromises)
    const successCount = results.filter(success => success).length
    
    return {
      code: 200,
      message: `修复完成，成功${successCount}条，失败${nullRecords.data.length - successCount}条`,
      fixed: successCount,
      total: nullRecords.data.length
    }
  } catch (error) {
    console.error('修复analysisResults失败', error)
    return {
      code: 500,
      message: `修复失败: ${error.message || error}`
    }
  }
} 