# AI 基础设施日报 2026-10-06

> 生成时间: 2026-10-06 01:29 UTC | 覆盖项目: 6 个

- [vLLM](https://github.com/vllm-project/vllm)
- [SGLang](https://github.com/sgl-project/sglang)
- [llama.cpp](https://github.com/ggml-org/llama.cpp)
- [Ollama](https://github.com/ollama/ollama)
- [LiteLLM](https://github.com/BerriAI/litellm)
- [Unsloth](https://github.com/unslothai/unsloth)

---

## 横向对比

# AI 基础设施生态系统跨项目对比报告
**日期：** 2026-10-06

## 1. 生态系统概览
截至 2026 年 10 月 6 日，AI 基础设施领域正经历一场围绕下一代硬件（NVIDIA Blackwell/SM100 和 AMD MI350X）的激烈“稳定性与性能”权衡。虽然 vLLM 和 SGLang 正在通过新的注意力内核和 KV 缓存压缩技术，激进地优化 DeepSeek-V4 和混合 GDN 模型，但它们同时也面临着推测解码（speculative decoding）和解耦服务（disaggregated serving）中关键的稳定性回归问题。llama.cpp 和 Ollama 等本地运行时凭借对新模型的支持（GLM-5.3, Clef）及后端优化迅速跟进，而 LiteLLM 等网关则将其重心从纯粹的路由转向计费完整性和安全加固。整体趋势表明，原始推理速度已不再是唯一的差异化因素；在高并发智能体工作负载下的可靠性以及正确的成本归因，正成为生产部署的主要瓶颈。

## 2. 活动对比

| 项目 | 主要关注点 | 发布状态（过去 24 小时） | 关键活动指标 | 关键稳定性问题 |
| :--- | :--- | :--- | :--- | :--- |
| **vLLM** | 高吞吐量服务 | **v0.31.0 已发布** (717 commits) | 大量 PR 用于修复推测解码与解耦服务问题 | 推测解码正确性 Bug；前缀缓存吞吐量损失 (~30-40%) |
| **SGLang** | 低延迟服务 | 无发布 | CI：1 个失败，5 个不稳定测试；积极的 AMD/NVIDIA 优化 | HiCache 死锁；调度器双重释放崩溃；Hybrid-SWA 活锁 |
| **llama.cpp** | 本地/边缘运行时 | **v0.6.0 已发布** | 新增 `llama_batch_ext` API；Hexagon/CUDA 优化 | Qwen3.8 MTP 断言失败；Vulkan 长期运行性能退化 |
| **Ollama** | 消费者/简易部署 | 无发布 | MLX 后端修复；Gemma4 CUDA SDPA 加速 | 全缓存命中时 `llama-server` 卡死；间歇性工具调用解析错误 |
| **LiteLLM** | LLM 网关 | 无发布 | 安全加固（移除默认密钥）；支持实时会话 | 计费泄露 (`spend=0`)；TTS 重复计费；`/v1/messages` 中的竞态条件 |
| **Unsloth** | 微调/工作室 | 无发布 | AMD/vLLM 集成；决策模型训练 | Qwen3.5 SFT 中出现 NaN 损失；视觉多轮上下文丢失 |

## 3. 模型支持竞赛

对最新前沿模型的支持竞赛在专用服务引擎和通用运行时之间展开：

*   **DeepSeek-V4 / V4.1-Flash**:
    *   **领先者**: **vLLM** 针对 SM100 GPU 发布了使用 FlashMLA mega attention 和 NVFP4 压缩 KV 缓存的具体优化。**SGLang** 正在积极稳定该路径，但面临 HiCache 死锁问题。
    *   **状态**: 两者均瞄准生产就绪状态，但 vLLM 已发布了具体的内核级改进。
*   **GLM-5.3-Flash**:
    *   **领先者**: **llama.cpp** 在 v0.6.0 中添加了原生支持。**vLLM** 和 **SGLang** 在 B300/GB300 硬件上存在关于退化和性能回归的未关闭 Issue，表明它们仍在调优此架构。
    *   **状态**: llama.cpp 提供即时可用性；服务引擎处于“修复”阶段。
*   **Qwen3.8-Flash / Next**:
    *   **领先者**: **vLLM** 拥有活跃的 ROCm 优化计划 (MXFP4/GatedDeltaNet)。**llama.cpp** 报告了将此模型与 MTP 推测解码结合时的严重启动断言错误。
    *   **状态**: 在所有平台上均不稳定。开发者应避免在生产环境中使用，直到稳定性补丁落地。
*   **Clef Decision Models**:
    *   **领先者**: **llama.cpp** 添加了文本/视觉支持。**Unsloth** 添加了训练能力。**Ollama** 报告在特定端点上出现失败。
    *   **状态**: 新兴利基市场；llama.cpp 在推理方面领先，Unsloth 在训练方面领先。

## 4. 性能前沿

优化工作正汇聚于三个具体方向：

1.  **KV 缓存压缩与管理**:
    *   **vLLM** 为 Blackwell 上的 DeepSeek 引入了 NVFP4 压缩 KV 缓存。
    *   **SGLang** 为 AMD Prefill Context Parallelism (PCP) 实现了 FP8 Unified KV 布局。
    *   两个项目的 **RFCs** 都提出了多层级 KV 缓存（扩展至 GPU VRAM 之外）以及用于可观测性的标准化事件模式。
2.  **推测解码 (MTP/DFlash)**:
    *   这是当前的“危险区域”。所有主要引擎（vLLM, SGLang, llama.cpp）在使用混合模型进行推测解码时，均报告了正确性错误或显著的吞吐量损失（由于前缀缓存未命中，vLLM 损失达 30-40%）。
    *   优化重点正转向移除 eager 元数据重建（vLLM）并限制状态查找以防止 CUDA 启动失败。
3.  **内核级注意力优化**:
    *   **Ollama** 通过切换到 SDPA 实现，在 CUDA 上将 Gemma4 的预填充速度提升了约 12 倍。
    *   **Unsloth** 优化了窄行 RMSNorm 内核（在 Qwen3 中常见），并将 head dims >128 的 FlexAttention 路由到 SDPA。
    *   **llama.cpp** 改进了 Hexagon NPU flash-attention 在移动/边缘设备上的可扩展性。

## 5. 层级定位

*   **推理引擎 (vLLM, SGLang)**:
    *   **角色**: 面向云/本地集群的生产级、高吞吐量服务。
    *   **当前状态**: 高度复杂。它们正在集成先进的硬件特性（SM100, MI350X）和架构创新（GDN, MLA），导致 Bug 暴露面增大。它们在 *负载下延迟* 和 *硬件效率* 方面展开竞争。
*   **本地运行时 (llama.cpp, Ollama)**:
    *   **角色**: 边缘计算、桌面应用和开发者本地实验。
    *   **当前状态**: 快速采用新架构。llama.cpp 充当新模型格式（GGUF 更新）的参考实现，而 Ollama 专注于用户体验、稳定性和易用性集成（MLX, Windows ROCm 文档）。它们在 *兼容性* 和 *部署便捷性* 方面展开竞争。
*   **网关/代理 (LiteLLM)**:
    *   **角色**: 流量管理、认证、日志记录和多提供商抽象。
    *   **当前状态**: 迈向运营成熟期。重点关注财务准确性（计费日志）、安全卫生（密钥管理）以及支持新的协议标准（用于实时会话的 WebSocket）。它不执行推理，但决定推理如何被消费。
*   **训练/微调 (Unsloth)**:
    *   **角色**: 定制化和数据准备。
    *   **当前状态**: 扩展其“Studio”功能以包含推理后端（AMD 上的 vLLM），模糊了训练与服务之间的界限。重点是使微调更易于访问，并修复数据管道完整性（嵌入提示词，CPT 列选择）。

## 6. 趋势信号

**行业趋势:**
1.  **混合架构复杂性**: Qwen3.8 和 DeepSeek-V4 等模型中门控 Delta 网络 (GDN) 和多令牌预测 (MTP) 的兴起，打破了现有的推理假设，导致前缀缓存和推测解码出现广泛的回归问题。
2.  **硬件碎片化**: 市场分裂为 NVIDIA Blackwell (SM100) 和 AMD MI350X (gfx950)。框架现在需要为每种硬件维护独立且优化的代码路径，增加了维护负担。
3.  **智能体工作负载压力**: 向智能体应用（Claude Code, 工具调用智能体）的转变，暴露了流式协议、结构化输出验证和长上下文内存管理中的边缘情况，这些对于简单的聊天机器人而言以前并不相关。

**对应用开发者的建议:**
1.  **固定推测解码的稳定版本**: 如果你依赖混合模型（Qwen3.5/3.8）的推测解码，**请勿**使用 vLLM 或 SGLang 的 nightly 构建版本。坚持使用稳定发布版或完全禁用推测解码，以避免静默的正确性问题和服务吞吐量的急剧下降。
2.  **审计计费与日志**: 如果使用 LiteLLM，请立即检查你的 SpendLogs，查看带有自定义模型 slug 的流式调用中是否存在 `spend=0` 条目。这是一个已知的收入泄露 Bug。此外，迁移并移除任何硬编码的默认主密钥。
3.  **为工具调用实施健壮的重试逻辑**: 鉴于 Ollama 和 vLLM 在解析 Qwen3.x 工具调用时显示出间歇性失败（由于缺少闭合标签），请为智能体工作负载构建带有指数退避策略的客户端重试逻辑。
4.  **监控特定硬件的性能回归**: 如果在 AMD MI350X 或 NVIDIA B300 上部署，请密切关注 GLM-5.3 和 DeepSeek-V4 的 Issue 跟踪器。性能正在改善，但与旧架构相比仍不稳定。如果延迟敏感且集群复杂度较低，考虑针对这些特定新模型与 llama.cpp 进行基准测试对比。

---

## 各项目详细报告

<details>
<summary><strong>vLLM</strong> — <a href="https://github.com/vllm-project/vllm">vllm-project/vllm</a></summary>

# vLLM 快讯 — 2026-10-06

## 1. 今日亮点
vLLM 发布了 **v0.31.0**，通过 SM100 硬件上的 FlashMLA mega attention 和 NVFP4 压缩 KV cache，为 DeepSeek-V4.1-Flash 带来了显著的性能提升。社区正在积极解决投机解码（特别是涉及混合 GDN 模型时）和解耦式服务中的关键稳定性问题，同时扩展 Anthropic API 兼容性以支持 Claude Code 等智能体工作流。

## 2. 发布与破坏性变更
*   **v0.31.0 发布**：包含来自 307 位贡献者的 717 次提交。主要亮点包括在 SM100 GPU 上为 DeepSeek-V4.1-Flash 引入新的默认 FlashMLA mega attention，以及用于索引器的 DeepGEMM sparse MQA logits。
    *   [Release Notes](https://github.com/vllm-project/vllm/releases/tag/v0.31.0)
*   **API/配置调整**：
    *   PR [#60088](https://github.com/vllm-project/vllm/pull/60088) 将结构化输出中 `disable_any_whitespace` 的验证推迟到后端解析完成后进行，防止在使用 `backend="auto"` 时过早报错。
    *   PR [#59917](https://github.com/vllm-project/vllm/pull/59917) 通过将警告范围限定到正确的解析器，修复了 `vllm chat` 和 `vllm complete` 命令中关于 `--url` 的虚假弃用警告。

## 3. 新模型与硬件支持
*   **DeepSeek-V4.1-Flash**：针对 NVIDIA SM100 (Blackwell) 架构进行了优化，使用 FlashMLA mega attention 和 V4.1 NVFP4 压缩 KV cache ([PR #60064](https://github.com/vllm-project/vllm/pull/60064))。
*   **Qwen3.8-Flash-Next**：AMD ROCm (gfx950 / MI355X) 性能优化计划正在进行中，目标涵盖 MXFP4 量化和 GatedDeltaNet 层 ([Issue #59575](https://github.com/vllm-project/vllm/issues/59575))。
*   **GLM-5.3-Flash**：基于 GLM-5.2 的改进，性能优化工作正在推进 ([Issue #57406](https://github.com/vllm-project/vllm/issues/57406))。
*   **Kimi-K3**：修复了 DSpark MLA KV cache specs，以防止与张量并行分片相关的性能回归 ([PR #59733](https://github.com/vllm-project/vllm/pull/59733))。

## 4. 性能与优化
*   **投机解码**：
    *   PR [#58463](https://github.com/vllm-project/vllm/pull/58463) 移除了 MTP fused multi-step decode 期间的 eager metadata 重建，提高了 MTP > 1 的 DeepSeek V4 模型的效率。
    *   Issue [#53670](https://github.com/vllm-project/vllm/issues/53670) 指出，由于混合 Qwen3.8 GDN layouts 中 prefix-cache last-block drops 导致约 30-40% 的批量吞吐量损失；调查正在进行中。
*   **权重加载**：
    *   Issue [#58726](https://github.com/vllm-project/vllm/issues/58726) 报告了在 GB10 (DGX Spark) 上由于从 safetensors mmap views 进行逐张量 H2D copies 导致的权重加载缓慢问题。
*   **KV Cache 与解耦**：
    *   PR [#60107](https://github.com/vllm-project/vllm/pull/60107) 和 [#60108](https://github.com/vllm-project/vllm/pull/60108) 修复了 NIXL connector 在混合内存注册场景中关于 replicate flags sizing 和 descriptor return types 的问题。
    *   RFC [#57187](https://github.com/vllm-project/vllm/issues/57187) 提出了利用 MORI-UMBP 实现调度器感知的多层级 KV caching，以扩展超出 GPU 内存的容量。

## 5. 稳定性与回归
*   **严重 Bug**：
    *   **GLM-5.3-Flash Degeneration**：Issue [#56868](https://github.com/vllm-project/vllm/issues/56868) 报告了在 B300 GPUs 上使用 W4A16 量化时，累积推理后的长解码退化问题。高评论活跃度表明该问题的紧迫性。
    *   **Spec Decode Correctness**：Issue [#53488](https://github.com/vllm-project/vllm/issues/53488) 指出在 DGX Spark 上使用 MTP speculative decoding 时 `prompt_logprobs` 出现损坏。Issue [#54360](https://github.com/vllm-project/vllm/issues/54360) 报告在 nightly builds 中，混合 GDN models 的 prefix-cache hits 被静默禁用。
    *   **MoE Quantization**：Issue [#48895](https://github.com/vllm-project/vllm/issues/48895) 发现 gpt-oss NVFP4 MoE shapes 在 `moe_wna16_marlin_gemm` 中因错误的 per-row topk weights 导致输出损坏。
*   **修复进行中**：
    *   PR [#59751](https://github.com/vllm-project/vllm/pull/59751) 限制 FlashInfer sparse MLA FULL graphs 仅用于 decode-only 模式，以防止在 SM100 上发生非法内存访问。
    *   PR [#50021](https://github.com/vllm-project/vllm/pull/50021) 限制了 GDN/KDA spec decode 中 accepted-token state lookups 的范围，以防止 CUDA launch failures。
    *   PR [#59103](https://github.com/vllm-project/vllm/pull/59103) 在会话截断 tokens 时丢弃 stale block hashes，修复了 prefix cache 的一致性。

## 6. 对应用开发者的意义
*   **Agentic Workflows**：如果你正在基于 vLLM 使用 Claude Code 或类似工具构建 agents，请密切关注 RFC [#58647](https://github.com/vllm-project/vllm/issues/58647)，该提案旨在加固 `/v1/messages` 支持。确保你的客户端能正确处理 interleaved thinking 和大型 tool schemas，因为这些路径正在完善中。
*   **Disaggregated Serving**：使用 render/generate/derender pipelines 的开发者应关注 RFCs [#56851](https://github.com/vllm-project/vllm/issues/56851) 和 [#42729](https://github.com/vllm-project/vllm/issues/42729)。请求级文本输出和 derender endpoints 的 API 接口正在演变，这可能会简化与外部 tokenizers/detokenizers 的集成。
*   **Speculative Decoding Caution**：如果在使用混合模型 (Qwen3.5/3.6/3.8) 时采用 speculative decoding (MTP/DFlash)，请注意当前的正确性 bug 以及由 prefix cache misses (#53670, #54360) 引起的潜在吞吐量损失。在这些修复落地之前，建议坚持使用稳定版本而非 nightlies。
*   **Structured Outputs**：如果使用 `backend="auto"` (#60088)，请更新客户端逻辑以预期 deferred validation errors for structured outputs。此外，确保优雅地处理 tool schemas 中格式错误的 `$defs`，因为它们现在会触发 400 Bad Request 而不是 500 Internal Server Error (#54850)。

</details>

<details>
<summary><strong>SGLang</strong> — <a href="https://github.com/sgl-project/sglang">sgl-project/sglang</a></summary>

# SGLang 基础设施动态 — 2026-10-06

## 1. 今日亮点
生态系统正积极稳定 **DeepSeek-V4** 和 **Kimi-K3/5** 的推理路径，重点修复了 HiCache 死锁以及推测解码（Speculative Decoding）内存泄漏等关键问题。**AMD MI350X (gfx950)** 支持方面取得了显著进展，包括新增 FP8 Unified KV 布局和原生 MXFP4 MoE 后端。此外，一项重要的 RFC 提议将 KV 缓存事件架构与 vLLM 对齐，以促进共享基础设施消费者的兼容性。

## 2. 发布与破坏性变更
*   过去 24 小时内**无新版本发布**。
*   **CI 状态**：主分支 CI 跟踪 Issue 报告有 **1 个失败测试**、**5 个不稳定测试（flaky tests）** 以及 **1149 个近期已修复项**。([Issue #17050](https://github.com/sgl-project/sglang/issues/17050))

## 3. 新模型与硬件支持
*   **AMD / ROCm (MI350X/gfx950)**:
    *   **带 FP8 Unified KV 的预填充上下文并行 (PCP)**：一项 PR 允许在 gfx950 上启用 PCP，使用需显式开启的双池 FP8 布局 (`SGLANG_DSV4_UNIFIED_KV_FP8=1`)。这解决了之前将 `--enable-prefill-cp` 与 unified KV 结合使用时被拒绝的问题。([PR #39923](https://github.com/sgl-project/sglang/pull/39923))
    *   **原生 GLM MXFP4 Triton Gluon MoE 后端**：为 MI355X 上的 GLM-5.2/5.3 解码添加了特定模型内核，优化了路由投影、top-k 选择和专家调度。([PR #41639](https://github.com/sgl-project/sglang/pull/41639))
*   **NVIDIA Blackwell (B300/GB300)**:
    *   **MXFP8/W4A8 MegaMoE 修复**：关闭了一个在 B300 GPU 上使用 `sgl-deep-gemm` 时，MXFP8FP4/W4A8 路径中出现的 `CUDA_ERROR_ILLEGAL_ADDRESS` Bug。([Issue #37559](https://github.com/sgl-project/sglang/issues/37559))
    *   **Gemma-4 QAT W4A16 修复**：解决了 GB10/DGX Spark (SM121) 上与 GPTQ Marlin repack 路径相关的启动失败问题。([Issue #28018](https://github.com/sgl-project/sglang/issues/28018))
*   **特定模型改进**:
    *   **DeepSeek V4.1 优化路线图**：正在积极进行 mHC 代码清理、预填充优化，并将 `q_rope_store` 折叠到融合内核中。([Issue #42170](https://github.com/sgl-project/sglang/issues/42170))
    *   **Rust Processor 对等性**：一项新 PR 旨在实现 Dynamo 的 OpenAI formatter 与 SGLang 服务路径在 DeepSeek-V4 上的对等性，并引入了一个可复用的对等性测试框架。([PR #42664](https://github.com/sgl-project/sglang/pull/42664))

## 4. 性能与优化
*   **Radix Cache 驱逐策略**：一项已合并的 PR 引入了需显式开启的 **Hits-Per-Token (HPT)** 大小感知频率驱逐策略 (`--radix-eviction-policy hpt`)，旨在提高不同请求大小下的缓存命中率。([PR #30300](https://github.com/sgl-project/sglang/pull/30300))
*   **多模态 NPU 优化**：通过将扩展的元素级掩码替换为按行 token embedding 替换逻辑，改进了 Ascend NPUs 上多模态 embeddings 的 scatter 操作。([PR #30205](https://github.com/sgl-project/sglang/pull/30205))
*   **Gemma-4 图像分辨率控制**：通过 `images_config` 增加了对每个请求 `max_soft_tokens` 的支持，允许动态调整图像分辨率（例如，密集 OCR 场景下设为 1120 tokens）。([PR #30161](https://github.com/sgl-project/sglang/pull/30161))

## 5. 稳定性与回归问题
*   **严重调度器死锁 (HiCache)**：一个未关闭的 Bug 报告指出，**DeepSeek-V4** 在启用 `--enable-hierarchical-cache --hicache-write-policy write_through` 且并发长预填充时，会在 TP ranks 间发生死锁。症状包括 scheduler/detokenizer 心跳静默和 `/health` 返回 503。([Issue #42465](https://github.com/sgl-project/sglang/issues/42465))
*   **调度器崩溃 (Double Free)**：一个新的高严重性 Bug 表明，scheduler 在空闲循环不变量检查（`session_held_tokens` 遍历）内部因 `double free or corruption` 而中止，导致服务器永久挂起。([Issue #42508](https://github.com/sgl-project/sglang/issues/42508))
*   **Hybrid-SWA 活锁**：一个未关闭的 Issue 描述了一种准入活锁现象，其中 SWA 前缀锁固定了已完成请求未修剪的最后一个 chunk，导致 GPU 处于空闲状态但有等待中的请求。([Issue #41579](https://github.com/sgl-project/sglang/issues/41579))
*   **推测解码内存泄漏**：一个已关闭的非活跃 Bug 指出，DSPARK/DFLASH spec v2 在 `page_size=1` 时，由于跨越上下文边界的窄 `req_to_token` 行导致静默的 KV slot 泄漏。([Issue #33579](https://github.com/sgl-project/sglang/issues/33579))
*   **健康检查孤立请求**：一个未关闭的 Bug 揭示，`/health` 处理程序的超时路径未能取消 scheduler 侧的请求，导致孤立的健康检查请求堆积，进而使 paged-prefill 批处理崩溃。([Issue #35884](https://github.com/sgl-project/sglang/issues/35884))
*   **GLM-5.3-Flash 回归**：报告显示，近期变更后，在 GB300 上并发数为 1 时解码吞吐量下降约 5%；另外还有一个独立 Bug，表现为 NVFP4 模型在 B200/B300 上陷入推理循环而无最终答案。([Issue #42074](https://github.com/sgl-project/sglang/issues/42074), [Issue #41939](https://github.com/sgl-project/sglang/issues/41939))

## 6. 对应用开发者的意义
*   **监控 HiCache 使用情况**：如果您运行启用了 Hierarchical Cache 的 **DeepSeek-V4**，请警惕在高并发长提示词下可能出现的 TP rank 死锁。在 Issue #42465 解决之前，建议考虑禁用 `write_through` 或密切监控心跳日志。
*   **混合负载采用 HPT 驱逐策略**：对于处理不同长度请求的服务，评估新的 `--radix-eviction-policy hpt`，相比默认策略可能会提升缓存效率。
*   **标准化 KV 事件消费者**：关注关于将 KV cache events 与 vLLM schema 对齐的 RFC #39991。如果您构建消费这些事件的外部可观测性或编排工具，预计未来将从标准化中受益。
*   **AMD 用户：启用 PCP 进行预填充**：在 MI350X 系统上，现在可以利用带 FP8 Unified KV 的预填充上下文并行来改善预填充延迟，前提是设置 `SGLANG_DSV4_UNIFIED_KV_FP8=1`。

</details>

<details>
<summary><strong>llama.cpp</strong> — <a href="https://github.com/ggml-org/llama.cpp">ggml-org/llama.cpp</a></summary>

# llama.cpp 技术摘要 — 2026-10-06

## 1. 今日亮点
llama.cpp v0.6.0 已发布，引入了用于混合 token/embedding 输入的新 `llama_batch_ext` API，并增加了对 GLM-5.3-Flash 和 Clef 模型的支持。Hexagon 后端（池化操作、flash-attention 可扩展性）和 CUDA 后端（NVFP4 累加）进行了重要的优化，同时针对多 GPU MoE prefill 性能和 ROCm 稳定性问题的调试工作仍在进行中。

## 2. 版本发布与破坏性变更
*   **v0.6.0 发布**：从 v0.5.x 升级。主要变更包括：
    *   新增 `llama_batch_ext` 扩展 batch API，配合 `llama_process` 处理混合 token/embedding 输入以及 MTP/deepstack 状态 embedding。
    *   支持 GLM-5.3-Flash (GLM5-Next) 320B 混合模型和 Clef 决策模型。
    *   **迁移提示**：使用自定义 batch 处理的开发者，若需要混合输入类型或高级投机解码状态，建议评估切换至 `llama_batch_ext`。
*   **API 重构**：PR #30011 和 #30015 正在整合服务器端的模态处理逻辑，将模型模态归入单一 struct。这可能会影响依赖先前模态标志位的底层集成代码。

## 3. 新模型与硬件支持
*   **模型**：
    *   **GLM-5.3-Flash (GLM5-Next)**：在 v0.6.0 中增加了对该 320B 混合模型的支持。
    *   **Clef 决策模型**：增加了文本和视觉支持；b11418 合并了服务器端视觉输入支持。
    *   **Qwen 3.8 Flash**：开发和 bug 修复正在进行中（Issues #29811, #28734）。
*   **硬件/后端**：
    *   **Hexagon NPU**：增加了 pool op 支持 (#29995)，并为多核 HTP 带来了显著的 matmul/flash-attention 可扩展性更新 (#29974)。
    *   **CUDA**：针对 mmq 中的 NVFP4 类型累加进行了优化 (#29857)。
    *   **ROCm/HIP**：针对 AMD GCN 架构调整了 stream_k 算法和 MMQ 配置 (#30021, #30022)。

## 4. 性能与优化
*   **Hexagon NPU**：
    *   为行拆分多核场景实现了 head-parallel flash_attn 分区，提高了 Snapdragon 设备上的利用率 (#29974)。
    *   优化了 HTP 池化边界和 DMA 流水线，以支持 1D/2D 平均/最大池化，这是 Gemma 4 图像编码器 CLIP 图所需的 (#29995)。
*   **CUDA**：
    *   优化了 `mmq_vec_dot_fp4_fp4_mma` 中针对 NVFP4 权重的累加过程，降低了量化推理的延迟 (#29857)。
    *   修复了 `alloc_deps` 检查中的 batch 独立性问题，以防止不必要的同步 (#29986)。
*   **Vulkan**：
    *   RMS norm kernels 的 subgroup reductions 优化正在审查中 (#29882)，在 Intel Arc Pro 和 NVIDIA RTX 40 系列显卡上表现良好。
    *   修复了 flash attention 和 soft_max 操作中过期的 prealloc_y 重用问题 (#29591)。

## 5. 稳定性与回归问题
*   **严重 Bug**：
    *   **#29811 (Open)**：在使用 MTP 投机解码运行 Qwen 3.8 Flash 时，启动阶段发生断言失败。由于阻塞了特定高性能配置，优先级较高。
    *   **#29980 (Closed/Fixed)**：自 PR #29184（将共享专家融合进 MMVQ）以来，Qwen3.6-35B-A3B 的 prompt 处理速度慢了约 2 倍。已在近期提交中修复。
    *   **#29526 (Open)**：Intel Arc A770 上的 Vulkan 后端在连续运行约 7-8 小时后性能下降，因 GPU fence 超时导致产生空的 EOS 回复。
    *   **#27388 (Open)**：服务器卡死，生成在 decode 中途停滞；`/health` 保持正常但 `/slots` 挂起，需发送 SIGKILL 才能恢复。
*   **正确性修复**：
    *   **#29994 (Open)**：修复 MTP 模型中共享序列上 k-pool scatter 的数据竞争问题。
    *   **#29988 (Fixed)**：修复 Vulkan Flash Attention 共享内存写入越界问题。
    *   **#29915 (Open)**：在 ggml-rpc 中验证 `PAD_REFLECT_1D` 参数，以防止远程写入越界。

## 6. 对应用开发者的意义
*   **为混合模型采用 v0.6.0**：如果您正在服务 GLM-5.3 或 Clef 模型，请立即升级。新的 `llama_batch_ext` API 为多模态输入和投机解码状态提供了更清晰的处理方式，但如果之前绕过标准 API，则需要更新客户端-服务器通信逻辑。
*   **关注 Qwen 3.8 + MTP 的不稳定性**：在 Issue #29811 解决之前，避免在生产环境中部署带有 Multi-Token Prediction (MTP) 投机解码的 Qwen 3.8 Flash。对于这种特定的模型组合，考虑回退到标准 draft 模型或禁用 spec-decoding。
*   **监控长时间运行的 Vulkan 服务**：如果使用配备 Vulkan 后端的 Intel Arc GPU，请实施健康检查以监控“空回复”模式或进程卡死现象（Issue #29526, #27388）。在这些内存/fence 泄漏补丁发布之前，长会话可能需要自动重启机制。
*   **Hexagon NPU 用户**：更新至最新构建版本，以受益于新的池化和 flash-attention 优化，这将显著改善移动/边缘设备上视觉语言任务（如 Gemma 4 编码器）的延迟。

</details>

<details>
<summary><strong>Ollama</strong> — <a href="https://github.com/ollama/ollama">ollama/ollama</a></summary>

# Ollama 基础设施摘要：2026-10-06

## 1. 今日要点
MLX 后端今日受到重点关注，合并了针对高延迟空闲后场景的修复及版本更新补丁；同时，通过 SDPA 优化，Gemma4 模型在 CUDA 上的性能显著提升。稳定性仍是优先事项，开发者正在解决 Qwen3.5/3.6 中间歇性的工具调用解析失败问题，并修复影响 CUDA 全缓存命中任务的严重 `llama-server` 卡死问题。此外，Responses API 流式传输协议已修正，以正确处理混合文本和函数调用输出，确保符合严格的客户端预期。

## 2. 发布与破坏性变更
*   过去 24 小时内**没有发布新版本**。
*   **API 行为变更 (Responses API):** 一项修复 (#18804) 已落地，纠正了 `/v1/responses` 流如何处理包含助手文本和函数调用的轮次。此前，这些项目共享一个 `output_index`，未能关闭消息事件，并且重排了最终输出。依赖严格 OpenAI 兼容事件顺序的客户端应验证此更正后的兼容性。
*   **配置鲁棒性:** 整数秒时长配置 (`OLLAMA_KEEP_ALIVE`, `OLLAMA_LOAD_TIMEOUT`) 现在会在转换为纳秒之前对值进行钳制（clamp），以防止溢出导致的短超时 (#18800)。这解决了静默配置错误的问题，即大型整数输入意外导致亚秒级或无限期类似的行为。

## 3. 新模型与硬件支持
*   **MLX 后端更新:**
    *   合并的 PR #18720 升级了 MLX 库版本以纳入上游改进。
    *   PR #18812 修复了与近期 MLX 更新相关的补丁，确保 macOS 上的稳定性。
    *   PR #18780 在 MLX 引擎中增加了对 **Kolibri 1** 模型的支持。
*   **AMD GPU 文档:** PR #18623 扩展了文档中 Windows ROCm 支持的 GPU 列表，明确涵盖从 `gfx1030` 到 `gfx1201` 架构（RX 7000 系列及更新型号），使文档与构建中实际使用的 CMake 预设保持一致。
*   **社区集成:** AgenticOS 已被添加到社区集成列表中 (#18811)，突出展示了一个使用 Ollama 作为 AI 代理无密钥模型提供商的自托管平台。

## 4. 性能与优化
*   **Gemma4 CUDA Prefill 加速:** PR #18809 将手写的注意力内核替换为 MLX 的 SDPA 实现，用于头维度超过 128 的 Gemma4 模型在 CUDA 上的运行。基准测试显示，`e2b` 变体的 prefill 操作速度提升约 **~12x**，`12b` 变体提升 **2-4x**。
*   **模型查找开销降低:** PR #18806 通过避免在名称查找期间解码无关清单，优化了服务器内部模型解析逻辑。它还引入了决策请求中小 Metal scratch 缓冲区的重用，减少分配开销并在评分错误后清除工作集。
*   **MLX 延迟缓解:** PR #18807 通过在 macOS 上携带一个驻留刷新补丁来解决 GPU 空闲期后的高延迟问题，该补丁保持权重更长时间的连线状态，防止它们在内存压力下被操作系统分页换出或压缩。

## 5. 稳定性与回归问题
*   **关键: `llama-server` 在全缓存命中时卡死 (#18685)**
    *   *严重程度:* 高。在 Linux/CUDA (RTX 5060 Ti) 上，当处理具有全缓存命中的任务时，`llama-server` 偶尔会无限期挂起。在该模型实例手动卸载之前，后续所有请求均会失败。
    *   *状态:* 开放，需要更多信息。尚未确定修复 PR。
*   **高: Qwen3.5/3.6 工具调用解析失败 (#16383, #18802)**
    *   *严重程度:* 高。由于 Qwen3.5 解析器在模板漂移发生时（例如缺少闭合的 `</think>` 标签）无法反序列化 Qwen3.6 的工具调用输出，导致间歇性出现 500 错误。
    *   *修复:* PR #18802 处于开放状态，旨在即使部分标签跟随 `<tool_call>` 之后也能保留工具调用。
*   **中等: v0.35.1 中 GLM-OCR 回归 (#18810)**
    *   *严重程度:* 中等。从 0.34.0 更新后，`glm-ocr` 无法生成 HTML 表格，而是返回纯文本或因令牌重复限制而循环。
    *   *状态:* 开放。可能与最新发布版中的渲染器/解析器更改有关。
*   **中等: Clef-Flash 决策模型失败 (#18769)**
    *   *严重程度:* 中等。尽管在标准聊天补全中正常工作，但 `clef-flash` 模型在 `/v1/systemone` 端点上持续失败，报错为 "non-finite logit" (CUDA) 或 "cannot open model" (CPU)。
    *   *状态:* 开放。表明决策模型存在特定的端点路由或量化处理问题。
*   **低: RPi5 第二次运行挂起 (#18796)**
    *   *严重程度:* 低。在 Raspberry Pi 5 (Debian 13) 上，第一次 `ollama run` 正常工作，但后续运行挂起且无输出。
    *   *状态:* 开放。可能与 ARM Linux 上的 systemd 服务配置或资源清理有关。

## 6. 对应用开发者的意义
*   **监控工具调用可靠性:** 如果你使用 Qwen3.5 或 3.6 模型构建代理，请准备好应对工具执行期间的间歇性 500 错误。考虑实施带有指数退避的重试逻辑，直到 PR #18802 合并。对于生产系统，可能需要锁定稳定版本或切换到解析器更健壮的模型。
*   **利用 Gemma4 性能增益:** 在 NVIDIA GPU 上使用 Gemma4 模型的开发者应更新至最新的 nightly/main 分支，以受益于 SDPA 优化引入的显著 prefill 加速。这可以减少长上下文代理提示词的首字延迟 (TTFT)。
*   **审计超时配置:** 检查你的部署环境变量 (`OLLAMA_KEEP_ALIVE`, `OLLAMA_LOAD_TIMEOUT`)。确保它们未设置为极大的整数，因为之前的溢出 bug 可能导致意外的短超时。新的钳制行为使配置更可预测。
*   **macOS MLX 用户:** 更新你的 Ollama 安装以包含最近的 MLX 补丁。这将缓解不活动期后遇到的“冷启动”延迟惩罚，改善依赖本地推理的桌面应用程序的用户体验。

</details>

<details>
<summary><strong>LiteLLM</strong> — <a href="https://github.com/BerriAI/litellm">BerriAI/litellm</a></summary>

# LiteLLM 基础设施简报 — 2026-10-06

### 1. 今日重点
今天最关键的更新是针对流式请求的**计费完整性修复**。此前，带有日期或 slug 格式的模型名称（例如特定的 Anthropic 构建版本）被错误地记录为 `spend = 0`，这可能导致代理运营商出现严重的收入流失（[Issue #42161](https://github.com/BerriAI/litellm/issues/42161)）。此外，一项新的**安全加固 PR** 从代码库和文档中移除了一个公开已知的默认主密钥，解决了长期存在的凭证卫生风险（[PR #44718](https://github.com/BerriAI/litellm/pull/44718)）。最后，通过 WebSocket 路由增加了对 OpenAI 新推出的 **Live sessions** (`gpt-live-1`) 的支持，扩展了实时多模态能力（[PR #43621](https://github.com/BerriAI/litellm/pull/43621)）。

### 2. 发布与破坏性变更
*   **过去 24 小时内无新版本发布。**
*   **配置变更（待定）：** 引入新的配置参数 `prometheus_metrics_max_series_per_metric`，用于限制每个带标签指标的 Prometheus 序列基数，防止在多租户环境中出现内存膨胀（[PR #44420](https://github.com/BerriAI/litellm/pull/44420)）。
*   **安全性：** 正在从约 1,500 行代码/文档中移除已废弃的默认主密钥字面量。依赖硬编码默认值的运营商应立即迁移至基于环境变量的密钥管理方式（`$LITELLM_MASTER_KEY`）（[PR #44718](https://github.com/BerriAI/litellm/pull/44718)）。

### 3. 新模型与硬件支持
*   **OpenAI Live 模型：** 为 `gpt-live-1` 模型添加了针对 `/v1/live/sessions` 及相关 WebSocket 端点的代理支持，实现了标准 `/v1/chat/completions` 路径此前不支持的低延迟实时音频/视频交互（[PR #43621](https://github.com/BerriAI/litellm/pull/43621)）。
*   **Anthropic Vertex AI 兼容性：** 修复了在 Vertex AI 上的 Claude 模型转发 `compact-2026-09-04` beta 头部的问题，确保原生压缩功能正常工作且不再返回 400 错误（[PR #44747](https://github.com/BerriAI/litellm/pull/44747)）。

### 4. 性能与优化
*   **连接池修复：** 解决了 LiteLLM Proxy 在低流量期间未能关闭空闲数据库连接的问题，该问题曾导致 PGBouncer 饱和。此修复提高了在突发负载模式下的稳定性（[Issue #41420](https://github.com/BerriAI/litellm/issues/41420)）。
*   **CPU 泄漏缓解：** 识别并提出了针对透传端点注册表无限增长的修复方案，该问题曾导致 CPU 使用率在空闲状态下也攀升至 100%。性能分析表明，在 `store_model_in_db: true` 配置下，字典处理效率低下是主要原因（[Issue #26081](https://github.com/BerriAI/litellm/issues/26081)）。
*   **并发 Bug 修复：** 解决了 `/v1/messages` 中的竞态条件，该条件在高并发负载下偶尔会返回 HTTP 500 错误（"dictionary changed size during iteration"），尽管用户已被成功计费。此修复确保了响应交付与消费日志记录之间的原子一致性（[Issue #44748](https://github.com/BerriAI/litellm/issues/44748)）。

### 5. 稳定性与回归问题
*   **严重计费回归：** 使用非标准模型 slug 的流式请求导致 `spend = 0`。这影响了使用自定义部署名称的团队的成本归属和预算执行（[Issue #42161](https://github.com/BerriAI/litellm/issues/42161)）。
*   **TTS 重复计费：** 由于协程处理不当，`litellm.aspeech` 对同步语音提供商执行了两次调用，导致上游（如 Gemini TTS）产生双重收费。修复 PR 已提交（[Issue #44546](https://github.com/BerriAI/litellm/issues/44546), [PR #44757](https://github.com/BerriAI/litellm/pull/44757)）。
*   **缺失 Usage 对象导致的崩溃：** 缺少 `usage` 对象的非流式 Anthropic 响应触发了 `KeyError`，导致重试并最终返回 HTTP 500 错误，而非优雅降级。修复 PR 已提交（[Issue #44535](https://github.com/BerriAI/litellm/issues/44535), [PR #44756](https://github.com/BerriAI/litellm/pull/44756)）。
*   **JWT 团队验证：** 团队 ID 未针对 JWT 声明进行验证，如果虚拟密钥配置错误，可能会允许未经授权访问受限模型组（[Issue #44182](https://github.com/BerriAI/litellm/issues/44182)）。

### 6. 对应用开发者的意义
*   **审计你的计费日志：** 如果你使用自定义模型名称或 slug（尤其是针对 Anthropic），请检查 SpendLogs 中流式调用的 `spend = 0` 条目。在 [#42161](https://github.com/BerriAI/litellm/issues/42161) 的修复合并并部署之前，你可能需要手动核对成本。
*   **更新安全配置：** 确保你的 CI/CD 或启动脚本中没有依赖任何硬编码的默认主密钥。随着 [#44718](https://github.com/BerriAI/litellm/pull/44718) 中公共字面量的移除进程推进，请严格迁移至环境变量。
*   **监控并发错误：** 如果你运营高吞吐量的 `/v1/messages` 端点，请注意观察伴随成功消费日志出现的间歇性 500 错误。这表明你遇到了 [#44748](https://github.com/BerriAI/litellm/issues/44748) 中的竞态条件；建议在补丁发布前限制并发请求数量。
*   **探索实时功能：** 构建语音/视频代理的开发者现在可以利用 LiteLLM 针对 OpenAI Live 模型的新 WebSocket 路由，从而简化实时多模态能力的集成，无需直接管理原始套接字连接。

</details>

<details>
<summary><strong>Unsloth</strong> — <a href="https://github.com/unslothai/unsloth">unslothai/unsloth</a></summary>

# Unsloth Digest — 2026-10-06

### 1. 今日亮点
Unsloth Studio 正在积极扩展其推理引擎支持，一项重大 PR 添加了 **AMD GPU 上的 vLLM**（Linux/WSL），另一项则启用了针对 Qwen/Llama/Gemma 的决策模型训练。稳定性工作主要集中在修复微调流水线中的关键数据处理 Bug（特别是嵌入提示词和 CPT 列选择问题），以及解决与上下文管理和文件附件相关的 UI 回归问题。

### 2. 发布与破坏性变更
*   过去 24 小时内**没有发布新版本**。
*   **API 行为变更（待定）：** PR [#12791](https://github.com/unslothai/unsloth/pull/12791) 修改了 API 客户端处理 Qwen3 思考模式的方式。目前，当启用思考模式时，默认使用非思考采样值的 API 请求将改为对齐 Chat 中特定的 `temperature=0.6` / `top_p=0.95` 默认值。依赖严格 API 参数继承的开发者应检查其客户端配置。

### 3. 新模型与硬件支持
*   **AMD GPU + vLLM:** PR [#12785](https://github.com/unslothai/unsloth/pull/12785) 允许通过 Linux 原生环境或 Windows WSL 在 AMD GPU 上安装并运行 **vLLM**。这消除了 Studio 中该后端此前仅限 NVIDIA 的限制。
*   **决策模型:** PR [#12796](https://github.com/unslothai/unsloth/pull/12796) 增加了对基于 **Qwen3.5**、**Llama** 和 **Gemma 4** 架构的“决策模型”的训练支持，并通过新的 Decision API 暴露这些功能。
*   **嵌入模型修复:** PR [#12795](https://github.com/unslothai/unsloth/pull/12795) 确保 **EmbeddingGemma** 和 **Qwen3-Embedding** 在微调过程中保留其特定的提示词模板，此前这些模板会被丢弃。

### 4. 性能与优化
*   **RMSNorm 内核优化:** PR [#12754](https://github.com/unslothai/unsloth/pull/12754) 通过在每个 Triton 程序中处理多行数据，优化了窄 RMSNorm 行（常见于 `head_dim=128` 的 Qwen3 q/k norm）。这降低了高吞吐量推理时的内核启动开销和调度延迟。
*   **注意力后端路由:** PR [#12773](https://github.com/unslothai/unsloth/pull/12773) 在 B200/Hopper 硬件上，将无掩码因果 FlexAttention 调用路由至 SDPA (`is_causal=True`)，适用于头维度 > 128 的情况（如 Qwen3.5/Next, Gemma 4），旨在超越填充后的 FlexAttention 批次性能。
*   **上下文压缩扩展:** PR [#12786](https://github.com/unslothai/unsloth/pull/12786) 将 Auto-compact 功能扩展至 **基于 API 的模型** (Claude/OpenAI)，防止在长对话中出现此前仅针对本地 GGUF/MLX 模型处理的上下文长度错误。

### 5. 稳定性与回归问题
*   **[严重] 微调数据完整性:**
    *   Issue [#12737](https://github.com/unslothai/unsloth/issues/12737): Qwen3.5 SFT 损失值无论学习率/种子如何，均确定性变为 NaN。
    *   PR [#12790](https://github.com/unslothai/unsloth/pull/12790): 修复了继续预训练 (CPT) 在 The Stack 等数据集中选错列的问题（例如选择了仓库名称而非代码正文）。
*   **[高] 推理正确性:**
    *   PR [#12787](https://github.com/unslothai/unsloth/pull/12787): 修复了视觉模型 (Safetensors) 在多轮对话中丢失早期图像的问题，确保所有附加图像都能传递给模型。
    *   Issue [#12708](https://github.com/unslothai/unsloth/issues/12708): “Think Toggle” 无法抑制 Gemma-4-GGUF 量化版本的内部推理输出。
*   **[中] Studio UI/UX 回归问题:**
    *   Issue [#12372](https://github.com/unslothai/unsloth/issues/12372): 由于生成期间从磁盘读取 mmproj-F16.gguf 导致 tokens/sec 严重下降；`--mlock` 参数被静默剥离。
    *   Issue [#12552](https://github.com/unslothai/unsloth/issues/12552): RTX 40 系列 GPU 上报处长上下文聊天卡顿。
    *   PR [#12788](https://github.com/unslothai/unsloth/pull/12788): 修复 Word 文档附件丢失换行符和复选框状态的问题，此问题会导致结构化数据输入损坏。

### 6. 对应用开发者的意义
*   **采用 AMD/vLLM 以降低成本:** 如果你正在 AMD 硬件上构建智能体，Unsloth Studio 中新增加的 vLLM 支持 ([#12785](https://github.com/unslothai/unsloth/pull/12785)) 提供了 llama.cpp 之外的可行替代方案，可能为批量推理任务解锁更高的吞吐量。
*   **验证嵌入流水线:** 使用自定义嵌入的开发者必须确保更新到包含 PR [#12795](https://github.com/unslothai/unsloth/pull/12795) 的版本。之前的微调可能静默丢弃了关键的查询/文档前缀，从而降低检索性能。
*   **优雅地处理上下文限制:** 随着 Auto-compact 现在支持 API 模型 ([#12786](https://github.com/unslothai/unsloth/pull/12786))，你可以更多地依赖 Unsloth 的自动摘要来处理长时间运行的智能体会话，而不是手动管理 Claude/GPT 集成的令牌窗口。
*   **关注视觉多轮对话 Bug:** 如果你的应用涉及跨轮次比较图像，请针对 PR [#12787](https://github.com/unslothai/unsloth/pull/12787) 中的修复进行测试。早期版本很可能因缺失图像上下文而提供幻觉答案。

</details>