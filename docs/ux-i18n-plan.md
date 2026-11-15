# 直观化与中文版改造计划（2026-11-15）

目标：让用户打开就明白第一步做什么；编辑器操作直观、布局紧凑；全站提供中文界面（含模板文字）。

## 批次与顺序

```
A 中文基础设施（先做，因为所有 UI 文案都会动到）
  A1 src/i18n：LocaleProvider（en/zh，localStorage 持久化、<html lang>）、t()（以英文原文为 key，gettext 风格）
  A2 SitePageHeader 语言切换；legal getPageLanguage() 接入 locale（terms 已有 zh-CN 文档，privacy 补一份）
  A3 内容元数据双语：pageThemeMeta / templateMeta / templatePacks / pageStarters / 默认项目文案（zh 字段 + locale 选择器）
  A4 全站字符串接 t()：SitePageHeader、HomePage、AuthPage、AccountPage、AdminPage、EditorPage + 三个 sidebar、
     ExportCenter、IssueViewPage、NotFoundPage、TransientNotice、confirmations
  A5 新建草稿/模板包应用时按 locale 取中文文字

B 编辑器重构（依赖 A 完成 UI 字符串后统一做，避免两次改动同一处 JSX）
  B1 Sequence 页面芯片重做：紧凑行；每页一个“纸色圆点”按钮 → 磨砂气泡选色（单页/全部应用）；
     非激活页折叠为一行；删除独立 Page style/Paper color 面板
  B2 Page templates 卡片改为示意图优先（TemplateLayoutPreview 缩略图），文字说明移入悬停气泡
  B3 Project templates / My templates：默认折叠（项目已有内容时）；卡片加预览示意图 + 说明；
     “Use as project” 危险样式 + 明确后果文案
  B4 内容侧栏重排：Photos 在前；新增“Add from URL”
  B5 服务端 POST /api/uploads/from-url：SSRF 防护（仅 http/https、私网拦截）、大小上限、魔数校验，走与上传相同管线
  B6 舞台直接编辑：点击预览中的文字块 → 锚定浮层内联编辑（kicker/title/deck/body/caption），Esc/失焦提交；
     Page content 面板保留为完整字段编辑
  B7 首屏引导：空草稿时舞台给出“第一步”提示（上传照片 → 选模板 → 加文字 → 导出）

C 验证与发布
  C1 tsc / build / validate-mvp（注意其中对源码文本的断言需同步）/ Playwright（含新增用例）
  C2 中英两语言四断点截图巡检
  C3 提交 + 推送 GitHub + 部署上线 + 线上冒烟
```

## 冲突与规避
- validate-mvp.mjs 断言源码含特定文案（如 /Save folio/）→ 改动后同步更新断言。
- B1 移除 page-style 面板会动 pageStylePanel 及 themeChoice 逻辑 → 保留 themeChoice 状态，仅换呈现位置。
- i18n key 以英文原文为 key，避免大量重命名；zh 词典缺失时回退英文，保证不白屏。
- 内联编辑与 MagazinePreview 交互（拖拽/裁剪）可能冲突 → 文字块点击仅在选择态生效，拖拽手柄优先。

## 回归范围
- 中英切换后所有页面渲染、编辑器全流程（上传/URL 图/模板/文字/导出/分享）、公开阅读页、账户与管理后台。

## 执行结果（2026-11-15）

- A1–A5 完成：i18n 运行时、全站字符串接入（含服务端错误文案映射）、法律页中文（隐私政策新增 zh-CN 文档）、模板/纸色/起始文案与新建草稿按语言取词。
- B1–B7 完成：页面芯片纸色圆点 + 气泡选色（含“应用到所有页面”）、页面模板改为缩略图卡片、项目模板默认折叠 + 危险操作确认、照片面板前置 + “从 URL 添加”、舞台内联文字编辑浮层、空草稿上手引导。
- B5 服务端：`POST /api/uploads/from-url`，仅公网 http/https、逐跳校验重定向、大小上限、魔数校验，复用既有上传/变体/对象存储管线。
- C 验证：`tsc`、`npm run build`、`npm run validate:mvp`、Playwright 12 项全部通过；中英双语 390/768/1024/1440 截图巡检无横向溢出。

## 二次优化（2026-11-15 晚）

- 中文文案整体重写为产品化用语，不再逐字直译；补充活动日志、后台状态、首页演示内容等遗漏文案；账户/后台时间使用 zh-CN 格式。
- 引入霞鹜文楷（自托管，按需加载子集），移除宋体回退。
- 移除“快速上手”卡片，改用自解释的空状态（图库上传提示 + 图框拖放提示）。
- 纸色气泡改为锚定颜色圆点、圆形色板、支持 Esc/点击外部关闭。
- 页面模板更名“页面排版”：A4 比例、真实页边距的示意图，一排放三个、标签居中；悬停只显示文字说明与推荐场景，并提供“替换本页 / 新增一页”两个直接操作（替换时保留图片与文字）。
- 修复危险按钮的多余浅色描边；焦点样式改为 outline。
- 页面文字改为 contenteditable 直接编辑，不再弹出编辑框。
- 未保存的链接改用浅色 placeholder 呈现。

## 三次优化（2026-11-15 深夜）

- 字体：合并为单个 866KB 自托管 woff2（GB2312 一级字库），移除字体 npm 依赖与全站 preload；设计字体只用于首页与作品页，后台/账户/登录/按钮等全部使用系统字体；加载前显示系统字体。
- 纸色选择：选中态改为小对勾，不再使用粗描边；气泡改为不透明底色。
- 排版示意图：修正文字栈内百分比 gap 失效导致的贴合/重叠，缩小文字与图片圆角，悬停按钮居中、示意图变暗模糊，说明气泡锚定到侧栏外侧。
- 页面结构文字（页码、图框提示）与新建页模板文案全部本地化。
