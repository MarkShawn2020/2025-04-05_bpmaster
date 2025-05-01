  小游戏 
介绍
开发
设计
运营
数据
社区
学堂


指南
框架
API
服务端
工具
云服务 · 云开发
云测试
介绍
快速开始
基础概念
开发指引
运维
云模板中心
计费相关
开发者资源
HTTP API 文档
云函数
触发云函数
数据库
存储
其他
SDK 文档
参考信息
开发者资源 /HTTP API 文档 /云函数 /触发云函数
invokeCloudFunction
本接口应在服务器端调用，详细说明参见服务端API。

触发云函数。注意：HTTP API 途径触发云函数不包含用户信息。


请求地址
POST https://api.weixin.qq.com/tcb/invokecloudfunction?access_token=ACCESS_TOKEN&env=ENV&name=FUNCTION_NAME
请求参数
属性	类型	默认值	必填	说明
access_token / cloudbase_access_token	string		是	接口调用凭证
env	string		是	云开发环境ID
name	string		是	云函数名称
POSTBODY	string		是	云函数的传入参数，具体结构由开发者定义。
返回值
Object
返回的 JSON 数据包

属性	类型	说明
errcode	number	错误码
errmsg	string	错误信息
resp_data	string	云函数返回的buffer
errcode 的合法值

值	说明	最低版本
0	请求成功	
-1	系统错误	
-1000	系统错误	
40014	AccessToken 不合法	
40101	缺少必填参数	
41001	缺少AccessToken	
42001	AccessToken过期	
43002	HTTP METHOD 错误	
44002	POST BODY 为空	
85088	该APP未开通云开发	
其他错误码	云开发错误码	
示例代码
curl -d '{}' \
'https://api.weixin.qq.com/tcb/invokecloudfunction?access_token=ACCESS_TOKEN&env=ENV&name=login'
返回数据示例
{
    "errcode": 0,
    "errmsg": "ok",
    "resp_data": "{\"event\":{\"userInfo\":{\"appId\":\"SAMPLE_APPID\"}},\"appid\":\"SAMPLE_APPID\"}"
}
Tips
使用本API触发云函数，在云函数中无法获取OpenID等用户相关信息，无法使用涉及用户登录态的其他API。
注意 POST BODY 部分会传递给云函数作为输入参数。
由 HTTP API 触发的云函数可以使用云调用。
由 HTTP API 触发云函数的超时时间为5s，请注意云函数的执行时间不能过长。

关于腾讯 文档中心 辟谣中心 客服中心
Copyright © 2012-2025 Tencent. All Rights Reserved.

