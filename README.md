# BP小诸葛

基于微信小程序的BP(商业计划书)智能评估系统。

## 功能特点

- 上传BP文件（支持PDF、DOC、DOCX等格式）
- 智能分析BP内容和结构
- 生成标准化结构化评估数据
- 提供详细的评估报告及建议
- 支持历史记录查看和比较

## 项目结构

```
├── app.js               # 小程序入口文件
├── app.json             # 小程序全局配置 
├── app.wxss             # 小程序全局样式
├── project.config.json  # 项目配置文件
├── components/          # 自定义组件
├── pages/               # 页面文件
├── services/            # 服务接口
├── utils/               # 工具函数
└── cloudfunctions/      # 云函数目录
    ├── login/           # 用户登录
    ├── validateToken/   # 验证用户Token
    ├── saveBPFile/      # 保存BP文件信息
    ├── analyzeBP/       # 分析BP文件
    ├── getBPList/       # 获取BP文件列表
    ├── getBPDetail/     # 获取BP文件详情
    ├── deleteBP/        # 删除BP文件
    ├── generateReport/  # 生成分析报告
    ├── getReportList/   # 获取报告列表
    ├── getReportDetail/ # 获取报告详情
    └── getReportFileID/ # 获取报告文件ID
```

## 开发环境

- 微信开发者工具
- Node.js
- 微信云开发

## 云开发配置步骤

1. 在微信开发者工具中创建新项目，选择云开发模板
2. 按以下步骤配置云开发环境:
   - 创建/选择云开发环境
   - 在`app.js`中初始化云开发环境:
   ```js
   wx.cloud.init({
     env: wx.cloud.DYNAMIC_CURRENT_ENV, // 使用当前环境配置
     traceUser: true
   });
   ```
   - 在`project.config.json`中配置云函数根目录:
   ```json
   {
     "cloudfunctionRoot": "cloudfunctions/"
   }
   ```

3. 创建数据库集合:
   - 在云开发控制台中选择"数据库"
   - 创建以下集合:
     - `users` - 存储用户信息
     - `bp_files` - 存储BP文件信息
     - `reports` - 存储报告信息
   - 设置合适的权限(建议"仅创建者可读写")

4. 部署云函数:
   - 右键点击`cloudfunctions`目录下的每个云函数
   - 选择"上传并部署: 云端安装依赖"

## 常见问题及解决方案

### 云函数调用错误

**问题**: 环境ID错误
```
Error: errCode: -501000 | errMsg: [100003] Param Invalid: env check invalid be filterd
```

**解决方案**: 
修改`app.js`中的云环境配置，使用`DYNAMIC_CURRENT_ENV`:
```js
wx.cloud.init({
  env: wx.cloud.DYNAMIC_CURRENT_ENV,
  traceUser: true
});
```

### 数据库集合不存在

**问题**: 数据库集合未创建
```
fail -502005 database collection not exists. [ResourceNotFound] Db or Table not exist
```

**解决方案**:
在云开发控制台中创建必要的数据库集合:
1. 打开微信开发者工具的云开发控制台
2. 选择"数据库" → "集合管理"
3. 点击"新建集合"，创建`users`、`bp_files`和`reports`集合
4. 设置适当的读写权限

### Cannot create field 'analysisDate' in element {analysisResults: null}

**问题**: 数据库字段初始化错误
```
document.update:fail -502001 database request fail. [FailedOperation] multiple write errors: [{write errors: [{Cannot create field 'analysisDate' in element {analysisResults: null}}]}, {<nil>}]
```

**解决方案**:

1. **预防措施**: 确保初始化记录时将`analysisResults`设置为空对象而非`null`

```js
// 错误写法 - 初始化为null
await bpFilesCollection.add({
  data: {
    // ...其他字段
    analysisResults: null  // 错误！
  }
});

// 正确写法 - 初始化为空对象
await bpFilesCollection.add({
  data: {
    // ...其他字段
    analysisResults: {}  // 正确！
  }
});
```

2. **修复已有数据**: 使用`fixAnalysisResults`云函数修复已存在的问题记录

   - 部署`fixAnalysisResults`云函数
   - 在云函数控制台手动触发该函数，或在代码中调用:

```js
// 调用修复云函数
wx.cloud.callFunction({
  name: 'fixAnalysisResults',
  success: (res) => {
    console.log('修复结果', res.result);
  },
  fail: (err) => {
    console.error('修复失败', err);
  }
});
```

3. **正确的更新方式**: 在`analyzeBP`云函数中，一次性设置完整的`analysisResults`对象:

```js
// 错误写法 - 尝试在null对象中添加字段
await bpFilesCollection.doc(fileId).update({
  data: {
    'analysisResults.businessPlan': businessPlan // 错误！
  }
});

// 正确写法 - 一次性设置整个对象
await bpFilesCollection.doc(fileId).update({
  data: {
    analysisResults: completeAnalysisResults, // 整个对象
    analysisDate: db.serverDate() // 独立字段
  }
});
```

## 数据结构

BP分析结果的数据结构如下：

```json
{
  "projectInfo": {
    "projectName": "string", // 项目名称
    "companyName": "string", // 企业名称
    "companyCode": "string", // 统一社会信用代码
    "industryCategory": "string", // 行业分类
    "developmentStage": "string", // 发展阶段
    "projectManager": "string", // 项目负责人
    "contactPerson": "string", // 项目联系人
    "contactPhone": "string" // 联系电话
  },
  "businessPlan": {
    "projectSummary": "string", // 项目简介
    "productsAndServices": "string", // 产品与服务
    "industryAndMarket": "string", // 行业与市场
    "coreTechnology": "string", // 核心技术
    "businessModel": "string", // 商业模式
    "coreTeam": "string", // 核心团队
    "strategicPlanning": "string" // 战略规划
  },
  "patents": [
    {
      "patentNumber": "string", // 专利号
      "patentName": "string", // 专利名称
      "inventors": ["string"] // 发明人
    }
  ],
  "teamMembers": [
    {
      "name": "string", // 姓名
      "organization": "string", // 单位
      "position": "string", // 职务
      "education": "string", // 学历
      "experience": "string" // 履历
    }
  ],
  "financials": {
    "revenueProjections": [
      {
        "year": "number",
        "amount": "number"
      }
    ],
    "expenseProjections": [
      {
        "year": "number",
        "amount": "number"
      }
    ],
    "profitProjections": [
      {
        "year": "number",
        "amount": "number"
      }
    ]
  }
}
```

## 重要文档

项目相关的重要文档都存放在 `docs` 目录下：

- [微信小程序头像与昵称处理最佳实践](docs/wechat/头像昵称处理最佳实践.md) - 如何符合最新规范获取头像昵称
- 其他开发文档...