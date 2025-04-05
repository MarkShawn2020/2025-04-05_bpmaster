// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

/**
 * 登录云函数
 * 此函数接收微信code，返回自定义登录态
 */
exports.main = async (event, context) => {
  console.log('登录云函数被调用', event)
  
  const wxContext = cloud.getWXContext()
  
  // 获取用户openid
  const { OPENID, APPID } = wxContext
  
  console.log('当前用户OPENID:', OPENID)
  
  // 检查用户是否已存在
  const db = cloud.database()
  const userCollection = db.collection('users')
  
  try {
    // 查询用户
    let user = await userCollection.where({
      openid: OPENID
    }).get()
    
    // 生成token (实际项目中应使用更安全的方式)
    const token = `${OPENID}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    
    if (user.data.length === 0) {
      // 新用户，创建用户记录
      console.log('创建新用户')
      
      const userData = {
        openid: OPENID,
        appid: APPID,
        createdAt: db.serverDate(),
        lastLoginAt: db.serverDate(),
        token: token,
        nickname: '用户' + OPENID.substring(0, 5),
        avatarUrl: ''
      }
      
      const result = await userCollection.add({
        data: userData
      })
      
      console.log('新用户创建成功，ID:', result._id)
      
      // 返回登录信息
      return {
        code: 200,
        message: '登录成功',
        token,
        userInfo: {
          isNewUser: true,
          userId: result._id,
          nickname: userData.nickname,
          avatarUrl: userData.avatarUrl,
          openid: OPENID
        }
      }
    } else {
      // 已存在用户，更新登录时间和token
      const userId = user.data[0]._id
      const userData = user.data[0]
      
      console.log('用户已存在，ID:', userId)
      
      await userCollection.doc(userId).update({
        data: {
          lastLoginAt: db.serverDate(),
          token: token
        }
      })
      
      console.log('用户token已更新')
      
      // 返回登录信息
      return {
        code: 200,
        message: '登录成功',
        token,
        userInfo: {
          isNewUser: false,
          userId: userId,
          nickname: userData.nickname || '用户' + OPENID.substring(0, 5),
          avatarUrl: userData.avatarUrl || '',
          openid: OPENID
        }
      }
    }
  } catch (err) {
    console.error('登录失败', err)
    return {
      code: 500,
      message: '登录失败: ' + err.message
    }
  }
} 