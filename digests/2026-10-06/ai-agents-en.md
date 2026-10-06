# OpenClaw Ecosystem Digest 2026-10-06

> Issues: 40 | PRs: 40 | Projects covered: 5 | Generated: 2026-10-06 01:29 UTC

- [OpenClaw](https://github.com/openclaw/openclaw)
- [Hermes Agent](https://github.com/nousresearch/hermes-agent)
- [IronClaw](https://github.com/nearai/ironclaw)
- [QwenPaw](https://github.com/agentscope-ai/QwenPaw)
- [ZeroClaw](https://github.com/zeroclaw-labs/zeroclaw)

---

## OpenClaw Deep Dive

# OpenClaw Project Digest — 2026-10-06

## 1. Today's Overview
OpenClaw is currently in a high-intensity stabilization phase, marked by the release of **v2026.10.1-beta.1** and a surge in activity focused on Gateway performance and memory management. The project faces significant pressure from reported memory leaks in `prepared-model-catalog` workers and session state persistence issues, which are dominating both issue trackers and pull requests. While core functionality remains stable for many users, the community is actively troubleshooting regressions introduced in late September (specifically versions 2026.9.4–2026.9.6). Maintainers and contributors are prioritizing architectural refactors to offload heavy synchronous operations to worker threads, aiming to resolve event-loop blocking and improve scalability.

## 2. Releases
### **v2026.10.1-beta.1**
*   **Highlights:**
    *   **Sessions & Memory:** Preserved usage across registry changes; delivered worker attachments from remote workspaces.
    *   **Stability Fixes:** Prevented queued cancellations and transcript aliases from stalling active turns; kept continuation signatures aligned.
    *   **Migration:** Automated migration of embedding caches.
*   **Notes:** This beta release attempts to address several critical stability issues reported in previous versions. Users experiencing "crash loops" or stalled turns in 2026.9.x are encouraged to test this build, though it is labeled as beta and may contain new regressions.

## 3. Project Progress
Activity today was heavily skewed toward **performance optimizations** and **memory leak fixes**, with a notable absence of merged PRs (5 closed/merged vs. 35 open), indicating a bottleneck in review or testing capacity.

*   **Key Architectural Shifts (PRs):**
    *   **#165644 (`perf(auth)`):** Moving auth saves to workers to prevent Gateway stalls during SQLite JSON encoding.
    *   **#165819 (`perf(session-entry)`):** Offloading cold and child patches to worker threads to reduce main-thread transaction load.
    *   **#165836 (`perf(sessions)`):** Isolating transcript worker queues to prevent sparse display-history scans from blocking metadata requests.
    *   **#165733 (`refactor(sessions)`):** A major refactor persisting run outcomes only, relying on the run registry for liveness to fix sidebar/state mismatches.
*   **Critical Fixes:**
    *   **#165866 (`fix(doctor)`):** Addresses legacy session entry state migration failures during upgrades to 2026.10.1-beta.1.
    *   **#165882 (`fix(update)`):** Ensures checkout plugin skills remain loadable during update retention processes.

## 4. Community Hot Topics
The community is intensely focused on **Gateway memory behavior** and **WebUI stability**.

*   **#159662: Unbounded Memory Leak in `prepared-model-catalog.worker.js`**
    *   **Status:** Open, P0, Silver Shellfish rating.
    *   **Discussion:** Users report RSS growing from ~2.5 GB to 8-10 GB within 60-90 minutes on idle installs. This is provider-agnostic and reproduced on cold reboots.
    *   **Link:** [Issue #159662](https://github.com/openclaw/openclaw/issues/159662)
*   **#149361: Umbrella Issue for WebUI Performance and Stability**
    *   **Status:** Open, P2, Platinum Hermit rating.
    *   **Discussion:** A central hub tracking scroll compensation, history loading triggers, and mobile/desktop rendering issues. High comment count indicates widespread UX friction.
    *   **Link:** [Issue #149361](https://github.com/openclaw/openclaw/issues/149361)
*   **#165644: Auth Saves Blocking Gateway Event Loop**
    *   **Status:** Open PR, Ready for maintainer look.
    *   **Discussion:** Highlights that ordinary shared/agent-local updates stall the Gateway while rereading SQLite cells. This PR aims to move these operations to workers.
    *   **Link:** [PR #165644](https://github.com/openclaw/openclaw/pull/165644)

## 5. Bugs & Stability
Severe stability issues dominate the bug tracker, particularly related to memory management and process lifecycle.

| Severity | Issue ID | Title | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **P0** | [#159662](https://github.com/openclaw/openclaw/issues/159662) | `prepared-model-catalog.worker.js`: unbounded memory leak (~4-5 GB/h) | Open | Critical regression in 2026.9.6+. No fix PR linked yet. |
| **P0** | [#158095](https://github.com/openclaw/openclaw/issues/158095) | Gateway worker keeps state-lifecycle after acquireSqliteWorkerLifecycle | Open | Causes every later acquire to fail until restart. |
| **P1** | [#119720](https://github.com/openclaw/openclaw/issues/119720) | Synchronous agent persistence blocks Gateway event loop at scale | Open | Partial repairs landed (#140231, #138984), but still active. |
| **P1** | [#159596](https://github.com/openclaw/openclaw/issues/159596) | Gateway memory sawtooth on 2026.9.6 | Open | Correlates with #159662; memory pressure events trigger worker retirement. |
| **P1** | [#97616](https://github.com/openclaw/openclaw/issues/97616) | Leaks unreaped hook/tool child processes (zombies) | Open | Long-standing issue causing runtime degradation. |

**Analysis:** There is a clear cluster of issues around the `prepared-model-catalog` worker and SQLite state management. The "sawtooth" memory pattern suggests that while garbage collection or worker recycling occurs, the underlying allocation rate is too high or objects are not being properly dereferenced.

## 6. Feature Requests & Roadmap Signals
User requests indicate a desire for better observability and identity integration.

*   **#51441: Expose resolved backend model in session_status**
    *   **Signal:** Users using routing proxies (LiteLLM) cannot see the actual backend model used (e.g., `openai/gpt-5.4` vs alias `litellm/complex`). This hinders debugging and cost tracking.
    *   **Likelihood:** Medium. Requires changes to how agent runtime reports state.
*   **#70266: Use assistant avatar in macOS Talk Mode overlay**
    *   **Signal:** Personalization request for macOS clients. Low complexity, high user satisfaction potential.
    *   **Likelihood:** High. Likely to be picked up in a minor UI patch.
*   **#165685: Machine-readable reason on registry-settled yielded collector**
    *   **Signal:** Advanced diagnostic feature for developers managing complex agent workflows.
    *   **Likelihood:** Low/Medium. Niche developer tooling.

## 7. User Feedback Summary
*   **Pain Points:**
    *   **Memory Anxiety:** Multiple users report fear of running OpenClaw on resource-constrained devices due to rapid memory growth ("8-10 GB within 60-90 minutes").
    *   **Update Fragility:** Reports of failed updates leaving gateways in "unverified" states or requiring manual intervention (`state-migrated-no-rollback`).
    *   **Plugin Trust Issues:** Path-managed (`--link`) plugin installs are being rejected as "untrusted," breaking local development workflows.
*   **Satisfaction Drivers:**
    *   **Performance Refactors:** The community is generally supportive of the massive effort to move tasks to worker threads (#165644, #165819), viewing it as the necessary path to scalability.
    *   **Transparency:** Detailed umbrella issues like #149361 help users understand that their specific UI glitches are part of a known, tracked batch of fixes.

## 8. Backlog Watch
*   **#142821: Default-on model-visible transcript redaction poisons replayed agent context**
    *   **Age:** Created 2026-09-09.
    *   **Status:** P0, Diamond Lobster.
    *   **Risk:** This is a security/behavioral bug where masking propagates into commands/files/replies. It has been open for nearly a month with no recent activity. High priority for immediate triage.
*   **#132888: Exec approval from non-native channel auto-cancelled**
    *   **Age:** Created 2026-08-29.
    *   **Status:** Closed today.
    *   **Note:** Resolution confirms that `/approve` fails if the turn ends before native approval flags are set. Users must use native channels for exec approvals.
*   **#151795: Path-managed plugin installs not trusted**
    *   **Age:** Created 2026-09-18.
    *   **Status:** Open, P2.
    *   **Risk:** Blocks local plugin development/testing. Needs a decision on whether to relax trust policies for `--link` or provide a clearer error/workaround.

---

## Cross-Ecosystem Comparison

# Cross-Project Comparison Report: Personal AI Assistant Ecosystem
**Date:** 2026-10-06

## 1. Ecosystem Overview
The personal AI assistant open-source landscape is currently in a critical "stabilization and scalability" phase, with major projects like OpenClaw and Hermes Agent prioritizing infrastructure reliability over new feature shipping to address severe memory leaks and event-loop blocking. While core agent logic remains robust, the ecosystem faces significant friction from rapid third-party model API changes (e.g., GPT-6, DeepSeek-V4), forcing frameworks to implement dynamic provider compatibility layers and stricter input validation. Community engagement is high but fragmented, with users demanding better observability for silent failures and more robust support for non-standard deployment environments (LAN, Windows, mobile messaging). The trend indicates a shift from simple chatbots toward complex, multi-channel workflow orchestration engines that require rigorous state management and security sandboxing.

## 2. Activity Comparison

| Project | Active Issues (24h) | Updated PRs (24h) | Release Status | Health Score* | Primary Focus |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **OpenClaw** | High (P0 Memory Leaks) | 35 Open / 5 Merged | v2026.10.1-beta.1 | **Critical** | Gateway stability, worker offloading, memory fixes |
| **Hermes Agent** | 10 Active | 40 Updated / 37 Open | None | **Stable-High** | Updater hardening, gateway routing, provider compat |
| **IronClaw** | Low (2 New) | 2 New | None | **Good** | Messaging integrations (iMessage/SMS), WebChat UX |
| **QwenPaw** | High (Regressions) | 26 Updated | None (v2.2.x beta) | **Unstable** | Provider API breaks (OpenCode/GPT-6), session pollution |
| **ZeroClaw** | 6 New Issues | 40 Open | None | **Moderate** | SOP framework expansion, security schemas, channel parity |

*\*Health Score derived from severity of open bugs vs. merge velocity and release cadence.*

## 3. OpenClaw's Position

### Advantages vs. Peers
*   **Architectural Maturity:** Unlike QwenPaw or IronClaw, which are dealing with basic integration regressions, OpenClaw is tackling deep architectural bottlenecks (event-loop blocking, SQLite contention) by refactoring into worker threads. This positions it as the most scalable option for heavy-load enterprise or power-user scenarios once stabilized.
*   **Community Transparency:** OpenClaw maintains detailed umbrella issues (e.g., #149361 for WebUI) and precise bug tracking for memory leaks (#159662), fostering trust through transparency even when facing critical P0 bugs.
*   **Core Stability Foundation:** Despite current memory issues, its core agent loop and session registry mechanisms are considered the reference standard for other projects, particularly regarding how run outcomes and continuation signatures are managed.

### Technical Approach Differences
*   **Worker-Centric Refactor:** OpenClaw is aggressively moving synchronous operations (auth saves, transcript parsing, embedding caches) to dedicated worker threads (#165644, #165819). In contrast, Hermes focuses on updater safety and message routing logic, while ZeroClaw emphasizes schema-based configuration and SOP composition.
*   **State Persistence Strategy:** OpenClaw’s approach to persisting only "run outcomes" relying on the registry for liveness (#165733) differs from QwenPaw’s struggle with context pollution via file blocks, suggesting OpenClaw has a more rigorous separation between transient state and persistent history.

### Community Size Comparison
*   **Scale & Pressure:** OpenClaw exhibits the highest volume of complex technical discussions and P0 bug reports, indicating a larger, more demanding user base pushing the system to its limits. Hermes Agent shows similar PR volume but with a focus on edge-case provider configs, suggesting a technically sophisticated but slightly smaller niche community. IronClaw and QwenPaw have lower activity volumes relative to their codebase size, indicating either earlier-stage adoption or a less pressure-tested production environment.

## 4. Shared Technical Focus Areas

Several requirements are emerging across multiple projects, highlighting systemic challenges in the AI agent ecosystem:

| Requirement Area | Projects Involved | Specific Needs & Evidence |
| :--- | :--- | :--- |
| **Provider API Volatility Handling** | **OpenClaw**, **Hermes**, **QwenPaw**, **ZeroClaw** | All projects face breakage due to rapid model updates. <br>- *QwenPaw:* `max_completion_tokens` whitelist fails for GPT-6 (#8074); missing headers for OpenCode Go (#7599).<br>- *Hermes:* Context-length resolution fails for LiteLLM aliases (#133606); GLM-5.3 rejects reasoning params (#133595).<br>- *OpenClaw:* Model catalog memory leaks tied to prepared models (#159662).<br>- *ZeroClaw:* Tool-call envelope leaks from GPT-5.6/Codex glitches (#10446). |
| **Session State Integrity & Pollution** | **OpenClaw**, **Hermes**, **QwenPaw** | Critical need to prevent invalid states from crashing sessions.<br>- *QwenPaw:* File uploads pollute context causing permanent 400s (#8022).<br>- *OpenClaw:* Transcript aliases stalling active turns; legacy state migration failures (#165866).<br>- *Hermes:* Subagent completion stalls chat routes for 30 mins (#131578). |
| **Non-Standard Deployment Compatibility** | **IronClaw**, **Hermes**, **QwenPaw** | Growing demand for LAN-only, Windows, and self-hosted HTTP support.<br>- *IronClaw:* Web Push fails on plain HTTP/LAN; stale UI in background tabs (#8124).<br>- *Hermes:* LSP URI encoding breaks on Windows drives (#127810); updater crashes on Windows gateways (#132365 series).<br>- *QwenPaw:* LAN access crashes after update (#8073); WebView2 cache deadlocks (#8094). |
| **Observability & Debugging Visibility** | **OpenClaw**, **QwenPaw**, **Hermes** | Users cannot easily diagnose why agents fail or switch models.<br>- *OpenClaw:* Request to expose resolved backend model in session status (#51441).<br>- *QwenPaw:* Silent fallbacks hide provider errors (#8103); truncated answers indistinguishable from complete ones (#8085).<br>- *Hermes:* Need for structured prefetch observations rather than just formatted strings (#92118). |

---

## Peer Project Reports

<details>
<summary><strong>Hermes Agent</strong> — <a href="https://github.com/nousresearch/hermes-agent">nousresearch/hermes-agent</a></summary>

# Hermes Agent Project Digest – 2026-10-06

## 1. Today's Overview
Hermes Agent exhibits high-intensity development activity with zero new releases but a significant volume of code changes, evidenced by 40 updated Pull Requests and 10 active Issues in the last 24 hours. The project is currently in a heavy stabilization phase, focusing on critical infrastructure reliability, particularly regarding the `hermes update` mechanism and Gateway message routing. While no features were shipped today, the sheer number of open PRs (37) indicates a massive backlog of fixes being prepared for integration. Community engagement remains strong, with users actively reporting edge-case bugs related to multi-platform messaging and provider compatibility, suggesting the agent is seeing broader real-world adoption across diverse environments.

## 2. Releases
**None.** No new versions were published today.

## 3. Project Progress
The primary focus of today’s progress was on **updater stability**, **gateway routing logic**, and **provider compatibility**. Key advancements include:

*   **Updater Hardening:** A stacked series of PRs by `teknium1` (#132365, #132386, #132361, #132338, #132345, #132354) are addressing critical flaws in the `hermes update` process. These changes introduce crash-safe commit points, proper lock handling for Windows gateways, and improved hand-off scripts for Desktop applications to prevent stranded states during updates.
*   **Gateway & Delegation Fixes:**
    *   [#133607](https://github.com/NousResearch/hermes-agent/pull/133607): Fixed an issue where user-stopped subagents were incorrectly reported as failures to their parent agents, improving delegation reliability.
    *   [#133609](https://github.com/NousResearch/hermes-agent/pull/133609): Implemented size caps for native screenshots in `computer_use` to prevent API limit rejections from Anthropic.
    *   [#132501](https://github.com/NousResearch/hermes-agent/pull/132501): Ensures steers accepted after final drain are correctly returned via the API.
*   **Provider Support:**
    *   [#133534](https://github.com/NousResearch/hermes-agent/pull/133534): Added support for MiniMax OAuth side tasks.
    *   [#99287](https://github.com/NousResearch/hermes-agent/pull/99287): Recognized `llmman` as a local runner alias.
*   **Documentation & Skills:**
    *   [#133610](https://github.com/NousResearch/hermes-agent/pull/133610): Clarified skill reuse within conversations.
    *   [#132127](https://github.com/NousResearch/hermes-agent/pull/132127): Protected essential `hermes-agent` skills from curator pruning.

Two PRs were closed without merge today:
*   [#127944](https://github.com/NousResearch/hermes-agent/pull/127944): Closed due to conflict/supersession by newer voice-channel fixes.
*   [#133598](https://github.com/NousResearch/hermes-agent/pull/133598): Closed, likely superseded by [#133607](https://github.com/NousResearch/hermes-agent/pull/133607) or similar gateway routing fixes.

## 4. Community Hot Topics
The community is heavily focused on **multi-platform messaging reliability** and **edge-case provider configurations**.

*   **WhatsApp Group Silence Bug ([#120051](https://github.com/NousResearch/hermes-agent/issues/120051))**:
    *   **Status:** Open, P1, 4 comments.
    *   **Analysis:** Users report that the bot incorrectly replies with warning messages when it should remain silent in group chats. This highlights a regression in the "human-turn silence guard," impacting natural social interaction in messaging platforms.
*   **Subagent Session Stalling ([#131578](https://github.com/NousResearch/hermes-agent/issues/131578))**:
    *   **Status:** Open, P2, 3 comments.
    *   **Analysis:** Background processes in subagents are causing chat routes to re-pin incorrectly, stalling conversations for up to 30 minutes. This is a critical UX blocker for asynchronous task execution.
*   **LSP Diagnostics on Windows ([#127810](https://github.com/NousResearch/hermes-agent/issues/127810))**:
    *   **Status:** Open, P2.
    *   **Analysis:** Percent-encoded drive letters in file URIs are breaking LSP communication on Windows, specifically affecting PHP/intelephense users. This reflects growing pains in cross-platform IDE integration.

## 5. Bugs & Stability
Several critical stability issues were reported today, primarily affecting **session state**, **vision tools**, and **provider compatibility**.

| Severity | Issue ID | Component | Description | Fix Status |
| :--- | :--- | :--- | :--- | :--- |
| **P1** | [#120051](https://github.com/NousResearch/hermes-agent/issues/120051) | Gateway/WhatsApp | Silence marker triggers unwanted warning messages in groups. | Open |
| **P2** | [#131578](https://github.com/NousResearch/hermes-agent/issues/131578) | Gateway/Delegate | Subagent completion stalls chat route for 30 mins. | Open |
| **P2** | [#133606](https://github.com/NousResearch/hermes-agent/issues/133606) | Agent/OpenAI | Context-length resolution fails for custom/LiteLLM aliases, poisoning cache. | Open |
| **P2** | [#133608](https://github.com/NousResearch/hermes-agent/issues/133608) | Desktop/Vision | Composer images are never cleaned up, surviving session deletes/uninstalls. | Open |
| **P2** | [#133602](https://github.com/NousResearch/hermes-agent/issues/133602) | Agent/LSP | TypeScript diagnostics always time out; first publish discarded as seed. | Open |
| **P2** | [#133596](https://github.com/NousResearch/hermes-agent/issues/133596) | Tools/Anthropic | Computer use screenshots exceed API limits without size cap/recovery. | **Fix PR:** [#133609](https://github.com/NousResearch/hermes-agent/pull/133609) |
| **P3** | [#133603](https://github.com/NousResearch/hermes-agent/issues/133603) | Plugins/Agent | Background review fork still fires tool lifecycle hooks under parent session. | Open |
| **P3** | [#133595](https://github.com/NousResearch/hermes-agent/issues/133595) | Provider/Zai | GLM-5.3-flash rejects `reasoning_effort=medium` (HTTP 400). | Open |

**Stability Note:** The updater-related PRs merged/closed recently indicate that previous instability in `hermes update` was a major pain point, now being systematically addressed with crash-safe commits and lock management.

## 6. Feature Requests & Roadmap Signals
*   **Local Session Supervision via MCP ([#133601](https://github.com/NousResearch/hermes-agent/issues/133601))**:
    *   **Request:** Expose local Desktop/CLI sessions through `hermes mcp serve` for read-only supervision.
    *   **Signal:** Indicates a demand for better observability and external control of Hermes instances, aligning with the growing ecosystem of MCP-based tools.
*   **Structured Memory Prefetch ([PR #92118](https://github.com/NousResearch/hermes-agent/pull/92118))**:
    *   **Status:** Open since Aug 2026.
    *   **Signal:** Advanced memory architecture work is ongoing, aiming to provide operation-bound structured observations rather than just formatted context strings. This suggests future versions will have more sophisticated memory retrieval mechanisms.

## 7. User Feedback Summary
*   **Pain Points:**
    *   **Messaging Reliability:** Users are frustrated by bots breaking "silence" protocols in group chats (WhatsApp) and stalling conversations during background tasks.
    *   **Cross-Platform Friction:** Windows-specific issues (LSP URI encoding, updater crashes) continue to be a source of bugs.
    *   **Resource Leaks:** Desktop app users are noticing disk space usage from uncapped image storage (`composer-images`).
*   **Use Cases:**
    *   Heavy reliance on **Delegation/Subagents** for long-running tasks.
    *   Integration with **LiteLLM/OpenAI-compatible proxies** requires robust alias handling.
    *   **Computer Use/Vision** capabilities are being pushed to their limits, requiring strict input validation against provider API constraints.

## 8. Backlog Watch
*   **Long-Standing PRs:**
    *   [#21470](https://github.com/NousResearch/hermes-agent/pull/21470) (Open since May 2026): "Skip compression when summary would inflate context." This core optimization has been pending for months and needs maintainer attention to ensure context efficiency.
    *   [#39784](https://github.com/NousResearch/hermes-agent/pull/39784) (Open since June 2026): Relaxing repeated skill loading guidance. This impacts prompt efficiency and token costs.
    *   [#92118](https://github.com/NousResearch/hermes-agent/pull/92118) (Open since Aug 2026): Structured prefetch observations. A significant architectural change that has remained open for over two months.
*   **Recommendation:** The maintainers should prioritize reviewing these older PRs, as they address fundamental efficiency and architecture concerns that may be blocking newer feature integrations.

</details>

<details>
<summary><strong>IronClaw</strong> — <a href="https://github.com/nearai/ironclaw">nearai/ironclaw</a></summary>

# IronClaw Project Digest — 2026-10-06

## 1. Today's Overview
IronClaw shows steady development activity with a focus on expanding messaging integrations and improving WebChat reliability in non-standard deployment environments. Two new pull requests were opened today, addressing feature expansion (Sendblue iMessage/SMS) and critical UI state management fixes. No releases were published, and no issues were closed in the last 24 hours, indicating that current efforts are concentrated on incoming contributions rather than backlog clearance. The project remains active with community-driven improvements to both core functionality and user experience.

## 2. Releases
No new releases were published in the last 24 hours.

## 3. Project Progress
- **Feature Expansion**: PR [#8127](https://github.com/nearai/ironclaw/pull/8127) introduces a bundled Sendblue extension for direct iMessage and SMS support, enhancing IronClaw’s capability to integrate with mobile messaging platforms while maintaining host custody of API credentials.
- **UI/UX Stability**: PR [#8125](https://github.com/nearai/ironclaw/pull/8125) addresses stale action status and missing completion notifications in background tabs by enabling `refetchOnWindowFocus` in the WebChat frontend, directly targeting a reported usability gap in self-hosted deployments.

## 4. Community Hot Topics
- **PR #8127: feat: add Sendblue iMessage and SMS extension**  
  [Link](https://github.com/nearai/ironclaw/pull/8127)  
  *Underlying Need*: Users seek broader communication channel support beyond web-based interfaces, particularly for personal/mobile workflows. This contribution signals demand for seamless integration with native messaging apps like iMessage and SMS, emphasizing security (host custody of credentials) and lifecycle management.
  
- **Issue #8124 & PR #8125: WebChat state freshness in background tabs**  
  [Issue Link](https://github.com/nearai/ironclaw/issues/8124) | [PR Link](https://github.com/nearai/ironclaw/pull/8125)  
  *Underlying Need*: Self-hosted users operating over plain HTTP (non-HTTPS) report degraded real-time feedback when switching away from the chat tab. This highlights a growing expectation for robust, always-fresh UI states even in constrained or non-standard deployment environments.

## 5. Bugs & Stability
- **Severity: Medium-High**  
  - **WebChat Stale State & Silent Push Failures** ([Issue #8124](https://github.com/nearai/ironclaw/issues/8124))  
    *Description*: In self-hosted single-tenant deployments using plain HTTP on LAN ports, tool/action status messages become stale, and completion notifications fail silently due to Web Push API restrictions on non-secure contexts.  
    *Fix Status*: Actively addressed via PR [#8125](https://github.com/nearai/ironclaw/pull/8125), which enables window-focus refetching to rebuild fresh run/action states upon tab return. Full resolution may require additional work for push notification fallbacks in non-HTTPS environments.

- **Severity: Low (Diagnostic)**  
  - **Daily Failure Taxonomy Report** ([Issue #8126](https://github.com/nearai/ironclaw/issues/8126))  
    *Description*: Automated daily benchmark analysis reveals persistent numeric errors in DeepSeek-V4-Flash model outputs during officeqa suite runs. This is categorized as a model-quality issue rather than a platform bug but impacts overall system reliability metrics.  
    *Fix Status*: No direct fix PR; likely requires model tuning or prompt engineering adjustments.

## 6. Feature Requests & Roadmap Signals
- **Messaging Platform Integration**: The introduction of Sendblue iMessage/SMS support ([PR #8127](https://github.com/nearai/ironclaw/pull/8127)) suggests a roadmap priority toward multi-channel agent interaction, especially for mobile-first use cases. Future versions may include similar extensions for WhatsApp, Telegram, or other popular messaging services.
- **Enhanced Deployment Flexibility**: User reports around non-HTTPS/LAN deployments ([Issue #8124](https://github.com/nearai/ironclaw/issues/8124)) indicate demand for improved compatibility with private, air-gapped, or local-network setups. Expect upcoming work on graceful degradation strategies for secure-context APIs (e.g., Web Push, Service Workers).

## 7. User Feedback Summary
- **Positive Signals**: Community members are actively contributing code fixes and feature extensions, demonstrating strong engagement and ownership of the project’s direction.
- **Pain Points**: 
  - Real-time feedback inconsistencies in backgrounded tabs affect productivity for self-hosted users.
  - Model-specific numeric inaccuracies continue to impact benchmark performance, raising concerns about output reliability for data-intensive tasks.
- **Expectations**: Users anticipate more robust handling of edge-case deployment scenarios (non-TLS, LAN-only) and expanded support for external communication channels.

## 8. Action Items / Next Steps
- **Review & Merge PRs**: Prioritize review of PR [#8125](https://github.com/nearai/ironclaw/pull/8125) to resolve immediate WebChat state issues, followed by evaluation of PR [#8127](https://github.com/nearai/ironclaw/pull/8127) for potential inclusion in the next release cycle.
- **Investigate Non-HTTPS Notifications**: Explore alternative notification mechanisms (e.g., polling, WebSocket fallbacks) for deployments where Web Push is unavailable due to lack of HTTPS.
- **Monitor Benchmark Trends**: Track Issue #8126 for recurring failure patterns and coordinate with model teams to address persistent numeric accuracy issues in DeepSeek-V4-Flash.

</details>

<details>
<summary><strong>QwenPaw</strong> — <a href="https://github.com/agentscope-ai/QwenPaw">agentscope-ai/QwenPaw</a></summary>

# QwenPaw Project Digest — 2026-10-06

## 1. Today's Overview
QwenPaw is in a high-intensity stabilization phase, with significant activity focused on provider compatibility and session state management following the recent v2.2.x releases. The project recorded 32 updated issues and 26 PRs in the last 24 hours, indicating a surge in user-reported regressions related to model API changes (specifically OpenCode Go and GPT-6 families) and file-handling edge cases. While no new release was published today, the volume of closed/merged fixes suggests the maintainers are actively addressing critical blockers for the upcoming stable version. Community engagement remains strong, with numerous first-time contributors submitting targeted fixes for browser automation, security sandboxing, and UI rendering bugs.

## 2. Releases
**None.** No new versions were released in the last 24 hours. Users currently on `v2.2.2.beta4` or `main` should note that several critical bugs affecting conversation persistence and provider connectivity remain open.

## 3. Project Progress
The following Pull Requests were merged or closed today, advancing core stability and feature completeness:

*   **PR #8113 [CLOSED]**: *feat(channels): pilot backward-compatible DingTalk plugin.* This change migrates the DingTalk channel implementation into an independent plugin architecture, allowing for lazy loading and safer upgrades without breaking existing configurations. It represents a strategic move toward modularizing channel integrations.
    *   *Link:* [agentscope-ai/QwenPaw PR #8113](https://github.com/agentscope-ai/QwenPaw/pull/8113)

## 4. Community Hot Topics
The most active discussions revolve around **provider-specific API incompatibilities** and **session context pollution**, highlighting a gap between QwenPaw’s abstraction layer and evolving third-party model APIs.

*   **[Issue #7599]**: *Bug: "MissingSessionID" when using opencode go package models.*
    *   *Analysis:* Users are encountering HTTP 400 errors because the `x-opencode-session` header is not being generated correctly for specific subscription tiers. This indicates a need for more granular provider capability detection.
    *   *Link:* [agentscope-ai/QwenPaw Issue #7599](https://github.com/agentscope-ai/QwenPaw/issues/7599)
*   **[Issue #8022]**: *Bug: send_file_to_user pollutes context, causing persistent 400s.*
    *   *Analysis:* A critical workflow bug where empty assistant messages combined with file blocks break subsequent requests for all models. This suggests the message serialization logic needs stricter validation against model capabilities before sending.
    *   *Link:* [agentscope-ai/QwenPaw Issue #8022](https://github.com/agentscope-ai/QwenPaw/issues/8022)
*   **[PR #7307]**: *feat(console): chain provider config straight into model management.*
    *   *Analysis:* A long-standing UX pain point where adding a model requires navigating multiple modals. This PR aims to streamline the configuration flow, reducing friction for users setting up new providers.
    *   *Link:* [agentscope-ai/QwenPaw PR #7307](https://github.com/agentscope-ai/QwenPaw/pull/7307)

## 5. Bugs & Stability
A cluster of high-severity bugs has emerged, primarily affecting **session continuity** and **platform-specific integrations**.

### Critical Severity (Blocks Core Usage)
1.  **[Issue #8022] Context Pollution via File Blocks:** Sending files creates invalid message structures that cause permanent 400 errors for subsequent turns. *No fix PR identified yet.*
    *   *Link:* [Issue #8022](https://github.com/agentscope-ai/QwenPaw/issues/8022)
2.  **[Issue #7599] OpenCode Go Session Header Missing:** Specific provider models fail due to missing required headers. *Related Closed Issue #8104 confirms the requirement for `x-opencode-session`.*
    *   *Link:* [Issue #7599](https://github.com/agentscope-ai/QwenPaw/issues/7599)
3.  **[Issue #8073] V2.2.2.beta4 Conversation Page Crash:** LAN access fails after update, blocking remote usage scenarios.
    *   *Link:* [Issue #8073](https://github.com/agentscope-ai/QwenPaw/issues/8073)

### High Severity (Feature Breakage)
4.  **[Issue #8064] DeepSeek PDF Handling Failure:** Uploading a PDF breaks the session permanently for DeepSeek models due to incorrect payload formatting. *Fix PR #8010 attempts to recover from media rejections but may not fully address this specific provider quirk.*
    *   *Link:* [Issue #8064](https://github.com/agentscope-ai/QwenPaw/issues/8064)
5.  **[Issue #8074] GPT-6 Model Connection Failures:** The whitelist for `max_completion_tokens` only matches `gpt-5*`, causing 400s for newer models. *Fix PR #8090 addresses this by parsing model names more dynamically.*
    *   *Link:* [Issue #8074](https://github.com/agentscope-ai/QwenPaw/issues/8074) | [PR #8090](https://github.com/agentscope-ai/QwenPaw/pull/8090)
6.  **[Issue #8094] Console Boot Splash Deadlock:** Stale WebView2 cache can permanently block boot with no retry mechanism.
    *   *Link:* [Issue #8094](https://github.com/agentscope-ai/QwenPaw/issues/8094)

### Medium Severity (UX/Minor Logic)
7.  **[Issue #8046] DST Timestamp Freezing:** Transcripts show incorrect times during Daylight Saving Time transitions. *Fix PR #8050 resolves timezone resolution.*
    *   *Link:* [Issue #8046](https://github.com/agentscope-ai/QwenPaw/issues/8046) | [PR #8050](https://github.com/agentscope-ai/QwenPaw/pull/8050)
8.  **[Issue #8035] Transcription Settings Ineffective:** Switching providers silently breaks transcription as `transcription_model` cannot be configured. *Fix PR #8052 makes the model name configurable.*
    *   *Link:* [Issue #8035](https://github.com/agentscope-ai/QwenPaw/issues/8035) | [PR #8052](https://github.com/agentscope-ai/QwenPaw/pull/8052)

## 6. Feature Requests & Roadmap Signals
User feedback highlights a demand for better observability and flexibility in handling non-standard API behaviors.

*   **[Issue #8103] Observability Enhancement:** Users request notifications when the daemon silently falls back to a different model due to API failures. This signals a roadmap priority for **transparent error handling** and **fallback visibility**.
    *   *Link:* [Issue #8103](https://github.com/agentscope-ai/QwenPaw/issues/8103)
*   **[Issue #8085] Truncation Surface:** Request to display `finish_reason="length"` when output is cut off. Currently, truncated answers are indistinguishable from complete ones. *Fix PR #8096 implements this metadata surfacing.*
    *   *Link:* [Issue #8085](https://github.com/agentscope-ai/QwenPaw/issues/8085) | [PR #8096](https://github.com/agentscope-ai/QwenPaw/pull/8096)
*   **[Issue #8075] Codex SDK Update:** Request to update bundled Codex SDK to support current model discovery (e.g., gpt-5.6 variants). This indicates the need for **regular dependency updates** to keep pace with OpenAI's rapid model releases.
    *   *Link:* [Issue #8075](https://github.com/agentscope-ai/QwenPaw/issues/8075)

## 7. User Feedback Summary
*   **Pain Points:** The primary frustration stems from **"silent failures"**—where sessions break without clear error messages (e.g., #8022, #8064) or where fallback mechanisms hide underlying provider issues (#8103). Users also struggle with **rigid provider abstractions** that don't account for new API requirements like custom headers (#7599) or token parameter changes (#8074).
*   **Use Cases:** Heavy usage of **multi-provider setups** (OpenCode, DeepSeek, GPT-6) and **file-based workflows** (PDF/image analysis) is exposing gaps in the framework's robustness.
*   **Satisfaction:** Mixed. While the community appreciates quick responses to bugs (many fix PRs exist), the frequency of regressions in beta releases is causing fatigue. The introduction of the DingTalk plugin (#8113) is seen as a positive step toward modular extensibility.

## 8. Backlog Watch
The following items require maintainer attention due to their age or complexity:

*   **[PR #7066] OAuth2 Refresh Token Persistence:** An open PR since August 2026 fixing rotating refresh tokens for MCP servers. This is critical for enterprise deployments relying on OAuth2 auth-code flows. Needs review/merge.
    *   *Link:* [PR #7066](https://github.com/agentscope-ai/QwenPaw/pull/7066)
*   **[Issue #7984] Browser Extension Loading:** Playwright injects `--disable-extensions`, preventing profile extensions from loading. Two competing PRs (#8029, #7987) attempt to fix this; one needs to be selected and merged to resolve the conflict.
    *   *Link:* [Issue #7984](https://github.com/agentscope-ai/QwenPaw/issues/7984)
*   **[Issue #8013] Large Skill Download Timeout:** Downloads >30s fail due to frontend AbortController limits, even if the backend succeeds. Fix PR #8055 addresses the backend load, but frontend timeout configuration may still need adjustment.
    *   *Link:* [Issue #8013](https://github.com/agentscope-ai/QwenPaw/issues/8013)

</details>

<details>
<summary><strong>ZeroClaw</strong> — <a href="https://github.com/zeroclaw-labs/zeroclaw">zeroclaw-labs/zeroclaw</a></summary>

# ZeroClaw Project Digest – 2026-10-06

## 1. Today's Overview
ZeroClaw exhibits high development velocity with a significant backlog of active Pull Requests (40 open) and a steady influx of new feature requests (6 new Issues). The project is currently in a heavy "stabilization and expansion" phase, focusing on runtime security, provider compatibility, and the Standard Operating Procedure (SOP) framework for agent orchestration. No releases were published today, indicating that recent changes are still undergoing review or integration testing. Community engagement is strong, particularly around complex architectural features like persistent session attachments and multi-channel support (Teams, WhatsApp), though many PRs remain in `needs-author-action` or `needs-maintainer-review` states, suggesting a bottleneck in finalizing large-scale contributions.

## 2. Releases
*No new releases were published in the last 24 hours.*

## 3. Project Progress
The following key areas saw activity via open Pull Requests updated today:

### **Runtime & Agent Core**
*   **#11532 (`fix(runtime)`):** Caps the structured Agent system prompt to prevent token overflow issues in gateway web chats. *Status: Open.*
*   **#11535 (`fix(agent)`):** Restores cost attribution in `AgentEnd` usage annotations, ensuring accurate billing tracking even when token counts are zero but costs are incurred. *Status: Open.*
*   **#10446 (`fix(runtime)`):** Rejects tool-call envelopes leaked into prose instead of rendering them, addressing intermittent provider glitches (e.g., GPT-5.6 via Codex). *Status: Open.*
*   **#10935 (`fix(runtime)`):** Prevents the streaming protocol guard from suppressing valid replies that quote tool-result objects. *Status: Open.*

### **Security & Configuration**
*   **#7821 (`feat(security)`):** Introduces a canonical `sandbox_policy` schema with application-layer enforcement, a critical step toward standardized filesystem policies. *Status: Open (High Risk).*
*   **#10499 (`fix(config)`):** Validates persistent config writes to ensure data integrity during CLI/RPC updates. *Status: Open.*
*   **#11144 (`fix(memory)`):** Narrows credential URL scanning to reduce false positives in memory threat detection. *Status: Open.*

### **Channels & Integrations**
*   **#11194 (`feat(channels)`):** Adds Microsoft Teams channel support via Bot Framework Connector API. *Status: Open (Large Scope).*
*   **#10979 / #10988 (`feat/channels/whatsapp-web`):** Implements room creation, user invitations, and poll vote reading for WhatsApp Web. *Status: Open.*
*   **#10843 (`fix(channels)`):** Fixes Telegram reaction implementation, preventing fabricated success responses. *Status: Open.*

### **Web & UX**
*   **#11414 (`feat(web)`):** A massive update adding focused workspaces and an Admin hub for better operator UX and SOP visibility. *Status: Open (High Risk).*

## 4. Community Hot Topics
While comment counts are not explicitly detailed in the metadata, the following items represent high-priority discussions based on complexity, risk labels, and recent activity:

1.  **#11414 [PR] feat(web): add focused workspaces and Admin hub**
    *   *Why it’s hot:* This is a foundational UI/UX overhaul (`size:XL`, `risk:high`) that restructures how operators interact with agents and SOPs. It likely involves significant design decisions and backend contract changes.
2.  **#7821 [PR] feat(security): canonical sandbox_policy schema**
    *   *Why it’s hot:* Security is paramount for AI agents. This PR standardizes how file access is restricted, affecting all tools and runtimes. High scrutiny is expected due to potential breaking changes.
3.  **#10407 [PR] feat(sessions): add persistent session prompt attachments**
    *   *Why it’s hot:* Enhances context retention across restarts, a key feature for long-running agentic workflows. Involves database schema changes (`SQLite`) and transactional integrity checks.
4.  **#11551 - #11546 [Issues] SOP Framework Expansion**
    *   *Why it’s hot:* A cluster of 6 new issues by `IftekharUddin` defining the future of "Composable Child-SOP nodes," "Named Groups," and "Immutable Workflow Revisions." This signals a strategic push towards making ZeroClaw a robust workflow automation engine, not just a chatbot.

## 5. Bugs & Stability
Several stability issues were addressed in open PRs, highlighting current pain points:

| Severity | Issue/PR | Description | Status |
| :--- | :--- | :--- | :--- |
| **High** | **#10446** | Tool-call envelopes leaking into prose output (provider-specific glitch). | Open |
| **High** | **#10935** | Streaming guard incorrectly suppressing replies containing quoted JSON/tool results. | Open |
| **Medium** | **#11535** | Cost attribution missing for turns with zero tokens but non-zero cost. | Open |
| **Medium** | **#10843** | Telegram reactions returning fake success without API calls. | Open |
| **Low** | **#11080** | Hailo connect-failure test instability on different platforms. | Open |

*Note: Most bug fixes are still in `OPEN` state, indicating they have not yet been merged into the main branch.*

## 6. Feature Requests & Roadmap Signals
The new Issues (#11546–#11551) provide clear roadmap signals for the **SOP (Standard Operating Procedure)** subsystem:

*   **Composability:** Support for nested child-SOP nodes (#11551).
*   **Organization:** Named groups for SOP libraries (#11550).
*   **Human-in-the-Loop:** Reviewable gate payloads for approving/rejecting outputs before publication (#11549).
*   **Adaptability:** Explicit authority for live adaptation of running SOPs (#11548).
*   **Version Control:** Binding runs to immutable definition revisions (#11547).
*   **State Management:** Persistent managing-agent conversations per SOP (#11546).

**Prediction:** The next major release will likely focus heavily on the **Operator Experience (UX)** and **Workflow Orchestration**, moving beyond simple chat interactions to structured, auditable, and composable agent tasks.

## 7. User Feedback Summary
*   **Pain Points:**
    *   **Context Loss:** Users need persistent attachments (#10407) to maintain context across sessions.
    *   **Provider Glitches:** Intermittent failures with specific providers (GPT-5.6/Codex) causing malformed outputs (#10446).
    *   **Channel Limitations:** Lack of full feature parity in newer channels (WhatsApp polls, Teams integration) drives community contribution efforts.
*   **Use Cases:**
    *   **Automated Workflows:** The surge in SOP-related issues suggests users are trying to build complex, multi-step automated processes rather than just single-turn queries.
    *   **Enterprise Integration:** Demand for Microsoft Teams and enhanced Slack/Discord/Mattermost support indicates adoption in corporate environments.

## 8. Backlog Watch
*   **#9420 (Anthropic OAuth Support):** Open since July 2026. Marked `stale-candidate` and `needs-author-action`. This is a critical provider authentication feature that has stalled. Maintainers should check if the author needs help rebasing or if this can be closed in favor of a newer approach.
*   **#10412 (Session Ownership Claim):** Open since August 2026. Marked `do-not-merge` and `breaking-change`. This architectural refactor is blocked; clarification on the path forward is needed to unblock related session management improvements.
*   **#11532 & #11535:** These are smaller, targeted fixes (`size:S/M`) updated today. They appear ready for review and could be quick wins to improve stability if merged promptly.

</details>