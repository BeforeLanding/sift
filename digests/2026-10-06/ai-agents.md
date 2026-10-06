# OpenClaw 生态日报 2026-10-06

> Issues: 40 | PRs: 40 | 覆盖项目: 5 个 | 生成时间: 2026-10-06 01:29 UTC

- [OpenClaw](https://github.com/openclaw/openclaw)
- [Hermes Agent](https://github.com/nousresearch/hermes-agent)
- [IronClaw](https://github.com/nearai/ironclaw)
- [QwenPaw](https://github.com/agentscope-ai/QwenPaw)
- [ZeroClaw](https://github.com/zeroclaw-labs/zeroclaw)

---

## OpenClaw 项目深度报告

# OpenClaw 项目摘要 — 2026-10-06

## 1. 今日概览
OpenClaw 目前处于高强度的稳定化阶段，以 **v2026.10.1-beta.1** 的发布以及围绕 Gateway 性能和内存管理活动的激增为标志。该项目面临来自 `prepared-model-catalog` worker 中报告的内存泄漏和会话状态持久化问题的巨大压力，这些问题主导了 Issue 跟踪器和 Pull Request。虽然核心功能对许多用户来说保持稳定，但社区正在积极排查在九月下旬（具体为 2026.9.4–2026.9.6 版本）引入的回归问题。维护者和贡献者正优先进行架构重构，将繁重的同步操作卸载到 worker 线程，旨在解决事件循环阻塞并提高可扩展性。

## 2. 版本发布
### **v2026.10.1-beta.1**
*   **亮点：**
    *   **Sessions & Memory:** 在注册表变更期间保留使用情况；从远程工作区交付 worker 附件。
    *   **稳定性修复：** 防止排队取消和转录别名导致活动轮次停滞；保持续签名对齐。
    *   **迁移：** 自动化嵌入缓存迁移。
*   **备注：** 此 Beta 版本试图解决先前版本中报告的几个关键稳定性问题。鼓励在 2026.9.x 中遇到“崩溃循环”或轮次停滞的用户测试此构建版本，尽管它被标记为 beta 且可能包含新的回归问题。

## 3. 项目进展
今日的活动严重偏向于**性能优化**和**内存泄漏修复**，值得注意的是合并 PR 数量极少（5 个已关闭/合并 vs. 35 个开启），表明审查或测试能力存在瓶颈。

*   **关键架构转变 (PRs):**
    *   **#165644 (`perf(auth)`):** 将 auth 保存移至 workers，以防止在 SQLite JSON 编码期间 Gateway 停滞。
    *   **#165819 (`perf(session-entry)`):** 将冷启动和子补丁卸载到 worker 线程，以减少主线程事务负载。
    *   **#165836 (`perf(sessions)`):** 隔离转录 worker 队列，以防止稀疏显示历史扫描阻塞元数据请求。
    *   **#165733 (`refactor(sessions)`):** 一项重大重构，仅持久化运行结果，依赖运行注册表来维持活跃度，以修复侧边栏/状态不匹配问题。
*   **关键修复：**
    *   **#165866 (`fix(doctor)`):** 解决升级到 2026.10.1-beta.1 期间旧版会话条目状态迁移失败的问题。
    *   **#165882 (`fix(update)`):** 确保 checkout 插件技能在更新保留过程中仍可加载。

## 4. 社区热点话题
社区高度关注 **Gateway 内存行为**和 **WebUI 稳定性**。

*   **#159662: `prepared-model-catalog.worker.js` 中的无界内存泄漏**
    *   **状态：** Open, P0, Silver Shellfish 评级。
    *   **讨论：** 用户报告在空闲安装上，RSS 在 60-90 分钟内从约 2.5 GB 增长到 8-10 GB。这与提供商无关，并在冷重启后复现。
    *   **链接：** [Issue #159662](https://github.com/openclaw/openclaw/issues/159662)
*   **#149361: WebUI 性能和稳定性总括议题 (Umbrella Issue)**
    *   **状态：** Open, P2, Platinum Hermit 评级。
    *   **讨论：** 一个中央枢纽，用于跟踪滚动补偿、历史记录加载触发器以及移动/桌面渲染问题。高评论数表明广泛的 UX 摩擦。
    *   **链接：** [Issue #149361](https://github.com/openclaw/openclaw/issues/149361)
*   **#165644: Auth 保存阻塞 Gateway 事件循环**
    *   **状态：** Open PR, 等待维护者审查。
    *   **讨论：** 强调普通的共享/代理本地更新在重新读取 SQLite 单元格时会使 Gateway 停滞。此 PR 旨在将这些操作移至 workers。
    *   **链接：** [PR #165644](https://github.com/openclaw/openclaw/pull/165644)

## 5. Bug 与稳定性
严重的稳定性问题主导着 Bug 跟踪器，特别是与内存管理和进程生命周期相关的问题。

| Severity | Issue ID | Title | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **P0** | [#159662](https://github.com/openclaw/openclaw/issues/159662) | `prepared-model-catalog.worker.js`: 无界内存泄漏 (~4-5 GB/h) | Open | 2026.9.6+ 中的严重回归。尚未关联修复 PR。 |
| **P0** | [#158095](https://github.com/openclaw/openclaw/issues/158095) | Gateway worker 在 acquireSqliteWorkerLifecycle 后保持 state-lifecycle | Open | 导致每次后续获取都失败，直到重启。 |
| **P1** | [#119720](https://github.com/openclaw/openclaw/issues/119720) | 大规模下同步代理持久化阻塞 Gateway 事件循环 | Open | 部分修复已落地 (#140231, #138984)，但仍活跃。 |
| **P1** | [#159596](https://github.com/openclaw/openclaw/issues/159596) | 2026.9.6 上的 Gateway 内存锯齿波 | Open | 与 #159662 相关；内存压力事件触发 worker 退役。 |
| **P1** | [#97616](https://github.com/openclaw/openclaw/issues/97616) | 泄漏未回收的 hook/tool 子进程 (僵尸进程) | Open | 长期存在的问题，导致运行时性能下降。 |

**分析：** 围绕 `prepared-model-catalog` worker 和 SQLite 状态管理存在明显的问题集群。“锯齿波”内存模式表明，虽然垃圾回收或 worker 回收会发生，但底层分配率过高或对象未被正确解引用。

## 6. 功能请求与路线图信号
用户请求表明对更好的可观测性和身份集成的渴望。

*   **#51441: 在 session_status 中暴露解析后的后端模型**
    *   **信号：** 使用路由代理 (LiteLLM) 的用户无法看到实际使用的后端模型（例如，`openai/gpt-5.4` vs. 别名 `litellm/complex`）。这阻碍了调试和成本跟踪。
    *   **可能性：** 中等。需要更改代理运行时报告状态的方式。
*   **#70266: 在 macOS Talk Mode 叠加层中使用助手头像**
    *   **信号：** 针对 macOS 客户端的个性化请求。低复杂度，高用户满意度潜力。
    *   **可能性：** 高。可能会在一个小的 UI 补丁中被采纳。
*   **#165685: 在 registry-settled yielded collector 上提供机器可读的原因**
    *   **信号：** 面向管理复杂代理工作流开发者的先进诊断功能。
    *   **可能性：** 低/中等。小众开发者工具。

## 7. 用户反馈摘要
*   **痛点：**
    *   **内存焦虑：** 多名用户表示因内存快速增长而在资源受限设备上运行 OpenClaw 感到担忧（“60-90 分钟内达到 8-10 GB”）。
    *   **更新脆弱性：** 有报告称失败的更新使网关处于“未验证”状态，或需要手动干预 (`state-migrated-no-rollback`)。
    *   **插件信任问题：** 路径管理的 (`--link`) 插件安装被视为“不可信”，破坏了本地开发工作流程。
*   **满意驱动因素：**
    *   **性能重构：** 社区普遍支持将任务移至 worker 线程的巨大努力 (#165644, #165819)，视其为通往可扩展性的必要路径。
    *   **透明度：** 像 #149361 这样的详细总括议题帮助用户理解他们特定的 UI 故障是已知、跟踪的一批修复的一部分。

## 8. 积压监控
*   **#142821: 默认开启的模型可见转录脱敏污染重放的代理上下文**
    *   **年龄：** 创建于 2026-09-09。
    *   **状态：** P0, Diamond Lobster。
    *   **风险：** 这是一个安全/行为 bug，其中掩码传播到命令/文件/回复。它已开启近一个月，近期无活动。需立即分诊的高优先级事项。
*   **#132888: 非原生通道的 Exec 审批自动取消**
    *   **年龄：** 创建于 2026-08-29。
    *   **状态：** 今日关闭。
    *   **备注：** 解决方案确认，如果轮次在设置原生审批标志之前结束，`/approve` 会失败。用户必须使用原生通道进行 exec 审批。
*   **#151795: 路径管理的插件安装不被信任**
    *   **年龄：** 创建于 2026-09-18。
    *   **状态：** Open, P2。
    *   **风险：** 阻止本地插件开发/测试。需要决定是放宽对 `--link` 的信任策略，还是提供更清晰的错误/变通方法。

---

## 横向生态对比

# 跨项目对比报告：个人 AI 助手生态系统
**日期：** 2026-10-06

## 1. 生态系统概览
目前，个人 AI 助手的开源格局正处于关键的“稳定化与扩展性”阶段。OpenClaw 和 Hermes Agent 等主要项目优先关注基础设施可靠性而非新功能交付，以解决严重的内存泄漏和事件循环阻塞问题。尽管核心代理逻辑依然稳健，但第三方模型 API 的快速变更（如 GPT-6、DeepSeek-V4）给生态系统带来了巨大阻力，迫使框架实现动态提供商兼容层并执行更严格的输入验证。社区参与度虽高但较为分散，用户强烈要求提升对静默失败的可见性，并加强对非标准部署环境（局域网、Windows、移动消息平台）的支持。趋势表明，行业正从简单的聊天机器人向复杂的多渠道工作流编排引擎转型，这对严格的状态管理和安全沙箱提出了更高要求。

## 2. 活跃度对比

| 项目 | 活跃 Issue (24h) | 更新 PR (24h) | 发布状态 | 健康评分* | 主要焦点 |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **OpenClaw** | 高 (P0 内存泄漏) | 35 Open / 5 Merged | v2026.10.1-beta.1 | **Critical** | Gateway 稳定性、Worker 卸载、内存修复 |
| **Hermes Agent** | 10 Active | 40 Updated / 37 Open | None | **Stable-High** | Updater 加固、Gateway 路由、Provider 兼容性 |
| **IronClaw** | 低 (2 New) | 2 New | None | **Good** | 消息集成 (iMessage/SMS)、WebChat UX |
| **QwenPaw** | 高 (回归问题) | 26 Updated | None (v2.2.x beta) | **Unstable** | Provider API 断裂 (OpenCode/GPT-6)、会话污染 |
| **ZeroClaw** | 6 New Issues | 40 Open | None | **Moderate** | SOP 框架扩展、安全 Schema、Channel 一致性 |

*\*健康评分基于未修复 Bug 的严重程度与合并速度及发布频率的综合评估。*

## 3. OpenClaw 的定位

### 相比同行的优势
*   **架构成熟度：** 不同于正在处理基础集成回归问题的 QwenPaw 或 IronClaw，OpenClaw 正在通过重构为 Worker 线程来解决深层架构瓶颈（如事件循环阻塞、SQLite 争用）。一旦稳定下来，这将使其成为高负载企业级或高级用户场景下最具扩展性的选择。
*   **社区透明度：** OpenClaw 维护着详尽的汇总 Issue（例如 WebUI 相关的 #149361）以及对内存泄漏的精确追踪（#159662），即使在面临关键的 P0 级 Bug 时，也通过透明沟通建立了信任。
*   **核心稳定性基石：** 尽管当前存在内存问题，但其核心代理循环和会话注册表机制被视为其他项目的参考标准，特别是在运行结果（run outcomes）和续接签名（continuation signatures）的管理方面。

### 技术路线差异
*   **以 Worker 为中心的重构：** OpenClaw 正积极将同步操作（如认证保存、转录解析、嵌入缓存）迁移至专用 Worker 线程 (#165644, #165819)。相比之下，Hermes 专注于 Updater 安全性和消息路由逻辑，而 ZeroClaw 则强调基于 Schema 的配置和 SOP 组合。
*   **状态持久化策略：** OpenClaw 仅持久化“运行结果”并依赖注册表维持活性 (#165733) 的策略，与 QwenPaw 因文件块导致上下文污染的困境形成对比，这表明 OpenClaw 在瞬态状态与持久历史之间有着更严格的隔离。

### 社区规模对比
*   **体量与压力：** OpenClaw 拥有最高数量的复杂技术讨论和 P0 级 Bug 报告，显示出其用户基数更大且需求更为苛刻，不断将系统推向极限。Hermes Agent 的 PR 数量相当，但侧重于边缘情况的 Provider 配置，暗示其拥有一个技术精湛但稍小的利基社区。IronClaw 和 QwenPaw 相对于代码库规模的活跃度较低，这可能意味着它们处于早期采用阶段，或者其生产环境承受的压力较小。

## 4. 共同的技术焦点领域

多个项目中涌现出若干共性需求，凸显了 AI 代理生态系统中的系统性挑战：

| 需求领域 | 涉及项目 | 具体需求与证据 |
| :--- | :--- | :--- |
| **Provider API 波动性处理** | **OpenClaw**, **Hermes**, **QwenPaw**, **ZeroClaw** | 所有项目都因模型快速更新而面临中断。<br>- *QwenPaw:* `max_completion_tokens` 白名单对 GPT-6 失效 (#8074)；OpenCode Go 缺少请求头 (#7599)。<br>- *Hermes:* LiteLLM 别名导致上下文长度解析失败 (#133606)；GLM-5.3 拒绝推理参数 (#133595)。<br>- *OpenClaw:* 与预准备模型绑定的模型目录存在内存泄漏 (#159662)。<br>- *ZeroClaw:* GPT-5.6/Codex 故障导致 Tool-call 信封泄漏 (#10446)。 |
| **会话状态完整性与污染防护** | **OpenClaw**, **Hermes**, **QwenPaw** | 防止无效状态导致会话崩溃的需求至关重要。<br>- *QwenPaw:* 文件上传污染上下文，导致永久性 400 错误 (#8022)。<br>- *OpenClaw:* 转录别名导致活跃轮次停滞；遗留状态迁移失败 (#165866)。<br>- *Hermes:* Subagent 完成导致聊天路由停滞 30 分钟 (#131578)。 |
| **非标准部署兼容性** | **IronClaw**, **Hermes**, **QwenPaw** | 对纯局域网、Windows 及自托管 HTTP 支持的需求日益增长。<br>- *IronClaw:* Web Push 在纯 HTTP/局域网环境下失败；后台标签页 UI 过期 (#8124)。<br>- *Hermes:* LSP URI 编码在 Windows 驱动器上出错 (#127810)；Updater 在 Windows Gateway 上崩溃 (#132365 系列)。<br>- *QwenPaw:* 更新后局域网访问崩溃 (#8073)；WebView2 缓存死锁 (#8094)。 |
| **可观测性与调试可见性** | **OpenClaw**, **QwenPaw**, **Hermes** | 用户难以诊断代理为何失败或切换模型。<br>- *OpenClaw:* 要求在会话状态中暴露解析后的后端模型 (#51441)。<br>- *QwenPaw:* 静默回退掩盖了 Provider 错误 (#8103)；截断的回答与完整回答无法区分 (#8085)。<br>- *Hermes:* 需要结构化的预取观察数据，而不仅仅是格式化字符串 (#92118)。 |

---

## 同赛道项目详细报告

<details>
<summary><strong>Hermes Agent</strong> — <a href="https://github.com/nousresearch/hermes-agent">nousresearch/hermes-agent</a></summary>

# Hermes Agent 项目日报 – 2026-10-06

## 1. 今日概览
Hermes Agent 呈现出高强度的开发活动，虽然没有发布新版本，但代码变更量巨大，过去 24 小时内有 40 个更新后的 Pull Request 和 10 个活跃的 Issue。该项目目前处于重度稳定化阶段，重点关注关键基础设施的可靠性，特别是 `hermes update` 机制和 Gateway 消息路由。虽然今天没有交付新功能，但大量的未合并 PR（37 个）表明有一大批修复正在准备集成中。社区参与度依然很高，用户积极报告与多平台消息传递和提供商兼容性相关的边缘案例 Bug，这表明该智能体正在跨多样化环境中获得更广泛的实际应用。

## 2. 发布版本
**无。** 今天没有发布新版本。

## 3. 项目进展
今日进展的主要重点在于 **更新器稳定性**、**网关路由逻辑** 以及 **提供商兼容性**。主要改进包括：

*   **更新器加固：** `teknium1` 提交的一系列堆叠 PR (#132365, #132386, #132361, #132338, #132345, #132354) 正在解决 `hermes update` 过程中的严重缺陷。这些更改引入了崩溃安全的提交点、针对 Windows 网关的正确锁处理，以及改进的桌面应用程序交接脚本，以防止更新期间出现状态滞留。
*   **网关与委托修复：**
    *   [#133607](https://github.com/NousResearch/hermes-agent/pull/133607)：修复了用户停止的子代理被错误地报告为失败给父代理的问题，提高了委托的可靠性。
    *   [#133609](https://github.com/NousResearch/hermes-agent/pull/133609)：在 `computer_use` 中实施了原生截图的大小限制，以防止来自 Anthropic 的 API 限制拒绝。
    *   [#132501](https://github.com/NousResearch/hermes-agent/pull/132501)：确保在最终排空后接受的 steer 能正确通过 API 返回。
*   **提供商支持：**
    *   [#133534](https://github.com/NousResearch/hermes-agent/pull/133534)：添加了对 MiniMax OAuth 侧任务的支持。
    *   [#99287](https://github.com/NousResearch/hermes-agent/pull/99287)：将 `llmman` 识别为本地运行器别名。
*   **文档与技能：**
    *   [#133610](https://github.com/NousResearch/hermes-agent/pull/133610)：澄清了会话中的技能复用。
    *   [#132127](https://github.com/NousResearch/hermes-agent/pull/132127)：保护核心 `hermes-agent` 技能免受策展人剪枝。

今天有两个 PR 被关闭而未合并：
*   [#127944](https://github.com/NousResearch/hermes-agent/pull/127944)：因冲突或被更新的语音频道修复取代而关闭。
*   [#133598](https://github.com/NousResearch/hermes-agent/pull/133598)：已关闭，可能被 [#133607](https://github.com/NousResearch/hermes-agent/pull/133607) 或类似的网关路由修复所取代。

## 4. 社区热点话题
社区高度关注 **多平台消息传递可靠性** 和 **边缘案例提供商配置**。

*   **WhatsApp 群组静默 Bug ([#120051](https://github.com/NousResearch/hermes-agent/issues/120051))**:
    *   **状态：** 开启，P1，4 条评论。
    *   **分析：** 用户报告机器人本应在群聊中保持沉默时却错误地回复警告消息。这凸显了“人类轮次静默守卫”功能的回归，影响了消息平台上的自然社交互动。
*   **子代理会话停滞 ([#131578](https://github.com/NousResearch/hermes-agent/issues/131578))**:
    *   **状态：** 开启，P2，3 条评论。
    *   **分析：** 子代理中的后台进程导致聊天路由错误地重新固定，使对话停滞长达 30 分钟。这是异步任务执行的一个严重用户体验阻碍。
*   **Windows 上的 LSP 诊断 ([#127810](https://github.com/NousResearch/hermes-agent/issues/127810))**:
    *   **状态：** 开启，P2。
    *   **分析：** 文件 URI 中的百分号编码盘符破坏了 Windows 上的 LSP 通信，特别影响 PHP/intelephense 用户。这反映了跨平台 IDE 集成中的成长烦恼。

## 5. Bug 与稳定性
今天报告了几个关键的稳定性问题，主要影响 **会话状态**、**视觉工具** 和 **提供商兼容性**。

| 严重程度 | Issue ID | 组件 | 描述 | 修复状态 |
| :--- | :--- | :--- | :--- | :--- |
| **P1** | [#120051](https://github.com/NousResearch/hermes-agent/issues/120051) | Gateway/WhatsApp | 静默标记在群组中触发了不需要的警告消息。 | 开启 |
| **P2** | [#131578](https://github.com/NousResearch/hermes-agent/issues/131578) | Gateway/Delegate | 子代理完成导致聊天路由停滞 30 分钟。 | 开启 |
| **P2** | [#133606](https://github.com/NousResearch/hermes-agent/issues/133606) | Agent/OpenAI | 自定义/LiteLLM 别名的上下文长度解析失败，污染缓存。 | 开启 |
| **P2** | [#133608](https://github.com/NousResearch/hermes-agent/issues/133608) | Desktop/Vision | Composer 图像从未被清理，在删除会话/卸载后依然存在。 | 开启 |
| **P2** | [#133602](https://github.com/NousResearch/hermes-agent/issues/133602) | Agent/LSP | TypeScript 诊断总是超时；首次发布作为种子被丢弃。 | 开启 |
| **P2** | [#133596](https://github.com/NousResearch/hermes-agent/issues/133596) | Tools/Anthropic | Computer use 截图超出 API 限制，且无大小上限/恢复机制。 | **修复 PR:** [#133609](https://github.com/NousResearch/hermes-agent/pull/133609) |
| **P3** | [#133603](https://github.com/NousResearch/hermes-agent/issues/133603) | Plugins/Agent | 后台审查分支仍在父会话下触发工具生命周期钩子。 | 开启 |
| **P3** | [#133595](https://github.com/NousResearch/hermes-agent/issues/133595) | Provider/Zai | GLM-5.3-flash 拒绝 `reasoning_effort=medium` (HTTP 400)。 | 开启 |

**稳定性说明：** 最近合并/关闭的与更新器相关的 PR 表明，之前 `hermes update` 的不稳定性是一个主要痛点，现在正通过崩溃安全提交和锁管理得到系统性解决。

## 6. 功能请求与路线图信号
*   **通过 MCP 进行本地会话监控 ([#133601](https://github.com/NousResearch/hermes-agent/issues/133601))**:
    *   **请求：** 通过 `hermes mcp serve` 暴露本地桌面/CLI 会话以进行只读监控。
    *   **信号：** 表明对更好的可观察性和外部控制 Hermes 实例的需求，这与基于 MCP 的工具生态系统的增长相一致。
*   **结构化内存预取 ([PR #92118](https://github.com/NousResearch/hermes-agent/pull/92118))**:
    *   **状态：** 自 2026 年 8 月以来一直开启。
    *   **信号：** 高级内存架构工作正在进行中，旨在提供操作绑定的结构化观察结果，而不仅仅是格式化的上下文字符串。这表明未来版本将具有更复杂的内存检索机制。

## 7. 用户反馈摘要
*   **痛点：**
    *   **消息可靠性：** 用户对机器人在群聊（WhatsApp）中打破“静默”协议以及在后台任务期间停滞对话感到沮丧。
    *   **跨平台摩擦：** Windows 特有的问题（LSP URI 编码、更新器崩溃）仍然是 Bug 的来源。
    *   **资源泄漏：** 桌面应用用户注意到由于未限制大小的图像存储 (`composer-images`) 导致的磁盘空间占用。
*   **用例：**
    *   严重依赖 **委托/子代理** 来执行长时间运行的任务。
    *   与 **LiteLLM/OpenAI 兼容代理** 的集成需要稳健的别名处理。
    *   **Computer Use/Vision** 功能正被推向极限，需要根据提供商 API 约束进行严格的输入验证。

## 8. 待办事项监控
*   **长期存在的 PR：**
    *   [#21470](https://github.com/NousResearch/hermes-agent/pull/21470)（自 2026 年 5 月开启）：“当摘要会膨胀上下文时跳过压缩。” 这一核心优化已等待数月，需要维护者关注以确保上下文效率。
    *   [#39784](https://github.com/NousResearch/hermes-agent/pull/39784)（自 2026 年 6 月开启）：放宽重复技能加载指南。这影响提示效率和令牌成本。
    *   [#92118](https://github.com/NousResearch/hermes-agent/pull/92118)（自 2026 年 8 月开启）：结构化预取观察。这是一项重大的架构变更，已开启超过两个月。
*   **建议：** 维护者应优先审查这些较旧的 PR，因为它们解决了可能阻碍新功能集成的基本效率和架构问题。

</details>

<details>
<summary><strong>IronClaw</strong> — <a href="https://github.com/nearai/ironclaw">nearai/ironclaw</a></summary>

# IronClaw 项目摘要 — 2026-10-06

## 1. 今日概览
IronClaw 保持稳步的开发活动，重点在于扩展消息集成以及提升非标准部署环境下的 WebChat 可靠性。今天开了两个新的 Pull Request，分别针对功能扩展（Sendblue iMessage/SMS）和关键的 UI 状态管理修复。过去 24 小时内没有发布新版本，也没有关闭任何 Issue，这表明当前的工作重心集中在处理新贡献而非清理积压任务。项目依然活跃，社区正在共同推动核心功能和用户体验的改进。

## 2. 版本发布
过去 24 小时内未发布新版本。

## 3. 项目进展
- **功能扩展**：PR [#8127](https://github.com/nearai/ironclaw/pull/8127) 引入了捆绑的 Sendblue 扩展，支持直接的 iMessage 和 SMS 通信，增强了 IronClaw 与移动消息平台的集成能力，同时确保 API 凭证由主机方保管。
- **UI/UX 稳定性**：PR [#8125](https://github.com/nearai/ironclaw/pull/8125) 通过在 WebChat 前端启用 `refetchOnWindowFocus`，解决了后台标签页中操作状态过期及完成通知缺失的问题，直接针对自托管部署中报告的一个可用性缺口进行修复。

## 4. 社区热点话题
- **PR #8127: feat: add Sendblue iMessage and SMS extension**  
  [链接](https://github.com/nearai/ironclaw/pull/8127)  
  *潜在需求*：用户希望获得超越基于 Web 界面的更广泛通信渠道支持，特别是针对个人/移动工作流程。这一贡献表明了对无缝集成原生消息应用（如 iMessage 和 SMS）的需求，并强调安全性（主机方保管凭证）和生命周期管理。
  
- **Issue #8124 & PR #8125: WebChat state freshness in background tabs**  
  [Issue 链接](https://github.com/nearai/ironclaw/issues/8124) | [PR 链接](https://github.com/nearai/ironclaw/pull/8125)  
  *潜在需求*：在局域网端口上使用纯 HTTP（非 HTTPS）进行自托管的用户报告称，当切换离开聊天标签页时，实时反馈质量下降。这突显了在受限或非标准部署环境中，用户对健壮、始终新鲜的 UI 状态的期望日益增长。

## 5. Bug 与稳定性
- **严重程度：中高**  
  - **WebChat 状态过期与静默推送失败** ([Issue #8124](https://github.com/nearai/ironclaw/issues/8124))  
    *描述*：在使用 LAN 端口上的纯 HTTP 的单租户自托管部署中，由于非安全上下文对 Web Push API 的限制，工具/操作状态消息变得过期，且完成通知会静默失败。  
    *修复状态*：正通过 PR [#8125](https://github.com/nearai/ironclaw/pull/8125) 积极解决，该 PR 启用了窗口聚焦时的重新获取机制，以便在返回标签页时重建最新的运行/操作状态。在非 HTTPS 环境中实现完全解决可能还需要额外的工作来处理推送通知的回退方案。

- **严重程度：低（诊断性）**  
  - **每日故障分类报告** ([Issue #8126](https://github.com/nearai/ironclaw/issues/8126))  
    *描述*：自动化的每日基准分析显示，在 officeqa 套件运行期间，DeepSeek-V4-Flash 模型输出中存在持续的数值错误。这被归类为模型质量问题而非平台 Bug，但会影响整体系统可靠性指标。  
    *修复状态*：无直接修复 PR；可能需要模型调优或提示工程调整。

## 6. 功能请求与路线图信号
- **消息平台集成**：引入 Sendblue iMessage/SMS 支持 ([PR #8127](https://github.com/nearai/ironclaw/pull/8127)) 暗示了向多渠道代理交互发展的路线图优先级，特别是针对移动优先的用例。未来版本可能会包含针对 WhatsApp、Telegram 或其他流行消息服务的类似扩展。
- **增强的部署灵活性**：关于非 HTTPS/LAN 部署的用户报告 ([Issue #8124](https://github.com/nearai/ironclaw/issues/8124)) 表明，对私有、隔离网络或本地网络设置兼容性的需求正在增加。预计后续将致力于开发针对安全上下文 API（例如 Web Push、Service Workers）的优雅降级策略。

## 7. 用户反馈摘要
- **积极信号**：社区成员积极参与代码修复和功能扩展的贡献，展现了对项目方向的强烈参与感和主人翁意识。
- **痛点**： 
  - 后台标签页中的实时反馈不一致影响了自托管用户的生产力。
  - 特定模型的数值不准确继续影响基准测试性能，引发了人们对数据密集型任务输出可靠性的担忧。
- **期望**：用户期待对边缘情况部署场景（非 TLS、仅限 LAN）有更健壮的处理方式，并扩展对外部通信渠道的支持。

## 8. 行动项 / 下一步计划
- **审查与合并 PRs**：优先审查 PR [#8125](https://github.com/nearai/ironclaw/pull/8125) 以解决紧迫的 WebChat 状态问题，随后评估 PR [#8127](https://github.com/nearai/ironclaw/pull/8127) 是否纳入下一个发布周期。
- **调查非 HTTPS 通知**：探索替代的通知机制（例如轮询、WebSocket 回退），用于因缺乏 HTTPS 而无法使用 Web Push 的部署环境。
- **监控基准趋势**：跟踪 Issue #8126 中的重复故障模式。

</details>

<details>
<summary><strong>QwenPaw</strong> — <a href="https://github.com/agentscope-ai/QwenPaw">agentscope-ai/QwenPaw</a></summary>

# QwenPaw 项目摘要 — 2026-10-06

## 1. 今日概览
QwenPaw 正处于高强度的稳定化阶段，近期 v2.2.x 版本发布后，开发活动主要集中在提供商兼容性和会话状态管理上。过去 24 小时内，项目记录了 32 个更新的问题（Issues）和 26 个拉取请求（PRs），表明与模型 API 变更（特别是 OpenCode Go 和 GPT-6 系列）及文件处理边缘情况相关的用户回归报告激增。虽然今天没有发布新版本，但大量已关闭/合并的修复表明维护者正在积极解决即将发布的稳定版的关键阻塞问题。社区参与度依然强劲，许多首次贡献者提交了针对浏览器自动化、安全沙箱和 UI 渲染错误的定向修复。

## 2. 发布版本
**无。** 过去 24 小时内未发布新版本。目前使用 `v2.2.2.beta4` 或 `main` 分支的用户需注意，影响对话持久化和提供商连接的几个关键 Bug 仍未解决。

## 3. 项目进展
以下 Pull Requests 今日被合并或关闭，推动了核心稳定性和功能完整性：

*   **PR #8113 [CLOSED]**: *feat(channels): pilot backward-compatible DingTalk plugin.* 此更改将钉钉频道实现迁移到独立的插件架构中，允许懒加载并在不破坏现有配置的情况下进行更安全的升级。这代表了向模块化频道集成迈出的战略一步。
    *   *链接:* [agentscope-ai/QwenPaw PR #8113](https://github.com/agentscope-ai/QwenPaw/pull/8113)

## 4. 社区热点话题
最活跃的讨论围绕 **特定提供商的 API 不兼容性** 和 **会话上下文污染**，凸显了 QwenPaw 抽象层与不断演进的第三方模型 API 之间的差距。

*   **[Issue #7599]**: *Bug: "MissingSessionID" when using opencode go package models.*
    *   *分析:* 用户遇到 HTTP 400 错误，原因是针对特定订阅层级，`x-opencode-session` 标头未能正确生成。这表明需要更细粒度的提供商能力检测。
    *   *链接:* [agentscope-ai/QwenPaw Issue #7599](https://github.com/agentscope-ai/QwenPaw/issues/7599)
*   **[Issue #8022]**: *Bug: send_file_to_user pollutes context, causing persistent 400s.*
    *   *分析:* 一个严重的工作流 Bug，空的助手消息结合文件块会导致后续所有模型的请求失败。建议消息序列化逻辑在发送前需根据模型能力进行更严格的验证。
    *   *链接:* [agentscope-ai/QwenPaw Issue #8022](https://github.com/agentscope-ai/QwenPaw/issues/8022)
*   **[PR #7307]**: *feat(console): chain provider config straight into model management.*
    *   *分析:* 长期存在的 UX 痛点，添加模型需要导航多个模态框。此 PR 旨在简化配置流程，减少用户设置新提供商时的摩擦。
    *   *链接:* [agentscope-ai/QwenPaw PR #7307](https://github.com/agentscope-ai/QwenPaw/pull/7307)

## 5. Bug 与稳定性
出现了一簇高严重性 Bug，主要影响 **会话连续性** 和 **特定平台集成**。

### 严重级别 (阻碍核心使用)
1.  **[Issue #8022] 通过文件块导致的上下文污染:** 发送文件会创建无效的消息结构，导致后续轮次出现永久性 400 错误。*尚未确定修复 PR。*
    *   *链接:* [Issue #8022](https://github.com/agentscope-ai/QwenPaw/issues/8022)
2.  **[Issue #7599] OpenCode Go 会话标头缺失:** 特定提供商模型因缺少必需标头而失败。*相关的已关闭 Issue #8104 确认了对 `x-opencode-session` 的需求。*
    *   *链接:* [Issue #7599](https://github.com/agentscope-ai/QwenPaw/issues/7599)
3.  **[Issue #8073] V2.2.2.beta4 对话页面崩溃:** 更新后局域网访问失败，阻碍远程使用场景。
    *   *链接:* [Issue #8073](https://github.com/agentscope-ai/QwenPaw/issues/8073)

### 高严重级别 (功能损坏)
4.  **[Issue #8064] DeepSeek PDF 处理失败:** 上传 PDF 由于负载格式错误，导致 DeepSeek 模型的会话永久中断。*修复 PR #8010 试图从媒体拒绝中恢复，但可能无法完全解决此特定提供商的特殊行为。*
    *   *链接:* [Issue #8064](https://github.com/agentscope-ai/QwenPaw/issues/8064)
5.  **[Issue #8074] GPT-6 模型连接失败:** `max_completion_tokens` 的白名单仅匹配 `gpt-5*`，导致较新模型出现 400 错误。*修复 PR #8090 通过更动态地解析模型名称来解决此问题。*
    *   *链接:* [Issue #8074](https://github.com/agentscope-ai/QwenPaw/issues/8074) | [PR #8090](https://github.com/agentscope-ai/QwenPaw/pull/8090)
6.  **[Issue #8094] Console 启动画面死锁:** 过期的 WebView2 缓存可能在无重试机制的情况下永久阻止启动。
    *   *链接:* [Issue #8094](https://github.com/agentscope-ai/QwenPaw/issues/8094)

### 中等严重级别 (UX/次要逻辑)
7.  **[Issue #8046] DST 时间戳冻结:** 夏令时转换期间转录记录显示错误的时间。*修复 PR #8050 解决了时区解析问题。*
    *   *链接:* [Issue #8046](https://github.com/agentscope-ai/QwenPaw/issues/8046) | [PR #8050](https://github.com/agentscope-ai/QwenPaw/pull/8050)
8.  **[Issue #8035] 转录设置无效:** 切换提供商会静默破坏转录功能，因为 `transcription_model` 无法配置。*修复 PR #8052 使模型名称可配置。*
    *   *链接:* [Issue #8035](https://github.com/agentscope-ai/QwenPaw/issues/8035) | [PR #8052](https://github.com/agentscope-ai/QwenPaw/pull/8052)

## 6. 功能请求与路线图信号
用户反馈强调了对更好可观测性以及处理非标准 API 行为的灵活性的需求。

*   **[Issue #8103] 可观测性增强:** 用户请求当守护进程因 API 故障静默回退到其他模型时提供通知。这表明 **透明错误处理** 和 **回退可见性** 是路线图的优先事项。
    *   *链接:* [Issue #8103](https://github.com/agentscope-ai/QwenPaw/issues/8103)
*   **[Issue #8085] 截断表面:** 请求在输出被切断时显示 `finish_reason="length"`。目前，截断的回答与完整的回答无法区分。*修复 PR #8096 实现了此元数据展示。*
    *   *链接:* [Issue #8085](https://github.com/agentscope-ai/QwenPaw/issues/8085) | [PR #8096](https://github.com/agentscope-ai/QwenPaw/pull/8096)
*   **[Issue #8075] Codex SDK 更新:** 请求更新捆绑的 Codex SDK 以支持当前的模型发现（例如 gpt-5.6 变体）。这表明需要 **定期依赖更新** 以跟上 OpenAI 快速的模型发布节奏。
    *   *链接:* [Issue #8075](https://github.com/agentscope-ai/QwenPaw/issues/8075)

## 7. 用户反馈总结
*   **痛点:** 主要挫败感源于 **“静默失败”**——即会话在没有清晰错误消息的情况下中断（例如 #8022, #8064），或者回退机制掩盖了底层提供商问题（#8103）。用户还难以应对 **僵化的提供商抽象**，这些抽象未考虑到新的 API 要求，如自定义标头（#7599）或令牌参数变更（#8074）。
*   **用例:** **多提供商设置**（OpenCode, DeepSeek, GPT-6）和 **基于文件的工作流**（PDF/图像分析）的大量使用暴露了框架健壮性方面的差距。
*   **满意度:** 喜忧参半。虽然社区赞赏对 Bug 的快速响应（存在许多修复 PR），但 Beta 版本中频繁的回归导致了疲劳感。引入钉钉插件（#8113）被视为迈向模块化扩展性的积极一步。

## 8. 待办事项关注
以下条目因其年龄或复杂性需要维护者关注：

*   **[PR #7066] OAuth2 刷新令牌持久化:** 自 2026 年 8 月以来一直开放的 PR，修复 MCP 服务器的轮换刷新令牌。这对于依赖 OAuth2 授权码流程的企业部署至关重要。需要审查/合并。
    *   *链接:* [PR #7066](https://github.com/agentscope-ai/QwenPaw/pull/7066)
*   **[Issue #7984] 浏览器扩展加载:** Playwright 注入 `--disable-extensions`，阻止配置文件扩展加载。两个相互竞争的 PR (#8029, #7987) 试图修复此问题；需要选择一个并合并以解决冲突。
    *   *链接:* [Issue #7984](https://github.com/agentscope-ai/QwenPaw/issues/7984)
*   **[Issue #8013] 大型技能下载超时:** 超过 30 秒的下载因前端 AbortController 限制而失败，即使后端成功。修复 PR #8055 解决了后端负载，但前端超时配置可能仍需要调整。
    *   *链接:* [Issue #8013](https://github.com/agentscope-ai/QwenPaw/issues/8013)

</details>

<details>
<summary><strong>ZeroClaw</strong> — <a href="https://github.com/zeroclaw-labs/zeroclaw">zeroclaw-labs/zeroclaw</a></summary>

# ZeroClaw 项目摘要 – 2026-10-06

## 1. 今日概览
ZeroClaw 展现出极高的开发速度，目前积压了 40 个活跃的 Pull Request（PR），并持续接收新的功能请求（新增 6 个 Issue）。项目当前处于“稳定与扩展”的重心阶段，重点关注运行时安全、Provider 兼容性以及用于 Agent 编排的标准作业程序（SOP）框架。今日未发布任何新版本，表明近期的变更仍在进行代码审查或集成测试。社区参与度很高，特别是在持久化会话附件和多渠道支持（Teams, WhatsApp）等复杂架构特性方面。然而，许多 PR 仍处于 `needs-author-action` 或 `needs-maintainer-review` 状态，显示大型贡献的最终定稿环节存在瓶颈。

## 2. 版本发布
*过去 24 小时内没有发布新版本。*

## 3. 项目进展
以下关键领域通过今日更新的开放 Pull Request 展现了活跃进展：

### **运行时与 Agent 核心**
*   **#11532 (`fix(runtime)`):** 限制结构化 Agent 系统提示词的长度，以防止网关 Web 聊天中出现 Token 溢出问题。*状态：Open.*
*   **#11535 (`fix(agent)`):** 恢复 `AgentEnd` 用量注释中的成本归属，确保即使 Token 计数为零但产生费用时，也能准确追踪计费。*状态：Open.*
*   **#10446 (`fix(runtime)`):** 拒绝将泄漏到正文文本中的工具调用信封（tool-call envelopes）进行渲染，而是直接拦截，以解决间歇性的 Provider 故障（例如经由 Codex 调用的 GPT-5.6）。*状态：Open.*
*   **#10935 (`fix(runtime)`):** 防止流式协议守卫抑制引用了工具结果对象的有效回复。*状态：Open.*

### **安全与配置**
*   **#7821 (`feat(security)`):** 引入规范化的 `sandbox_policy` schema 并在应用层实施强制策略，这是实现标准化文件系统策略的关键一步。*状态：Open (High Risk).*
*   **#10499 (`fix(config)`):** 验证持久化配置写入操作，以确保在 CLI/RPC 更新期间的数据完整性。*状态：Open.*
*   **#11144 (`fix(memory)`):** 缩小凭证 URL 扫描范围，以减少内存威胁检测中的误报率。*状态：Open.*

### **渠道与集成**
*   **#11194 (`feat(channels)`):** 通过 Bot Framework Connector API 添加对 Microsoft Teams 渠道的支持。*状态：Open (Large Scope).*
*   **#10979 / #10988 (`feat/channels/whatsapp-web`):** 为 WhatsApp Web 实现房间创建、用户邀请和投票读取功能。*状态：Open.*
*   **#10843 (`fix(channels)`):** 修复 Telegram 表情回应（reaction）的实现，防止返回伪造的成功响应。*状态：Open.*

### **Web 与 UX**
*   **#11414 (`feat(web)`):** 一项大规模更新，添加了专注工作区（focused workspaces）和管理员中心（Admin hub），以提升操作员 UX 和 SOP 可见性。*状态：Open (High Risk).*

## 4. 社区热点话题
虽然元数据中未明确列出评论数量，但基于复杂性、风险标签和近期活跃度，以下条目代表了高优先级的讨论：

1.  **#11414 [PR] feat(web): add focused workspaces and Admin hub**
    *   *热度原因:* 这是一项基础性的 UI/UX 重构（`size:XL`, `risk:high`），改变了操作员与 Agent 及 SOP 交互的方式。它可能涉及重大的设计决策和后端契约变更。
2.  **#7821 [PR] feat(security): canonical sandbox_policy schema**
    *   *热度原因:* 安全性对于 AI Agent 至关重要。此 PR 标准化了文件访问限制方式，影响所有工具和运行时。由于潜在的破坏性变更，预计会受到严格审查。
3.  **#10407 [PR] feat(sessions): add persistent session prompt attachments**
    *   *热度原因:* 增强了重启后的上下文保留能力，是长期运行 Agent 工作流的关键特性。涉及数据库 schema 变更（`SQLite`）和事务完整性检查。
4.  **#11551 - #11546 [Issues] SOP Framework Expansion**
    *   *热度原因:* 由 `IftekharUddin` 提出的 6 个新 Issue 集群，定义了“可组合子 SOP 节点”、“命名组”和“不可变工作流修订版”的未来方向。这标志着 ZeroClaw 正战略性地向强大的工作流自动化引擎演进，而不仅仅是一个聊天机器人。

## 5. Bug 与稳定性
多个稳定性问题在开放的 PR 中得到处理，突显了当前的痛点：

| 严重程度 | Issue/PR | 描述 | 状态 |
| :--- | :--- | :--- | :--- |
| **高** | **#10446** | 工具调用信封泄漏到正文输出中（特定 Provider 故障）。 | Open |
| **高** | **#10935** | 流式守卫错误地抑制包含引用 JSON/工具结果的回复。 | Open |
| **中** | **#11535** | 零 Token 但非零成本的回合缺失成本归属。 | Open |
| **中** | **#10843** | Telegram 反应在未调用 API 的情况下返回虚假成功。 | Open |
| **低** | **#11080** | Hailo 连接失败测试在不同平台上的不稳定性。 | Open |

*注意：大多数 Bug 修复仍处于 `OPEN` 状态，表明它们尚未合并到主分支。*

## 6. 功能请求与路线图信号
新的 Issues (#11546–#11551) 为 **SOP（标准作业程序）** 子系统提供了清晰的路线图信号：

*   **可组合性:** 支持嵌套的子 SOP 节点 (#11551)。
*   **组织管理:** 为 SOP 库提供命名分组 (#11550)。
*   **人机协同 (Human-in-the-Loop):** 提供可审核的门控负载（gate payloads），以便在发布前批准或拒绝输出 (#11549)。
*   **适应性:** 赋予正在运行的 SOP 显式的实时适应权限 (#11548)。
*   **版本控制:** 将运行实例绑定到不可变的定义修订版 (#11547)。
*   **状态管理:** 为每个 SOP 维护持久的管理 Agent 对话 (#11546)。

**预测：** 下一个主要版本可能会重点聚焦于 **操作员体验 (UX)** 和 **工作流编排**，从简单的聊天交互转向结构化、可审计且可组合的 Agent 任务。

## 7. 用户反馈摘要
*   **痛点:**
    *   **上下文丢失:** 用户需要持久化附件 (#10407) 以在跨会话中保持上下文。
    *   **Provider 故障:** 特定 Provider（GPT-5.6/Codex）的间歇性失败导致输出格式错误 (#10446)。
    *   **渠道限制:** 较新渠道（WhatsApp 投票、Teams 集成）缺乏完整的功能对等性，推动了社区的贡献努力。
*   **使用场景:**
    *   **自动化工作流:** SOP 相关 Issue 激增表明，用户正尝试构建复杂的多步骤自动化流程，而非仅仅是单轮查询。
    *   **企业集成:** 对 Microsoft Teams 以及增强 Slack/Discord/Mattermost 支持的需求，表明其在企业环境中的采用率正在上升。

## 8. 待办事项监控
*   **#9420 (Anthropic OAuth Support):** 自 2026 年 7 月开启。标记为 `stale-candidate` 和 `needs-author-action`。这是一个关键的 Provider 认证功能，目前已停滞。维护者应检查作者是否需要帮助进行 rebase，或者是否可以关闭此 PR 转而采用更新的方案。
*   **#10412 (Session Ownership Claim):** 自 2026 年 8 月开启。标记为 `do-not-merge` 和 `breaking-change`。此架构重构被阻塞；需要澄清后续路径，以解除对相关会话管理改进的限制。
*   **#11532 & #11535:** 这些是今日更新的小型、针对性修复（`size:S/M`）。它们似乎已准备好接受审查，如果及时合并，可能是提升稳定性的速赢项目。

</details>