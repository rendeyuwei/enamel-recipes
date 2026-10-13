# 家常菜本 V1 计划

视觉以 `uploads/index.html` 和 DESIGN V3.2 为准。产品行为以 PRD 为准。两边冲突时，下面「取舍」里写了听谁的。

## 取舍

两套存储形状都够用。

- 拆表。`recipes`、`ingredients`、`steps`、`images` 四张表。查询直白，但一次保存要写四张表，食材和步骤并没有独立生命周期。
- 菜谱当一份文档。`recipes` 一行，食材和步骤放 JSON。图片单独一张表，因为图片要先上传、再挂到菜上、删除时还要删对象存储。

采用第二套。菜谱的读写是整份替换。图片是另一条生命周期，不塞进 JSON。

不采用「一个 JSON 文件一份菜」。用户指定了 SQLite，而且会话和图片行需要事务。

## 模块

```
shared/site.ts        SITE_NAME，默认「家常菜本」。徽章和罗马字副标只在这里再出现一次
shared/domain.ts      类型、食材行解析、校验、图片魔数、搜索、周界、步骤配图
server/src/env.ts     环境变量解析。缺项就拒绝启动
server/src/db.ts      SQLite 连接和建表
server/src/repo.ts    菜谱、图片行、会话
server/src/store.ts   ObjectStore。OSS（S3 接口）或本地磁盘
server/src/password.ts
server/src/limiter.ts 内存计数
server/src/cookies.ts
server/src/app.ts     Fastify 路由
server/src/index.ts   监听 127.0.0.1:PORT，默认 3030
server/src/seed.ts    SEED_DEMO=1 且库为空时写入示例菜
client/               Vite + React。base 为 /recipes/
```

一个 npm 包。Fastify 同时提供 JSON API、构建后的页面，以及 `/recipes/img/<key>`。开发时不单独起前端端口。

## 数据模型

```ts
type Ingredient = { name: string; amount: string };
type ImageRef = {
  key: string;
  filename: string;
  bytes: number;
  contentType: "image/jpeg" | "image/png" | "image/webp";
};
type RecipeRecord = {
  id: number;
  title: string;
  douyinUrl: string | null;
  ingredients: Ingredient[];
  steps: string[];
  images: ImageRef[];
  createdAt: string;
  updatedAt: string;
};
type RecipeWrite = {
  title: string;
  douyinUrl: string;
  ingredientLines: string[];
  stepLines: string[];
  imageKeys: string[];
};
```

SQLite：

- `recipes(id, title, douyin_url, ingredients, steps, created_at, updated_at)`
- `images(key, recipe_id, position, filename, bytes, content_type, created_at)`
- `sessions(id, expires_at)`

`images.recipe_id` 为空表示已上传但还没保存进菜谱。启动时删掉超过 24 小时的这类行和对应对象。

食材行按第一个空白切开。`番茄 2 个` 得到名称「番茄」、用量「2 个」。没有空白则用量为空。

步骤配图。第 i 张图跟在第 i 步下面。多出来的图都跟在最后一步。表单不另做「挂到哪一步」的控件，顺序就是对应关系。提示写在截图字段上。

封面。有图用第一张。没有图用菜名的第一个字，底色由码点在四种浅色里取一种。

搜索。空串匹配全部。否则匹配菜名、食材名、用量，大小写不敏感。列表数字「本周新增」按亚洲/上海的周一 00:00 起算，看 `created_at`。

## 对象存储

```ts
interface ObjectStore {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Buffer; contentType: string } | null>;
  delete(key: string): Promise<void>;
}
```

`S3_ENDPOINT`、`S3_REGION`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`、`S3_BUCKET` 五项齐全才用阿里云 OSS（S3 兼容接口）。缺任意一项则五项都必须缺，此时用 `DATA_DIR/objects`。只填了一部分就拒绝启动，避免以为在用 OSS 其实写了磁盘。客户端用虚拟托管，`forcePathStyle: false`。可选的 `S3_PREFIX` 在对象键通过文件名检查之后再加到前面。本地磁盘不加前缀。

对象键是 32 位十六进制加 `.jpg` / `.png` / `.webp`。类型看魔数，不看客户端声明的 MIME。单张最大 2MB，一道菜最多 8 张。删除菜谱时删除这些对象。凭证只留在服务器进程里。浏览器只见到 `/recipes/img/<key>`。

## HTTP

前缀全是 `/recipes`。写操作要会话。API 响应 `Cache-Control: no-store`。图片响应 `Cache-Control: public, max-age=31536000, immutable`。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/recipes/api/health` | `{ ok: true }` |
| GET | `/recipes/api/session` | `{ authenticated: boolean }` |
| POST | `/recipes/api/login` | `{ username, password }`。失败 401，正文不区分账号还是密码 |
| POST | `/recipes/api/logout` | 204，清 cookie |
| GET | `/recipes/api/recipes?q=` | `{ total, addedThisWeek, recipes: RecipeCard[] }` |
| GET | `/recipes/api/recipes/:id` | 菜谱。未知 id 为 404 |
| POST | `/recipes/api/recipes` | `RecipeWrite`，201 |
| PUT | `/recipes/api/recipes/:id` | 整份替换 |
| DELETE | `/recipes/api/recipes/:id` | 204，并删除对象 |
| POST | `/recipes/api/uploads` | `multipart` 字段名 `file`，返回 `ImageRef` |
| DELETE | `/recipes/api/uploads/:key` | 只删尚未挂到菜谱上的图 |
| GET | `/recipes/img/:key` | 图片字节 |
| GET | `/recipes`、`/recipes/*` | 单页应用。`/recipes/api` 和 `/recipes/img` 不走这里 |

`RecipeCard` 是 `{ id, title, ingredients, stepCount, coverKey, createdAt }`。

错误正文是 `{ error: string, fields?: { field, message }[] }`。

Cookie 名 `caiben_session`。`HttpOnly`、`SameSite=Lax`、`Path=/recipes`、14 天。`COOKIE_SECURE=0` 时不加 `Secure`，便于本机 http。未设置时默认加 `Secure`。

登录失败按 IP 计数，默认 15 分钟内 5 次失败后 429。成功一次就清零。已登录的 POST、PUT、DELETE 另有每 IP 每分钟 30 次的限制。登录请求不计入这 30 次。`TRUST_PROXY=1` 时才相信 `X-Forwarded-For`。

## 页面

React Router 的 `basename` 为 `/recipes`。

- `/` 列表。左侧「今天吃啥」和搜索，右侧盆卡片。已登录显示「＋ 新菜谱」，未登录显示「登录」。
- `/:id` 详情。桌面两栏，备料卡 `position: sticky; top: var(--rf-h, 0px)`。截图可点开放大。
- `/new`、`/:id/edit` 未登录送到 `/login?next=`。`next` 只接受站内路径。
- `/login` 登录。

粘性定位的 `top` 都写成 `var(--rf-h, 0px)`，给以后的全站顶栏留高度。

站名只从 `SITE_NAME` 读。改名改这一处，然后重新构建前端。

## 环境

`ADMIN_USER`、`ADMIN_PASSWORD_HASH`（`scrypt$<saltHex>$<hashHex>`）、`SESSION_SECRET`（至少 16 字符）必填。`PORT` 默认 3030。`DATA_DIR` 默认 `data`。`SEED_DEMO=1` 写入六道示例菜。

密码哈希用 `npm run hash-password`。

## 测试与构建

- `shared/domain.test.ts` 锁住解析、校验、魔数、周界、配图。
- `server/test/api.test.ts` 用 `app.inject` 锁住鉴权、限流、上传、删除连带对象、缓存头。
- `client/src/*.test.tsx` 锁住列表搜索、详情步骤、登录错误文案。

CI 跑 lint、test、build。`build` 是 Vite 构建加 `tsc --noEmit`。
