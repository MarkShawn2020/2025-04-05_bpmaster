# 环境变量配置指南

## 概述

本项目使用配置文件方式管理敏感信息（如API密钥），避免将其暴露在源代码中。

## 配置方法

### 1. 创建配置文件

项目根目录下已有 `config.env.example.js` 模板文件，请按以下步骤操作：

```bash
# 1. 复制模板文件
cp config.env.example.js config.env.js

# 2. 编辑 config.env.js，填入实际的配置值
```

### 2. 配置文件结构

```javascript
module.exports = {
  // 开发环境配置
  dev: {
    coze: {
      API_URL: 'https://api.coze.cn/v1/workflow/stream_run',
      TOKEN: 'your-dev-token-here',      // 开发环境 Coze API Token
      WORKFLOW_ID: 'your-dev-workflow-id' // 开发环境工作流 ID
    }
  },
  
  // 生产环境配置
  prod: {
    coze: {
      API_URL: 'https://api.coze.cn/v1/workflow/stream_run',
      TOKEN: 'your-prod-token-here',      // 生产环境 Coze API Token
      WORKFLOW_ID: 'your-prod-workflow-id' // 生产环境工作流 ID
    }
  }
};
```

### 获取 Coze Token

1. 访问 [Coze 个人访问令牌页面](https://www.coze.cn/open/oauth/pats)
2. 点击「创建令牌」
3. 设置令牌名称（如：`bp-xiaozhu-dev`）
4. 选择合适的权限范围
5. 设置过期时间
6. 复制生成的 Token 到配置文件中

### 3. 环境自动切换

系统会根据小程序运行环境自动选择配置：

- **开发版/体验版**：使用 `dev` 配置
- **正式版**：使用 `prod` 配置

环境检测代码：
```javascript
const isDev = wx.getAccountInfoSync().miniProgram.envVersion === 'develop' || 
              wx.getAccountInfoSync().miniProgram.envVersion === 'trial';
```

## 安全注意事项

### ⚠️ 重要提醒

1. **永远不要将 `config.env.js` 提交到版本控制系统**
   - 该文件已添加到 `.gitignore`
   - 提交前请确认文件未被跟踪

2. **定期更新 Token**
   - 建议定期更换 API Token
   - 开发和生产环境使用不同的 Token

3. **权限最小化**
   - 为 Token 设置最小必要权限
   - 使用 IP 白名单等额外安全措施

## 其他配置方案

### 方案二：云函数环境变量

将敏感信息存储在云函数中，前端通过云函数间接调用：

```javascript
// cloudfunctions/getConfig/index.js
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  
  // 验证用户权限
  if (!isAuthorized(OPENID)) {
    return { error: 'Unauthorized' };
  }
  
  return {
    coze: {
      API_URL: process.env.COZE_API_URL,
      TOKEN: process.env.COZE_TOKEN,
      WORKFLOW_ID: process.env.COZE_WORKFLOW_ID
    }
  };
};
```

### 方案三：小程序云开发数据库配置

将配置存储在云数据库的特定集合中：

```javascript
// 初始化时从数据库读取配置
const db = wx.cloud.database();
const config = await db.collection('config').doc('app-config').get();
```

### 方案四：构建时注入（CI/CD）

使用 miniprogram-ci 在构建时注入环境变量：

```javascript
// build.js
const ci = require('miniprogram-ci');

const project = new ci.Project({
  appid: 'your-appid',
  type: 'miniProgram',
  projectPath: './dist',
  privateKeyPath: './private.key',
  ignores: ['node_modules/**/*'],
});

// 构建前替换配置
replaceConfig({
  TOKEN: process.env.COZE_TOKEN,
  WORKFLOW_ID: process.env.COZE_WORKFLOW_ID
});

// 上传代码
await ci.upload({
  project,
  version: '1.0.0',
  desc: 'production release',
  setting: {
    es6: true,
  },
});
```

## 故障排查

### 配置未生效？

1. 检查 `config.env.js` 文件是否存在
2. 查看控制台日志确认配置加载状态
3. 确认环境判断是否正确（开发/生产）

### Token 无效？

1. 确认 Token 格式正确
2. 检查 Token 是否过期
3. 验证 API 权限设置

## 最佳实践

1. **开发环境**：使用专门的开发 Token，限制权限范围
2. **生产环境**：使用独立的生产 Token，启用 IP 白名单
3. **Token 轮换**：建立 Token 定期更换机制
4. **监控告警**：设置异常调用监控和告警

## 参考资源

- [微信小程序安全指南](https://developers.weixin.qq.com/miniprogram/dev/framework/security/)
- [Coze API 文档](https://www.coze.cn/docs/developer_guides/api_overview)