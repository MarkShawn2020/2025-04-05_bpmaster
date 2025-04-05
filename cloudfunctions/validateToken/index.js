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
  const { OPENID, ENV } = wxContext
  
  try {
    // 验证token
    const db = cloud.database()
    const userCollection = db.collection('users')
    
    // 开发环境下的验证逻辑
    if (ENV === 'local' || ENV === 'development') {
      console.log('开发环境下的token验证')
      
      // 查询用户，只验证token的存在性，不严格匹配openid
      const user = await userCollection.where({
        token: token
      }).get()
      
      if (user.data.length > 0) {
        // 找到任意匹配token的用户即可
        const userData = user.data[0]
        return {
          valid: true,
          code: 200,
          message: '开发环境Token验证成功',
          userInfo: {
            userId: userData._id,
            nickname: userData.nickname || '',
            avatarUrl: userData.avatarUrl || ''
          }
        }
      } else {
        // 开发环境下，如果找不到token，尝试创建一个测试用户
        const testUserData = {
          openid: OPENID,
          nickname: '测试用户',
          avatarUrl: '',
          token: token,
          createdAt: db.serverDate(),
          lastLoginAt: db.serverDate()
        }
        
        const result = await userCollection.add({
          data: testUserData
        })
        
        return {
          valid: true,
          code: 200,
          message: '开发环境创建测试用户成功',
          userInfo: {
            userId: result._id,
            nickname: testUserData.nickname,
            avatarUrl: testUserData.avatarUrl
          }
        }
      }
    }
    
    // 生产环境下的严格验证逻辑
    const user = await userCollection.where({
      openid: OPENID,
      token: token
    }).get()
    
    if (user.data.length === 0) {
      return {
        valid: false,
        code: 401,
        message: 'Token无效或已过期'
      }
    }
    
    // 返回用户信息
    const userData = user.data[0]
    return {
      valid: true,
      code: 200,
      message: 'Token验证成功',
      userInfo: {
        userId: userData._id,
        nickname: userData.nickname || '',
        avatarUrl: userData.avatarUrl || ''
      }
    }
  } catch (err) {
    console.error('验证Token失败', err)
    return {
      code: 500,
      message: '验证失败: ' + err.message
    }
  }
} 