// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

/**
 * 更新用户信息云函数
 * 此函数用于更新用户的头像和昵称
 */
exports.main = async (event, context) => {
  console.log('更新用户信息云函数被调用', event)
  
  const wxContext = cloud.getWXContext()
  
  // 获取用户openid
  const { OPENID } = wxContext
  const { nickname, avatarUrl, avatarFileID } = event
  
  console.log('当前用户OPENID:', OPENID)
  console.log('要更新的信息:', { nickname, avatarUrl, avatarFileID })
  
  // 参数验证
  if (!nickname && !avatarUrl && !avatarFileID) {
    return {
      code: 400,
      message: '未提供需要更新的信息'
    }
  }
  
  // 构建更新数据
  const updateData = {}
  if (nickname) updateData.nickname = nickname
  if (avatarUrl) updateData.avatarUrl = avatarUrl
  if (avatarFileID) updateData.avatarFileID = avatarFileID
  
  // 更新用户信息
  const db = cloud.database()
  const userCollection = db.collection('users')
  
  try {
    // 查询用户
    let user = await userCollection.where({
      openid: OPENID
    }).get()
    
    if (user.data.length === 0) {
      return {
        code: 404,
        message: '用户不存在'
      }
    }
    
    // 获取用户ID
    const userId = user.data[0]._id
    
    // 更新用户信息
    await userCollection.doc(userId).update({
      data: updateData
    })
    
    console.log('用户信息更新成功')
    
    return {
      code: 200,
      message: '更新成功',
      data: {
        ...updateData,
        openid: OPENID
      }
    }
  } catch (err) {
    console.error('更新用户信息失败', err)
    return {
      code: 500,
      message: '更新失败: ' + err.message
    }
  }
} 