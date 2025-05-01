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
    ……
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


## [FAQ](./FAQ.md)
