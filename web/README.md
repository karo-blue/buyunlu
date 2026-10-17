# 步云录网页即用版

## 直接使用

从 GitHub Releases 下载 `buyunlu-web.zip`，解压后用 Chrome / Edge 打开 `index.html`。下载整个仓库时，入口为 `docs/index.html`。全部网页资源已附带，首次打开不需要下载依赖、编译、登录或使用微信开发者工具。

iPhone / iPad 请用 Safari 打开 https://karo-blue.github.io/buyunlu/ 或自己的部署网址。请勿把下载 ZIP、在“文件”App 中预览 HTML、或安装 APK 当作 iOS 的运行方式。

网页已经移除启动阶段对 String.replaceAll 的依赖。iOS / Safari 真机仍需结合具体系统版本验证，手机浏览器建议使用部署后的网址打开。

## 安装到 iPhone / iPad 主屏幕

1. 用 Safari 打开 https://karo-blue.github.io/buyunlu/ ，首次保持联网并等待游戏及离线资源加载完成。
2. 点 Safari 的“分享”，选择“添加到主屏幕”。如果出现“作为 Web App 打开”选项，请保持开启。
3. 点“添加”，以后从主屏幕的“步云录”图标启动。

本版提供独立窗口、专用图标和离线缓存；缓存完成后可离线启动和游玩。存档仍保存在本机，不提供跨设备同步；主屏幕应用与浏览器的存储行为以设备系统为准。清除网站数据或系统清理缓存后，需要重新联网缓存资源。

这是可安装到主屏幕的网页应用，不是 IPA、TestFlight 或 App Store 安装包。尚未完成 iPhone 真机安装验证。

## 部署到网站

将 `docs/` 里的全部文件（或网页部署包内全部文件）放进静态网站目录，首页使用 `index.html`。不要只上传单独的 HTML，也不要把小程序的 `app.js` 当作网页入口。资源使用相对路径，根目录与子路径都能部署。

### GitHub Pages

在自己的仓库中打开 Settings → Pages，选择 Deploy from a branch，分支 main，目录 /docs，然后保存。等待 GitHub 构建成功，再使用设置页面给出的地址。Fork 后无需修改网页中的资源路径。

### Node.js

需要 Node.js 22 或更新版本；不需要 `npm install`：

```sh
npm start
```

默认 `0.0.0.0:8080`，首页 `http://localhost:8080`。可通过 `HOST` 和 `PORT` 调整监听地址、端口；公开部署时由自己的 HTTPS 反向代理提供域名访问。启动入口仅提供静态文件，不创建玩家账号或数据库。

## 功能与存档

保留季度事件、晋升、年度结算、家庭、健康、资产、结局、自动存档、三槽手动存档及本机榜单。关闭或刷新页面后恢复进度与待处理事件。存档只保存在当前浏览器，切换设备、域名或浏览器不会自动迁移；清除网站数据会删除存档。

本版本不连接原游戏服务，没有真实广告、付款或微信分享要求。免广告卡可免费领取，晋升奖励也可免费领取；这些只改变本机游戏数值。

## 维护

`build.js` 从本仓库 `game/`、`pages/` 生成 `docs/`；`runtime.js` 提供页面渲染和本机存储，`offline.js` 定义网页专属交互，`mobile.css` 负责屏幕适配，`pwa.js` / `sw.js` 负责主屏幕应用注册与离线资源，`icons/` 为图标源文件。构建过程中强制清空服务配置，游戏页面内容安全策略禁止业务联网请求；离线工作线程仅缓存本应用目录中的静态资源，不缓存其他网站或用户接口。

```sh
npm run build:web
npm run test:web
npm test
```

`docs/` 是生成结果，请修改原始文件后重新构建。发布包必须附带 LICENSE；网页版同样仅限非商业使用，不授权商业化使用。
