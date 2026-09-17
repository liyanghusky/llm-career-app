/* Inference & ML Infra 主攻线 · 动手实验室 + 12 周计划 + 定位话术 */

window.INFRA_LAB_INTRO = `AI Infra 岗位极其看重**你是否真的测过**。「我读过 PagedAttention 论文」和「我压测过开关 prefix caching，固定 system prompt 场景 TTFT 降了 63%」是两个量级的可信度。

下面 10 个实验，每一个都产出**一组能写进简历的数字**。共同点是：都有明确的基线、明确的变量、明确的指标。

**关于硬件**：标了「本地可做」的用你那张 GTX 1650（4GB，sm_75，无 Tensor Core）就够；标了「需要租卡」的去 Vast.ai / RunPod / Lambda 按小时租，A100 一小时几美元，做完一个实验几十美元。**别买卡。**

> **一个重要提醒**：GTX 1650 没有 Tensor Core，FP16 比 FP32 还慢（实测 0.43 vs 1.84 TFLOPS）。所以任何和精度/Tensor Core 相关的结论，在这张卡上测出来是**反的**。这类实验必须上云做。`;

window.INFRA_LABS = [
{id:"L1", name:"Roofline 实测：建立你的性能直觉", days:"半天", where:"本地可做", must:true,
why:"这是所有优化的地基。做完你会有一组自己测出来的数字，讨论任何性能问题时都有锚点。而且这个实验能让你亲眼看到「利用率」和「有效算力」是两件事。",
steps:[
"用 torch 测有效显存带宽：大数组逐元素加法 `c=a+b`，带宽 = 3×N×字节/耗时。注意预热、synchronize、数组要远超 L2。",
"测有效算力：大方阵 GEMM (n=4096)，TFLOPS = 2n³/耗时。分别测 FP32 / TF32 / FP16 / BF16。",
"算 ridge point = 峰值算力 / 峰值带宽，和几个典型算子的算术强度对照。",
"对比标称值，算出实测达成率。",
"（上云重做一遍）在 A100 或 H100 上跑同一个脚本，把两组数字并排。"],
deliver:"一个可复跑的脚本 + 一张对照表（本地卡 vs 云卡的带宽/算力/ridge point）",
numbers:"我的 GTX 1650 实测：带宽 112.5 GB/s（标称 128，达成 88%）、FP32 1.84 TFLOPS、**FP16 0.43 TFLOPS（比 FP32 慢，因为没有 Tensor Core）**、ridge point 16.3 FLOP/Byte（H100 约 295）",
stretch:"用 Nsight Compute 验证 sm__throughput 和 dram__throughput，确认你的判断和硬件计数器一致。",
ref:"仓库里已有 tools/gpu_bench.py，直接 `python tools/gpu_bench.py` 就能跑"},

{id:"L2", name:"手写 CUDA reduction：从朴素到 warp shuffle", days:"1 天", where:"本地可做", must:true,
why:"最经典的 CUDA 入门练习，而且覆盖了访存合并、shared memory、bank conflict、warp 原语这几个核心概念。NVIDIA 面试可能直接让你写这个。",
steps:[
"版本 1：朴素做法，每个 block 用 shared memory 做树形归约，注意 `__syncthreads()` 的位置。",
"版本 2：消除 bank conflict（把 stride 从递增改成递减折半）。",
"版本 3：展开最后一个 warp（warp 内不需要 syncthreads）。",
"版本 4：用 `__shfl_down_sync` 做 warp 级归约，完全去掉 shared memory 的最后几步。",
"版本 5：grid-stride loop + 每线程处理多元素，提高算术强度。",
"逐版本测速，画出加速曲线；用 ncu 看每版的 occupancy 和 bank conflict 计数。"],
deliver:"5 个版本的 kernel + 加速对比表 + 每一步为什么变快的解释",
numbers:"典型结果：v1→v5 能有 3-6 倍差距，且最终接近带宽上限（这是 memory-bound kernel 的天花板）",
stretch:"再写一个 softmax kernel（需要两趟：求 max、求 sum），然后改成 online 单趟版本。",
ref:"NVIDIA 官方的 reduction 优化白皮书是这个练习的标准教材"},

{id:"L3", name:"Triton 三部曲：vector add → fused softmax → matmul", days:"2-3 天", where:"需 WSL2/Linux", must:true,
why:"**投入产出比最高的一项。** 不用啃几个月 CUDA 就能产出真实的 kernel 优化成果，而且 torch.compile 生成的就是 Triton，会读它等于能调试 compile 的产物。简历上写「用 Triton 实现并优化 XX kernel」可信度很高。",
steps:[
"跟官方 tutorial 写 vector add，理解 program_id / block / mask 的语义。",
"写 fused softmax：对比 PyTorch 的 `torch.softmax`，在不同行宽下测加速比。理解为什么融合能快（省 HBM 往返）。",
"写 matmul：用 tl.dot，加 autotune 搜 BLOCK_M/N/K 和 num_stages，和 cuBLAS 比。",
"额外写一个 fused RMSNorm 或 fused SwiGLU（LLM 里真实用到的算子）。",
"用 `triton.testing.do_bench` 做规范的 benchmark。"],
deliver:"4 个 Triton kernel + 与 PyTorch 原生的性能对比曲线 + autotune 的最优配置",
numbers:"fused softmax 通常比 PyTorch 快 2-4 倍（省了中间张量的 HBM 往返）；matmul 能到 cuBLAS 的 80-95%",
stretch:"把你的 fused kernel 接进一个小模型，端到端测 decode 延迟的变化。",
ref:"Triton 官方 tutorials；注意 Windows 不支持，要在 WSL2 里做"},

{id:"L4", name:"vLLM 全面压测：吞吐-延迟曲线与调参", days:"2 天", where:"需租卡", must:true,
why:"**这是 AI Infra 简历上最标准的项目。** 做完你能回答「这个模型在这张卡上，SLO 约束下能撑多少 QPS」——这是容量规划的核心能力。",
steps:[
"基线：HuggingFace Transformers 原生 generate，测 TTFT/TPOT/吞吐。这是你要打败的对象。",
"部署 vLLM，用 `benchmark_serving.py` + ShareGPT 真实数据集（不要用固定长度合成负载）。",
"扫并发：1/2/4/8/16/32/64/128，每个点记录吞吐、TTFT 的 P50/P95/P99、TPOT 的 P50/P95/P99。画三条曲线。",
"找到 SLO 拐点：比如 TTFT P95 < 1s 且 TPOT P95 < 50ms 时的最大吞吐。",
"调参对比：`max_num_seqs`、`max_num_batched_tokens`、`gpu_memory_utilization`、`enable_chunked_prefill`，各测一组。",
"观察 KV Cache 使用率和抢占率随并发的变化（vLLM 会打日志）。"],
deliver:"一份带图的压测报告：基线对比、并发-吞吐-延迟三曲线、调参敏感度表、SLO 约束下的容量结论",
numbers:"vLLM 相比 HF 原生通常吞吐提升 5-20 倍（continuous batching + PagedAttention 双重收益）",
stretch:"同一模型再测 SGLang 和 TensorRT-LLM，做三引擎对比。",
ref:"用 open-loop 固定 QPS 打，不要 closed-loop 固定并发 —— 后者会掩盖过载行为"},

{id:"L5", name:"Prefix Caching 的真实收益", days:"1 天", where:"需租卡", must:true,
why:"这是**性价比最高、零质量损失**的降本手段，任何降本讨论都该从它开始。而且这个实验直接对应面试里「怎么把成本降 60%」那道题。",
steps:[
"构造两组负载：① 每个请求独立的短 prompt ② 共享一段 2000 token 的 system prompt + 短用户输入（模拟真实的 Agent/客服场景）",
"对每组分别测 `--enable-prefix-caching` 开和关，记录 TTFT 和输入侧的有效 token 吞吐。",
"再测多轮对话场景：模拟 5 轮对话，每轮复用前面所有轮次。",
"观察缓存命中率（vLLM metrics 里有），以及缓存占用的显存对并发上限的影响。",
"算出每种场景下的成本节省比例。"],
deliver:"一张表：场景 × 开关 × TTFT/吞吐/命中率/成本节省",
numbers:"固定长 system prompt 场景 TTFT 通常降 50-80%；多轮对话第 5 轮的 prefill 成本能降 80%+",
stretch:"测多副本部署时缓存命中率的下降（没有会话亲和性路由会打散缓存），并实现一个简单的一致性哈希路由验证改善。",
ref:"这个实验的数字特别适合写进简历，因为它既是性能又是成本"},

{id:"L6", name:"量化三方对比：FP16 / FP8 / AWQ-4bit", days:"2 天", where:"需租 H100", must:true,
why:"选型题高频，而且这个实验能让你亲手验证那个关键区别：**4-bit 省显存不省算力，FP8 是真的提算力**。",
steps:[
"同一模型（建议 7B 或 13B）准备三个版本：FP16、FP8（H100）、AWQ-4bit。",
"分别测：显存占用、prefill 吞吐、decode 吞吐、TTFT、TPOT。",
"**关键对比**：看 prefill（compute-bound）和 decode（memory-bound）的加速比是否不同。4-bit 应该只在 decode 明显受益；FP8 两边都受益。",
"精度评估：不要只看 PPL。跑 GSM8K（推理，最敏感）+ HumanEval（代码，信号干净）+ 一个 needle-in-a-haystack（长上下文召回）。",
"算出每种方案的「单 token 成本 vs 质量损失」权衡表。"],
deliver:"三方对比表（显存/prefill吞吐/decode吞吐/三项精度指标）+ 选型建议及理由",
numbers:"典型：4-bit 显存降 3.5 倍、decode 吞吐提升 2-3 倍、prefill 略降；FP8 显存降 2 倍、两阶段都提升约 1.5-2 倍、精度损失 <1%",
stretch:"再加 KV Cache 量化（`kv_cache_dtype=fp8`），测它对最大并发的提升，并用 needle 测试验证长上下文召回有没有受损。",
ref:"精度评估一定要包含推理类任务，PPL 会骗你"},

{id:"L7", name:"投机解码的收益边界", days:"1 天", where:"需租卡",
why:"能亲手验证「高并发时收益衰减」这个反直觉的结论 —— 面试里说出这一条能立刻区分读过论文和真跑过。",
steps:[
"配置 vLLM 的 speculative decoding：用一个小模型（如 1B）给大模型（如 13B/70B）做草稿。",
"固定并发=1，扫草稿长度 k = 1/3/5/7，测加速比和接受率。找到最优 k。",
"固定最优 k，扫并发 = 1/4/8/16/32/64，观察加速比如何随并发衰减，找到收益归零的拐点。",
"换成 n-gram 投机（`speculative_model=\"[ngram]\"`），在重复性强的文本（代码、长文档摘要）上测，对比需要草稿模型的方案。",
"验证输出一致性：temperature=0 时，开关投机解码的输出应该完全相同（无损性验证）。"],
deliver:"两条曲线（加速比 vs k、加速比 vs 并发）+ 接受率数据 + 无损性验证结果",
numbers:"低并发通常 1.5-3 倍加速；并发到 32-64 时收益常降到接近 1 倍甚至为负",
stretch:"测 EAGLE 或 Medusa，对比接受率的提升。"},

{id:"L8", name:"多卡：TP 扩展性与通信开销", days:"2 天", where:"需租多卡",
why:"验证 TP=8 拐点的真实存在，并亲手测出通信占比。这是分布式推理的核心直觉。",
steps:[
"同一模型在 TP=1/2/4/8 下部署（选一个 TP=1 能装下的模型，如 13B）。",
"测每种配置的：单请求延迟（TTFT/TPOT）、最大吞吐、显存占用。",
"算扩展效率：TP=8 的吞吐是 TP=1 的几倍？（理想 8 倍，实际会明显低于）",
"用 nsys 抓一次 decode，量出 NCCL kernel 占总时间的比例，看它如何随 TP 增长。",
"跑 nccl-tests 的 all_reduce_perf，对比机内 NVLink 和跨机 IB 的实测带宽。",
"（如果能租到两台机）测 TP=8 机内 vs TP=16 跨机，验证跨机的性能悬崖。"],
deliver:"TP 扩展曲线 + 通信占比表 + NVLink/IB 实测带宽对比",
numbers:"典型：TP=8 的吞吐约为 TP=1 的 4-6 倍（扩展效率 50-75%）；decode 阶段 NCCL 占比随 TP 上升，TP=8 时可能达 20-30%",
stretch:"用 `--tp-comm-overlap` 或类似选项测通信重叠的收益。"},

{id:"L9", name:"生产化：服务 + 监控 + 压测闭环", days:"3-4 天", where:"需租卡", must:true,
why:"这一步把「跑通 demo」变成「能上线」，是简历含金量的分水岭。也直接对应系统设计轮的所有追问。",
steps:[
"FastAPI 包一层：SSE 流式输出、请求校验、超时、限流（per-tenant token bucket）、优雅关闭（graceful drain）。",
"Prometheus 指标：TTFT/TPOT 直方图、队列长度、KV 使用率、每租户 token 计数、错误率。Grafana 做看板。",
"结构化日志 + trace_id 串全链路，能回答「这个请求 3 秒花在哪」。",
"Docker + docker-compose 一键起（服务 + Prometheus + Grafana）。",
"故障注入测试：杀掉引擎进程、打满 KV、发超长 prompt、突发流量 —— 观察监控是否能正确反映，限流是否生效。",
"压测闭环：改一个参数 → 压测 → 看看板 → 得出结论，形成可重复的流程。"],
deliver:"可一键启动的完整服务 + Grafana 看板截图 + 故障注入报告 + 压测流程文档",
numbers:"重点不是性能数字，而是「我能证明这个服务在故障下的行为是可预期的」",
stretch:"部署到 K8s，配上 HPA（用 KV 使用率作为自定义指标）、PodDisruptionBudget、以及 readiness/liveness 探针。"},

{id:"L10", name:"分布式训练：FSDP + 故障恢复 + MFU", days:"3 天", where:"需租多卡",
why:"训练侧的经验在 Infra 岗里是稀缺品。即使你只做推理，能讲清训练的并行和容错也会明显加分。",
steps:[
"用 FSDP 训一个 1B 级模型，对比 ZeRO-2 和 ZeRO-3 的显存占用与吞吐，验证那 ~50% 的通信开销。",
"算 MFU：`6×N×tokens / (step_time × GPU数 × 峰值FLOPS)`。调优到 40% 以上。",
"逐项测优化的收益：梯度检查点（显存降多少、时间涨多少）、混合精度、`bucket_cap_mb`、序列并行。",
"用 nsys 验证通信和计算是否重叠（看 NCCL kernel 和计算 kernel 是否在时间线上并行）。",
"故障演练：训练中途 kill 一个 rank，观察 NCCL 超时行为；实现从 checkpoint 恢复并验证 loss 连续。",
"测 checkpoint 的写入耗时，用 Young/Daly 公式算最优保存频率。"],
deliver:"MFU 优化记录（从多少到多少、每一项的贡献）+ 故障恢复演练报告 + checkpoint 频率的计算",
numbers:"梯度检查点典型：+30% 时间换 60-70% 激活显存；ZeRO-3 vs ZeRO-2 通信增加约 50%",
stretch:"故意制造一个 straggler（用 cgroup 限制某个 rank 的 CPU），观察它如何拖慢整个集群，并实现 per-rank step 时间监控来检测它。"}
];

/* ══════════ 12 周主攻计划 ══════════ */
window.INFRA_PLAN_INTRO = `这是一条**并行于主线路线图**的主攻线，假设你已经有工程基础（你有 6.5 年），目标是在 12 周内把 Infra 方向的知识补成体系 + 攒出 3 个能写进简历的实验成果。

**每周节奏**：按业余时间每天 2 小时 + 周末半天算，一周约 14 小时。全职学习可以压到 6 周。

**优先级原则**：如果时间不够，砍掉标了「可选」的周，但**第 1、3、5、7、10 周不能砍** —— 它们对应面试里被问到概率最高的内容。`;

window.INFRA_PLAN = [
{w:"第 1 周", key:true, focus:"性能直觉与显存账",
 do:["吃透第一层的 5 个必会知识点（算术强度、显存层级、互联、精度、显存账）",
     "做 L1（Roofline 实测），本地 + 云各跑一遍",
     "练到能 60 秒口算任意模型的推理/训练显存和 KV Cache"],
 deliver:"一张自己测的硬件性能卡片（带宽/算力/ridge point），以及显存估算的肌肉记忆"},

{w:"第 2 周", focus:"CUDA 基本功",
 do:["理解 warp/block/SM、访存合并、bank conflict、occupancy",
     "做 L2（手写 reduction 五个版本）",
     "学会读 Nsight Compute 的核心指标"],
 deliver:"5 个版本的 reduction kernel + 加速分析"},

{w:"第 3 周", key:true, focus:"Triton 与算子优化",
 do:["装好 WSL2 环境","做 L3（Triton 三部曲 + 一个 LLM 真实算子）",
     "读懂 FlashAttention 的 tiling 和 online softmax，手写 numpy 版验证"],
 deliver:"4 个 Triton kernel 的性能对比；能在白板上讲 online softmax 的更新公式"},

{w:"第 4 周", focus:"推理引擎原理（读源码）",
 do:["读 vLLM 的调度器（scheduler.py）和 block manager，搞清 continuous batching 和 PagedAttention 的实现",
     "吃透第三层的 8 个知识点（prefill/decode、批处理、PagedAttention、prefix caching、投机解码、量化、MoE、长上下文）",
     "整理 vLLM / TRT-LLM / SGLang 的选型决策树"],
 deliver:"一份 vLLM 调度流程的笔记（能画出一次 iteration 的决策图）"},

{w:"第 5 周", key:true, focus:"压测与容量规划",
 do:["做 L4（vLLM 全面压测）","做 L5（Prefix Caching 收益）",
     "学会用真实长度分布做 open-loop 压测","练容量估算：给定 QPS 和 SLO 推 GPU 数"],
 deliver:"**第一份可写进简历的压测报告**"},

{w:"第 6 周", focus:"量化与精度",
 do:["做 L6（三方量化对比）","搞清 GPTQ/AWQ/SmoothQuant 的算法差异",
     "建立「量化后怎么评估」的完整方法（PPL 之外的敏感探针）"],
 deliver:"量化选型表 + 精度评估流程"},

{w:"第 7 周", key:true, focus:"服务化与生产工程",
 do:["做 L9（服务 + 监控 + 压测闭环）","设计一套多租户隔离方案（对着你在 Bedrock 的经验写）",
     "整理监控指标体系和延迟拆解方法"],
 deliver:"**第二份简历项目**：可一键启动的生产级服务 + 看板"},

{w:"第 8 周", focus:"分布式推理", opt:true,
 do:["做 L8（TP 扩展性测试）","吃透 TP/PP/EP 在推理里的取舍",
     "理解 PD 分离、Ring Attention、分布式 KV（Mooncake/DistServe 的论文各读一篇）"],
 deliver:"TP 扩展曲线 + 通信占比数据"},

{w:"第 9 周", focus:"分布式训练", opt:true,
 do:["做 L10（FSDP + MFU + 故障恢复）","吃透 ZeRO 三阶段、NCCL 原语、通信重叠",
     "学会算 MFU 并排查它低的原因"],
 deliver:"MFU 优化记录 + 故障演练报告"},

{w:"第 10 周", key:true, focus:"系统设计专项",
 do:["把 6 道 AI Infra 系统设计题各打一遍腹稿，然后**出声讲、录屏、回看**",
     "重点打磨「多租户 LLM 推理服务」和「降本 60%」这两道（你有真实经验）",
     "每道题都要能当场算出容量数字"],
 deliver:"6 道设计题的答题框架，每道能讲 20 分钟并接住追问"},

{w:"第 11 周", key:true, focus:"经历挖掘与简历重写",
 do:["按「把 Bedrock / AGI 经历挖成故事」那 8 个问题，翻 oncall 记录、设计文档、绩效材料",
     "找出 3 个能讲十分钟的故事，写成 STAR 结构（重心放 Action，要有数字）",
     "简历从「后端服务开发」重写成 AI Infra 语言",
     "同时开始在 LinkedIn 上梳理前同事名单，准备内推"],
 deliver:"3 个深度故事 + 一版 Infra 定位的简历"},

{w:"第 12 周", focus:"模拟面试与投递",
 do:["模拟面试 ×5：2 轮算法 + 2 轮系统设计 + 1 轮行为面","练 AI 辅助编码轮（60 分钟多文件任务，用 Claude/Gemini 完成修 bug + 实现 + 优化）",
     "先投 2 家练手的创业公司校准手感","同时启动 Microsoft / Meta（本地、流程快、签证稳）和 NVIDIA",
     "Google 因为流程长（6-10 周）可以同时排队"],
 deliver:"进入面试流程，每面完一家立刻写 badcase 笔记"}
];

/* ══════════ 定位与话术 ══════════ */
window.INFRA_PITCH = {
title: "怎么把自己定位成 Infra 而不是算法",
body: `同样的经历，说法不同，面试官的判断完全不同。你现在的简历如果写「在 Bedrock 做后端服务开发」，会被归类成普通 SDE；写对了就是 AI Infra。

**核心原则：强调「系统、性能、成本、可靠性」，弱化「模型、调参、效果」。**

下面是同一件事的两种说法对照：`,
pairs:[
["✗ 在 Bedrock 负责模型接入的后端服务",
 "✓ 负责 Bedrock 上 XX 系列模型的推理服务链路，覆盖请求路由、配额隔离与容量规划"],
["✗ 处理过线上延迟问题",
 "✓ 定位并修复 P99 TTFT 尖刺：根因是长 prompt 的 prefill 阻塞了同批 decode 请求，通过调整调度策略把 P99 TPOT 降低了 X%"],
["✗ 参与了限流功能的开发",
 "✓ 设计并落地 per-tenant 的 token 级配额与加权公平调度，解决共享推理池的 noisy neighbor 问题，使单租户突发流量不再影响其他租户的 SLO"],
["✗ 做过一些性能优化",
 "✓ 通过启用 prefix caching + 调整 max_num_batched_tokens，在固定 system prompt 场景下把 TTFT 降低 X%、单 token 成本降低 Y%"],
["✗ 了解模型部署",
 "✓ 熟悉 vLLM/TensorRT-LLM 的调度与显存管理机制；能从 KV Cache 公式推算并发上限并做容量规划"],
["✗ 在 AGI 团队参与大模型训练",
 "✓ 参与 XX 规模的分布式训练，处理过 checkpoint 恢复 / loss spike / 慢节点 等大规模训练的可靠性问题"],
["✗ 熟悉 Python 和 PyTorch",
 "✓ 能用 Triton 实现并优化融合算子；熟练使用 Nsight Systems/Compute 做性能归因"]
],
tail:`**面试自我介绍的三段式**（两分钟，提前写稿并计时练 5 遍）：

1. **一句话定位（15 秒）**：「我是做 LLM 推理基础设施的，6 年半系统工程经验，最近两年在 Amazon 的 Bedrock 和 AGI 团队，主要做推理服务的性能和多租户容量。」
2. **最相关的一段经历 + 数字（60 秒）**：讲一个故事，说清问题、你的定位手法、量化结果。
3. **技能广度 + 为什么是这家（45 秒）**：点出你熟悉的引擎/工具链，以及对方团队在做什么让你感兴趣（要具体到他们的产品或技术方向）。

**三个禁忌**：从大学讲起的流水账；只讲用了什么框架不讲解决了什么问题；超过 3 分钟。`
};
