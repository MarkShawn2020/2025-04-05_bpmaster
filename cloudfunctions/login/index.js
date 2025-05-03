// 云函数入口文件
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境

// 数据库实例
const db = cloud.database();
const userCollection = db.collection('users');

/**
 * 获取用户信息
 * @param {string} openid - 用户的openid
 * @returns {Promise<Object>} 用户信息
 */
async function getUserByOpenid(openid) {
  console.log('查询用户信息', { openid });
  return await userCollection.where({ openid }).get();
}

/**
 * 创建新用户
 * @param {string} openid - 用户的openid
 * @param {string} appid - 小程序appid
 * @returns {Promise<Object>} 创建结果
 */
async function createUser(openid, appid) {
  console.log('创建新用户', { openid });
  
  const userData = {
    openid,
    appid,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate(),
    // 默认用户信息
    nickname: `用户${openid.substring(openid.length - 6)}`,
    avatarUrl: '',
    // 其他默认字段
    loginCount: 1,
    lastLoginTime: db.serverDate()
  };
  
  return await userCollection.add({ data: userData });
}

/**
 * 更新用户登录信息
 * @param {string} openid - 用户的openid
 * @returns {Promise<Object>} 更新结果
 */
async function updateUserLoginInfo(openid) {
  console.log('更新用户登录信息', { openid });
  
  return await userCollection.where({ openid }).update({
    data: {
      updatedAt: db.serverDate(),
      lastLoginTime: db.serverDate(),
      loginCount: db.command.inc(1)
    }
  });
}

/**
 * 生成登录令牌
 * @param {string} openid - 用户的openid
 * @returns {string} 生成的令牌
 */
function generateToken(openid) {
  // 生成简单token (实际项目中应使用更安全的方式，如JWT)
  return `${openid}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * 处理登录逻辑
 * @param {string} openid - 用户的openid
 * @param {string} appid - 小程序appid
 * @returns {Promise<Object>} 处理结果
 */
async function handleLogin(openid, appid) {
  try {
    // 查询用户是否存在
    const userResult = await getUserByOpenid(openid);
    const token = generateToken(openid);
    
    if (userResult.data.length === 0) {
      // 新用户，创建用户记录
      await createUser(openid, appid);
      return {
        success: true,
        isNewUser: true,
        openid,
        token
      };
    } else {
      // 已存在的用户，更新登录信息
      await updateUserLoginInfo(openid);
      return {
        success: true,
        isNewUser: false,
        openid,
        token,
        userInfo: userResult.data[0]
      };
    }
  } catch (error) {
    console.error('登录处理失败', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 登录云函数入口
 * 此函数接收微信code，返回自定义登录态
 */
exports.main = async (event, context) => {
  console.log('登录云函数被调用', event);
  
  // 获取微信上下文
  const wxContext = cloud.getWXContext();
  
  // 获取用户openid
  const { OPENID, APPID } = wxContext;
  
  if (!OPENID) {
    return {
      success: false,
      error: '无法获取用户openid'
    };
  }
  
  console.log('当前用户OPENID:', OPENID);
  
  // 使用单一出口模式处理登录逻辑
  const result = await handleLogin(OPENID, APPID);
  
  return {
    ...result,
    // 返回云调用相关信息供参考
    event,
    openid: OPENID,
    appid: APPID,
    unionid: wxContext.UNIONID,
  };
};
