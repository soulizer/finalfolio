# FinalFolio 审查修复计划

本文件记录 `docs/review-2026-11-14.md` 中全部问题的修复顺序、依赖关系、潜在冲突与回归范围。
基线提交：`chore: baseline current production state`（对应线上 `EditorPage-DE9Z09T1.js`）。

## 批次与依赖

```
A 基础设施（无功能风险，解锁后续）
  A1 设计令牌 + 按钮/浮层统一            ← 影响所有页面，必须在视觉回归前完成
  A2 ErrorBoundary + 404 路由 + API 404  ← 保护后续重构
  A3 共享确认对话框（替换 window.confirm）
        │
B 关键正确性（数据丢失/性能）              │
  B1 渲染循环与自动保存饿死（MagazinePreview/useEditorUiState）← 依赖 A1 的 memo 约定
  B2 访客本地照片被清理（storage/uploadOperations）
  B3 保存竞态（projectPersistence）
  B4 多标签冲突（server rev + 前端 409）
  B5 真 PDF 导出（pdf-lib + 现有截图管线）← 依赖 B1（渲染稳定才能截图）
        │
C 安全与健壮性（服务端）                  │
  C1 登录限流 / C2 会话与 token 哈希化、Cookie Secure、目录权限
  C3 删除项目时清理未引用资源 / C4 路由 projectId 净化
  C5 错误响应统一（无内部路径、API JSON 404、ffmpeg 400）
  C6 /api/exports 限流与截断 / C7 上传魔数校验 / C8 PUBLIC_ORIGIN
  C9 事件日志容量与噪声 / C10 依赖升级与官方 registry / C11 容器非 root
        │
D 体验与一致性（前端）                    │
  D1 模板切换/替换的文案与后果说明（复用 A3 对话框）
  D2 圆角上限统一（28） / D3 页数与资源上限提示
  D4 术语与标签统一 / D5 活动日志标签与去重
  D6 撤销/重做 / D7 打印栈按需挂载 + memo
  D8 移动端账户标签与编辑器预览 / D9 无障碍（H1、skip link、radiogroup、reduced-motion）
  D10 字体与重复图片 / D11 时间格式统一
        │
E 工程化
  E1 服务端共享工具（createBadRequest 等）
  E2 Playwright 配置 + 新回归用例
  E3 CI + 文档 + .env.example
```

## 冲突点与规避

| 冲突 | 规避 |
| --- | --- |
| A1 改动 `.button` 基础样式会改变所有页面截图 | 先建立令牌与组件映射，再逐页核对；不做“每页覆盖” |
| B1 memo 化 `MagazinePreview` 与 D7 打印栈按需挂载相互影响 | 先修循环，再改挂载；两者都用同一个 memo 组件 |
| B4 引入 `rev` 会改变项目 JSON 结构与所有写入路径 | 读路径做默认值兼容（`rev ?? 0`），旧数据无需迁移 |
| C2 会话哈希化会让旧会话失效 | 实现 legacy 回退并自动升级，避免强制下线 |
| C10 依赖升级可能改变 Express/Multer 行为 | 独立提交，升级后跑 build + validate:mvp + e2e |
| D6 撤销/重做与自动保存叠加 | 撤销只改 project 状态，保存仍走统一链路；时间窗口合并快照 |

## 回归范围

- 服务端：认证（登录/注册/验证/重置/改密）、项目 CRUD 与分享、上传与变体、对象存储镜像、管理员接口、事件统计。
- 前端：首页、认证页、编辑器（上传/排版/模板/圆角/保存/导出/分享）、公开翻书页、账户中心、管理后台。
- 断点：1440 / 1024 / 768 / 390，桌面与触屏。
- 无障碍：键盘 Tab 顺序、焦点可见性、标题层级、reduced-motion。
- 性能：含照片页面主线程占用、DOM 变动、自动保存请求、首屏传输量。

## 验收门槛

`tsc --noEmit`、`vite build`、`npm run validate:mvp`、`npm run validate:e2e`、`npm audit`（无 high/critical）、
以及 B1–B5、C1/C4/C7、D1/D2/D6 的专项回归脚本全部通过。
