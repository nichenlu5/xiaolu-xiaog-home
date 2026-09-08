# 小路 OS 架构边界

`xiaolu-xiaog-home` 是公开可访问的统一入口和个人仪表盘，不吞并专业项目仓库。当前仍保持零构建的 HTML / CSS / Vanilla JavaScript 结构；功能按“页面 + 独立数据 + 版本化存储”逐步演进。

## 三个长期核心

1. **事件总线（Event Bus）**：模块只发布稳定事件，例如 `study.session.completed`、`memory.created`、`exercise.logged`。首页订阅摘要，不直接读取模块内部实现。
2. **权限中心（Permission Center）**：浏览器本地、云同步、健康数据和 AI 调用分别授权。默认本地优先、最小权限；公开页面不等于公开个人数据。
3. **记忆核心（Memory Core）**：保存可迁移的共同档案与跨模块引用。模块只提交结构化记录，不彼此复制整份数据。

这三者目前是架构契约。v2.2 第一阶段只实现本地模块和稳定来源引用，不提前实现远端服务。

## 模块分层

| 层级 | 当前职责 | 未来扩展 |
|---|---|---|
| Home Shell | 房间入口、统一导航、摘要卡片 | 手机式首页、通知与模块互联 |
| Domain Modules | 英语、游戏、愿望、足迹、运动、回忆、笔记等独立页面 | 体态照片时间线与更完整关联 |
| Local Data | 各模块独立、版本化的 localStorage | 可导入导出、可选择迁移 |
| Integration | 只保存模块清单和稳定链接 | PWA、云同步、AI Companion |

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
| 回忆时间线 | `xiaoluXiaogTimelineV1` | `{ schemaVersion, memories }` | `source` 保存来源，`links` 预留领域 ID 数组 |
| 笔记 / 小纸条 | `xiaoluXiaogNotesV1` | `{ schemaVersion, notebooks, notes }` | 笔记通过 `notebookId` 归属笔记本 |
| 跨模块成就 | `xiaoluXiaogAchievementsV2` | `{ schemaVersion, unlocked }` | 只登记稳定成就 ID 与首次解锁时间 |

生活模块仓储均过滤缺失字段和异常类型；JSON 损坏或检测到更高 schema 版本时只读展示，不覆盖原值。

### v2.3 备份边界

备份文件使用独立的 `backupSchemaVersion`，并按模块保存已登记 localStorage key 的原始 JSON 值，以保留未知字段。恢复只接受当前备份 schema，逐项校验根类型；损坏 JSON 仅留在导出文件供人工恢复，不自动写回。恢复不会清空备份未包含的 key；写入中途失败时会尝试回滚本轮已写项目。当前仅提供明确确认后的覆盖恢复，不提供自动合并或远端同步。

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
- **v2.3（当前）**：全站备份/恢复、稳定来源引用、跨模块成就登记和首页动态摘要。
- **小路 OS 首页**：先做手机式导航壳和模块清单，再接摘要；不改变各模块存储。
- **模块互联**：在稳定 ID 和导出恢复机制成熟后，再加入事件协议与可选双向索引。
- **平台能力**：PWA 离线壳优先；云同步必须在冲突策略和导出恢复成熟后加入。
- **AI Companion**：最后接入权限中心与记忆核心，只读取用户明确授权的范围。
