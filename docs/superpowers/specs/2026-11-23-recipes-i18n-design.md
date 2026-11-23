# 家常菜本公开界面双语

预览实现。不合并、不部署、不改生产、ESA、Nginx 或线上缓存。英文品牌是 Home Recipes。用户写入的菜名、食材、步骤、链接、图片和文件名原样保留，不自动翻译，不迁库。登录身份不变。

共享契约以未合并的 [rende-site#5](https://github.com/rendeyuwei/rende-site/pull/5) `64701ced2b3e495f8e5237148096a5a665e41c17` 为准。本仓库只内联那次构建的 `lang.js`，并在本地用同一份 `dist/shell` 做预览。不修改远程 main。

## 路径

中文入口保持 `/recipes`、`/recipes/`、`/recipes/new`、`/recipes/login`、`/recipes/12`、`/recipes/12/edit`。英文是 `/recipes/en`、`/recipes/en/`、`/recipes/en/new`、`/recipes/en/login`、`/recipes/en/12`、`/recipes/en/12/edit`。`en` 不是菜谱 id。`/recipes/english` 仍是中文路径。

`/recipes/api` 与 `/recipes/img/<key>` 不带语言前缀。会话 cookie 仍是 `Path=/recipes`、`HttpOnly`、`SameSite=Lax`。`COOKIE_SECURE` 的规则不变。

## 语言

页面语言只由路径决定，不读 cookie，不读 `Accept-Language`。`/recipes/en` 与 `/recipes/en/` 都是英文。显式 URL 优先。否则用手选的共享 `rf-lang`。否则取 `navigator.languages` 里第一个 `zh*` 或 `en*`；`zh-HK` / `zh-TW` 归简体。没有匹配则英文。只持久化手选。切到中文追加 `lang=zh`，切到英文去掉 `lang`，其余 query 与 hash 保留。英文页不自动跳回中文。存储和 cookie 都被禁用时仍能切换，并且显式中文可以带到另一站。

这份决定在内联的 `client/vendor/rf-lang.js` 里。当前登记表里 `recipes.en` 仍是 `false`。在改成 `true` 并重新发布 `/shell/lang.js` 之前，英文主页菜单仍指向 `/recipes/`。本站切换器看 `hreflang`，不看 `en` 标志，所以站内仍可进入 `/recipes/en/`。

同版本先装入的 `rfLang` 不会被后加载覆盖。中文壳内联带 `data-rf-enter` 的 `lang.js`，脚本因此调用 `enter()`，并在 `window.rfLang.leaving` 时跳过百度统计。英文壳保留同一段脚本，只去掉 `data-rf-enter`。`topbar.js` 在没有 `window.rfLang` 时直接返回，所以英文页必须先装上 `rfLang`；去掉属性后不会调用 `enter()`，英文页不会被送回中文。

## 路由

`BrowserRouter` 的 basename 固定为 `/recipes`。`useLocation().pathname` 是去掉 basename 之后的路径，例如 `/en/12`。

`RecipeRoutes` 用 `parseRouter` 得到语言和去掉 `/en` 的 `bare`。`<Routes location={virtual}>` 只用 `bare` 做匹配，因此 `/en` 不会落到详情路由，语言切换也不会卸载页面。`Routes` 会把这份 location 传给子树，所以页面里的 `useLocation()` 看不到 `/en`。`LocaleProvider` 包在这对 `Routes` 外面，记下真实 pathname、search、hash 和语言。页面用 `useLocale()`。没有 provider 时才退回当前 location，现有单页测试仍是中文。

站内链接用 `routerPath` 加上语言前缀，再由 basename 变成 `/recipes/...`。普通左键在捕获阶段 `preventDefault` 后 `navigate(toRouterTarget(...))`，不改写 `place` 或 `href`。带修饰键的点击仍走真实 href。语言切换不卸载页面，未保存的菜名、食材、步骤和链接留在内存里。前进和后退走浏览器自己的历史，同样不重新取页面、不另存草稿。

`64701ced` 的 `topbar.js` 只在第一次执行时绘制。`a.rf-lang` 的 href 只在 `hashchange` 时按当时的 `location` 重算。点击处理只调用 `choose()`，再按点击当下的地址写 href。没有 `popstate` 监听。同文档的 `pushState` 不改变顶栏的 `lang`、按钮文案、工具链接，也不改变它自己记下的切换地址。连续切换、后退、前进都一样。hash 没变时，`hashchange` 也不会帮它刷新。

本地预览量过这份顶栏，没有改 `rfLang`。从 `/recipes/en/` 进入后，按钮是「中文」，工具链接是 `/easypic/`、`/shutter/`、`/recipes/`、`/en/`。接着 `history.pushState` 到 `/recipes/?lang=zh`，再 push 回英文：页面自己的 `html lang` 不变，顶栏的 `lang`、文案、href 和工具链接也不变。此时重新调用 `rfLang.href` 已经指向新地址，画在页面上的链接仍是旧的。`history.back()` / `forward()` 会让本站路由更新页面语言，顶栏的 `lang`、文案和工具链接仍停在第一次。从英文编辑页连续点两次，再后退、前进，未保存菜名保持不变；按钮一直显示「中文」，而 href 被本站写成当前这一页的对向地址，于是文案和 href 会不一致。存储和 cookie 都禁用时仍能切换，并带上 `lang=zh`。重新调用 `siteHref("easypic")` 得到 `/easypic/?lang=zh`，顶栏里的链接仍是第一次画上的 `/easypic/`。

本站不定义 mount 或 refresh，不重插 `topbar.js`，不写 `__rfBar`，不替换 `rfLang`。React 提交之后，只把已经存在的 `a.rf-lang` 的 href 写成当前 `switchHref`，让右键和复制得到这一页的真实地址。这一处不刷新顶栏语言、站名或其它工具链接。因此第一次站内切换之后，按钮文案可能仍是「中文」，而 href 已经指向英文。这是已知缺口，不是另一套壳接口。

rende-site 会另有一个向后兼容的同文档刷新，以及可选的显式 mount。签名由那边定，到了再接。在签名到达之前，这里不调用任何新的壳方法。官方刷新若会重写这个 href，再删掉本地这一处写入。

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

## 以后启用英文主菜单

菜谱预览合并并部署、且 `/recipes/en/` 已验证之后，才在 rende-site 的 `lang.ts` 把 `recipes.en` 设为 `true`（`v` 仍是 1），发布 `/shell/lang.js` 和 `topbar.js`。同时把新的 `lang.js` 再复制进 `client/vendor/rf-lang.js` 并重新部署菜谱。内联副本版本相同，不会被后加载的壳脚本覆盖。在此之前不要依赖已经发布的新资源。不依赖 shutter-count#12 或 easy-ncp-pic#17 的生产发布。
