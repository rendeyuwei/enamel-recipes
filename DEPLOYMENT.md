# 把家常菜本挂到 rende.fun/recipes

应用只监听 `127.0.0.1:3030`。Nginx 把 `https://rende.fun/recipes` 反代过来。图片也从这台进程读出，再由外面的 CDN 按响应头缓存。

## 1. 准备目录和账号

在 ECS 上安装 Node.js 22。给应用单独的系统用户，代码放在 `/opt/caiben`。

```bash
sudo useradd --system --create-home --home-dir /opt/caiben caiben
sudo chown caiben:caiben /opt/caiben
```

把仓库同步到 `/opt/caiben` 之后，用 `caiben` 用户安装依赖并构建。`better-sqlite3` 需要编译环境，系统里要有 `python3`、`make` 和 `g++`。

```bash
cd /opt/caiben
npm ci
npm run build
```

## 2. 写生产环境变量

复制 `.env.example` 为 `/opt/caiben/.env`，然后改这几项。

- `ADMIN_PASSWORD_HASH` 用 `npm run hash-password -- '你的密码'` 重新生成。不要沿用示例哈希。
- `SESSION_SECRET` 换成至少 16 位的随机字符串。
- `COOKIE_SECURE=1`。站点走 HTTPS，cookie 才带 `Secure`。
- `TRUST_PROXY=1`。否则登录限流看到的全是 Nginx 的地址。
- `SEED_DEMO=0`，或者删掉这一行。
- 要用阿里云 OSS 时，五项都填。`S3_ENDPOINT`、`S3_REGION`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`、`S3_BUCKET`。少一项进程不会启动。`S3_ENDPOINT` 填区域域名，不要带 Bucket，例如 `https://oss-cn-hangzhou.aliyuncs.com`。同地域的 ECS 可以用内网域名，例如 `https://oss-cn-hangzhou-internal.aliyuncs.com`。可选的 `S3_PREFIX` 不要以 `/` 或 `\` 开头，已有对象之后不要再改。

`COOKIE_SECURE=0` 只留给本机的 http。

## 3. systemd

单元文件是 `deploy/caiben.service`。

```bash
sudo cp deploy/caiben.service /etc/systemd/system/caiben.service
sudo systemctl daemon-reload
sudo systemctl enable --now caiben
sudo systemctl status caiben
```

进程异常退出后会自己拉起。日志在 `journalctl -u caiben -f`。

确认本机接口：

```bash
curl -sS http://127.0.0.1:3030/recipes/api/health
```

应返回 `{"ok":true}`。

## 4. Nginx

在 `rende.fun` 现有的 `server` 里加入 `deploy/nginx-recipes.conf` 的内容。`proxy_pass` 后面不要加路径，否则 `/recipes` 会被剥掉。`client_max_body_size 3m` 略大于单张 2MB 的限制，超限时仍由应用返回中文 JSON，而不是 Nginx 的 HTML 错误页。

```bash
sudo nginx -t && sudo systemctl reload nginx
```

然后打开 `https://rende.fun/recipes`。

## 5. 从 GitHub Actions 发到 ECS

`.github/workflows/deploy.yml` 在推送到 `main` 时运行，也可以在 Actions 页面手动触发（`workflow_dispatch`）。同一次部署不会并行：并发组是 `enamel-recipes-deploy`，`cancel-in-progress` 为 false，后一次会等前一次结束。

`test` 先跑 `npm ci`、`npm test`、`npm run typecheck`、`npm run lint`、`npm run build`。`deploy` 依赖 `test`。通过之后，runner 只向主机发送这一条命令：

```bash
deploy <40位 commit sha>
```

也就是 `deploy $GITHUB_SHA`。现网账号是 `caiben-deploy`，登录后的强制命令是 `receive-deploy.sh`。这条通道不接受 rsync，也不接受其它远程 shell。工作流不会同步文件，也不会在服务器上执行 `npm` 或 `systemctl`。

仓库里要有四个 secret。不要把私钥或主机公钥写进仓库。

| Secret | 内容 |
|---|---|
| `ECS_HOST` | ECS 的主机名或 IP |
| `ECS_USER` | 部署账号。现网是 `caiben-deploy` |
| `ECS_SSH_KEY` | 这个用户的私钥 |
| `ECS_KNOWN_HOSTS` | 你在自己的机器上核对过指纹之后，`ssh-keyscan -H <主机>` 的输出 |

工作流把 `ECS_KNOWN_HOSTS` 写成 `known_hosts`，用 `-i` 私钥和 `StrictHostKeyChecking=yes` 连接。主机密钥对不上就停止，不会在第一次连接时自动信任。

SSH 成功之后，工作流请求 `https://rende.fun/recipes/api/health`，响应正文必须是 `{"ok":true}`。

数据库文件在 `DATA_DIR/caiben.sqlite`。要备份时停写或直接复制这个文件和 WAL。OSS 上的对象随菜谱删除。还没保存进菜谱的上传，超过 24 小时会在下次启动时清掉。
