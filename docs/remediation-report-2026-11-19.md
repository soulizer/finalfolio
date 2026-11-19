# FinalFolio 全面修复与验收报告

- 日期：2026-11-19
- 分支：`fix/comprehensive-review`（同步推送至 `main`）
- 最终运行时代码：`371a847`（线上即此版本）；其后为文档与回归用例提交（`bba7216`、`2e1ec52`、`545623f`、`b22627e`、`93ce6a8`）
- 线上：<https://finalfolio.com/editor>，构建产物 `assets/index-CBprp_6Q.js`
- 结论：P0 全部关闭；`tsc --noEmit`、`vite build`、`validate:mvp`、34 个 Playwright 用例全部通过；GitHub Actions 在 `main` 与 `fix/comprehensive-review` 两个分支均为绿色。

## 0. P0 状态

| # | P0 问题 | 根因 | 状态 | 证据 |
| --- | --- | --- | --- | --- |
| 1 | 导出 PDF 与编辑预览不一致 | 导出按“截图画布当时尺寸”输出，与配置的 dpi 无关；装订几何从未校验 | 已修复 | `[evidence] pdf pages=6 sheet=841.89x1190.55pt raster=2105x2975px dpi=180.0/179.9`；`docs/evidence/export-preflight-*.png` |
| 2 | 分享链接与预览不一致 | 曾经的公开阅读器是另一套渲染路径 | 已修复（结构性一致） | 编辑器、账户、后台、公开阅读器共用同一个 `MagazinePreview`（`issueViewTurnJsMarkup.tsx:118`），页面数据与字体变量同源 |
| 3 | AI 排版 90 秒必失败 | 我们自己的非流式请求被 `Math.min(requestTimeoutMs, 90_000)` 截断（线上成功耗时 50–82 s） | 已修复 | 17/17 流式用例；见 §2.6 |
| 4 | 图库删除后照片“复活” | 删除只改本地状态，未落库；随后拉取列表把照片带回来 | 已修复 | `DELETE /api/assets/:assetId` 级联删除 + `deletedOwnedAssetIdsRef` 防复活；`validate:mvp` 断言接口 204 且资源从所有作品集移除 |
| 5 | 上传没有真实进度/失败重试 | 所有文件走服务端代理，前端只有一个假进度 | 已修复 | 直传对象存储（预签名 PUT）+ 逐文件进度/速度/失败/重试（`docs/uploads.md`） |
| 6 | 控件高度/边框/圆角在同类控件间漂移 | 16 处硬编码描边、每个上下文各自声明 42/46/32/30/50 px | 已修复 | 24/36/40 三档令牌 + 单一 `--field-border`；见 §2.5 |
| 7 | 中文界面残留英文 | 动态文案（配额、失败、限制）直接拼英文字符串 | 已修复 | 残留英文扫描 0；新增文案全部进 `src/i18n/zh.ts` |
| 8 | 面板折叠实现分裂 | 每个面板自带一套折叠逻辑 | 已修复 | `PanelCollapseToggle` + `initPanelCollapse()` 委托；全站共用 |
| 9 | AI 方案卡片信息无意义（“AI 02”） | 卡片只显示序号圆点 | 已修复 | 每张方案显示真实页面缩略图（18 个页面、33 个图位，36×51 px A4） |
| 10 | 后台 AI 面板输入中塌陷、控件不对齐、prompt 可随意改 | 对话框在每次输入后按草稿重建；无只读态 | 已修复 | 输入中保持打开；对话框字段 40 px 对齐（top 438/511）；prompt `readOnly` true→false |

## 1. 测量与证据方法

“已修复”不靠主观描述，统一使用可重复的测量：

- 控件：Playwright 读取 `offsetHeight` / `getBoundingClientRect()` / `getComputedStyle().borderTopColor`（`offsetHeight` 不受画布缩放影响）。
- 导出：e2e 用 `pdf-lib` 解析导出的 PDF，断言页数、页面 pt 尺寸、嵌入图 px 与 dpi，并打印 `[evidence]` 行。
- 装订：临时稿强制 7 页与 6 mm 内边距，读取预检告警；正常稿测得 16.0 mm 时不告警。
- AI：本地 4193 端口起假供应商，覆盖缓冲 JSON、SSE、500 故障转移、长时间静默、自纠错等 17 个场景。
- 响应式：390/768/1440 × 浅色/深色，遍历 `/`、`/auth`、`/account`、`/editor`、`/admin`，检查 `scrollWidth - clientWidth`。
- 截图统一放在 `docs/evidence/`（原始 PNG 在 `/tmp/opencode/shots/`）。

## 2. 逐项修复

### 2.1 上传：真实进度与直传

- **根因**：照片先到 Node 进程再到存储，前端无法知道真实字节进度；失败即整批失败。
- **修复**：`POST /api/uploads/presign` 签发 15 分钟、内容类型固定的 PUT URL，浏览器直传对象存储；队列 4 路并发，逐文件显示准备/上传/完成/失败与速率，失败可单条重试；私有部署或无对象存储时回退到服务端多段上传。
- **文件**：`server/objectStorage.js`、`server/app.js`、`src/editor/upload*`、`docs/uploads.md`。
- **证据**：`docs/uploads.md` 的时序说明；`validate:mvp` 覆盖“镜像失败时保留本地资源并保留重试”。

### 2.2 图库与删除：级联且不可复活

- **根因**：删除只是从 `project.assets` 移除，账户图库仍有该资源；下次刷新又合并回来。
- **修复**：图库删除调用 `DELETE /api/assets/:assetId`，服务端从所有引用该资源的作品集里移除并删文件；前端记录 `deletedOwnedAssetIdsRef`，合并远程列表时跳过刚删除的 id，避免竞态复活。
- **文件**：`server/assets.js`、`src/routes/editor/EditorContentSidebar.tsx`、`src/editor/assetResources.ts`。
- **证据**：`validate:mvp` 调用删除接口断言 204 并检查引用清理；缩略图右上角 13 px 内缩的垃圾桶图标。

### 2.3 页面顺序与页面排版

- **根因**：页面条标题不截断、动作按钮混排、取色器被滚动容器裁剪、拖拽没有落点提示。
- **修复**：标题两行截断；动作改为纯图标（24 px，aria-label/title）；取色器 portal 到 `body` 并在滚动/缩放/Esc 时关闭；拖拽显示插入间隙；“页面排版”用真实 A4 比例缩略图 3 列、名称居中、悬停才显示简介、无逐卡编辑按钮；动作分两行（插入到上方/插入下方，随后 编辑排版/替换本页，编辑始终可见、不适用时禁用）。
- **文件**：`src/routes/EditorPage.tsx`、`src/routes/editor/LayoutPicker*`、`src/styles.css`。
- **证据**：`editor-ux.spec.ts` 的布局选择/替换/拖拽用例；截图 `docs/evidence/editor-control-tiers.png`。

### 2.4 项目区与动作分组

- **根因**：项目动作平铺，主次不分，危险操作没有提示。
- **修复**：项目动作按语义分组（保存/导出、复制/归档、AI、新建/存模板、分享），全部 36 px、等宽网格；AI 入口独占整行并带说明文案。
- **文件**：`src/routes/editor/EditorOperationsSidebar.tsx`、`src/styles.css`。
- **证据**：`docs/evidence/ai-entry-zh.png`（中文“使用 AI 排版 / 指定素材后由 AI 完成整体排版。”）。

### 2.5 设计系统：一套控件刻度

这是本轮最后一批，也是“同类控件在不同页面长得不一样”的总根因。

**根因**

1. 每个上下文自己声明高度：`.admin-config-row` 42 px、`.auth-captcha__field` 46 px、`.admin-config-table__cell` / `.layout-editor-geometry` 32 px、`.admin-ai-usage__fields` 30 px、`.asset-slot__upload` 50 px。
2. 没有 `type` 属性的 `<input>` 不匹配 `input[type='text']`，直接落回浏览器默认约 19 px（后台配置表里同时出现 19 px 和 32 px）。
3. 输入框描边 `rgba(17,17,17,0.16)` 被复制进 16 个规则；把它抽成 token 时，一次字符串替换把 token 自身改成自引用，导致所有 `var()` 链在计算期失效（表现是所有输入框边框变黑/消失）。
4. 死代码残留：`.editor-project-bar*`、`.editor-project-url`、`.asset-tile__delete/__actions/__action` 已无任何 TSX 引用，仍带着旧的 32/40 px 高度。

**修复**

- 三档令牌：`--control-height-xs: 24px`、`--control-height-sm: 36px`、`--control-height: 40px`；`--space-1…6`（4/8/12/16/20/24）。
- 密集区域只重定 token，不重写高度：`.editor-sidebar`、`.admin-config-table__cell`、`.layout-editor-geometry`、`.admin-ai-usage__fields`、`.admin-ai-usage__search`、`.import-url-form`。
- 零特异性兜底：`:where(input:not([type]), input[type='text'|'search'|'url'|'email'|'password'|'number'|'tel'|'date'], select) { min-height: var(--control-height) }`，任何上下文都能覆盖，但不会再有字段掉回 UA 默认值。
- 单一 `--field-border` / `--field-border-color`；16 处硬编码描边全部替换；`validate:mvp` 新增静态守卫，禁止再出现硬编码描边。
- 后台 AI 用量输入框改用共享表单外观（此前是 UA 默认样式）；验证码刷新按钮升到 40 px，与其右侧输入框同高。
- 清掉死代码与三处重复选择器（`.admin-ai-limits`、`.editor-panel__toolbar`、`.asset-tile__title-row`）。
- 面板标题：文案块吸收剩余空间、折叠箭头固定右边，后台长导语不再把箭头挤到左侧单独一行。

**测量结果**（`offsetHeight`）

| 区域 | 结果 |
| --- | --- |
| 认证页表单 / 验证码 | 40 / 40 |
| 编辑器侧栏 按钮 / 输入 / 下拉 | 36 / 36 / 36 |
| 面板折叠箭头 / 页条图标 / 页内上传 CTA | 24 / 24 / 40（画布缩放后渲染 26） |
| URL 导入 输入 / 按钮 | 36 / 36 |
| 排版编辑器 16 个几何字段 | 全部 36 |
| 后台配置表输入（原 19/32 混用） | 全部 36 |
| 后台 AI 限额 / 用量 | 40 / 36 |
| 所有可见输入框描边 | `rgba(17, 17, 17, 0.16)` |

**文件**：`src/styles.css`、`src/routes/AuthPage.tsx`、`scripts/validate-mvp.mjs`、`tests/e2e/editor-ux.spec.ts`、`docs/design-system.md`。

**截图**：`docs/evidence/auth-controls.png`、`editor-control-tiers.png`、`layout-editor-geometry.png`、`admin-ai-controls.png`。

### 2.6 AI 排版

**90 秒失败的根因（线上统计确认）**：供应商平均成功耗时 50–82 s，而代码把请求包在 `Math.min(config.requestTimeoutMs, 90_000)` 里，且不是流式请求——超时来自我们自己，不是供应商。

**修复**

- 流式：`stream: true`，同时解析 SSE 与“缓冲式 JSON”两种响应；首个内容块预算 90 s（兼容忽略 `stream` 的供应商：它们只在正文完成后才发头），块间静默预算 60 s，总预算 `min(requestTimeoutMs, 280 s)`，默认 `requestTimeoutMs` 180 s。
- 对冲与转移：`min(100 s, total/2)` 发起对冲请求；任何错误立即切下一个供应商；允许一次自纠错。
- 异步作业：`POST /api/ai/plans` 返回 202 + jobId，前端每 1.2 s 轮询，5 分钟上限，绕开 Cloudflare 524。
- 管理端：供应商池（顺序/超时/重试/退避/降级/日志/JSON Schema 校验）；“生成预算（秒）”可编辑；prompt 只读，点“编辑提示词”后才可改；按用户配额可改、可重置。
- 提示词覆盖：全部照片、首页/末页、页码、配色、圆角、标题、每个模板容量。
- 方案卡片：真实页面缩略图（含每个图位的照片），显示页数、风格、使用照片数。
- 进度体验：进度文案、耐心提示、取消、失败重试。

**证据**：17/17 流式场景（缓冲 JSON、SSE、500 后转移、静默 60.2 s 触发 idle、`corrections:1`）；方案卡片 18 个页面 / 33 个图位、3 列、`scrollWidth == clientWidth`（`docs/evidence/ai-plan-cards.png`）；后台面板实测见 §4。

### 2.7 导出与分享（硬验收）

- **根因**：导出尺寸来自截图时的画布像素，配置的 120/180/300 dpi 只是标签；装订风险（奇数页、过窄内边距）从未提示。
- **修复**：
  - `getExportTargetPixelSize()` 由 mm → inch → dpi 推导目标像素；`normalizeExportRaster()` 只在偏差 >1% 时重编码（<1% 视为舍入），`readJpegSize()` 只读 JPEG 头，不解码像素。
  - `runExportPreflight()` 新增奇数页与内边距 < `BINDING_SAFE_MARGIN_MM = 10` 两条“整本”级告警，排在逐页问题之前（列表截断为 6 条，装订问题必须最先可见）；内边距从真实 `.magazine-page` 计算样式的 px 按 96 dpi 换算。
  - 整本告警不可跳页，按钮显示“整本作品集”。
- **证据**：`pdf pages=6 sheet=841.89x1190.55pt raster=2105x2975px dpi=180.0/179.9`（A3、双轴 180 dpi）；16.0 mm 静默、6.0 mm 触发；7 页奇数告警中英文均排第一（`docs/evidence/export-preflight-*.png`）。

### 2.8 中文本地化

- **根因**：动态消息用模板字符串直接拼接，绕过 `t()`；新增控件缺少词条。
- **修复**：所有动态文案经 `t()`；补齐后台 AI、配额、上限、删除确认、导出、预检、状态栏等词条；术语统一（作品集 / 页面 / 排版 / 图注 / 页边距）。本轮又补了“这本作品集最多容纳 %s 张照片…”“已达到 %s 张照片的上限”等。
- **证据**：残留英文扫描 0；`docs/evidence/export-preflight-odd-zh.png`、`ai-entry-zh.png`。

### 2.8b 首次进入编辑器

新用户进入编辑器时不会面对一张空白画布：空图框直接给出“上传照片 / 把照片拖到这里”的 CTA，点击即可上传并自动填入该图框；侧栏的“上传 / 从 URL 添加”始终可见；状态行说明当前是本地草稿、保存后才有公开链接。中文环境同样完整（截图见 `docs/evidence/mobile-editor.png` 与 `editor-control-tiers.png`）。

### 2.9 面板折叠

- 单一 `PanelCollapseToggle`（24 px 拟物箭头）+ `ui/panelCollapse.ts` 委托；状态按路由记忆；标题行标签/标签块/箭头同一 24 px 行高。

### 2.10 字体

- 真实 CJK 字体子集（WOFF2，`public/fonts`），按角色（标题/导语/图注/正文）选择，默认只保留一个“默认”；功能界面统一无衬线，衬线只用于作品内容。

## 3. 证据目录

| 文件 | 说明 |
| --- | --- |
| `docs/evidence/auth-controls.png` | 认证页 40 px 字段与同高验证码 |
| `docs/evidence/editor-control-tiers.png` | 侧栏 36 px 控件、24 px 箭头、40 px 页内 CTA |
| `docs/evidence/layout-editor-geometry.png` | 排版编辑器几何字段 36 px |
| `docs/evidence/admin-ai-controls.png` | 后台 AI 限额 40 / 用量 36 / 对齐 |
| `docs/evidence/ai-entry-zh.png` | 项目区“使用 AI 排版”及说明 |
| `docs/evidence/ai-plan-cards.png` | AI 方案真实页面缩略图 |
| `docs/evidence/export-preflight-odd-en.png` | 奇数页告警（英文，排第一） |
| `docs/evidence/export-preflight-gutter-en.png` | 6 mm 内边距告警（英文） |
| `docs/evidence/export-preflight-odd-zh.png` | 奇数页/订口告警（中文） |
| `docs/evidence/mobile-*.png` | 390 px 首页/编辑器/后台 |

## 4. 性能

- 上传：浏览器直传对象存储，服务端不再转发字节；4 路并发；URL 导入与上传并行；无对象存储时回退多段上传。
- AI：流式 + 首块/静默/总预算；对冲与立即转移避免“等满 90 s 再换家”；异步作业避免网关 524。
- 导出：只读 JPEG 头判断尺寸；偏差 ≤1% 不重编码；打印栈离屏按精确纸张尺寸渲染。
- 前端：无新增依赖；编辑器路由按需加载；构建 0.9 s（Vite，本机）。
- 回归时长：33 个 Playwright 用例 1.3 分钟。

## 5. 安全

- 直传：预签名 PUT 15 分钟有效，key 由服务端生成（`uploads/<filename>`），内容类型固定；客户端不能指定任意 key。
- URL 导入：仅 http/https，DNS 解析后拒绝私网/回环/链路本地/文档地址，重定向最多 4 跳且逐跳复检，20 s 超时、体积上限、内容类型与魔数校验（`server/app.js`）。
- 删除/配额：资产删除校验归属并级联清理；AI 配额与每日配额在服务端校验。
- 会话：HttpOnly / SameSite=Lax / 生产 Secure；登录按 IP 与账号双维度限流。
- 依赖与镜像：CI 运行 `npm audit --audit-level=high --omit=dev`；容器以非 root（uid 1000）运行。
- 本批新增静态守卫：禁止把字段描边写回硬编码 rgba。

## 6. 回归与 CI

- `./node_modules/.bin/tsc --noEmit`：通过。
- `./node_modules/.bin/vite build`：通过。
- `npm run validate:mvp`：通过（含导出几何、装订、AI 流式、设计令牌静态断言）。
- `./node_modules/.bin/playwright test`：34/34 通过（最终提交上重跑：`34 passed (1.4m)`）（新增“每种内置排版都能在页面上直接改字”“替换排版保留文案与已选照片”“失败的 URL 导入保留原链接可重试”）。
- GitHub Actions：`main` 与 `fix/comprehensive-review` 在每个提交上均为 success（GitHub 托管 ubuntu-24.04、actions v5）。

## 7. 开源/产品参考采纳表

| 参考 | 采纳 | 未采纳及原因 |
| --- | --- | --- |
| Doory（相册书流程） | 明确的页面顺序 + 每页显式选择排版 | 不做全自动成书：AI 方案需要用户可审阅，而不是一键不可逆 |
| Avnac（画布编辑器） | 画布内直接编辑文字、选中态在瓦片自身边框上 | 不做自由画布：印刷页面必须有受约束的栅格与出血/页边距 |
| pyPhotoAlbum（批量相册排版） | 固定 A4 几何 + 每页图位比例用于导出预检 | 不复用其命令行工具链：产品需要浏览器内交互 |
| Rega（规格驱动版面） | 版面由 mm/比例规格驱动，导出按规格推导像素 | 不引入其版面 DSL：现有模板 JSON 已能表达 |
| zinegen（小志拼版） | 奇数页配平 + 装订安全边距预检 | 不做印厂拼版（折手/双面）：当前导出单页，拼版交给印厂 |
| Uppy / tus（上传） | 逐文件进度、失败重试、直传存储、并发队列 | 不引入 tus 可恢复协议：S3 多段上传已覆盖大文件，依赖更少 |
| Mixbook / Shutterfly（商业印品） | 导出前的预检概念、A4/A5/A3 同比例选择 | 不做商品目录/定价/下单 |
| Figma / Canva（编辑器） | 紧凑侧栏、安静提示、显式危险确认、无 hover 位移 | 不做无限画布与多人协作 |
| Notion（面板） | 每个面板独立折叠并记忆状态 | 不做块编辑器模型 |
| Linear（密度） | 24/36/40 三档控件、图标微操作、键盘可达 | 不做命令面板（超出本轮范围） |
| Radix（浮层解剖） | trigger → portal → content；外部点击/Esc/滚动/缩放关闭 | 不引入整套 primitive 依赖，按需自实现 |
| Primer（设计令牌） | 高度/描边/间距令牌化，静态守卫防回退 | 不引入完整主题体系与多品牌令牌 |

## 8. 遗留与风险

1. 没有深色主题：应用是明确的浅色产品界面；已在 `prefers-color-scheme: dark` 下逐页验证不会被系统反转或出现不可读文本。若要做深色主题，应作为独立特性设计令牌，而不是让浏览器反色。
2. 自定义排版存在浏览器本地（`saved layouts stay in this browser`），跨设备需要另做账户同步。
3. 导出是单页 PDF，不含印厂折手/拼版；装订预检只覆盖奇数页与内边距。
4. AI 质量依赖第三方供应商；池化、超时、降级、日志已就绪，但外部服务不可用时仍只能给出可重试的失败提示。
5. 公开阅读器的翻页动画依赖 turn.js；已在无 LocaleProvider 的分离根节点上修复过空白书问题，后续改动该路径需保留回归用例。

## 9. 部署记录

| 项 | 值 |
| --- | --- |
| 代码 | `371a847`（+ `bba7216` 文档） |
| 构建产物 | `assets/index-CBprp_6Q.js` / `assets/index-B7Rs36PJ.css` |
| 部署方式 | `rsync` 到 `/opt/finalfolio/app`，`docker compose up -d --build` |
| 健康检查 | `GET /api/health` → `{"ok":true}` |
| 容器 | `finalfolio-web` healthy，非 root（uid 1000） |
| AI 预算 | 生产 `data/ai/config.json` `requestTimeoutMs` 120000 → **180000** |
| 校验 | 线上 bundle 含中文“指定素材后由 AI 完成整体排版。”与新令牌 `--control-height-xs`、`.editor-project-action__hint` |

---

# 第二轮：全站审计与一致性整改（2026-11-19 晚）

本轮以"用户点名的问题只是入口"为前提，重新审计了首页、编辑器、账户、后台的全部可见界面和交互，并把同类问题一次性收敛到共享组件与令牌。

## R1. 问题清单、根因与修复

| # | 问题 | 根因 | 修复 | 证据 |
| --- | --- | --- | --- | --- |
| 1 | 首页中文像机翻 | 英文源文案本身是内部说明（"governance language"、"one-shot canvas"、"the product falls back to…"），中文逐句直译 | 重写英文源 + 中文重写（默认值同步 `src/product/defaults.ts`、`server/site.js`，客户端硬编码文案同步），术语统一 | `docs/evidence/home-zh.png` |
| 2 | 衬线/无衬线混用、圆角不统一 | UI 标签 41 处使用等宽字体；圆角散落 3–32px 共 18 种取值 | UI 全部改 `--font-ui`（等宽只保留缩放值、AI 计时、页码、验证码）；圆角收敛为 4/8/12/20/28/999 六档令牌 | `docs/evidence/editor-after.png`；§R2 |
| 3 | 使用流程右侧"页面顺序"激活后右移 | `.browser-stage__rail-card.is-active { transform: translateX(4px) }` | 删除位移，选中态改用描边 + 内环 + 表面变化；同时移除已无用的 transform 过渡 | `tests/e2e/consistency.spec.ts` 用例 1（实测 `transform: none`） |
| 4 | 默认选中"封面"但"编辑排版"禁用 | 只有已保存的自定义排版才能编辑（`activeCustomLayout`） | 任何选中排版都可编辑：内置排版按当前页面实测几何生成自定义副本（`layoutFromPage.ts`），应用后保留照片与文案 | 用例 3（按钮可用、对话框含真实 Hero 图框）；`docs/evidence/layout-edit-dialog.png` |
| 5 | 排版卡片同时出现介绍气泡和名称气泡 | 按钮带原生 `title`，外层又有自定义悬停预览 | 移除原生 `title`（名称已在卡片内可见），只保留一个预览 | 用例 2（全部卡片 `title=null`，预览仅 1 个） |
| 6 | "用作新项目"按钮不是统一轻拟物风格 | 使用了 `button--danger-ghost`（危险色） | 改为共享 `button--ghost`；破坏性由二次确认承担 | 用例 6（class 与 4px 圆角断言） |
| 7 | 改字体后预览有时不变 | 封面/瀑布页的导语是无角色类的 `<p>`；封面导语甚至用 kicker 样式；kicker 的字体声明被页面兜底规则覆盖 | 所有文本节点带角色类（deck/caption/body/title），kicker 走 caption 角色；封面导语使用 deck 角色与真实导语样式 | 用例 5（切换字体后 computed font-family 立即变化） |
| 8 | "页面内容"里收起画框会收起整个面板 | 子区块复用了 `PanelCollapseToggle`，委托逻辑总是收起最近的 `.editor-panel` | 新增共享 `EditorSubsection`（原生 `<details>` + 统一表皮），用于"图片与画框""图片圆角""作品集信息"；不会触发面板折叠 | 用例 4（子区块关闭后父面板仍展开、文字区仍可见）；`docs/evidence/content-panel.png` |

## R2. 审计中主动发现并修复的问题

| 问题 | 根因 | 修复 |
| --- | --- | --- |
| 自定义排版的名称被印在页面上（"Editorial Split"） | `.magazine-custom__label` 直接渲染模板名 | 删除该标签；排版名属于库元数据 |
| 内置排版转自定义后文字溢出/导语被裁 | 自定义文本框字号按视口 `vw` 计算，与文本框高度无关；文本框还带标签和固定内边距 | 文本框改为容器查询单位（`cqh`），标题/导语/正文随文本框高度缩放；实测溢出 0 |
| 保存状态行重复同一句 | 生命周期把草稿提示同时写入 `message` 和兜底状态 | 草稿提示只由兜底状态输出；动作消息与保存提示合并时先翻译再拼接，避免混入英文 |
| 中文界面底部声明仍是英文 | 组件字符串已换新，词条未同步 | 同步英文源与 `zh.ts` |
| 分享链接输入框占位文字被截断 | 用整句占位符填充窄输入框 | 改为"保存后生成链接。"等短句 |
| 后台"错误情况"面板显示的是每小时事件总数，标题却叫 Failures | 面板把 `bucket.total` 当主数值 | 标题改为"最近 24 小时 / 每小时活动"，徽标显示失败次数 |
| 账户/后台头图文案是内部术语 | "information architecture and governance language" 等 | 改为"你的项目、照片与账户。""管理整个产品。" |
| 首页滚动揭示依赖 IntersectionObserver，失败时内容永久透明 | 无兜底、无 reduced-motion/打印处理 | 增加 1.2 s 兜底揭示、无 Observer 时直接显示、reduced-motion 与打印强制可见 |
| 排版卡片名称被截成"Editori… Split" | 同时声明 `nowrap` 与 `normal`，且行数截断写法无效 | 改为两行 `line-clamp` + 词边界换行 |
| 死代码与重复规则 | `.editor-project-bar*`、`.asset-tile__delete/__action`、重复 `.admin-ai-limits` 等 | 已在前一轮清理；本轮继续删除 `.magazine-custom__label` 与无用 transform 过渡 |

## R3. 设计令牌与复用组件清单

| 类别 | 令牌/组件 | 说明 |
| --- | --- | --- |
| 控件高度 | `--control-height-xs/sm/默认` 24/36/40 | 密集区域重定令牌，不重写高度 |
| 圆角 | `--radius-xs/sm/md/lg/xl/pill` + `--radius`/`--surface-radius`/`--control-radius` | 六档收敛全部界面圆角 |
| 间距 | `--space-1…6`（4/8/12/16/20/24） | 新规则必须落在此刻度 |
| 描边 | `--field-border(-color)` | 16 处硬编码全部替换，静态守卫禁止回退 |
| 字体 | `--font-ui` / `--font-display` / `--page-font-*` | UI 无衬线；衬线仅作品内容；四个角色覆盖全部文本节点 |
| 按钮 | `.button` + `--primary/--ghost/--small/--micro` | 统一的暖色轻拟物材质，无 hover 位移 |
| 输入 | 共享字段规则 + `:where()` 高度兜底 | 含无 `type` 属性输入框 |
| 面板 | `.editor-panel` + `PanelCollapseToggle` | 全站一致的折叠头 |
| 子区块 | `EditorSubsection` / `.editor-subsection` | 作品集信息、图片圆角、图片与画框 |
| 模态 | `.surface-popover` / 确认对话框材质 | AI 对话、删除确认、导出中心同源 |
| 浮层 | portal + 视口夹取 | 颜色选择器、排版预览 |
| 颜色 | `--page-paper`、`--ink`、`--muted`、`--field-border-color` | 禁止新增一次性灰色 |

## R4. 样式一致性检查结果

- 控件高度：侧栏按钮/输入/下拉 36、独立字段 40、图标控件 24（第二轮复测通过）。
- 圆角：`button 4 / panel 12 / subsection 8 / chip 4 / toggle 4`，无 3–32px 散值残留（50%、1–2px 缩略图、内容圆角除外）。
- 字体：等宽仅 4 处（缩放值、AI 计时、页码、验证码）；UI 其余全部无衬线。
- 溢出：390/768/1440 × 浅色/深色 × 5 个路由，横向溢出 0，控制台错误 0。
- 滚动揭示：全部 `[data-reveal]` 最终可见（隐藏数 0）。

## R5. 性能与稳定性

- 新增的 `EditorSubsection` 与测量式排版副本均为纯前端同步逻辑，无额外请求。
- 自定义文本使用容器查询单位，避免按视口缩放导致编辑器与导出一致性问题。
- 首页揭示兜底不增加轮询：一次性定时器 + 观察器，路由切换时清理。
- 全量回归：41 个 Playwright 用例（新增 7 个一致性用例）1.7 分钟通过。

## R6. 参考与差距对照（本轮新增）

| 参考 | 采纳 | 差距/未采纳 |
| --- | --- | --- |
| Figma / Canva 的"编辑当前选中对象"模式 | 选中任何排版即可"编辑排版"，不再要求先保存为自定义排版 | 未做无限画布；内置排版转自定义副本而非原地改代码 |
| Notion / Linear 的二级 disclosure | 用原生 `<details>` 做子区块，父面板不受影响 | 未做动画高度过渡（保持即时开合，减少抖动） |
| Radix 的浮层单一来源 | 一个预览、一个颜色浮层，移除原生 tooltip 叠加 | 未引入依赖 |
| Uppy 的错误保留 | URL 导入失败保留输入与原链接，可直接重试 | 未做断点续传协议 |
| Primer 的令牌纪律 | 圆角、间距、描边全部令牌化并加静态守卫 | 未引入完整主题系统 |

## R7. 剩余待验证项

1. 生产环境的站点文案是否被后台覆盖：已确认 `data/site/site-content.json` 不存在，部署后直接使用新默认值。
2. 自定义排版转为内置副本的几何为"实测近似"：封面/随笔等单文本区页面几乎一致；多文本区页面（如网格）会把正文与图注收进同一文本区，属于自定义排版的已知边界。
3. 深色模式仍非产品特性，仅在深色系统偏好下验证不被反转。

## R8. 本轮验证与部署

- `tsc --noEmit`、`vite build`、`validate:mvp`、41/41 Playwright 全部通过。
- 新增 `tests/e2e/consistency.spec.ts`（7 个用例）覆盖上述 1、3、4、5、6、7、8 号问题与状态行重复。
- 提交与 CI 状态见仓库；部署后需复核 `https://finalfolio.com/api/site-content` 返回新文案。
