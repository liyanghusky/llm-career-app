/* Infra 主攻线 · 项目 Demo —— 能放 GitHub、能在面试里讲的作品 */

window.INFRA_PROJ_INTRO = `实验室里那 10 个是**测量实验**（产出一组数字）；这里的是**作品**（产出一个能跑、能演示、能被面试官点开的仓库）。

**挑 3 个做，不要全做。** 推荐组合：

- **想进 NVIDIA / kernel 方向** → P1（迷你推理引擎）+ P3（Triton 算子库）+ P2（压测报告）
- **想进 Meta / Google / MSFT 的平台组** → P1 + P4（多租户网关）+ P5（评估与发布流水线）
- **想进 OpenAI / Anthropic 的 infra 岗** → P1 + P6（分布式训练脚手架）+ P4

**P1 是所有组合里都有的那个** —— 自己实现一个迷你推理引擎，是这个方向最能证明深度的单一项目。

**每个项目都必须有的四样东西**（缺一个含金量就掉一半）：
1. **基线对比** —— 你的东西比什么快/省，快多少
2. **真实数字** —— 不是「性能提升明显」，是"P99 TTFT 从 2.1s 降到 0.8s"
3. **README 里有图** —— 曲线图或架构图，面试官只看这个
4. **一键复现** —— \`docker compose up\` 或一行命令能跑起来`;

window.INFRA_PROJECTS = [
{
id:"P1", tier:"旗舰", days:"10-14 天", stars:5, color:"#9c6b4f", must:true,
name:"nano-serve：从零实现一个迷你推理引擎",
tagline:"手写 KV Cache、continuous batching、paged 显存管理和调度器。这是 Infra 方向最能证明深度的单一项目 —— 写完之后，vLLM 的源码你能读懂，面试里的调度题会变成常识。",
stack:["PyTorch","FastAPI","asyncio","一个小模型（TinyLlama / Qwen-0.5B）"],
why:`绝大多数候选人的项目是「我用了 vLLM」。**自己实现一遍的人凤毛麟角。**

而且这个项目的性价比极高：你不需要写 CUDA，用 PyTorch 就能实现全部核心机制。难点在**系统设计**而不是底层优化 —— 恰好是面试考的东西。

写完之后，「continuous batching 怎么实现」「PagedAttention 解决什么」「抢占策略怎么选」这些题，你答的是自己写过的代码，不是背的论文。`,
steps:[
{t:"D1 · 最朴素的基线", d:"用 HF transformers 写一个最简单的逐 token 生成循环，**不用 KV Cache**。测出生成 100 个 token 的耗时。这是你要打败的起点，也是后面所有加速比的分母。"},
{t:"D2 · 手写 KV Cache", d:"自己管理 K/V 张量的追加（不要用 HF 的 `past_key_values`，要自己实现才有意义）。测速度提升 —— 应该有数量级的改善。记录下来。"},
{t:"D3-4 · 静态批处理", d:"支持一次处理多个请求。实现 padding 和 attention mask。**故意构造长度差异大的一批请求**（比如 20/50/200/30），测量 GPU 空转比例 —— 这个数字是下一步的动机。"},
{t:"D5-7 · Continuous Batching（核心）", d:"改成 iteration 级调度：维护 running 和 waiting 两个集合，每一步结束后回收完成的请求、准入新请求。实现 `max_num_seqs` 和 `max_num_batched_tokens` 两个约束。对比静态批处理的吞吐提升。"},
{t:"D8-10 · Paged KV 管理（核心）", d:"把 KV Cache 切成固定大小的 block（16 token），实现 block pool、per-request 的 block table、按需分配与释放。注意力计算改成按 block table gather。**测量显存利用率的改善** —— 这是最有说服力的数字。"},
{t:"D11 · 抢占与 chunked prefill", d:"显存不足时按策略踢出请求（实现 recompute 版本即可），放回 waiting 队列。再实现 chunked prefill：长 prompt 按 token 预算切块，避免独占一次 iteration。测 TPOT 尖刺的改善。"},
{t:"D12 · 前缀共享", d:"用引用计数让多个请求共享相同前缀的物理 block。构造「固定 system prompt + 不同用户输入」的负载，测 TTFT 的改善。"},
{t:"D13-14 · 服务化与报告", d:"FastAPI + SSE 流式输出，OpenAI 兼容的 `/v1/chat/completions`。写 README：架构图、每一步的性能对比表、和 vLLM 的差距分析（诚实地说差多少、差在哪）。"}
],
resume:"从零实现迷你 LLM 推理引擎 nano-serve：手写 KV Cache、iteration 级 continuous batching、分页式 KV 显存管理（block=16）、抢占与 chunked prefill、前缀块共享。相比朴素逐 token 实现吞吐提升 X 倍，相比静态批处理提升 Y 倍，KV 显存利用率从 Z% 提升至 W%；提供 OpenAI 兼容的流式 API。",
asks:["你的调度器一次 iteration 做哪些决策？","block size 选 16 的依据是什么，选 4 或 64 会怎样？",
      "抢占时你选 swap 还是 recompute，为什么？","前缀共享的引用计数什么时候需要 copy-on-write？",
      "和 vLLM 比你慢在哪？如果要追上会怎么做？","chunked prefill 的 token 预算怎么定？"],
pitfall:"**不要追求性能超过 vLLM**，追不上也不需要追。这个项目的价值是「我理解每一个机制」，不是「我写得更快」。README 里诚实地写出和 vLLM 的差距和原因，反而是加分项 —— 说明你知道自己实现的边界在哪。"
},

{
id:"P2", tier:"必做", days:"4-5 天", stars:5, color:"#3b4a5a", must:true,
name:"推理性能实验室：引擎对比与容量规划报告",
tagline:"最标准的 AI Infra 简历项目。做完你能回答「这个模型在这张卡上、在 SLO 约束下能撑多少 QPS」—— 这是容量规划的核心能力。",
stack:["vLLM","SGLang","TensorRT-LLM（可选）","locust / benchmark_serving","matplotlib"],
why:`这个项目考察的不是编码能力，而是**实验设计能力**和**数据解读能力**。

大多数人的「压测」是跑一次 benchmark 脚本贴个数字。真正有价值的是：用真实长度分布、扫并发画曲线、找到 SLO 拐点、给出容量结论。这个差距在面试里一问就露。`,
steps:[
{t:"D1 · 建立基线与方法论", d:"HF transformers 原生推理作为基线。**确立压测方法**：用 ShareGPT 等真实数据集的长度分布（不要固定长度合成负载）、open-loop 按目标 QPS 打（不要 closed-loop 固定并发）、warmup 后丢弃前 60 秒数据、每个点多次取中位数。"},
{t:"D2 · vLLM 全面扫描", d:"扫并发 1/2/4/8/16/32/64/128，每点记录吞吐、TTFT 的 P50/P95/P99、TPOT 的 P50/P95/P99、KV 使用率、抢占率。画出三条曲线。**找到 SLO 拐点**（比如 TTFT P95<1s 且 TPOT P95<50ms 时的最大吞吐）。"},
{t:"D3 · 参数敏感度", d:"固定负载，分别扫 `max_num_seqs`、`max_num_batched_tokens`、`gpu_memory_utilization`、`enable_chunked_prefill`。做成敏感度表，指出哪个参数影响最大。"},
{t:"D4 · 多引擎对比", d:"同一模型同一硬件同一负载，跑 SGLang（重点测多轮对话场景的 RadixAttention 收益）。有条件再加 TensorRT-LLM。给出**决策树式**的选型建议，而不是简单排名。"},
{t:"D5 · 容量规划与报告", d:"用你测出的数字，反推「给定 QPS=X、SLO=Y，需要几张卡」。写完整报告：方法论、所有曲线、参数敏感度、选型建议、容量公式。"}
],
resume:"完成 XX 模型的推理性能系统性评测：对比 HF/vLLM/SGLang 三种引擎在真实长度分布负载下的表现，vLLM 相比基线吞吐提升 X 倍；通过参数调优（max_num_seqs、chunked prefill）在 TTFT P95<1s 约束下将有效吞吐再提升 Y%；产出容量规划模型，可由 QPS 和 SLO 直接推算 GPU 需求。",
asks:["为什么不能用固定长度的合成负载？","open-loop 和 closed-loop 压测有什么区别？",
      "SLO 拐点是怎么找的？","哪个参数对吞吐影响最大，为什么？",
      "如果 QPS 翻倍，你需要加几张卡？"],
pitfall:"最常见的翻车是**只报一个吞吐数字不报延迟**，或者只报平均值不报 P99。LLM 延迟长尾极重，平均值毫无意义。另外 warmup 一定要做 —— CUDA Graph 捕获和 cuBLAS autotune 都在前几十秒。"
},

{
id:"P3", tier:"kernel 方向", days:"5-7 天", stars:4, color:"#6b7d5c",
name:"Triton 算子库：写几个 LLM 真实用得上的融合 kernel",
tagline:"不用啃几个月 CUDA 就能产出真实的 kernel 优化成果。简历上写「用 Triton 实现并优化 XX 算子，相比 PyTorch 原生快 N 倍」可信度很高。",
stack:["Triton","PyTorch","WSL2 或 Linux","Nsight Compute（可选）"],
why:`这是系统工程师进入 kernel 层**最现实的入口**。

而且有额外收益：\`torch.compile\` 的后端 Inductor 生成的就是 Triton 代码，会读它等于能调试 compile 的产物 —— 这在排查性能问题时非常实用。`,
steps:[
{t:"D1 · 环境与基础", d:"装好 WSL2 + Triton（Windows 原生不支持）。跟官方 tutorial 写 vector add，理解 program_id / block / mask 的语义和 `triton.testing.do_bench` 的用法。"},
{t:"D2 · Fused Softmax", d:"实现融合 softmax，对比 `torch.softmax`。在不同行宽（256/1024/4096/16384）下测加速比。理解为什么融合能快 —— 省了中间张量的 HBM 往返。"},
{t:"D3 · Fused RMSNorm", d:"LLM 里真实用到的算子。实现 RMSNorm + 残差的融合版本，对比未融合版本。这个 kernel 在真实模型里能直接替换。"},
{t:"D4 · Fused SwiGLU", d:"`SwiGLU(x) = Swish(xW1) ⊗ (xW2)`，把三个操作融成一个。这是 LLaMA 系列 FFN 的核心算子。"},
{t:"D5-6 · Matmul 与 autotune", d:"用 `tl.dot` 实现分块 matmul，加 `triton.autotune` 搜 BLOCK_M/N/K、num_stages、num_warps。和 cuBLAS 对比（能到 80-95% 就很好）。理解 tiling 和软件流水。"},
{t:"D7 · 端到端验证与报告", d:"把你的 fused RMSNorm 和 SwiGLU 接进一个小模型，测端到端 decode 延迟的变化。写 README：每个 kernel 的加速曲线、autotune 出的最优配置、以及为什么快的解释。"}
],
resume:"用 Triton 实现 LLM 融合算子库：fused softmax / RMSNorm+残差 / SwiGLU / 分块 matmul，相比 PyTorch 原生实现分别加速 X/Y/Z 倍，matmul 达到 cuBLAS 的 W%；接入小模型后端到端 decode 延迟降低 V%。",
asks:["融合省的是什么，为什么对 memory-bound 算子收益大？","BLOCK_SIZE 怎么选，autotune 搜出来的最优值符合预期吗？",
      "Triton 和手写 CUDA 的性能差距来自哪里？","你的 kernel 在什么输入形状下会退化？"],
pitfall:"别只跑 tutorial 就算完。**必须接进真实模型测端到端收益** —— 很多 kernel 微基准快 3 倍，端到端只快 2%，因为它本来就不是瓶颈。能诚实报告这一点反而加分。"
},

{
id:"P4", tier:"平台方向", days:"7-10 天", stars:5, color:"#6d6384", must:true,
name:"多租户推理网关：限流、公平调度、可观测",
tagline:"这是你在 Bedrock 做的事的开源版本。做出来之后，「设计一个多租户 LLM 推理服务」那道系统设计题你答的是自己的代码。",
stack:["FastAPI","Redis","Prometheus + Grafana","vLLM 作为后端","Docker Compose"],
why:`系统设计轮最高频的那道题就是这个。而且它是你**已有经验的延伸** —— 你在 Bedrock 见过真实的多租户问题，把它实现一遍，故事就完整了。

另外这个项目不需要多卡，单卡起一个小模型就能演示全部机制。`,
steps:[
{t:"D1-2 · 基础网关", d:"FastAPI 接入层：API key 鉴权、租户识别、请求校验、SSE 流式转发到后端 vLLM。实现优雅关闭（graceful drain）。"},
{t:"D3 · 双维度限流", d:"per-tenant 的 **TPM（token/分钟）+ RPM（请求/分钟）** 令牌桶，用 Redis 做分布式计数。超限返回 429 + `Retry-After`。**重点：token 限流要在请求前用 tokenizer 预估输入长度、生成后再结算实际用量。**"},
{t:"D4-5 · 公平调度", d:"per-tenant 队列 + 加权公平调度（DRR 或 WFQ），权重按套餐等级。**按 token 数计权而非请求数**。实现优先级抢占（高优租户插队）和排队超时。"},
{t:"D6 · SLO 分层", d:"把流量分成交互式和批处理两类，走不同的后端参数（批处理用更大的 max_num_seqs）。验证分层后整体吞吐的提升。"},
{t:"D7 · 可观测", d:"Prometheus 指标：TTFT/TPOT 直方图（**按租户打标**）、队列长度、限流命中数、KV 使用率、每租户 token 消耗。Grafana 看板。全链路 trace_id。"},
{t:"D8-9 · 故障注入与验证", d:"构造 noisy neighbor 场景：一个租户灌入大量长请求，验证其他租户的 SLO 不受影响。测试后端宕机时的熔断和排水。记录每种场景下的行为。"},
{t:"D10 · 成本归因与报告", d:"实现按租户/模型的 token 成本统计。写 README：架构图、每层机制的设计理由、故障注入的结果、Grafana 截图。"}
],
resume:"实现多租户 LLM 推理网关：per-tenant 的 TPM/RPM 双维度限流、按 token 加权的公平调度、SLO 分层路由；在 noisy neighbor 压力测试下，单租户突发 10 倍流量时其他租户 P95 延迟劣化控制在 X% 以内；全链路 trace 与按租户维度的 Prometheus 指标体系。",
asks:["为什么 token 限流比请求数限流更合理？","公平调度用什么算法，怎么防止长请求饿死短请求？",
      "一个租户突发流量，你的系统会发生什么？","prefix cache 在多租户下有什么安全风险？",
      "怎么做成本归因？"],
pitfall:"**别忘了 prefix cache 的租户隔离** —— 面试官问到这个而你没想过会很尴尬。跨租户共享前缀可以通过命中时延推测别人的 prompt，是真实的信息泄漏。在你的实现里按租户加缓存命名空间，并在 README 里写明这个考虑。"
},

{
id:"P5", tier:"平台方向", days:"5-7 天", stars:4, color:"#b08442",
name:"模型评估与发布流水线",
tagline:"被严重低估的方向。所有团队都缺一个「能说清模型到底好不好」的人，而这个能力在系统设计轮里是加分项。",
stack:["pytest","LLM-as-Judge","Streamlit / Grafana","GitHub Actions","SQLite"],
why:`量化、换引擎、改 prompt —— 每一次变更都需要回答「变好了还是变坏了」。这个流水线是所有优化工作的前提。

而且它能直接支撑你在 P2、P6 里的质量验证，是个基础设施型的项目。`,
steps:[
{t:"D1-2 · 多维评测集", d:"针对一个具体场景构建 200-300 条评测集，覆盖五个维度：正确性、格式遵循（JSON schema）、安全性、鲁棒性（错别字/歧义输入）、边界 case。每条标注期望行为。"},
{t:"D3 · LLM-as-Judge 与去偏", d:"实现 pairwise 对比和打分两种模式。**必须处理位置偏见**（交换 A/B 顺序跑两遍取一致结果）和**长度偏见**（在 rubric 里明确「长度不是质量」）。"},
{t:"D4 · 可信度验证（关键）", d:"人工标注 100 条作为金标准，计算 Judge 与人工的一致率（Cohen's Kappa）。**Kappa < 0.6 说明 Judge 不可信，要改 prompt 重来。** 这一步是整个项目可信度的来源，不能跳。"},
{t:"D5 · 回归门禁", d:"做成 pytest 套件，接 GitHub Actions。模型或 prompt 变更时自动跑，产出 diff 报告，指标掉超过阈值则阻断合并。"},
{t:"D6 · 敏感探针", d:"专门加入量化/压缩最容易伤到的测试：GSM8K 子集（多步推理）、needle-in-a-haystack（长上下文召回）、HumanEval 子集（可执行验证）。"},
{t:"D7 · 看板与报告", d:"Streamlit 做结果看板：分维度雷达图、版本对比、badcase 浏览与标注。写 README 说明方法论和 Kappa 验证结果。"}
],
resume:"设计并实现 LLM 评估与发布流水线：构建覆盖 5 个维度的 300 条评测集，实现消除位置/长度偏见的 LLM-as-Judge（与人工标注一致率 Kappa=X），集成 CI 实现变更自动回归与门禁阻断，将版本验证时间从 N 小时压缩到 M 分钟。",
asks:["LLM-as-Judge 有哪些偏见，你怎么消除？","你怎么证明你的 Judge 是可信的？",
      "离线指标好但线上效果差，可能是什么原因？","量化后该重点测什么？",
      "评测集怎么防止被过拟合？"],
pitfall:"Judge 的 prompt 本身要迭代。直接用「请打 1-10 分」会得到一堆 7、8 分，区分度极差。要用**明确的 rubric**（每一档的具体标准）或 **pairwise 对比**。另外 Kappa 验证不能省 —— 没有它，你的所有分数都只是「另一个模型的意见」。"
},

{
id:"P6", tier:"训练方向", days:"7-10 天", stars:4, color:"#a8503f",
name:"分布式训练脚手架：FSDP + MFU 优化 + 故障恢复",
tagline:"训练侧经验在 Infra 岗里是稀缺品。即使你主攻推理，能讲清训练的并行和容错也会明显加分 —— 而且这是 OpenAI/Anthropic infra 岗的直接考点。",
stack:["PyTorch FSDP","torchelastic","nsys","wandb","云上多卡"],
why:`大规模训练的**可靠性经验**是最难获得也最值钱的。这个项目让你在小规模上把整套机制走一遍：并行、重叠、检查点、故障恢复、慢节点检测。

你在 AGI 如果碰过相关问题，这个项目能把那些零散见闻变成系统化的能力证明。`,
steps:[
{t:"D1-2 · FSDP 基础与显存对比", d:"用 FSDP 训一个 1B 级模型。对比 ZeRO-2（`SHARD_GRAD_OP`）和 ZeRO-3（`FULL_SHARD`）的显存占用与吞吐，**验证那约 50% 的额外通信开销**。"},
{t:"D3 · MFU 测量与优化", d:"实现 MFU 计算：`6×N×tokens / (step_time × GPU数 × 峰值FLOPS)`。逐项优化并记录每项的贡献：混合精度、FlashAttention、torch.compile、bucket_cap_mb。目标做到 40% 以上。"},
{t:"D4 · 显存与激活优化", d:"测梯度检查点的成本模型（显存降多少、时间涨多少，验证「+30% 时间换 60-70% 激活显存」）。试选择性开启（只在激活大的层）。"},
{t:"D5 · 通信重叠验证", d:"用 nsys 抓时间线，**验证 NCCL kernel 和计算 kernel 是否真的在时间上并行**。如果是锯齿状说明没重叠，调 bucket 参数直到重叠。这一步的截图是很好的简历素材。"},
{t:"D6-7 · 检查点与故障恢复", d:"实现异步分片 checkpoint（先拷 CPU 内存、后台落盘）。测写入耗时，用 Young/Daly 公式 `T=√(2×C×MTBF)` 算最优保存频率。**故障演练**：训练中途 kill 一个 rank，观察 NCCL 超时行为，验证从 checkpoint 恢复后 loss 曲线连续。"},
{t:"D8-9 · 慢节点检测", d:"实现 per-rank step 时间监控与离群检测。**人为制造 straggler**（用 cgroup 限制某个 rank 的 CPU 或 GPU 频率），验证它如何拖慢整个集群，以及你的监控能否发现。"},
{t:"D10 · 报告", d:"写 README：MFU 优化记录（从多少到多少、每项贡献多少）、nsys 时间线对比截图、故障恢复演练结果、checkpoint 频率的计算过程。"}
],
resume:"搭建分布式训练脚手架并做效率优化：FSDP 训练 1B 模型，通过通信重叠、选择性梯度检查点、torch.compile 将 MFU 从 X% 提升至 Y%；实现异步分片 checkpoint 并按 Young/Daly 公式确定最优保存频率；完成节点故障与慢节点的注入演练，验证恢复流程与检测机制。",
asks:["ZeRO-3 相比 ZeRO-2 多了多少通信，为什么？","MFU 低你会按什么顺序排查？",
      "怎么验证通信和计算真的重叠了？","checkpoint 频率怎么定最优？",
      "一个 rank 挂了，其他 rank 会怎样？（提示：NCCL 会 hang 而不是报错）",
      "怎么检测慢节点？"],
pitfall:"**不要只跑通就算完**，这个项目的价值全在「测量 + 优化 + 演练」三件事上。尤其是**故障演练** —— 大多数人没做过，而这恰恰是大规模训练最核心的工程挑战。能讲 SDC 和 straggler 的候选人凤毛麟角。"
},

{
id:"P7", tier:"加分", days:"4-6 天", stars:3, color:"#c0caf5",
name:"KV Cache 服务：前缀缓存与多级存储",
tagline:"把 prefix caching 从引擎内部的一个开关，做成一个独立的、可跨实例共享的服务。这是 Mooncake 那类系统的简化版。",
stack:["Python","Redis / 本地 NVMe","一致性哈希","vLLM 作为后端"],
why:`多副本部署时，prefix cache 命中率会被路由打散 —— 同一个会话的请求落到不同实例，缓存就白建了。这是真实存在但讨论较少的问题。

做这个项目能让你在「怎么提高缓存命中率」「PD 分离怎么传 KV」这类问题上有独到的回答。`,
steps:[
{t:"D1 · 量化问题", d:"多副本部署，用随机路由 vs 会话亲和路由，对比 prefix cache 命中率和 TTFT。**先把问题量化出来**，这是项目的动机。"},
{t:"D2-3 · 亲和性路由", d:"实现基于会话 ID 或 prompt 前缀哈希的一致性哈希路由，让相同前缀的请求尽量落到同一实例。处理实例增减时的再平衡。测命中率的改善。"},
{t:"D4 · 前缀索引", d:"实现一个简化的 radix tree（压缩前缀树）来索引已缓存的前缀，支持最长公共前缀查找。对比简单哈希的命中率差异（多轮对话场景差距明显）。"},
{t:"D5 · 多级存储", d:"热前缀留 HBM（引擎内）、温的放 CPU 内存、冷的放本地 NVMe。实现 LRU 淘汰和按需加载。测不同层级的命中率和加载延迟。"},
{t:"D6 · 安全与报告", d:"实现租户级的缓存命名空间隔离。写 README：问题量化、每一步的改善数据、架构图、以及对 PD 分离场景的延伸讨论。"}
],
resume:"实现跨实例的 KV 前缀缓存服务：通过一致性哈希亲和路由将多副本部署下的 prefix cache 命中率从 X% 提升到 Y%，TTFT P95 降低 Z%；实现 radix tree 前缀索引与 HBM/DRAM/NVMe 三级存储，支持租户级命名空间隔离。",
asks:["为什么多副本会降低缓存命中率？","radix tree 比前缀哈希好在哪？",
      "实例增减时怎么处理缓存迁移？","跨租户共享前缀有什么风险？",
      "这套机制怎么支撑 PD 分离？"],
pitfall:"别把它做成一个通用缓存 —— 重点是**前缀语义**（最长公共前缀、树状共享），这才是和普通 KV 存储的区别。另外一定要**先量化问题再给方案**，否则面试官会问「你解决的问题真的存在吗」。"
}
];
