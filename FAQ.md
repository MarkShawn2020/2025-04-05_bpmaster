# FAQ

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
