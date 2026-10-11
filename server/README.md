# 步云录服务端

零第三方依赖的 Node.js 服务，同时提供两件事：

1. 全网结局排行榜，数据落在 `data/leaderboard.json`，榜上只有真实提交的记录（旧版数据文件里的随机样本会在启动时被自动清掉）。
2. 小程序虚拟支付（免广告卡）的服务端记账与发货，数据落在 `data/virtual-pay.json`。

## 接口

排行榜：

- `GET /api/health`
- `GET /api/leaderboard?limit=20&clientId=...`
- `GET /api/tigerboard?limit=20&clientId=...`　老虎榜，只展示落马记录，按查处财产金额排序
- `POST /api/leaderboard/submit`
- `POST /api/tigerboard/submit`　兼容独立资产榜提交（与结局提交共用同一用户记录）

提交字段包括 `clientId`、`name`、`rankIndex`、`rankYears`、`achievements`、`review`、`integrity`、`age`、`position`、`assetValue`、`confiscatedValue` 和 `fell`。服务端会限制数值范围，并按同一 `clientId` 分别保留更好的履历成绩和更高的查处金额。

关于 `fell`（落马标记）：

- `fell: true` 时服务端**强制归零** `rankIndex` / `rankYears` / `achievements` / `review` / `integrity`，
  并把 `position` 兜底成「落马被查」。客户端已经归零过一次，这里是第二道 —— 不信任客户端。
- `fell` 的提交**可以覆盖同 `clientId` 的旧成绩**，这是"只保留更好成绩"的唯一例外。
  没有这个例外，落马前的高分会把归零后的提交挡在门外，榜上就会一直挂着一个已经被带走的人的名次。
- 榜面返回里带 `fell` 字段，客户端据此标注。

客户端提交的状态仍然属于“客户端声明”，不能抵御恶意修改；若要做强防作弊，需要把结算逻辑迁移到服务端或增加服务端可验证的回放/签名机制。

虚拟支付（未配置时全部返回 503，小程序端自动隐藏入口）：

- `GET  /api/pay/status`　支付是否可用、道具价格与份内张数
- `POST /api/pay/login`　`{code}` → `{token, openid}`
- `POST /api/pay/order`　需 `x-session-token`，返回可直接喂给 `wx.requestVirtualPayment` 的 `payData`
- `GET  /api/pay/balance`　需 `x-session-token`，返回余额
- `POST /api/pay/consume`　需 `x-session-token`，`{scene}`，扣 1 张卡
- `GET  /api/pay/notify`　微信后台保存回调地址时的签名验证
- `POST /api/pay/notify`　微信消息推送回调（发货 / 退款），必须返回 XML
- `POST /api/pay/sweep`　需 `x-pay-admin-token`，兜底查单补发

## 虚拟支付接入步骤

### 1. 开通与建道具

前提（缺一不可）：**个人主体** + 服务类目含「**工具**」+ 已完成认证和 ICP 备案。

在微信公众平台后台开通虚拟支付，记下 **OfferID** 和 **AppKey**；在【道具管理】里新建一个道具：

| 项 | 值 |
| --- | --- |
| 道具 ID | 自定义，例如 `adcard10`（填到 `WX_XPAY_PRODUCT_ID`） |
| 价格 | 100 分，即 1 元（必须与 `WX_XPAY_GOODS_PRICE` 完全一致） |
| 发放 | 一次给 10 张卡（与 `WX_XPAY_CARDS_PER_UNIT` 一致） |

### 2. 填环境变量

服务器上是 `/etc/buyunlu/pay.env`（部署脚本会生成模板，权限 0600），本地调试直接导出同名变量即可：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `WX_APPID` | 是 | 小程序 AppID |
| `WX_APPSECRET` | 是 | 小程序密钥，用于 `code2Session` 和 `access_token` |
| `WX_XPAY_OFFER_ID` | 是 | 虚拟支付 OfferID |
| `WX_XPAY_APP_KEY` | 是 | 现网 AppKey（**密钥，绝不能下发到小程序端**） |
| `WX_XPAY_PRODUCT_ID` | 是 | 后台道具 ID |
| `WX_MESSAGE_TOKEN` | 是 | 后台消息推送 Token；由配置脚本生成，用于 URL 与回调签名校验 |
| `WX_XPAY_GOODS_PRICE` | 否 | 道具单价，单位**分**，默认 100 |
| `WX_XPAY_CARDS_PER_UNIT` | 否 | 一份道具发几张卡，默认 10 |
| `WX_XPAY_ENV` | 否 | `0` 现网（默认）/ `1` 沙箱 |
| `WX_XPAY_SANDBOX_APP_KEY` | 沙箱必填 | `WX_XPAY_ENV=1` 时必须提供 |
| `WX_PAY_DATA_FILE` | 否 | 数据文件路径，默认 `server/data/virtual-pay.json` |
| `WX_SESSION_SECRET` | 否 | 会话 token 的签名密钥，不填则用 AppSecret 派生 |
| `WX_PAY_ADMIN_TOKEN` | 否 | `/api/pay/sweep` 的管理口令；不填则该接口永久 403 |

**设计约定：缺任何一项必填就整块关闭**（`/api/pay/status` 仍返回 `enabled: false`，其余支付接口 503）。这样可以先上线游戏、后补支付配置，中途不会出现「支付一半能用」的怪状态。

### 3. 配置消息推送

小程序后台 → 开发管理 → 消息推送 → 启用，URL 填：

```
https://example.invalid/buyunlu-api/pay/notify
```

必须用 **HTTPS**，且该地址要返回 XML（本服务已处理）。平台推两类事件：

- Token 填 `configure-payment.bat` 成功后输出的 `Message push Token`
- 消息格式选 **XML**，数据格式选 **明文模式**（当前服务不接收 AES 密文）
- 后台保存 URL 时的 GET 验证与实际 POST 推送都会校验签名，Token 必须完全一致

- `xpay_goods_deliver_notify`　发货推送，取 `WeChatPayInfo.MchOrderNo` 作为幂等键
- `xpay_refund_notify`　退款推送，反向扣回卡

**发货推送可能丢**（平台最多重试 15 次后放弃），所以服务端每 5 分钟自动跑一次兜底查单补发；也可以手动触发：

```bash
curl -X POST https://example.invalid/buyunlu-api/pay/sweep \
  -H "x-pay-admin-token: $WX_PAY_ADMIN_TOKEN"
```

### 4. 关键实现约定（改代码前先读）

- **发卡只以服务端查单结果为准。** 推送体本身的签名口径没有在公开文档里固定下来，所以收到推送后一律回查 `query_order` 确认支付成功才发货。伪造推送拿不到卡。
- **幂等键是 `wx_order_id`**，重复推送不会重复发卡。
- **前端 success 回调不是发货依据**，它只代表支付完成；卡是随后端推送异步到账的。
- **两把签名算法不同，不要混用**：`paySig = HMAC-SHA256(AppKey, uri + "&" + postBody)`，`signature = HMAC-SHA256(sessionKey, postBody)`。`postBody` 必须与实际发出的字符串逐字节一致。
- **`sessionKey` 只留在服务端。** 小程序端拿到的是一个不透明随机 token，换不到 openid 也换不到 sessionKey。
- **余额只在服务端记账。** 存本地的话改存档就能白嫖。
- `query_order` 的 uri 口径在官方资料里有带不带前导斜杠两种说法，报签名错时服务端会自动换另一种重试一次。
- 退款推送的字段名口径不统一，所以金额→份数这条推导为主，同时把原始报文追加到 `data/notify-raw.log`，**第一笔真实退款到账后照着这个日志校准字段名**。

### 5. 上线首单验证清单

配置完先走一遍真机小额验证，别等用户发现：

1. `curl https://example.invalid/buyunlu-api/pay/status` → `enabled` 为 `true`，`goodsPrice` 与后台一致。
2. 真机（**Android 和 iOS 各一台**）点购买，确认能拉起收银台。
3. 付款后回小程序，余额应在数秒内从 0 变 10；`data/virtual-pay.json` 里该订单 `status` 为 `delivered`。
4. 再看 `data/notify-raw.log`，确认收到了 `deliver` 事件，且 `wx_order_id` 与订单一致。
5. 发起一笔退款（后台可操作），确认余额被扣回、订单 `status` 变 `refunded`，并**记下 `notify-raw.log` 里退款报文的真实字段名**，回填 `handleRefundNotify` 的候选名列表。
6. iOS 端注意：需微信客户端 ≥ 8.0.68 且已配置小程序简称；iOS 走 Apple IAP，佣金 12%，结算约 45-60 天，Android 侧费率 1%（T+3）。

## 本地调试

```bash
# 只跑服务端逻辑测试（用注入的假 fetch，不打真实微信接口）
npm test
```

真实支付链路无法在本地自动验证，必须走上面的真机清单。
