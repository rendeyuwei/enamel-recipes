# 家常菜本公开界面双语

预览实现。不合并、不部署、不改生产、ESA、Nginx 或线上缓存。英文品牌是 Home Recipes。用户写入的菜名、食材、步骤、链接、图片和文件名原样保留，不自动翻译，不迁库。登录身份不变。

共享运行时仍是契约 `v` 2。内联的 `client/vendor/rf-lang.js` 仍是 `3effebca35bf58244e77657ead34de9f6afb4416ffdc3ba5a0bbcd4f2933c70d`，3755 字节，和 rende-site `fdaa701bbf2736ee2874cfe5456bd25d941145f6` 的 `lang.js` 逐字节相同。中文壳和英文壳的顶栏地址钉在 `/shell/topbar.4a304e017601ad56e80a5c39886c186fa462161ce585d093ae92c4cfc17edd7b.js`（9981 字节）。这份顶栏自己引用 `/shell/topbar.918f2c1a3eaa24581dfb11b360b323fa925b5a2548108b6ad5d8bd98ff3cc23b.css`（2807 字节）。页面地址不加版本，页面上也不显示版本。这个带哈希的地址还没当作已经发布；合并前由父端确认它返回 200 且校验和一致。同版本的后加载副本不会覆盖先装入的内联文件。接入看 `choose` 是否存在，并派发 `rf:locale`，不判断 `v === 1`，也不另升版本。

## 路径

中文入口保持 `/recipes`、`/recipes/`、`/recipes/new`、`/recipes/login`、`/recipes/12`、`/recipes/12/edit`。英文是 `/recipes/en`、`/recipes/en/`、`/recipes/en/new`、`/recipes/en/login`、`/recipes/en/12`、`/recipes/en/12/edit`。`en` 不是菜谱 id。`/recipes/english` 仍是中文路径。

`/recipes/api` 与 `/recipes/img/<key>` 不带语言前缀。会话 cookie 仍是 `Path=/recipes`、`HttpOnly`、`SameSite=Lax`。`COOKIE_SECURE` 的规则不变。

## 语言

页面语言只由路径决定，不读 cookie，不读 `Accept-Language`。`/recipes/en` 与 `/recipes/en/` 都是英文。显式 URL 优先。否则用手选的共享 `rf-lang`。否则取 `navigator.languages` 里第一个 `zh*` 或 `en*`；`zh-HK` / `zh-TW` 归简体。没有匹配则英文。只持久化手选。切到中文追加 `lang=zh`，切到英文去掉 `lang`，其余 query 与 hash 保留。中文首页的对外地址是 `/recipes/`，带上尾斜杠；公网对正好 `/recipes` 的 301 会丢掉 query。英文页不自动跳回中文。存储和 cookie 都被禁用时仍能切换，并且显式中文可以带到另一站。

这份决定在内联的 `client/vendor/rf-lang.js` 里。英文页上的菜单直接用 `siteHref`：`/easypic/en/`、`/shutter/en/`、`/recipes/en/`、`/en/`。中文页仍指向无 `en` 的入口。存储和 cookie 都不可用时也是这样，不先打开中文地址再跳一次。本站切换器看 `hreflang`，不看 `en` 标志。

同版本先装入的 `rfLang` 不会被后加载覆盖。中文壳内联带 `data-rf-enter` 的 `lang.js`，脚本因此调用 `enter()`，并在 `window.rfLang.leaving` 时跳过百度统计。英文壳保留同一段脚本，只去掉 `data-rf-enter`。`topbar.js` 在没有 `window.rfLang` 时直接返回，所以英文页必须先装上 `rfLang`；去掉属性后不会调用 `enter()`，英文页不会被送回中文。

## 路由

`BrowserRouter` 的 basename 是 `/recipes/`。`useLocation().pathname` 是去掉 basename 之后的路径，例如 `/en/12`。首页链接和切回中文首页因此写成 `/recipes/?…#…`，刷新不会碰到丢掉 query 的精确重定向。

`RecipeRoutes` 用 `parseRouter` 得到语言和去掉 `/en` 的 `bare`。`<Routes location={virtual}>` 只用 `bare` 做匹配，因此 `/en` 不会落到详情路由，语言切换也不会卸载页面。`Routes` 会把这份 location 传给子树，所以页面里的 `useLocation()` 看不到 `/en`。`LocaleProvider` 包在这对 `Routes` 外面，记下真实 pathname、search、hash 和语言。页面用 `useLocale()`。没有 provider 时才退回当前 location，现有单页测试仍是中文。

站内链接用 `routerPath` 加上语言前缀，再由 basename 变成 `/recipes/...`。普通左键在捕获阶段 `preventDefault` 后 `navigate(toRouterTarget(...))`，不改写 `place` 或 `href`。带修饰键的点击仍走真实 href。语言切换不卸载页面，未保存的菜名、食材、步骤和链接留在内存里。前进和后退走浏览器自己的历史，同样不重新取页面、不另存草稿。

这份 v2 顶栏在同一文档里听 `rf:locale` 和 `popstate`。手选切换只走一次路由提交，提交后再调用 `choose(nextLang)` 并派发 `rf:locale`。顶栏按当前地址重画按钮、菜单和焦点。后退和前进由顶栏自己刷新，不写偏好。入口有 `<meta name="rf-mount" content="/recipes/">`，顶栏脚本有 `data-tool="recipes"`。

本站不重插 `topbar.js`，不写 `__rfBar`，不替换 `rfLang` 的方法，也不改已有链接的 href。没有定时器。没有 `choose` 时仍然切换路由。

`scripts/shell-toggle-regression.mjs` 加载这次本地构建的带哈希顶栏，不是只跑内联的 `lang.js`。它检查至少四次切换、后退、前进和下一次打开 `/recipes/`。地址、页面语言、按钮、标题、hreflang、工具链接要一致，`rf-lang` 停在最后一次手选。未保存的菜名、食材、步骤、已上传图片和登录框留在内存，不整页刷新，不重复上传，也不写入本地存储。存储被禁用时仍能切到带 `lang=zh` 的地址。

## 文案与用户内容

界面句在 `shared/copy.ts` 的 `COPY.zh` / `COPY.en`。中文句子保持原样。英文界面不夹汉字；徽章「菜」保留 `lang="zh-CN" translate="no"`。用户菜名、食材、步骤、链接、文件名使用 `lang=""` 与 `translate="no"`，不把它们标成中文。编辑页的四个输入框也是这样，避免浏览器翻译改写后再保存。截图按钮和放大层同样不翻译文件名。详情还在加载时不把文档标题改成首页标题。网络没有返回 HTTP 错误时，仍用原来的「没有保存成功。」「图片没有传上去。」「没有删掉。」「菜谱没有加载出来。」「登录失败」，并跟着当前语言走。

`html lang`、title、description、canonical、hreflang（`zh-CN`、`en`、`x-default`）由路径决定。canonical 域是 `https://rende.fun`。中文首页 canonical 是 `/recipes/`，英文首页是 `/recipes/en/`。`x-default` 指向英文。详情标题是「原菜名 · 站名」；确认没有这道菜时用缺失标题。

## HTML 与缓存

`serveIndex` 按路径选 `dist/index.html` 或 `dist/en/index.html`，再按路由改标题和链接。语言不看请求头。详情标题来自当前库的原菜名。HTML 响应是 `cache-control: no-cache`。缺文件是 503，`no-store`；英文缺文件用英文句子。

`/recipes/en` 在磁盘上是目录。通配读文件遇到 `ENOENT` 或 `EISDIR` 才回到 `serveIndex`，避免 500。`/recipes/api` 仍是 `no-store`。`/recipes/assets` 与 `/recipes/img` 仍是 `public, max-age=31536000, immutable`。

构建：`client/vite.config.ts` 的 `bilingualShell` 把 `client/vendor/rf-lang.js` 内联进中文壳。脚本里不能有 `</script`、`<script` 或注释。`closeBundle` 写出 `dist/en/index.html`；若开标签仍带 `data-rf-enter`，或没有 `lang="en"`，构建失败。脚本正文里的 `data-rf-enter` 字符串要留下，那是 `lang.js` 自己的判断。

## 错误

稳定 code 与旧中文句子一起返回。`HttpError` 的 message 是 `zhError(code)`。校验数值和规则不变：菜名 60、食材和步骤各 40 行、单行 300、8 张图、2MB、http(s)。`FieldError` 增加 `code`。JSON 是 `{ error, code, fields? }`。413 是 `upload.too_large`，其它小于 500 且不是 `HttpError` 的是 `request.bad`，500 及以上是 `server.error`。

前端 `localizeError`：已知 code 用当前语言；英文遇到未知或技术性 message 用安全回退，不显示服务端中文；中文没有 code、且 message 不像技术细节时，可以显示旧句子。

## 未保存内容

同一 `FormPage` 实例在语言切换后保留。切换不重新拉取、不把未保存字段写入新的存储。需要登录时，`next` 使用真实 pathname，英文编辑页仍回到英文。直接打开 `/recipes/en/login` 且没有 `next` 时，登录成功后留在英文首页，不会掉回 `/recipes/`。

## 英文菜单

rende-site#7 把三个工具和主站的 `en` 设为 true，`v` 仍是 2。本仓库只复制那次构建的 `lang.js`。它还没合并，发布顺序由父端安排。在它成为线上 `/shell/lang.js` 之前，菜谱页靠这份内联副本决定菜单。相同版本不会被后加载的壳脚本盖掉。
