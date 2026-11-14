# FinalFolio 产品报告

日期：2026-03-29

## 1. 当前结论

`FinalFolio` 已经从“照片排版 demo”进入“可继续经营的产品骨架”阶段。它当前不是空壳站点，而是具备以下完整表面：

- `Homepage`：产品叙事、featured issue proof、对外转化入口
- `Auth`：注册、登录、邮件验证、密码重置、TOS 接受
- `Editor`：多页 issue 创作、图片上传、裁切、排版、保存、打印/PDF
- `Account`：普通用户自助后台，管理自己的项目、上传和账户
- `Admin`：全站治理后台，负责项目、上传、用户、模板、站点配置、对象存储配置和事件观察
- `Server`：文件持久化、资产治理、邮件能力、对象存储镜像、基础安全与审计

一句话说穿：

> FinalFolio 已经具备继续向“真实多用户照片叙事产品”推进的基础，而不是只能截图演示的玩具。

## 2. 今天已解决的问题

以下“今天”明确指 `2026-03-29`（Asia/Shanghai）这一天内收口的工作。

### 2.1 Editor 登出后仍泄露上一位用户上传图片

- 原问题：用户 logout 后，`/editor` 里仍能看到刚才登录账号上传的图片，形成明显的会话隔离问题。
- 已处理：
  - editor 会在窗口聚焦和标签页恢复可见时刷新会话状态
  - logout 后，本地 draft 会清理掉上一位用户的 server-backed uploads
  - 对于属于账号的已保存 issue，logout 后不再继续裸露其媒体库，而是显示 sign-in gate

### 2.2 Account 删除上传后，Editor 不同步更新

- 原问题：在 `Account > My uploads` 删除图片后，editor `Photos` 面板仍残留旧图，形成“账号侧已删、编辑器还在”的错位状态。
- 已处理：
  - 提取了共享的 draft 资产移除逻辑
  - `My uploads` 删除成功后会同步清理本地 draft
  - 同时广播 browser event，让任何已打开的 editor 页面即时更新
  - editor 还会主动拿当前账号 upload inventory 对账，清掉历史僵尸图

### 2.3 Editor 中已被调用的图片点 Delete 后并不会真的删除

- 原问题：图片已经被页面 slot 使用时，editor 会弹确认框，但确认后实际删除失败，用户体验是“明明点了 Delete，却什么都没发生”。
- 已处理：
  - 删除动作改成真正的原子操作
  - 如果图片已经放进页面，确认后会先清掉相关 frame 引用，再把图片从当前 issue 移除
  - 对于服务器上已经被删掉但 editor 还残留的旧图，删除流程也增加了容错

### 2.4 仓库级日志补录

- 已把今天这批关键修复补进 `docs/devlog.md`，保证邮件、代码现状和仓库日志一致，不会出现“邮件里说修了，仓库里日志却还是旧状态”的割裂。

## 3. 当前已有功能

## 3.1 Homepage

- 首页文案和 featured issue 不再完全写死在前端，而是进入服务端配置体系
- 首页 proof 预览使用与 editor 一致的 `MagazinePreview`
- 首页已经能承担对外产品叙事，而不只是摆一个静态壳

## 3.2 Auth 与账号体系

- 用户注册
- 登录 / 登出
- 邮件验证
- 重发验证邮件
- 找回密码 / 重置密码
- Terms of Service 接受门槛
- 登录态会话持久化
- 基础验证码与按 IP 限流

## 3.3 Editor

- 多页 issue 结构
- 预设模板与 starter packs
- 自定义布局
- 图片上传
- fit / crop / scale 调整
- 页面顺序组织
- 页面文案编辑
- 本地 draft
- server-backed 项目保存 / reopen
- 打印 / PDF 输出
- 图片圆角、主题、模板治理联动

## 3.4 Account

- Overview
- My projects
- My uploads
- Account settings
- My templates / Preferences / Library 占位

## 3.5 Admin

- Overview
- Projects
- Uploads
- Governance
- Users
- Events
- Storage（对象存储配置入口）

## 3.6 Upload / Asset / Object Storage

- 上传后生成 `original / preview / thumb` 分层资源
- admin preview 与 inspect 不再傻吃原图
- 资源支持本地交付与对象存储镜像交付
- 对象存储配置可在 admin 后台治理
- 上传、项目、素材具备 ownership 与引用判断基础
- 删除时已有基础的引用安全检查与治理逻辑

## 3.7 共享预览与输出模型

- homepage / editor / admin inspect / print-export 共用核心页面渲染路径
- 图片几何计算已明显向统一模型收敛
- 预览与导出一致性比早期版本稳定得多

## 4. 当前主要风险

### 4.1 单机文件架构仍是现实边界

- 当前仍以文件持久化为主，易看懂、易维护，但不是多节点高并发架构
- 后续若进入更多用户、更多上传、更多治理动作，数据层还要继续升级

### 4.2 对象存储与大文件上传链路还需要继续加固

- 站内上传和对象存储镜像能力已经打通
- 但大文件、长连接、镜像同步和备份上传这类链路，仍需要继续做更稳的传输与重试策略

### 4.3 仍需要更多手工验收

- 自动校验和源码验证已经有了
- 但 editor 的真实使用手感、admin 操作流、homepage proof 的视觉验收，仍需要浏览器实测继续补

### 4.4 工作树尚未整理成一次干净提交

- 当前仓库工作树承载了大量连续推进结果
- 这说明开发在持续推进，但也意味着后续要安排一次更有纪律的整理、归档与提交

## 5. 下一阶段开发计划

## 5.1 上传与存储链路继续加固

- 继续收拾对象存储与大文件上传稳定性
- 让备份、镜像、恢复、清理形成更可预期的运维闭环
- 把对象存储切换、回退、回填做成更少踩坑的正式流程

## 5.2 用户内容治理继续补强

- 继续明确 project / upload / asset ownership 边界
- 把用户侧“我的素材 / 我的模板 / 我的偏好”逐步从占位推进为真实功能
- 继续避免 account / editor / admin 之间的状态错位

## 5.3 Editor 继续做成真正的创作主引擎

- 持续清理模板、媒体库、交互反馈中的误导性动作
- 继续提升预览、导出、媒体治理之间的一致性
- 补更多真实使用情境下的删除、替换、撤销、恢复和治理细节

## 5.4 Admin 继续从“可用”走向“成熟”

- 继续改善 inspect、治理、事件和失败诊断能力
- 让对象存储、模板治理、用户治理、站点配置在后台职责上更清晰
- 把运营、审计、风险观察和内容治理逐步拉开层次

## 5.5 上线纪律与备份体系继续完善

- 备份不仅要“有”，还要更稳定、更可验证、更易恢复
- 继续把上线回执、备份回执、devlog、产品报告连成一致闭环

## 6. 当前工作进度保存方式

- 最新工作内容已保存在当前仓库工作树
- 今日新增修复已补写到 `docs/devlog.md`
- 本报告已保存为 `docs/finalfolio-product-report-2026-03-29.md`
- 完整站点备份信息如下：
  - 备份命令：`bash /root/.openclaw/workspace/backup/scripts/run_project_backup.sh finalfolio`
  - 本地备份目录：`/tmp/dickless-backup/projects/finalfolio/20260328T164604Z`
  - 本地核心产物：
    - `finalfolio.tar.gz`，大小 `88264984` bytes
    - `manifest.json`
  - 对象存储桶：`copy`
  - 对象存储前缀：`dickless/project-backup/finalfolio/20260328T164604Z/`
  - 对象存储结果：
    - 主归档对象 `finalfolio.tar.gz` 已成功上传，远端 `ETag` 为 `"fa2d1202e99b9a2fb1eb4cd4c14b8e43"`，与本地 `manifest.json` 内记录的 `md5` 一致
    - `manifest.json` 已成功上传并完成回读校验，`timestamp_utc` 确认是 `20260328T164604Z`
    - 由于 Bitiful 对较大单次上传回执存在卡住现象，额外补充了一套 `chunks-1m/` 分块冗余副本与 `remote-layout.json`，共 `85` 个分块，总字节数与归档文件完全一致，便于必要时按块重组恢复
  - 远端恢复说明：
    - 优先直接使用对象存储中的 `finalfolio.tar.gz`
    - 如需走冗余分块恢复，可按 `remote-layout.json` 中记录执行 `cat chunks-1m/finalfolio.tar.gz.part-* > finalfolio.tar.gz`

## 7. 结语

现在的 FinalFolio，最值得肯定的不是“功能数量变多了”，而是它已经逐渐形成了清晰的产品分工：

- `homepage` 负责讲清产品和转化
- `editor` 负责创作和输出
- `account` 负责用户自助管理
- `admin` 负责治理和运营

这条路是对的。接下来不该回头再做 demo 化，而是继续把上传链路、会话边界、治理逻辑、对象存储、用户后台和创作体验往“能长期托付”的方向收紧。
