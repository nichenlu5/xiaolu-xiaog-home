# 小路 OS 架构边界

`xiaolu-xiaog-home` 是公开可访问的统一入口和个人仪表盘，不吞并专业项目仓库。当前仍保持零构建的 HTML / CSS / Vanilla JavaScript 结构；功能按“页面 + 独立数据 + 版本化存储”逐步演进。v2.6 在 Xiaolu OS 首页之上新增研究生旅程及其只读成长摘要。

## 三个长期核心

1. **事件总线（Event Bus）**：模块只发布稳定事件，例如 `study.session.completed`、`memory.created`、`exercise.logged`。首页订阅摘要，不直接读取模块内部实现。
2. **权限中心（Permission Center）**：浏览器本地、云同步、健康数据和 AI 调用分别授权。默认本地优先、最小权限；公开页面不等于公开个人数据。
3. **记忆核心（Memory Core）**：保存可迁移的共同档案与跨模块引用。模块只提交结构化记录，不彼此复制整份数据。

这三者目前是架构契约。v2.2 第一阶段只实现本地模块和稳定来源引用，不提前实现远端服务。

## 模块分层

| 层级 | 当前职责 | 未来扩展 |
|---|---|---|
| Home Shell | Xiaolu OS 手机式入口、统一导航、摘要卡片、PWA 外壳 | 通知与模块互联 |
| Domain Modules | 英语、游戏、愿望、足迹、运动、回忆馆、多笔记本、礼物盒、研究生旅程等独立页面 | 体态照片时间线与更完整关联 |
| Local Data | 各模块独立、版本化的 localStorage | 可导入导出、可选择迁移 |
| Integration | 模块清单、稳定链接、PWA 离线外壳 | 云同步、AI Companion |

## 存储约定

- 每个模块使用独立 key，不清空、不遍历删除其他模块的 localStorage。
- 每份数据必须带 schema version；迁移函数只向前迁移，并先过滤类型、范围和非法 ID。
- 遇到损坏 JSON 或未知的新版本时进入安全只读状态，不覆盖原值。
- 跨模块共享数据使用稳定的领域 ID；英语模块的单词身份是规范化英文，而不是某本词书的词条 ID。
- 云同步未来只能作为本地仓储接口的另一个适配器，页面逻辑不直接依赖云服务。

### v2.2 生活模块存储

| 模块 | localStorage key | 根结构 | 扩展边界 |
|---|---|---|---|
| 一起运动 | `xiaoluXiaogExerciseV1` | `{ schemaVersion, records }` | 单条记录预留 `posturePhotoRefs` |
| 回忆馆 | `xiaoluXiaogTimelineV1` | `{ schemaVersion: 3, memories }` | `source` 与 `links` 保存稳定领域 ID；记录支持收藏和置顶 |
| 笔记本 | `xiaoluXiaogNotesV1` | `{ schemaVersion: 3, notebooks, notes }` | 笔记通过稳定 `notebookId` 归属可管理的笔记本 |
| 礼物盒 | `xiaoluXiaogGiftsV1` | `{ schemaVersion: 1, gifts }` | 礼物通过 `links.memoryIds` 关联回忆 |
| 研究生旅程 | `xiaoluXiaogGraduateJourneyV1` | `{ schemaVersion: 1, settings, milestones }` | 月份精度时间设置、三阶段目标与状态；成长统计不复制入此 key |
| 跨模块成就 | `xiaoluXiaogAchievementsV2` | `{ schemaVersion, unlocked }` | 只登记稳定成就 ID 与首次解锁时间 |

生活模块仓储均过滤缺失字段和异常类型；JSON 损坏或检测到更高 schema 版本时只读展示，不覆盖原值。

### v2.3 备份边界

备份文件使用独立的 `backupSchemaVersion`，并按模块保存已登记 localStorage key 的原始 JSON 值，以保留未知字段。恢复只接受当前备份 schema，逐项校验根类型；损坏 JSON 仅留在导出文件供人工恢复，不自动写回。恢复不会清空备份未包含的 key；写入中途失败时会尝试回滚本轮已写项目。当前仅提供明确确认后的覆盖恢复，不提供自动合并或远端同步。

v2.5 将 `xiaoluXiaogGiftsV1` 加入第 16 个备份注册项。笔记本与笔记共用原有 notes 根存储，因此无需新增第二个 key。旧 v2.3/v2.4 备份没有 gifts 条目时，恢复逻辑不会删除或覆盖当前礼物数据。

v2.6 将 `xiaoluXiaogGraduateJourneyV1` 加入第 17 个备份注册项。旧 v2.3～v2.5 备份没有研究生旅程条目时，恢复逻辑不会删除或覆盖当前旅程数据。

v2.7 保持 `xiaoluXiaogGraduateJourneyV1` key 不变，将内部 schema 升级为 2，并在原状态中加入 `dailyRecords`、`communications` 与 `experiments`。schema 1 数据读取时只补空集合，不改写原有 settings 和 milestones；整个根对象继续作为同一个备份条目导出与恢复。

### v2.7 研究生生活关联边界

- 每个日期最多一条日常记录，同日保存执行更新。
- 本周小结只统计当前自然周内已有的日常、交流、实验和已完成里程碑，不生成推测内容。
- 交流的 `nextStep` 转为里程碑时保留 `sourceCommunicationId` 与 `milestoneId` 轻量回链；重复转换不会创建第二个里程碑。
- 实验预演状态使用 `draft`、`rehearsed`、`completed`，界面转换为中文显示。
- 不创建新的跨模块数据库或 localStorage key。

### v2.6 日期与摘要边界

- 默认正式入学日期为 `2026-09-14`，预计毕业月份为 `2029-06`；没有具体毕业日时仍按预计月份展示。
- 未设置具体毕业日时，倒计时以预计毕业月最后一天为计算边界，界面标注“约”和“预计”；设置具体日期后改用该日。
- 日期计算把本地今天映射到 UTC 日历日，只计算完整日边界，避免夏令时导致的 23/25 小时日与 off-by-one。
- 研一、研二阶段分别以入学月份起算的一周年、两周年为边界，之后至毕业为研三；入学前与到达毕业日另有明确状态。
- 首页和旅程页的成长统计只读解析现有模块 key，数据缺失或结构异常时显示“暂无数据”，不会写回或复制源数据。

### v2.5 迁移与关联边界

- Timeline V2 升级到 V3 时保留正文、日期、地点、标签、图片引用、来源和所有旧 links，并为旧记录补充 `favorite:false`、`pinned:false`。
- Notes V2 升级到 V3 时建立六本默认笔记本，所有旧笔记归入稳定 ID 为 `default` 的默认笔记本；标题、正文、日期、标签与来源不变。
- V3 用户删除的非默认空笔记本不会在下次加载时重新出现；`default` 始终作为安全回退存在。
- 从笔记或礼物创建回忆时，回忆保存 `source.module + source.itemId`，同时写入对应 `links.noteIds` 或 `links.giftIds`；来源记录保存回忆的稳定 ID 作为轻量回链。
- 本版不建立通用图数据库，也不自动复制来源正文；关联记录保持各自独立。

### v2.4 PWA 边界

- `manifest.webmanifest` 只描述安装名称、图标、主题和站内快捷方式，不包含个人数据。
- Service Worker 预缓存首页外壳；其余同源页面、脚本和词库仅在访问时按需缓存，避免首次安装下载全部大型词库。
- 导航请求优先联网，离线时才返回已缓存页面；未访问过的离线页面回退到首页。
- Cache Storage 与 `localStorage` 相互独立。缓存更新、清除或 Service Worker 升级不得迁移、删除或覆盖业务数据。
- 本版没有后台同步、推送、账号、远端接口或 AI 权限。

## 独立仓库

以下项目继续独立开发，由 Home 未来通过入口卡片和摘要协议聚合：

- `xiaolu-embedded-lab`
- `xiaolu-career-radar`
- `xiaolu-ai-hub`
- `xiaolu-research-toolkit`

Home 不复制这些仓库的业务代码。未来聚合数据时，每个项目提供小型只读摘要（版本、最近活动、进度和入口 URL），Home 只消费该摘要。

## 分阶段路线

- **v2.1**：英语数据边界、共享掌握状态、主动回忆、基础专项练习与报告。
- **v2.2 第一阶段**：运动、回忆、笔记使用独立 V1 存储；首页读取只读摘要；愿望和足迹通过 URL 预填建立可选来源引用。
- **v2.2 后续边界**：体态照片时间线、关系反向索引与模块事件协议。
- **v2.3**：全站备份/恢复、稳定来源引用、跨模块成就登记和首页动态摘要。
- **v2.4**：小路 OS 手机式首页、八应用入口、今日摘要、底部 Dock 与 PWA 离线壳；不改变各模块存储。
- **v2.5**：回忆馆收藏/置顶/日期层级、多笔记本、礼物盒、稳定 note/gift 回链与第 16 项备份注册。
- **v2.6（当前）**：研究生旅程、毕业倒计时、三阶段目标、首页只读摘要与第 17 项备份注册。
- **模块互联**：在稳定 ID 和导出恢复机制成熟后，再加入事件协议与可选双向索引。
- **平台能力**：PWA 离线壳已完成；云同步必须在冲突策略和导出恢复成熟后加入。
- **AI Companion**：最后接入权限中心与记忆核心，只读取用户明确授权的范围。
