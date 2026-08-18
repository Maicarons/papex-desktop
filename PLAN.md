# papex-desktop 完整规划（桌面科研工作平台）

> 版本：v0.1（草案，待审阅）
> 日期：2026-08-18
> 定位：Papex 学术文献平台的桌面客户端，面向深度研究者的「科研工作平台」
> 平台：Windows / Linux / macOS
> 上游依赖：`github.com/Maicarons/papex`（Next.js API + PostgreSQL 后端）
> 技术栈主线：**Tauri 2.x（Rust 内核 + 系统 WebView）+ Vite + React + TypeScript**

---

## 1. 项目概述

### 1.1 定位与目标

- **一句话定位**：把「读文献、管文献、引文献」做成一个常驻桌面的完整工作台，对标 Zotero 的库管理 + 主流 PDF 阅读器的阅读体验 + papex 云端数据。
- **目标用户**：深度研究者（硕博、科研人员），日常在电脑前工作，需要：多文献对比、引用生成、离线阅读、长期追踪领域动态。
- **核心价值**：
  1. 本地优先的文献库：秒开 PDF、全文检索、离线可用；
  2. 阅读批注闭环：高亮 → 笔记 → 云端同步；
  3. 引用即取即用：CSL 生成、BibTeX 导出、LaTeX 插入（对接 papex-latex）；
  4. 平台级体验：托盘常驻、全局快捷键、系统通知、深色跟随系统。
- **明确不做（V1）**：多人实时协同编辑、投稿审核后台、完整 Web 版后台管理。

### 1.2 与网页版/移动端的分工

| 能力 | 网页版 | 移动端 | 桌面端 |
|---|---|---|---|
| 浏览/检索/读 PDF | ✅ | ✅ | ✅（增强：全文索引） |
| 收藏/订阅/消息 | ✅ | ✅ | ✅ |
| 批注/笔记 | ❌ | 查看 | ✅（编辑 + 云同步） |
| 引用管理/BibTeX/LaTeX | 部分 | ❌ | ✅（核心差异点） |
| 本地 PDF 库/离线 | ❌ | 下载阅读 | ✅（本地优先） |
| 投稿/审核/后台 | ✅ | ❌ | ❌（V1） |

---

## 2. 技术栈（明细）

| 层 | 选型 | 版本/说明 |
|---|---|---|
| 桌面壳 | **Tauri 2.x** | 2.11+ 线；系统 WebView（Win WebView2 / macOS WKWebView / Linux WebKitGTK） |
| 后端语言 | Rust | 2021 edition；本地 PDF 解析、索引、SQLite、更新、托盘 |
| 前端框架 | **Vite + React + TypeScript** | React 19 + TS 5.x strict；独立工程（非 Next.js） |
| UI | Tailwind CSS 4 + shadcn 风格 | 复用 papex 网页端设计令牌（CSS 变量） |
| 图表 | ECharts 6 | 引文图谱、阅读统计（复用网页端配置） |
| PDF 渲染 | pdf.js（前端渲染）+ Rust pdfium（本地解析） | 渲染层与解析层分离 |
| 标注存储 | SQLite（Rust rusqlite）+ 云端 notes 表 | 本地优先、双向同步 |
| 全文索引 | Rust **tantivy** | 标题/摘要/全文本地倒排索引（P2） |
| 状态管理 | Zustand | 与网页端一致 |
| 网络 | fetch 封装 API client | 从 papex openapi.json 生成类型 |
| 自动更新 | Tauri updater 插件 | 全量包 + 代码签名 |
| 钥匙串 | Rust keyring crate | macOS Keychain / Windows Credential Manager / Linux Secret Service |
| 测试 | Vitest（前端单测）+ Rust cargo test + Playwright（E2E，可选） | |
| 包管理 | pnpm | |

### 2.1 关键依赖与版本锚点

```
tauri 2.x（@tauri-apps/api v2）
react 19 + react-dom 19
vite 6+（vite-plugin-react）
tailwindcss 4（@tailwindcss/vite）
pdf.js（pdfjs-dist 4.x，worker 本地打包）
tauri-plugin-updater / tauri-plugin-notification / tauri-plugin-single-instance
rust crates: tauri-build, serde, serde_json, rusqlite, pdfium-render(或 mupdf), tantivy, keyring, reqwest
```

> **WebView 兼容约束**：目标内核为 WebView2（Chromium 124+）/ WKWebView（Safari 17+）/ WebKitGTK 2.44+。开发期用最新 Chromium 验证，发布前在三平台分别做视觉回归（ECharts/Canvas/字体渲染差异点）。

---

## 3. 架构与目录结构

```
papex-desktop/
├── src/                        # 前端（Vite + React）
│   ├── app/                    # 路由（react-router v7）与页面
│   │   ├── routes/             # Library / Reader / Citations / Stats / Settings / Login
│   │   └── layout/             # 三栏布局、托盘菜单联动
│   ├── features/
│   │   ├── library/            # 文献库（树/列表/详情）
│   │   ├── reader/             # PDF 阅读器 + 标注层
│   │   ├── notes/              # 笔记面板与同步
│   │   ├── citations/          # 引用生成/导出
│   │   ├── graph/              # 引文图谱
│   │   ├── sync/               # 后台同步队列
│   │   └── settings/           # 账号/存储/快捷键/主题
│   ├── lib/
│   │   ├── api/                # client / refresh / endpoints（openapi 生成）
│   │   ├── tauri/              # invoke 封装（bridge.ts 类型安全）
│   │   ├── storage/            # PDF 缓存目录管理
│   │   └── theme/              # 设计令牌 + 深浅色
│   └── components/             # 通用组件（从 papex 网页端移植）
├── src-tauri/                  # Rust 后端
│   ├── src/
│   │   ├── main.rs             # 入口、插件注册
│   │   ├── commands/           # PDF 解析 / 索引 / SQLite / 钥匙串 / 文件操作
│   │   ├── db/                 # SQLite 连接、迁移、DAO（papex_local.db）
│   │   ├── indexer/            # tantivy 索引（P2）
│   │   ├── sync/               # 后台同步任务（reqwest + 队列）
│   │   └── updater/            # 更新器封装
│   ├── capabilities/           # Tauri 权限白名单（最小授权）
│   ├── tauri.conf.json
│   └── Cargo.toml
├── scripts/
│   ├── gen-types.sh            # openapi.json → TS 类型
│   └── build-{win|linux|mac}.sh # 三平台打包
├── e2e/                        # Playwright（可选，走真实 WebView）
└── package.json
```

### 3.1 前端与 Rust 的边界（invoke 契约）

```
前端 lib/tauri/bridge.ts  ←── invoke("pdf:extract_text", { path })
                             invoke("db:query_library", { filter })
                             invoke("indexer:search", { q })
                             invoke("keyring:get", { service })
Rust commands/ 负责：文件系统、PDF 解析、SQLite、索引、钥匙串、下载队列
前端永不直接碰文件系统；所有原生能力走 bridge.ts 类型化封装
```

### 3.2 本地数据库（papex_local.db，SQLite）

```
papers_cache(id TEXT PK, title, abstract, category, status, latest_version, fetched_at)
versions_cache(paper_id, version, pdf_path_local, size, fetched_at)
annotations(id PK, paper_id, version, page, rect_json, color, note_text, created_at, updated_at, sync_state)
reading_progress(paper_id PK, page, percent, updated_at, sync_state)
collections(id, name, parent_id)          -- 本地收藏夹（可选，V2）
tags_local(paper_id, tag)                 -- 本地标签（V2）
sync_queue(id PK, kind, payload_json, retry_count, next_retry_at)
```

- `sync_state`: `local`（仅本地）/ `pending`（待上传）/ `synced` / `conflict`；
- 冲突策略（MVP）：last-write-wins + 版本号，冲突时保留两端并在 UI 提示（P2 再考虑合并）。

---

## 4. 功能规划

### 4.1 P0 — MVP（可发布三平台）

| # | 模块 | 功能点 | 验收标准 |
|---|---|---|---|
| 1 | 认证 | 登录/登出/多账号 | token 入系统钥匙串；多账号切换；401 自动刷新 |
| 2 | 文献库 | 三栏布局（分类树/列表/详情） | 257 分类树（双语）、分页列表、筛选（分类/状态/时间）、排序 |
| 3 | 文献库 | 收藏/订阅/标签 | 与网页端双向同步 |
| 4 | 检索 | 关键词 + 语义（在线） | 复用 `/api/search`；语义开关；结果跳详情 |
| 5 | 阅读器 | PDF 内嵌阅读 | pdf.js 渲染 `/api/papers/[id]/pdf/[version]`；翻页/缩放/搜索/书签/进度记忆 |
| 6 | 标注 | 高亮 + 文本笔记 | 选择文本→高亮（多色）→笔记；渲染层自绘覆盖层；数据入 annotations 表 |
| 7 | 同步 | 标注/进度云同步 | 上传/拉取 notes 与 reading_progress；断网本地可用，联网自动同步 |
| 8 | 离线 | PDF 本地缓存 | 已读 PDF 缓存到本地目录；离线打开；缓存管理页（清理/上限） |
| 9 | 引文图谱 | 交互式图谱 | 复用网页端 citation-graph 逻辑；节点点击跳详情 |
| 10 | 通知 | 订阅新论文提醒 | 系统通知（tauri-plugin-notification），可开关 |
| 11 | 平台 | 托盘 + 全局快捷键 + 单实例 | 最小化到托盘；快捷键（如 Ctrl/Cmd+K 全局搜索）；单实例锁 |
| 12 | 设置 | 主题/语言/存储 | 深色跟随系统、zh/en、缓存上限 |

### 4.2 P1 — 科研工作平台成型

| # | 模块 | 功能点 | 验收标准 |
|---|---|---|---|
| 13 | 引用 | CSL 引用生成 | 选择样式（GB/T 7714、APA、MLA 等 ≥10 种）→ 生成参考文献/文内引用 |
| 14 | 引用 | BibTeX 导出 | 单篇/批量导出 `.bib`；EndNote RIS 导出 |
| 15 | 写作 | LaTeX 集成 | 对接 `papex-latex` 包：生成 `\cite{key}` 与参考文献块，一键复制 |
| 16 | 文献库 | 保存的搜索 | 筛选条件存为「智能文件夹」，自动更新 |
| 17 | 统计 | 阅读统计 | 阅读时长/论文数/分类分布/引用 Top（ECharts） |
| 18 | 阅读器 | 双栏对比阅读 | 两篇 PDF 并排；批注同步定位 |
| 19 | 数据 | PDF 导入 | 拖入本地 PDF → 解析元数据（pdfium）→ 上传服务器或仅存本地库 |
| 20 | 数据 | 离线全文索引（tantivy） | 本地标题/摘要/全文检索，离线可用，毫秒级返回 |

### 4.3 P2 — 进阶

| # | 模块 | 功能点 |
|---|---|---|
| 21 | 协作 | 协审/背书/评论聚合视图（只读+快捷操作） |
| 22 | 本地语义 | 可选本地 embedding 模型（Ollama 等）做离线语义检索 |
| 23 | 插件 | 插件系统雏形（借鉴 Zotero：脚本/外挂加载） |
| 24 | 写作 | Word 集成（Word 加载项生成引用，P2 评估） |
| 25 | 平板 | 触屏手势适配（P2 末评估） |

### 4.4 不做清单（本期明确排除）

投稿/审核后台、多人实时协同、服务器端管理功能、完整 Office 插件矩阵（仅 LaTeX/CSL/BibTeX）。

---

## 5. 界面与交互设计

### 5.1 三栏主布局（工作台默认）

```
┌──────────┬──────────────────────────┬───────────────────────┐
│ 侧栏      │ 文献列表                   │ 详情/阅读面板           │
│ 分类树     │ 筛选栏(搜索/分类/状态/排序)  │ 元数据卡                │
│ 智能文件夹 │ 卡片行(标题/作者/年份/标签)  │ PDF 预览或阅读器        │
│ 收藏/订阅  │ 分页/无限滚动              │ 标注/笔记 Tab           │
│ 下载/离线  │                          │ 引用/图谱 Tab           │
└──────────┴──────────────────────────┴───────────────────────┘
可折叠/可拖拽分栏；宽度记忆；F11 全屏阅读
```

### 5.2 关键页面规格

| 页面 | 要点 |
|---|---|
| 阅读器 | 中央 PDF（pdf.js）+ 右侧批注抽屉；高亮悬浮工具栏（颜色/笔记/删除）；阅读进度条；深色反色 |
| 引用页 | 样式下拉 → 预览 → 复制/导出；BibTeX 代码高亮展示 |
| 图谱页 | ECharts 力导向图：节点=论文、边=引用；点击高亮邻居 |
| 统计页 | ECharts：阅读时间曲线、分类饼图、Top 引用 |
| 设置页 | 账号（多账号/设备）/ 同步 / 存储（缓存大小/清理）/ 快捷键 / 主题 / 更新 |

---

## 6. 数据与 API 对接

### 6.1 复用 papex API（同移动端清单）

认证、论文、版本、PDF 流式、检索、分类、收藏、订阅、背书、消息、工单、反馈、API Key 管理——全部复用，无新写服务端逻辑。

### 6.2 需要 papex 后端新增的接口（依赖项）

| 接口 | 用途 | 优先级 |
|---|---|---|
| `POST /api/auth/refresh` + `devices` 表 | token 轮换/设备撤销 | **P0（阻塞）** |
| `GET/PUT /api/reading-progress/[paperId]` | 进度同步 | P0 |
| `GET/POST/PUT/DELETE /api/notes`（annotations 云表） | 批注云同步 | P0 |
| 推送订阅端点（桌面通知可无，跳过） | — | 可选 |

> 与 papex-app 共享同一份后端接口契约；`scripts/gen-types.sh` 从 `openapi.json` 生成类型。

### 6.3 本地/云端数据流

```
云端 papex(PostgreSQL)  ←──HTTPS──→  papex-desktop
                                     ├─ 在线查询走 API（列表/详情/检索）
                                     ├─ 已读 PDF 缓存本地（断网可开）
                                     ├─ annotations/reading_progress 双写：
                                     │    本地 SQLite（即时可用）+ 同步队列（后台上传）
                                     └─ sync_queue 失败重试（指数退避），手动「立即同步」
```

---

## 7. 认证与安全

### 7.1 Token 生命周期（与移动端一致）

```
登录 → { accessToken(15–60min), refreshToken(30d, 轮换+设备绑定) } → 系统钥匙串
请求: Authorization: Bearer；401 → 自动 refresh → 重放；refresh 失效 → 清会话跳登录
```

### 7.2 钥匙串接入

| 平台 | 后端 | Rust crate |
|---|---|---|
| Windows | Credential Manager | `keyring`（wincred） |
| macOS | Keychain | `keyring`（Security.framework） |
| Linux | Secret Service（libsecret）/ 回退加密文件 | `keyring`（secret-service），无桌面环境时回退 `keystore` 文件（0600 权限） |

### 7.3 安全基线

- Tauri capabilities 白名单：默认全禁，仅授权 `fs:read`（缓存目录）、`shell:open`（默认浏览器）、`notification`、`updater` 等最小集合；
- 所有 invoke 命令输入做类型校验（serde），禁止任意路径穿越（路径统一走 `app_cache_dir()`）；
- 前端仅 HTTPS 请求；不加载远程脚本（CSP 收紧）；
- 本地 SQLite 不存明文 refreshToken（只在钥匙串）；索引文件不含全文原样副本（P2 再定）。

---

## 8. 打包 / 签名 / 分发

| 平台 | 产物 | 签名/公证 | 分发渠道 |
|---|---|---|---|
| Windows | NSIS/MSI | 代码签名证书（EV/OV，必须） | 官网下载 + winget（可选） |
| macOS | .app/.dmg | Developer ID + 公证（notarization，必须） | 官网 + App Store（可选） |
| Linux | .deb / AppImage / .rpm | 可选（无强要求） | 官网 + 各发行版源（后续） |

### 8.1 自动更新

- Tauri updater：打包生成签名更新清单（`latest.json`）+ 全量包，托管在 GitHub Releases（每个平台一个 asset）；
- 启动时静默检查 + 手动检查；更新下载进度 UI；
- 签名密钥（updater 私钥）妥善保管，泄漏即作废。

### 8.2 前置准备

- Windows 代码签名证书（OV 约 ¥1500–3000/年，EV 更贵）+ macOS Developer ID（99 美元/年）；
- Linux：构建机装依赖（webkit2gtk、libappindicator 等），AppImage 工具链；
- 三平台 CI：GitHub Actions 矩阵（windows-latest / macos-latest / ubuntu-latest），产物 + 签名 + 发布 Release。

---

## 9. 开发环境搭建（脚手架命令）

```bash
# 1) 创建 Tauri 2 + Vite + React 工程
npm create tauri-app@latest papex-desktop -- --template react-ts
cd papex-desktop && npm i

# 2) 生成 API 类型（依赖 papex openapi.json）
npm run gen:types

# 3) 本地开发（前端 HMR + Tauri dev 窗口）
npm run tauri dev

# 4) 三平台打包
npm run tauri build          # 当前平台产物
# CI: scripts/build-{win|linux|mac}.sh 分别出各平台安装包
```

### 9.1 依赖系统说明（Linux 首次）

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

### 9.2 验收门禁（每个 PR）

- `tsc --noEmit` 0 错误；Vitest 单测通过；`cargo test` 通过；
- Rust `cargo clippy` 无 warn（CI 强制）；
- 当前平台冒烟：登录 → 列表 → 读 PDF → 高亮 → 重启后标注仍在 → 同步状态正确。

---

## 10. 里程碑计划

| 阶段 | 内容 | 验收 | 预估 |
|---|---|---|---|
| M0 基建 | Tauri 工程三平台跑通、bridge 契约、API client、认证改造联调 | 三平台能登录并浏览列表 | 2–3 周 |
| M1 MVP | P0 全部 12 项（阅读器+标注+本地缓存+同步） | 三平台安装包可分发；核心闭环可用 | 6–8 周 |
| M2 平台化 | P1 全部 8 项（引用/BibTeX/LaTeX/统计/导入/索引） | 科研工作平台完整可用 | 5–6 周 |
| M3 发布 | 签名/公证/自动更新/官网下载 | 三平台正式版 + 自动更新链路 | 2–3 周 |
| M4 进阶 | P2 部分 + 插件雏形 | 社区反馈驱动迭代 | 持续 |

> 总预估约 15–20 周（1 名前端 + 1 名 Rust/后端兼职 + 后端接口依赖方配合）。

---

## 11. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| 三平台 WebView 渲染差异（ECharts/pdf.js 表现） | 视觉回归 | 开发期锁定最低内核版本；三平台发布前视觉回归清单（截图对比） |
| Linux WebKitGTK 兼容怪癖 | Linux 端体验 | 保守 CSS 子集；重点机型列表；AppImage 优先分发 |
| PDF 标注自绘层工作量 | 阅读器复杂度 | 分层：先做文本高亮（pdf.js text layer 定位），再做自由矩形/手绘（P2） |
| 后端 refresh/notes 接口未按期交付 | M0/M1 阻塞 | 先以 API Key 打通；notes 先用本地 SQLite（离线可用）再补云同步 |
| 自动更新签名/公证成本 | 分发风险 | M0 就建 CI 发布流水线；密钥管理规范 |
| Rust 学习/编译时间 | 迭代速度 | Rust 侧保持薄（只做原生能力）；前端占 80% 工作量 |

---

## 12. 里程碑验收口径（M1 后即可作为「科研工作平台」试用）

1. 三平台安装包可下载安装，登录后可浏览/检索/读 PDF；
2. 高亮/笔记本地可用并可与云端同步（若后端已就绪）；
3. 已读 PDF 离线可开；阅读进度跨设备续读；
4. 托盘常驻、全局快捷键、系统通知可用；
5. 自动更新链路打通（内测通道）。
