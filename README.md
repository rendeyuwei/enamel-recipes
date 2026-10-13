# 家常菜本

个人菜谱站。谁都可以看列表、按菜名或食材搜索、打开详情按步骤做。管理员登录之后才能新建、修改、删除，以及上传截图。

页面在 `/recipes`。本机地址是 [http://127.0.0.1:3030/recipes](http://127.0.0.1:3030/recipes)。

## 本地运行

需要 Node.js 22。

```bash
npm ci
cp .env.example .env
```

`.env.example` 里的 `ADMIN_PASSWORD_HASH` 和 `SESSION_SECRET` 是空的。填好再构建并启动。

```bash
npm run hash-password -- '你的密码'
npm run build
npm start
```

把哈希写进 `.env` 的 `ADMIN_PASSWORD_HASH`。`SESSION_SECRET` 至少 16 个字符。`npm start` 监听 `127.0.0.1` 上的 `PORT`，默认 3030。

生产环境保持 `COOKIE_SECURE` 不设置，cookie 会带 `Secure`。本机 http 要在 `.env` 里写 `COOKIE_SECURE=0`，否则浏览器不保存登录 cookie。

`SEED_DEMO` 在生产环境不要设置。只有本机想看示例菜时写成 `SEED_DEMO=1`，并且数据库是空的。

## 本地试用

这一节的账号只给本机试用。不要用到生产环境。

账号 `rende`，密码 `caiben-dev-only`。

```bash
npm run hash-password -- 'caiben-dev-only'
```

把输出贴到本机 `.env` 的 `ADMIN_PASSWORD_HASH`。`SESSION_SECRET` 自己生成一串至少 16 位的随机字符。不要把这组值写回 `.env.example`，也不要部署到 rende.fun。

## 检查

```bash
npm test
npm run lint
npm run build
```

`npm run build` 会构建前端，并做服务端和前端的类型检查。

## 配置

环境变量见 `.env.example`。

站名只有 `shared/site.ts` 里的 `SITE_NAME`，默认「家常菜本」。改完要重新 `npm run build`，浏览器里的标题和页头才会变。

`R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET` 四项都有值时，截图上传到 Cloudflare R2。少一项，进程直接退出。四项都空着时，文件写在 `DATA_DIR/objects`。访问图片一律走 `/recipes/img/<key>`，R2 的访问密钥不会发到浏览器。

已登录之后的新建、修改、删除和上传，每个 IP 每分钟最多 30 次。登录失败另有自己的次数限制，不占用这 30 次。

部署到 `rende.fun` 的步骤在 [DEPLOYMENT.md](DEPLOYMENT.md)。
