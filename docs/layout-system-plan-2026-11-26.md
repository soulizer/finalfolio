# FinalFolio 全站布局系统方案 — 2026-11-26

## 目标

保持现有暖纸色、轻微拟物、衬线只用于作品页的视觉基调，把首页、认证/法务页、账户页、后台、编辑器、阅读器统一到一套可解释的布局系统里：

- 同类页面用同一个 Page Shell、Page Header、内容宽度和间距节奏。
- 同类元素用同一个 Panel / Card / Row / Form / Gallery 规则，不再靠单页覆盖。
- 主操作明确，次操作退后；一屏只有一个视觉主按钮。
- 桌面、平板、手机都由同一套断点和容器规则推导，不做魔法补丁。
- 阅读器现有阴影方案、翻页样式和作品字体不动。

这份文档只定义方案与执行顺序，批准后才开始改动。

---

## 一、从成熟开源项目里提取的布局方法

调研的是方法和结构，不复制视觉。

| 项目 | 值得借用的做法 | 在 FinalFolio 的落点 |
| --- | --- | --- |
| shadcn/ui + dashboard blocks | 统一 PageHeader（标题/说明/操作）、Card 原语、固定内容宽度、响应式 `gap` | 账户/后台/认证/法务页的页头与卡片 |
| Tremor | 仪表盘先分层：KPI → 趋势 → 明细；卡片网格统一间距 | 后台概览、事件、用量页面 |
| Immich | 应用栏 + 内容区 + 响应式照片网格；选择只用勾选/高亮，不叠重边框 | 图库、上传、项目预览 |
| Cal.com | 设置页采用“垂直分区 + 单列卡片”，而不是硬套双栏 | 账户设置、后台系统设置 |
| Ghost / WordPress 编辑器 | 左侧内容、中央画布、右侧检查器；面板头与工具栏位置固定 | 编辑器三栏/四栏结构 |
| GrapesJS | Panel、Block Manager、Asset Manager 各自职责清楚，所有工具条复用同一种布局 | 编辑器面板、图库、模板库 |
| Linear | 列表行紧凑统一：标题、元信息、操作区固定列宽；操作不抢主内容 | 项目/上传列表、后台行 |
| Radix / shadcn Dialog | 统一遮罩、面板宽度、头/身/脚 padding、焦点管理 | 确认框、导出、AI、布局编辑器、移动详情 |

共同结论：**不是每个页面重新设计，而是先定义 Shell、Header、Container、Grid、Panel 这五层，所有页面只做组合。**

---

## 二、现状盘点

### 2.1 页面骨架

当前至少三套外壳：

- 站点页：`.editor-shell--site-page`，宽度 `--site-width: min(1240px, 100vw - 48px)`
- 编辑器：`.editor-shell` + `.editor-layout`，宽度 `--editor-shell-width: min(1880px, 100vw - 16px)`
- 阅读器：`.issue-view-shell`，沉浸式，独立宽度逻辑

问题：

- 账户页、后台页、认证页、法务页共用站点外壳，但各自又叠加 `.admin-page`、`.auth-form`、`.terms-state` 等不同布局类。
- 首页各 section 虽然共用 `--site-width`，但垂直间距、内部网格和卡片间距各自定义。
- 编辑器全宽 1880px，与站点 1240px 之间没有明确的“为什么不同”的规则。

### 2.2 页面头部

存在多种头部：

- `SitePageHeader` 的 home / auth / account / admin / editor 变体
- 编辑器自己的 `EditorStateTopbar`
- 后台 hero / 面板 heading
- 阅读器顶栏

问题：

- 标题层级、描述、meta、操作区位置不统一。
- 有的页面头部本身是卡片，有的是透明条，有的是 hero。
- 操作按钮的 gutter 已部分统一为 `--header-gap`，但仍有 8/10/12/18px 混用。

### 2.3 控制台（账户 / 后台）

- `.admin-page`、`.admin-page__main`、`.admin-page__side` 是 grid，但各页面 modifiers 自己决定列数和顺序。
- 项目/上传是“列表 + 检查器” split panel，但账户和后台的 DOM、事件、截断、操作位置并不完全一致。
- 设置页、偏好页、用户页的列数和卡片宽度不同。
- 行操作在移动端会变成纵向全宽按钮 + 36/44px 图标，对齐规则仍然不统一。

### 2.4 编辑器

- `.editor-layout` 是四列：导航 / 内容 / 画布 / 操作，最小宽度和 gap 固定，但 1100px 和 760px 两个断点直接切换列数。
- 面板大量复用 `.editor-panel`，但内部 heading、toolbar、actions 有三套写法。
- 图库 `.asset-tile`、模板卡 `.template-card`、布局卡 `.layout-card` 的 padding/radius 不同。
- 勾选图片曾叠加黑色双边框；本次已改为只保留左上角勾选框，图库和 AI 图片库都不再加额外选边框。

### 2.5 首页

- Hero、proof strip、feature grid、workflow、CTA 各自有独立 padding/gap。
- Hero 预览承担了展示产品能力的职责，但卡片数量、尺寸和移动端裁切逻辑与其他页面没有共享规则。
- 页面节奏靠单个 section 的 clamp 值拼出来，缺少统一的 section token。

### 2.6 表单、弹窗、空状态

- 表单字段有 `.field`、`.admin-inline-field`、`.import-url-form` 三套 recipe。
- 六个 dialog shell：确认、导出、AI、布局编辑器、后台 AI 供应商、移动详情。
- 空状态至少 9 处复制。
- 这些不是“布局页”问题，但会直接破坏页面观感，所以纳入同一套原语。

---

## 三、目标布局系统

### 3.1 宽度与间距 token

```css
--page-max: 1240px;          /* 首页、法务、认证 */
--page-max-console: 1480px;  /* 账户、后台 */
--page-max-editor: 1880px;   /* 编辑器 */
--page-gutter: clamp(16px, 3vw, 32px);
--section-gap: clamp(48px, 6vw, 80px);
--grid-gap: clamp(14px, 1.4vw, 20px);
--panel-pad: 16px;
--panel-pad-loose: 22px;
--card-pad: 12px;
--row-gap: 12px;
```

原则：

- 页面只用三个最大宽度，不再 each-page 自定义。
- 水平 gutter 由 `--page-gutter` 推导，移动端不再散落 28px/24px/16px。
- 垂直节奏由 `--section-gap` 和 panel 内部 `--row-gap` 推导。

### 3.2 四类 Shell

1. **SiteShell**（首页 / 认证 / 法务）
   - Header + `<main>` + footer
   - 最大宽度 `--page-max`
   - Header 与内容共用同一 gutter

2. **ConsoleShell**（账户 / 后台）
   - 紧凑页头 + 分区导航 + 内容区
   - 最大宽度 `--page-max-console`
   - 内容区默认单列；只有列表/检查器、概览 KPI 才允许双列

3. **EditorShell**
   - 全高、全宽（`--page-max-editor`）
   - 固定区域：页面条 / 图库 / 画布 / 检查器 / 操作
   - 用 container query 根据每个侧栏自身宽度切换 1/2 列，而不是只看 viewport

4. **ReaderShell**
   - 保持沉浸式
   - 桌面：书 + 侧栏
   - 移动：顶栏 / 书 / 翻页按钮在 grid 流中，永不覆盖作品
   - 阴影、翻页、字体方案不动

### 3.3 PageHeader 统一插槽

```tsx
<PageHeader
  eyebrow="Account"
  title="Your library"
  description="Projects, uploads and settings."
  meta={<Tag>...</Tag>}
  actions={<Button variant="primary">New</Button>}
  variant="site" | "console" | "editor"
/>
```

规则：

- 最多一个 `button--primary`。
- 操作区右对齐，移动端可换行，不压缩标题。
- 标题、描述、meta 的间距固定；console 变体只缩小字号，不改变结构。
- 页头高度由内容决定，不写死。

### 3.4 内容网格

- 12 列只用于首页/营销长页；控制台用语义网格。
- 控制台：
  - 概览：`minmax(0, 1.7fr) minmax(320px, 1fr)`
  - 列表/检查器：`minmax(320px, .9fr) minmax(420px, 1.4fr)`
  - 设置：单列
  - 后台用户/存储：单列或对称两列，按内容决定，不继承其他页面
- 编辑器：
  - 桌面：导航 / 内容 / 画布 / 操作，宽度用 `clamp`
  - ≤1180：导航折叠为页条，画布 + 检查器
  - ≤760：单列顺序：画布 → 页条 → 图库/操作

### 3.5 原语

**Panel**：`header / meta / actions / body`，统一 padding、header 高度、折叠按钮位置。
**Card**：两档——选项卡（12px padding / 8px radius）与内容卡（16–22px padding / 12px radius）。
**Row**：标题、副标题、meta、操作四区；桌面固定操作列，移动端纵向；整行可点但不劫持按钮。
**Field / FormGrid**：统一 label、输入高度、gap；≥640px 两列，以下单列。
**GalleryGrid**：图片网格只负责排布；选中只显示勾选，不加黑色双边框。
**EmptyState / Dialog / Disclosure / Tag / Chip**：统一外壳与间距。

---

## 四、逐页面改造计划

### 阶段 1：Token + Shell + Header（基础）

- 定义 `--page-max*`、`--page-gutter`、`--section-gap`、`--grid-gap`、`--panel-pad*`。
- 抽 `SiteShell` / `ConsoleShell` 的布局 CSS，不再每个页面自己写 padding。
- 统一 PageHeader 结构与 console 变体。
- 先迁移：认证、法务、账户、后台。

验收：1440 / 1024 / 768 / 390 宽度无横向溢出；所有页头标题基线、操作区、内容起点一致。

### 阶段 2：控制台网格与列表

- 账户：概览、项目、上传、设置、偏好统一页头与容器。
- 后台：概览 KPI、事件、项目、上传、用户、存储、AI 用同一套 panel/grid。
- 列表/检查器采用同一 split 规则；行操作统一列宽和移动端堆叠。
- 设置页保持单列，用户页保持列表+检查器。

验收：账户和后台同类页面在桌面/手机的列数、间距、行高一致；不再出现“三块面板塞进两列”。

### 阶段 3：编辑器

- `.editor-layout` 四区宽度与 gap 统一。
- 所有 `.editor-panel` 使用 PanelHeader/PanelActions。
- 图库、模板库、布局卡统一 Card 两档。
- 图库选中只保留勾选框（已改）。
- 断点改为容器查询；侧栏在窄宽度下优先保证画布可用。

验收：侧栏折叠、面板折叠、图库选择、页面条拖动在 1440/1180/900/390 下行为一致；画布不被挤到不可用。

### 阶段 4：首页与营销页

- Hero / proof / features / workflow / CTA 统一 section 间距与内部网格。
- Hero 预览严格使用共享 Card/Gallery 规则，移动端裁切和数量由同一套规则决定。
- Header/Footer 与 SiteShell 对齐。

验收：所有 section 的左右边界一致；移动端无单侧过宽卡片；首屏信息层级只有一个主 CTA。

### 阶段 5：表单、弹窗、空状态、标签

- 统一 Field/FormGrid。
- 六套 Dialog 收敛到一套 backdrop/panel/focus 规则。
- EmptyState、Disclosure、Tag/Chip 原语落地。
- 删除剩余单页覆盖与死 CSS。

验收：同类字段高度/圆角/间距一致；所有 modal 的 padding、宽度策略、焦点行为一致；空状态只有一种结构。

### 阶段 6：响应式与可访问性

- 统一 1180 / 900 / 760 / 480 断点语义。
- 所有列表行键盘可选；所有 icon-only 操作 44px 触控目标。
- 容器查询替代“面板宽度靠 viewport 猜”的规则。

验收：390px 宽无横向滚动；触控目标不小于 44px；键盘可完成账户/后台主要操作。

### 阶段 7：视觉回归与性能

- 固定 6 组截图：首页、认证、账户概览、账户项目、后台概览、编辑器。
- 视口：1440×900、1024×768、390×844。
- 几何断言：页头高度、内容左右边界、卡片 gap、行操作宽度、弹窗 padding。
- 性能：继续复用图片懒加载、编辑器导出懒加载；布局改造不引入新的全局 observer。

---

## 五、实施顺序与依赖

```text
Token/Shell/Header
   ├─> 控制台网格/列表
   ├─> 首页 section
   └─> 表单/弹窗/空状态
             ↓
         编辑器布局
             ↓
      响应式/可访问性
             ↓
        视觉回归/性能
```

- 先做 Token/Shell/Header，后面所有页面才有共同基线。
- 编辑器和阅读器最后动，避免影响已稳定的画布和翻页。
- 每个阶段独立提交、独立验证，不一次性大迁移。
- 不新增 UI 框架；继续 React + 原生 CSS。必要时只增加极小的 `cx` 类名工具。

---

## 六、明确不做

- 不改暖纸色、阴影语汇、字体分工（UI 无衬线、作品页衬线）。
- 不改阅读器每页 drop-shadow、无全局阴影、纸张背面方案。
- 不把桌面双页阅读改成单页。
- 不为统一而统一：编辑器画布优先于面板对称，阅读器作品优先于 chrome。
- 不复制开源项目的视觉皮肤，只借鉴布局和交互结构。

---

## 七、需要批准的关键取舍

1. **控制台最大宽度**：建议 1480px；后台宽表较多，但不超过 1480，避免视线跨度过长。
2. **账户/后台页头**：建议统一为紧凑 PageHeader，不再使用大 hero；概览页可保留一块轻量摘要卡。
3. **编辑器窄屏顺序**：建议画布优先，图库/操作在下方；不强行保留三栏。
4. **首页 section 间距**：建议统一 `clamp(48px, 6vw, 80px)`，比当前部分 section 更紧凑。

批准后按阶段 1 → 7 执行；每个阶段完成后给出几何测试与截图证据，再进入下一阶段。
