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
  const { OPENID, APPID, ENV } = wxContext
  
  // 检查是否为开发环境
  const isDev = ENV === 'local' || ENV === 'development'
  
  // 检查用户是否已存在
  const db = cloud.database()
  const userCollection = db.collection('users')
  
  try {
    // 生成token (实际项目中应使用更安全的方式)
    let token
    
    if (isDev) {
      // 开发环境使用固定token前缀，便于调试
      token = `dev_token_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    } else {
      // 生产环境token与openid绑定
      token = `${OPENID}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    }
    
    console.log(`当前环境: ${ENV}, 使用${isDev ? '开发' : '生产'}环境token`)
    
    // 查询用户
    let user = await userCollection.where({
      openid: OPENID
    }).get()
    
    if (user.data.length === 0) {
      // 新用户，创建用户记录
      const result = await userCollection.add({
        data: {
          openid: OPENID,
          appid: APPID,
          createdAt: db.serverDate(),
          lastLoginAt: db.serverDate(),
          token: token,
          isDev: isDev
        }
      })
      
      // 返回登录信息
      return {
        token,
        userInfo: {
          isNewUser: true,
          userId: result._id
        }
      }
    } else {
      // 已存在用户，更新登录时间和token
      const userId = user.data[0]._id
      
      await userCollection.doc(userId).update({
        data: {
          lastLoginAt: db.serverDate(),
          token: token,
          isDev: isDev
        }
      })
      
      // 返回登录信息
      return {
        token,
        userInfo: {
          isNewUser: false,
          userId: userId,
          nickname: user.data[0].nickname || '',
          avatarUrl: user.data[0].avatarUrl || ''
        }
      }
    }
  } catch (err) {
    console.error('登录失败', err)
    return {
      code: -1,
      message: '登录失败: ' + err.message
    }
  }
} 