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
└── utils/               # 工具函数
```

## 开发环境

- 微信开发者工具
- Node.js

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