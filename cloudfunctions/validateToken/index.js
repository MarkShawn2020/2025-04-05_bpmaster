// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

/**
 * 验证用户token的云函数
 * 验证成功返回用户信息，失败返回错误信息
 */
exports.main = async (event, context) => {
  console.log('验证Token云函数被调用', event)
  
  const { token } = event
  
  if (!token) {
    return {
      code: 401,
      message: 'Token不能为空'
    }
  }
  
  const wxContext = cloud.getWXContext()
  const { OPENID } = wxContext
  
  console.log('当前用户OPENID:', OPENID)
  
  try {
    // 验证token
    const db = cloud.database()
    const userCollection = db.collection('users')
    
    // 查询用户
    const user = await userCollection.where({
      token: token
    }).get()
    
    console.log('查询到的用户:', user.data.length > 0 ? `ID:${user.data[0]._id}` : '未找到')
    
    if (user.data.length === 0) {
      return {
        code: 401,
        message: 'Token无效或已过期',
        valid: false
      }
    }
    
    // 检查用户ID和OPENID是否匹配
    if (user.data[0].openid !== OPENID) {
      console.log('Token与当前用户不匹配', `Token用户:${user.data[0].openid}`, `当前用户:${OPENID}`)
      
      return {
        code: 401,
        message: 'Token与当前用户不匹配',
        valid: false
      }
    }
    
    // 返回用户信息
    const userData = user.data[0]
    
    return {
      code: 200,
      message: 'Token验证成功',
      valid: true,
      userInfo: {
        userId: userData._id,
        nickname: userData.nickname || '用户' + userData.openid.substring(0, 5),
        avatarUrl: userData.avatarUrl || '',
        openid: userData.openid
      }
    }
  } catch (err) {
    console.error('验证Token失败', err)
    return {
      code: 500,
      message: '验证失败: ' + err.message,
      valid: false
    }
  }
} 