# 步云录个人主体虚拟支付部署前检查清单

核对依据：[微信官方“虚拟支付：个人”接入指引](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment/person)。勾选规则：只有后台截图、线上接口或真机实付能够证明的项目才可勾选；本地单测不能替代平台验收。

## 官方清单逐项状态

| # | 检查项 | 当前状态 | 验收证据 |
|---|---|---|---|
| 1 | 个人主体、中国大陆身份证、服务类目含“工具”、已认证并备案 | 待后台确认 | 公众平台的主体信息、服务类目、认证与备案页面 |
| 2 | 已向用户说明个人主体每月累计支付金额上限为 100,000 元 | 代码已完成，待真机确认 | 免广告卡购买说明弹窗 |
| 3 | 已在公众平台开通虚拟支付 | 待后台确认 | “支付与交易 → 虚拟支付”显示已开通 |
| 4 | 已取得 AppID、OfferID、生产 AppKey | 部分完成 | AppID 已写入项目；OfferID/AppKey 必须在部署时私密填写 |
| 5 | 如支持 iOS，已配置小程序简称 | 待后台确认 | 基础配置页简称与虚拟支付 Apple IAP 开关 |
| 6 | 消息推送接收服务已部署 | **未通过（2026-09-11）** | 当前线上 `/buyunlu-api/pay/status` 返回 404，须重新运行 `deploy-all.bat` |
| 7 | 回调 URL 已配置并通过测试支付 | 待部署后真机确认 | `https://example.invalid/buyunlu-api/pay/notify` 保存成功，首单收到 XML 推送 |
| 8 | 服务端签名与官方规则一致 | 代码已通过 | 自动测试覆盖 AppKey 的 `paySig` 与 sessionKey 的 `signature` |
| 9 | 发货按 `wx_order_id` 幂等 | 代码已通过 | 重复发货通知测试不会重复增加免广告卡 |
| 10 | `wx.requestVirtualPayment` 可支付且成功收到通知 | 待真机确认 | Android；如支持 iOS，再各做一笔小额实付 |
| 11 | `query_order` 补单就绪 | 代码已通过，待线上确认 | 服务端每 5 分钟扫描未完成订单；部署后核对日志 |
| 12 | 已告知退款、结算与费率 | 代码已完成，待真机确认 | 购买说明已展示 Android 技术服务费 1%、iOS 佣金 12%及退款渠道；后台结算仍按平台规则 |
| 13 | 小额实付完成“支付→推送→发货→后台账单”闭环 | 待真机确认 | 订单、通知日志、卡余额与公众平台账单四方一致 |

## 执行顺序

1. 在微信公众平台确认第 1、3、5 项，并创建、发布“免广告卡”道具。
2. 双击 `deploy-all.bat`，按提示输入 SSH 密码、AppSecret、OfferID、生产 AppKey、已发布的 Product ID、价格和卡数。密钥不要发到聊天或写进仓库。
3. 将脚本输出的 Token 填入消息推送，URL 使用 `https://example.invalid/buyunlu-api/pay/notify`，格式选 XML、明文。
4. 双击 `verify-payment-release.bat`。全部 `[PASS]` 仅表示代码与线上接口通过；`[MANUAL]` 项仍需人工验收。
5. 完成一笔真机小额支付并核账，再勾选第 7、10、13 项。

## 重要合规边界

- 本接入只售卖可直接使用的“免广告卡”道具，不创建代币、金币或可兑换余额。
- 个人主体生产支付固定使用 `env: 0`；AppKey、AppSecret、sessionKey 不进入小程序包。
- “步云录”是游戏化生涯模拟内容，是否能归入“工具”类目必须以微信平台审核结论为准，不能通过改文案规避类目要求。
