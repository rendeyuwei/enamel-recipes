# Jiachang Caiben

Personal recipe book. Anyone can browse the list, search by dish name or ingredient, and open a recipe to cook from the steps. Only an admin, after logging in, can create, edit, delete, and upload screenshots.

The app is served at `/recipes`. Locally that is [http://127.0.0.1:3030/recipes](http://127.0.0.1:3030/recipes). Production is [https://rende.fun/recipes](https://rende.fun/recipes).

## Run locally

Node.js 22.

```bash
npm ci
cp .env.example .env
```

`ADMIN_PASSWORD_HASH` and `SESSION_SECRET` in `.env.example` are empty. Fill them in before building and starting.

```bash
npm run hash-password -- 'your password'
npm run build
npm start
```

Put the hash in `ADMIN_PASSWORD_HASH`. `SESSION_SECRET` must be at least 16 characters. `npm start` listens on `127.0.0.1` and `PORT` (default 3030).

Leave `COOKIE_SECURE` unset in production so the cookie is `Secure`. For local http, set `COOKIE_SECURE=0` in `.env`, or the browser will not store the login cookie.

Do not set `SEED_DEMO` in production. Set `SEED_DEMO=1` only on a machine where you want sample dishes, and only when the database is empty.

## Local trial account

This account is for a local trial only. Do not use it in production.

User `rende`, password `caiben-dev-only`.

```bash
npm run hash-password -- 'caiben-dev-only'
```

Paste the output into the local `.env` as `ADMIN_PASSWORD_HASH`. Generate your own `SESSION_SECRET` of at least 16 random characters. Do not write these values back into `.env.example`, and do not deploy them to rende.fun.

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

`npm run build` builds the client and typechecks the server and the client.

## Configuration

Environment variables are listed in `.env.example`.

The site name lives only in `SITE_NAME` in `shared/site.ts`. The default is 家常菜本. The document title before JavaScript runs is that name plus 「 · 菜谱」 (with the default, 家常菜本 · 菜谱). The build writes it into `index.html` from `SITE_NAME`. Change `SITE_NAME`, then run `npm run build`, and both the browser title and the header update.

Screenshots go to Alibaba Cloud OSS through its S3-compatible API when all five of `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_BUCKET` are set. If only some of them are set, the process exits. If all five are empty, files are stored in `DATA_DIR/objects`. Optional `S3_PREFIX` is prepended to the object key; the browser still requests `/recipes/img/<key>`. Access keys are never sent to the browser. `S3_ENDPOINT` is the regional endpoint without the bucket name, for example `https://oss-cn-hangzhou.aliyuncs.com`. An ECS instance in the same region can use the internal endpoint, for example `https://oss-cn-hangzhou-internal.aliyuncs.com`. Do not start `S3_PREFIX` with `/` or `\`, and do not change it after objects exist.

Signed-in creates, updates, deletes, and uploads are limited to 30 requests per minute per IP. Failed logins have a separate limit and do not consume those 30.

## Deploy

Pushing to `main`, or running the workflow manually, checks the repo and then deploys that commit. Deploys do not overlap: a later run waits (`cancel-in-progress` is false).

The deploy job does not rsync and does not open a remote shell. It SSHes as `ECS_USER` (the live account is `caiben-deploy`) and runs only:

```bash
deploy <40-character git sha>
```

The account's forced command is `receive-deploy.sh`. After SSH succeeds, the workflow requests `https://rende.fun/recipes/api/health` and requires `{"ok":true}`.

Host setup (Nginx on `/recipes`, systemd, env, secrets) is in [DEPLOYMENT.md](DEPLOYMENT.md).

---

# 家常菜本

个人菜谱站。谁都可以看列表、按菜名或食材搜索、打开详情按步骤做。管理员登录之后才能新建、修改、删除，以及上传截图。

页面在 `/recipes`。本机地址是 [http://127.0.0.1:3030/recipes](http://127.0.0.1:3030/recipes)。线上是 [https://rende.fun/recipes](https://rende.fun/recipes)。

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
npm run typecheck
npm run lint
npm run build
```

`npm run build` 会构建前端，并做服务端和前端的类型检查。

## 配置

环境变量见 `.env.example`。

站名只有 `shared/site.ts` 里的 `SITE_NAME`，默认「家常菜本」。JavaScript 执行前的文档标题是站名加上「 · 菜谱」（默认就是「家常菜本 · 菜谱」）。构建时按 `SITE_NAME` 写进 `index.html`。改完要重新 `npm run build`，浏览器里的标题和页头才会变。

`S3_ENDPOINT`、`S3_REGION`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`、`S3_BUCKET` 五项都有值时，截图上传到阿里云 OSS（S3 兼容接口）。少一项，进程直接退出。五项都空着时，文件写在 `DATA_DIR/objects`。可选的 `S3_PREFIX` 会加在对象键前面，浏览器仍然只访问 `/recipes/img/<key>`。访问密钥不会发到浏览器。`S3_ENDPOINT` 填区域域名，不要带 Bucket，例如 `https://oss-cn-hangzhou.aliyuncs.com`。同地域的 ECS 可以用内网域名，例如 `https://oss-cn-hangzhou-internal.aliyuncs.com`。`S3_PREFIX` 不要以 `/` 或 `\` 开头，已有对象之后不要再改。

已登录之后的新建、修改、删除和上传，每个 IP 每分钟最多 30 次。登录失败另有自己的次数限制，不占用这 30 次。

## 部署

推到 `main`，或在 Actions 里手动触发，都会先检查仓库，再部署这次提交。部署不会并行，后一次会等前一次（`cancel-in-progress` 为 false）。

部署任务不用 rsync，也不打开远程 shell。它用 `ECS_USER`（现网账号是 `caiben-deploy`）SSH 上去，只执行：

```bash
deploy <40位 git sha>
```

该账号的强制命令是 `receive-deploy.sh`。SSH 成功后，工作流请求 `https://rende.fun/recipes/api/health`，响应必须是 `{"ok":true}`。

主机上的 Nginx（`/recipes`）、systemd、环境变量和 secret 见 [DEPLOYMENT.md](DEPLOYMENT.md)。
