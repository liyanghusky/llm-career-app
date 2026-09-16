/* AI Infra 专项 —— window.INFRA_INTRO / INFRA_STACK / INFRA_DESIGN / INFRA_MINE
   面向已在 LLM 团队、但想把知识补成体系并转专职 AI Infra 岗的人。
   自评 s: 1 听过讲不清 / 2 能讲清 / 3 亲手做过
*/
window.INFRA_INTRO = {
title: "AI Infra 的知识栈长什么样",
body: `在大厂 LLM 团队待过，不等于有体系化的 AI Infra 知识 —— 因为你只拥有整栈里的一小片。这不是你的问题：Bedrock 上千人，没人能碰到全部。

但面试考的是**整栈的推理能力**。面试官会从任意一层切进去，然后往上下追。所以要补的不是"再深挖你已经会的"，而是**把没碰过的那几层从零变成能讲清楚**。

用法：

- 每个点先自评。**「能讲清」的标准是：不看资料，对着白板讲五分钟，并且答得上追问。** 觉得"好像知道"就是讲不清。
- 优先补标了「必会」的，它们被问到的概率最高。
- 每个点都有**动手清单**。这类岗位极其看重你是否真的测过 ——「我读过 PagedAttention 论文」和「我压测过开关 prefix caching 的吞吐差异，是 2.3 倍」是两个量级的可信度。

> **一个现实提醒**：你在 Bedrock / AGI 的经历已经够敲开门了，缺的是把它讲成 AI Infra 语言的能力。补知识的同时，用最后那一节把手上的经历挖成故事 —— 那部分回报比刷知识点更高。`
};

window.INFRA_STACK = [
{
id:"l1", name:"第一层 · 硬件与性能直觉", color:"#9c6b4f",
why:"所有优化的第一性原理都在这层。答不上「这个负载是算力瓶颈还是访存瓶颈」，后面全是空谈。",
topics:[
{id:"i1a", name:"算术强度与 Roofline 模型", must:true,
what:`**算术强度 = 浮点运算次数 / 访存字节数**，单位 FLOP/Byte。它决定一个算子是算力受限还是带宽受限。

硬件峰值算力除以峰值带宽得到**拐点**。H100 SXM 大致 989 TFLOPS(BF16) / 3.35 TB/s ≈ **295 FLOP/Byte**。算子强度低于这个数就是 memory-bound，再强的 Tensor Core 也闲着。

关键结论：**LLM 的 decode 阶段算术强度极低**（batch=1 时每读一遍权重只做一次乘加，强度约等于 2），所以解码是彻底的访存瓶颈。这一条同时解释了：为什么增大 batch 几乎白赚吞吐、为什么 KV Cache 大小如此关键、为什么投机解码有效。`,
ask:"NVIDIA 几乎必问。常见形式：「给你一个算子，怎么判断该优化什么」「为什么 LLM 推理增大 batch 吞吐涨得那么快」。Meta/Google 会包装成「这个服务慢在哪」。",
check:"能当场估算 7B 模型 decode 的算术强度并据此说明它是 memory-bound；能说出你常用那张卡的拐点大概在哪。",
hands:"跑 Nsight 或 nvidia-smi dmon，对比矩阵乘（compute-bound）和逐元素加法（memory-bound）的 SM 利用率与带宽利用率，记下两组数。"},

{id:"i1b", name:"显存层级：HBM / L2 / SMEM / 寄存器", must:true,
what:`存储金字塔：寄存器（~20 TB/s 级）→ Shared Memory / L1（~10 TB/s）→ L2（几 TB/s）→ HBM（H100 约 3.35 TB/s）→ 主机内存（PCIe 5.0 x16 约 64 GB/s 双向）。

**每往下一层慢一个量级**，所以几乎所有 kernel 优化的本质都是「减少 HBM 访问」。FlashAttention 快不是因为算得少（FLOP 反而更多），而是把注意力中间矩阵留在 SMEM 里分块算，避免把 N×N 矩阵写回 HBM。

容量也要有数：H100 每 SM 的 SMEM 228 KB，L2 50 MB，HBM3 80 GB。`,
ask:"NVIDIA 会追到 bank conflict 和访存合并。其他家一般问到「为什么 FlashAttention 快」为止。",
check:"能解释 FA 的加速来源是访存而非算力；能说明为什么 CPU offload 在 decode 阶段通常不划算（PCIe 比 HBM 低两个量级）。",
hands:"读 FlashAttention 论文的 tiling 那节，在纸上画出数据流：哪些留 SMEM、哪些写回 HBM。"},

{id:"i1c", name:"互联：NVLink / NVSwitch / PCIe / RDMA", must:true,
what:`多卡的瓶颈常常不在计算而在通信。

**机内**：H100 的 NVLink 4.0 单卡 900 GB/s 双向，经 NVSwitch 全互联。这是为什么张量并行（每层都要 All-Reduce）只在单机八卡内用。
**机间**：InfiniBand NDR 400 Gb/s ≈ 50 GB/s，比 NVLink 低一个量级以上。所以跨机只放通信量小的并行方式。

记住这个不等式：**NVLink >> IB/RoCE >> PCIe**。3D 并行的切分策略是从它直接推导出来的，不是约定俗成。`,
ask:"训练岗必问。典型：「为什么 TP 不跨机」「8 卡和 16 卡的切分策略有什么不同」。",
check:"能从带宽差异推导出「TP 在机内、PP 跨机、DP 最外层」，而不是背下来的。",
hands:"用 nccl-tests 跑 all_reduce_perf，对比机内和跨机实测带宽，记下数字。"},

{id:"i1d", name:"精度格式：BF16 / FP16 / FP8 / INT4",
what:`分清**动态范围（指数位）**和**精度（尾数位）**：

- FP32：8 位指数，23 位尾数
- **BF16**：8 位指数（范围同 FP32），7 位尾数 —— 范围够、精度低，**不需要 loss scaling**，当前训练默认
- FP16：5 位指数，10 位尾数 —— 范围窄易下溢，**必须配 loss scaling**
- FP8（H100 起）：E4M3 前向 / E5M2 梯度，需要 per-tensor 甚至 per-block 缩放
- INT4 / NF4：只用于推理权重量化

一句话核心：**深度学习对动态范围敏感，对精度不敏感。**`,
ask:"「BF16 和 FP16 怎么选」是送分题。追问会到 FP8 训练的稳定性和 scaling 粒度。",
check:"能说清 BF16 为什么不需要 loss scaling；能说出 FP8 训练的主要难点在 scaling 粒度。",
hands:"用 torch 构造一个在 FP16 下溢成 0 的小梯度，再换 BF16 看它保住。亲眼看过就忘不掉。"},

{id:"i1e", name:"显存账：一个模型到底要多少显存", must:true,
what:`要能当场算。设参数量 N：

**推理（BF16）**：权重 2N 字节，7B → 14 GB，再加 KV Cache。
**KV Cache**：\`2 × 层数 × KV头数 × 头维度 × 序列长 × batch × 2字节\`。LLaMA-7B（32 层 32 头 128 维）约 **512 KB/token**；用 GQA 降到 8 组后约 128 KB/token。
**训练（AdamW 混合精度）**：参数 FP32(4N) + 梯度(4N) + 动量(4N) + 二阶矩(4N) = **16N 字节**。7B 就是 112 GB，单卡放不下 —— 这就是 ZeRO 和 LoRA 存在的理由。再加激活值，长序列时激活可能超过权重。`,
ask:"极高频。「70B 推理要几张 A100」「为什么全参微调 7B 要 8 卡」几乎每家都问。",
check:"能在 60 秒内口算任意模型的推理与训练显存，包括 KV Cache 随并发的增长。",
hands:"把你在 Bedrock 见过的某个模型的真实显存占用拿来，用这套公式反推，看差在哪 —— 差的部分（碎片、CUDA context、激活）就是你的知识缺口。"}
]},

{
id:"l2", name:"第二层 · 单卡：kernel 与算子", color:"#3b4a5a",
why:"NVIDIA 和各家推理团队的核心筛子。不需要你会写 CUDA，但必须能读懂、能判断。",
topics:[
{id:"i2a", name:"CUDA 执行模型：grid / block / warp / SM", must:true,
what:`线程组织：**thread → warp（32 线程，SIMT 最小调度单位）→ block（同一 SM，共享 SMEM，可同步）→ grid**。

三个必须理解的后果：
- **warp divergence**：同一 warp 内走不同分支会串行执行两次，所以 kernel 里要避免线程间分叉。
- **occupancy**：SM 上同时驻留的 warp 数 / 上限。太低则无法用其他 warp 掩盖访存延迟。受寄存器数和 SMEM 用量限制。
- **coalesced access**：同一 warp 的 32 线程访问连续显存会合并成一次事务，否则退化成 32 次。**最常见的性能杀手。**`,
ask:"NVIDIA 会深挖，可能让你手写简单 kernel（向量加、reduction）。Meta/Google 的推理岗一般只要求能读懂和判断。",
check:"能解释什么是访存合并以及为什么重要；能说出 occupancy 高不一定快（可能已被带宽限制）。",
hands:"写一个 CUDA reduction（数组求和），朴素写法 vs warp shuffle 写法测速差。最经典的入门练习，一个下午能做完。"},

{id:"i2b", name:"算子融合与 CUDA Graph", must:true,
what:`每启动一个 kernel 都要：读 HBM → 算 → 写回 HBM。逐元素算子（bias、激活、残差、LayerNorm）算得少访存多，单独跑就是纯带宽浪费。

**融合**把连续算子合进一个 kernel，中间结果留在寄存器/SMEM，只读写一次 HBM。把 \`Linear → Bias → GELU\` 融成一个，能省两次完整读写。

路径：手写融合 kernel、torch.compile（Inductor 自动融合）、TensorRT 图优化、Triton。

**CUDA Graph** 是另一个方向：把整个 decode step 的几百次 kernel 启动录制成一张图一次提交，消除 CPU 启动开销。小 batch decode 时 CPU launch overhead 可能占三成以上。`,
ask:"「你会怎么优化这个推理服务」的标准展开方向。NVIDIA 会问到 Triton/TensorRT 的具体机制。",
check:"能说出融合省的是访存不是算力；能解释 CUDA Graph 解决的是 CPU 侧开销而非 GPU 侧。",
hands:"拿小模型对比 eager / torch.compile / CUDA Graph 三种模式的 decode 延迟，做成表格。半天能做完，很好的简历素材。"},

{id:"i2c", name:"FlashAttention 系列", must:true,
what:`标准注意力要物化 N×N 分数矩阵，显存 O(N²)，且多次读写 HBM。

**核心是 tiling + online softmax**：把 Q/K/V 切块加载进 SMEM，在片上算完一块，用在线更新维护 softmax 的 running max 和 running sum，从而**永远不物化完整的 N×N 矩阵**。显存降到 O(N)，HBM 访问大幅减少。

代价是反向时重算注意力。但因为是访存瓶颈，重算的算力开销远小于省下的访存时间 —— **「用算力换访存」的典范**，和梯度检查点「用算力换显存」是同一类思想。

FA2 改进并行切分与 work partitioning；FA3 针对 Hopper 的异步和 FP8 适配。`,
ask:"LLM infra 岗几乎必问。追问：online softmax 怎么保证数值稳定、为什么重算反而更快、和 PagedAttention 什么关系（正交，可叠加）。",
check:"能在白板上讲清 online softmax 为什么不需要看到全部元素；能说明 FA 和 PagedAttention 解决的是不同问题。",
hands:"手写 numpy 版 online softmax（分块喂入，维护 running max / sum），验证与一次性 softmax 结果一致。二十行代码，讲得清就赢一半。"},

{id:"i2d", name:"Triton：用 Python 写 kernel",
what:`OpenAI 的 Triton 让你用 Python 语法写 GPU kernel，编译器自动处理 SMEM 分配、访存合并、向量化，性能常达手写 CUDA 的 80-95%，开发效率高一个量级。

PyTorch 的 \`torch.compile\` 后端 Inductor 生成的就是 Triton；vLLM、Unsloth 里也有大量 Triton kernel。

对你的意义：**这是系统工程师进入 kernel 层最现实的入口** —— 不用啃几个月 CUDA 就能产出真实的优化成果。`,
ask:"不一定直接问，但简历上有 Triton 经验会显著提升 kernel 方向岗位的可信度。",
check:"能写出 Triton 版的 fused softmax 或 layernorm，并说明 BLOCK_SIZE 怎么选。",
hands:"跟官方 tutorial 写 vector add → fused softmax → matmul。**投入产出比最高的一项**，两三天完成，直接可写进简历。"}
]},

{
id:"l3", name:"第三层 · 推理引擎内部", color:"#6b7d5c",
why:"招聘需求最集中的一层，也是你在 Bedrock 最容易把已有经历接上的一层。",
topics:[
{id:"i3a", name:"Prefill / Decode 两阶段与调度", must:true,
what:`**Prefill**：并行处理整个 prompt，大矩阵乘，**compute-bound**，GPU 利用率高，决定 **TTFT**。
**Decode**：逐 token 生成，每步只算一个 token 却要读全部权重和 KV Cache，**memory-bound**，算力利用率常低于 5%，决定 **TPOT**。

两者特性冲突，混在一个 batch 里会互相伤害：一个长 prefill 会卡住所有正在 decode 的请求，造成 TPOT 尖刺。

两条解法：
- **Chunked Prefill**：把长 prefill 切块，与 decode 混合调度，平滑延迟。
- **PD 分离**：prefill 和 decode 放不同 GPU 池，各自独立扩缩，KV Cache 经高速网络传输。DeepSeek、Mooncake 和各大云厂的做法。`,
ask:"**当前最高频的推理面试题。** 必追问：PD 分离的 KV 传输开销怎么处理、什么场景下不值得分离。",
check:"能说清两阶段瓶颈差异、TTFT/TPOT 各受什么影响、PD 分离的收益与代价（增加 KV 传输和系统复杂度）。",
hands:"你在 Bedrock 应该见过 TTFT/TPOT 监控。把 P50/P99 翻出来分析尖刺来源 —— 这直接就是面试故事。"},

{id:"i3b", name:"Continuous Batching 与 PagedAttention", must:true,
what:`**静态批处理的问题**：一批要等最长的那个生成完才整批返回，短请求的槽位空转。

**Continuous Batching**：以 iteration 为单位调度，任何请求一出 EOS 就立刻踢出、换新请求进来。吞吐常提升数倍。

**PagedAttention**：传统实现要为每个请求预分配 max_len 的连续 KV 显存，内外碎片导致 60-80% 浪费。它借鉴虚拟内存，把 KV 切成固定 block（如 16 token），用块表映射，按需分配、非连续存储。显存利用率接近 100%，从而容纳数倍并发。

额外收益：**前缀共享**。多请求共用同一 system prompt 时物理块只存一份（copy-on-write），这就是 prefix caching 的实现基础。`,
ask:"vLLM 相关必问。追问：block size 怎么选、抢占策略、swap 还是 recompute。",
check:"能说出 PagedAttention 解决的是显存碎片而非计算；能解释 prefix caching 为什么能显著降低多轮对话和长 system prompt 的成本。",
hands:"部署 vLLM + locust 压测，画并发-吞吐-延迟曲线；再开关 --enable-prefix-caching 对比固定 system prompt 场景的 TTFT。标准的 AI Infra 简历项目。"},

{id:"i3c", name:"投机解码", must:true,
what:`小草稿模型一次预测 k 个 token，大模型**一次前向并行验证**，接受匹配前缀，从第一个不匹配处重采样。

**为什么快**：decode 是访存瓶颈，大模型验证 5 个 token 和验证 1 个耗时几乎一样（都要完整读一遍权重）。"一次验证多个"是白赚的算力。

**质量严格无损** —— 通过精心设计的拒绝采样，输出分布与直接采样数学上完全一致。这是核心卖点。

变体：**Medusa**（原模型加多预测头，省掉独立草稿模型）、**EAGLE**（特征层做草稿，接受率更高）、**Lookahead**（无草稿模型，n-gram 猜）。实测 1.5-3 倍，取决于接受率。

注意：**高并发时收益下降** —— batch 大时 GPU 已经不闲，投机反而抢算力。`,
ask:"高频。必追问：为什么不损失质量（要能讲拒绝采样）、什么情况下不该用。",
check:"能解释无损性来源；能说出高 batch 下收益衰减 —— 这句话能明显区分读过论文和真跑过的人。",
hands:"在 vLLM 里开 speculative decoding，测不同 batch size 下的加速比，验证高并发时收益衰减。"},

{id:"i3d", name:"量化：权重 / 激活 / KV Cache", must:true,
what:`分三个对象，别混：

**权重量化**（最常见）：GPTQ（基于 Hessian 逐列量化补偿）、**AWQ**（保护激活幅度大的约 1% 显著权重，不依赖反传，泛化更好，GPU 部署首选）、GGUF（CPU / 端侧）。4-bit 通常掉 1-2%，换 3.5 倍体积压缩。

**激活量化**：SmoothQuant 把激活的离群值难度迁移一部分到权重，使 W8A8 可行。难点是 LLM 激活有严重 outlier。

**KV Cache 量化**：长上下文高并发时 KV Cache 比权重还大，量化到 FP8/INT8 能直接翻倍并发。性价比很高但讨论较少。

**FP8** 在 H100 上是特例：硬件原生支持，几乎无损且**真正提速**。`,
ask:"「同样 4-bit，为什么 AWQ 比 GPTQ 更常用」「量化省的是显存还是算力」区分度很高。",
check:"能说清 4-bit 权重量化在多数实现里**计算时仍要反量化回 FP16**，省的是显存和带宽不是算力；而 FP8 是真用上了硬件算力。",
hands:"同一模型跑 FP16 / AWQ / FP8，对比显存、吞吐、精度掉点，三行表格。"},

{id:"i3e", name:"MoE 推理的工程难点",
what:`MoE 总参数大、激活参数小（Mixtral 8x7B 总参 47B 激活 13B），但部署并不轻松：

- **显存不省**：每 token 只激活 top-k 专家，但**全部专家都得在显存里**。
- **专家并行的 All-to-All**：专家分布在不同卡，每层两次 All-to-All，是主要瓶颈。
- **负载不均**：热门专家被打爆，冷专家闲置。需要容量上限、丢弃策略或动态重平衡。
- **batch 越大越划算**：小 batch 时每个专家只分到几个 token，矩阵乘退化成瘦长形，算力利用率极低。`,
ask:"DeepSeek/Mixtral 之后成为常见追问。「MoE 推理为什么不省显存」是很好的甄别题。",
check:"能说出总参数与激活参数的区别，以及 All-to-All 是核心瓶颈。",
hands:"部署一个 MoE 模型，对比它和同激活参数量的 dense 模型在相同硬件上的吞吐与显存。"},

{id:"i3f", name:"长上下文：从 4k 到 1M",
what:`两个独立问题，别混：

**位置外推**：RoPE 基频插值（NTK-aware、YaRN），改 θ 就能把 4k 训练的模型扩到 128k，不用重训。

**显存与计算**：注意力 O(N²) 计算、KV Cache O(N) 显存。128k 上下文的 KV Cache 可能几十 GB。手段：GQA/MLA 压缩、KV 量化、**序列并行 / Ring Attention**（序列切多卡，环形传 KV）、稀疏或滑窗注意力。

还有质量问题：**中间遗失** —— 即使塞得下，模型对长上下文中段的召回也会下降。`,
ask:"长文本场景的岗位会问。追问：为什么 RoPE 能外推而可学习位置编码不能。",
check:"能分清「能不能放下」和「放下了效果好不好」是两个问题。",
hands:"把一个 8k 模型用 YaRN 扩到 32k，跑 needle-in-a-haystack 看召回曲线。"}
]},

{
id:"l4", name:"第四层 · 分布式训练", color:"#b08442",
why:"你在 AGI 最可能接触的一层。即使不做训练岗，Google/Meta 的 infra 面试也会问，因为它最能考察系统思维。",
topics:[
{id:"i4a", name:"四种并行与怎么组合", must:true,
what:`- **数据并行 DP**：每卡一份完整模型，切数据，梯度 All-Reduce。通信量 = 模型大小，但只在 step 末一次。
- **张量并行 TP**：切单个矩阵（FFN 按列、注意力按头），**每层前向后向都要 All-Reduce**。通信极频繁 → 只在机内 NVLink 上用，一般 TP ≤ 8。
- **流水线并行 PP**：按层切，用 micro-batch 填气泡（1F1B）。通信量最小 → 适合跨机。气泡率 ≈ (stage数-1)/(micro_batch数+stage数-1)。
- **专家并行 EP**：MoE 专用，All-to-All。
- **序列 / 上下文并行**：长序列时按序列维切。

**标准 3D 布局**：\`TP（机内）× PP（机间）× DP（最外层）\` —— 这个顺序由带宽层级推导而来。`,
ask:"训练方向必问，且一定追问「为什么这么排」。能从带宽推导而不是背诵，是关键区分点。",
check:"能解释为什么 TP 不跨机、PP 气泡怎么算、给定 N 张卡怎么选组合。",
hands:"在 2×8 卡上跑一次 Megatron 或 DeepSpeed 的 3D 并行，故意让 TP 跨机看吞吐掉多少。"},

{id:"i4b", name:"ZeRO 三阶段与 FSDP", must:true,
what:`ZeRO 优化的是**数据并行的显存冗余** —— DP 下每卡都存一份完整参数+梯度+优化器状态，全是重复的。

- **Stage 1**：切优化器状态（省约 4 倍）
- **Stage 2**：再切梯度（省约 8 倍）
- **Stage 3**：再切参数本身（省约 N 倍，但前向后向都要 All-Gather 参数，**通信量增加约 50%**）

**FSDP** 是 PyTorch 原生等价实现（对应 ZeRO-3），按 module 包装，前向时 all-gather 该层参数、用完立刻释放。

**ZeRO-Offload / Infinity** 把状态换到 CPU 甚至 NVMe —— PCIe 带宽会让它慢得多，是"跑得动"而非"跑得快"的方案。`,
ask:"「ZeRO-3 和 TP 有什么区别」是很好的深度题。答案：ZeRO-3 是时间换空间的 DP 变体，通信分散在 step 内；TP 是真正的模型切分，每层都同步。",
check:"能说出三阶段各切什么、ZeRO-3 的通信代价、以及它和 TP 的本质区别。",
hands:"用 FSDP 训一个 1B 模型，对比 ZeRO-2 和 ZeRO-3 的显存与吞吐，验证那 50% 通信开销。"},

{id:"i4c", name:"NCCL 与集合通信", must:true,
what:`必须认识的原语：**All-Reduce**（每卡得到全局和，= Reduce-Scatter + All-Gather）、**All-Gather**、**Reduce-Scatter**、**All-to-All**（MoE）、**Broadcast**。

**Ring All-Reduce** 的通信量：每卡收发 \`2(N-1)/N × 数据量\`，近似与卡数无关 —— 这是它能扩展的原因。大规模下用分层算法（机内 ring + 机间 tree）。

工程上真会遇到的：**通信与计算重叠**（梯度桶 bucketing，算完一部分就开始传）、NCCL 超时与死锁排查、\`NCCL_DEBUG=INFO\` 看拓扑选择对不对。`,
ask:"Meta/NVIDIA 会问。典型：「All-Reduce 怎么实现的」「怎么让通信和计算重叠」。",
check:"能画出 Ring All-Reduce 的两个阶段；能解释 DDP 里 gradient bucketing 的作用。",
hands:"跑 nccl-tests 各原语 benchmark；在 DDP 里调 bucket_cap_mb 看吞吐变化。"},

{id:"i4d", name:"大规模训练的故障与恢复", must:true,
what:`千卡规模下**硬件故障是常态而非意外** —— 几千卡的训练平均几小时就会有卡或链路出问题。

- **Checkpoint 策略**：频率是权衡（写得勤开销大，写得稀重算多）。异步 checkpoint、分片保存是标配。
- **弹性训练**：节点掉了能否降级继续（torchelastic）。
- **静默错误 SDC**：最可怕的一类 —— 某张卡算错了但不报错，表现为 loss 突然发散。需要定期校验和跨副本比对。
- **慢节点 straggler**：一张卡慢，整个集群等它。需要监控 per-rank 的 step 时间分布。`,
ask:"**资深候选人的区分题。** 能讲故障恢复和 straggler 的人，明显比只会讲并行策略的更像做过真实大规模训练。",
check:"能说出至少三类真实故障模式和对应的检测/恢复手段。",
hands:"你在 AGI 如果碰过训练中断、loss spike、或 checkpoint 恢复，把细节整理成故事 —— **这是最值钱的面试素材之一**。"}
]},

{
id:"l5", name:"第五层 · 服务化与平台工程", color:"#6d6384",
why:"你在 Bedrock 的经验大概率集中在这层。讲清楚它，是你相对纯算法背景候选人的优势所在。",
topics:[
{id:"i5a", name:"多租户模型服务：隔离、配额、公平性", must:true,
what:`Bedrock 这类平台的核心难题：

- **隔离**：共用 GPU 时一个大 batch 的重请求会拖垮邻居（noisy neighbor）。手段：token 级配额、per-tenant 并发上限、优先级队列。
- **公平调度**：纯 FIFO 会让长请求饿死短请求。常见做法是按 token 数加权的公平队列，或分级队列（交互式 vs 批处理走不同池）。
- **多模型共驻**：一张卡放多个小模型，或 LoRA 多适配器（同基座动态切换 adapter），显著提升利用率。
- **SLO 分层**：不是所有请求都要低延迟，把批处理流量单独调度能大幅提升整体吞吐。`,
ask:"**这是你最该准备的一题**，因为你真做过。会被问「你们怎么防止一个租户打爆共享容量」。",
check:"能描述一套完整的多租户隔离方案，并说出每个机制的代价。",
hands:"把 Bedrock 上你参与的配额/限流/调度设计写成一页设计文档（脱敏），面试前重读。"},

{id:"i5b", name:"自动扩缩与冷启动", must:true,
what:`GPU 服务的扩缩和普通无状态服务完全不同：

- **冷启动极慢**：拉取几十 GB 权重 + 加载进显存，分钟级。手段：镜像预热、权重放本地 NVMe 或高速共享存储、warm pool、分段并行下载。
- **扩缩指标选什么**：CPU 利用率完全没用。应该看**队列长度、KV Cache 占用率、TTFT 的 P99**。KV Cache 使用率接近上限是最好的扩容信号。
- **缩容要小心**：正在生成的请求不能直接杀，需要 graceful drain。
- **成本**：GPU 贵，空转烧钱，但扩不及时就是 SLO 违约。这个权衡是平台岗的核心话题。`,
ask:"「你怎么给一个 LLM 服务做自动扩缩」是系统设计轮常见开场。",
check:"能说出为什么 CPU 利用率不是有效指标，以及该用哪几个替代。",
hands:"如果 Bedrock 有数据，算一下冷启动时间的构成（下载/加载/预热各占多少）。"},

{id:"i5c", name:"路由、缓存与降本", must:true,
what:`按性价比排序，**这个顺序本身就是答案**：

1. **Prefix / Prompt Caching** —— 固定 system prompt 或长文档命中缓存，输入成本降 50-90%，**零质量损失**，永远第一优先。
2. **精简 prompt / 限制输出长度** —— 输出 token 通常比输入贵数倍。
3. **语义缓存** —— 相似问题直接返回。
4. **模型路由** —— 小模型接住简单请求，难的才升级。
5. **蒸馏** —— 大模型造数据微调小模型，垂直任务常能追平。长期最优但要投入。
6. **推理优化** —— 量化 + 提升批处理并发。`,
ask:"「这个服务一个月烧 50 万，怎么降到 20 万」是很常见的开放题。**按优先级答而不是罗列**，是加分点。",
check:"能给出有序清单，每项都能说出质量代价和验证方式。",
hands:"估算你们服务的 prefix cache 命中率，以及提升 20% 能省多少 —— 这种数字在面试里极有说服力。"},

{id:"i5d", name:"可观测性：该监控什么",
what:`**性能**：TTFT、TPOT、端到端延迟（都看 P50/P95/P99，不看平均）、吞吐（请求/秒 和 token/秒，输入输出分开）、排队时长。
**资源**：GPU 利用率（SM 利用率和显存带宽利用率是两回事）、显存占用、**KV Cache 使用率**、batch size 分布。
**质量**：拒答率、截断率、工具调用成功率、抽样送 LLM-Judge 的日常回归。
**成本**：每请求 token 成本、缓存命中率。

关键工程要求：**全链路 trace + 可回放**。线上出问题靠日志复现是基本功。`,
ask:"系统设计轮收尾必问「你怎么知道它是否健康」。",
check:"能列出十个以上指标并说明每个诊断什么问题。",
hands:"梳理你们现有 dashboard，找出缺失的指标 —— 这个梳理本身就是可讲的内容。"}
]},

{
id:"l6", name:"第六层 · 评估、数据与平台周边", color:"#a8503f",
why:"被严重低估的一层。会做评估的人在任何 LLM 团队都是刚需，而且这是你从 Bedrock/AGI 最容易挖出故事的地方。",
topics:[
{id:"i6a", name:"评估基础设施", must:true,
what:`模型或 prompt 一改，怎么知道变好还是变坏？所有 LLM 团队的痛点。

要素：**多维评测集**（正确性、格式遵循、安全性、鲁棒性、边界 case）、**LLM-as-Judge**（必须处理位置偏见 —— 交换顺序跑两遍；长度偏见 —— 长答案天然占优）、**与人工标注的一致率**（Cohen 的 Kappa，这是 Judge 可信度的来源）、**CI 集成的回归测试**。

高阶：离线指标好但线上差怎么办（分布偏移、评测集污染）、怎么设计 A/B、怎么灰度和一键回滚。`,
ask:"「你怎么验证一个模型或 prompt 改动是安全的」。平台岗和应用岗都会问。",
check:"能设计包含目标指标、通用回归、安全性的三层评估方案，并说明怎么证明 Judge 可信。",
hands:"如果 Bedrock/AGI 有 eval 流程，把设计理由整理清楚；没有的话，这本身就是你可以在组里推动的项目 —— 做成了是升职和跳槽的双重素材。"},

{id:"i6b", name:"数据管道与训练数据基础设施",
what:`训练侧 infra 的大头：大规模去重（MinHash / SimHash）、质量过滤（分类器打分、困惑度过滤）、**数据配比与课程安排**、tokenization 吞吐、数据加载不能成为 GPU 瓶颈（streaming、预取、packing）。

**测试集污染**是当前最受关注的问题：评测集出现在预训练语料里会让所有榜单失真。做去污染检测是真实工作。`,
ask:"训练方向会问。「你怎么保证数据加载不拖慢训练」很实际。",
check:"能说出数据侧可能成为瓶颈的几个环节和对应手段。",
hands:"算一下你们训练时 GPU 的 data-loading 等待占比。"},

{id:"i6c", name:"GPU 集群调度与资源管理",
what:`Kubernetes + GPU 的特殊性：GPU 不能超卖（除非 MIG 或 MPS 分片）、**拓扑感知调度**（同 job 的卡要在同一 NVLink 域内）、**gang scheduling**（分布式任务要么全起要么不起，否则死锁占资源）、抢占与优先级（研究让位生产）、队列与配额。

相关系统：Slurm（传统 HPC）、Kubernetes + Volcano/Kueue、Ray。`,
ask:"平台岗会深挖。「为什么分布式训练需要 gang scheduling」是很好的题。",
check:"能解释拓扑感知和 gang scheduling 各自解决什么问题。",
hands:"搞清楚你们内部集群用的调度系统的排队策略和拓扑约束。"}
]}
];

window.INFRA_DESIGN = [
{id:"d1", name:"设计一个多租户 LLM 推理服务", must:true,
why:"你在 Bedrock 干的就是这个。这道题你应该答得比 90% 的候选人好 —— 前提是提前把它结构化。",
frame:`**先澄清**：QPS 和峰谷比？输入输出长度分布？TTFT / TPOT 的 SLO 各是多少？多少模型、多少租户？租户间要强隔离吗？预算约束？

**容量估算**：按模型大小算单卡能放多少 KV Cache → 推出单卡并发上限 → 结合 QPS 和平均生成长度推出需要多少卡。**这一步一定要当场算出数字。**

**架构**：接入层（鉴权、限流、配额）→ 路由（按模型/租户/优先级）→ 调度器（continuous batching + chunked prefill，或 PD 分离）→ 推理引擎池（vLLM / TensorRT-LLM）→ KV Cache 管理（paged + prefix 共享）。旁路：模型仓库与预热、指标与 trace。

**关键权衡**：PD 分离 vs 混合调度；共享池 vs 租户独占池；延迟优先与吞吐优先两套 SLO 池。

**收尾**：扩缩指标（队列长度 + KV 占用率）、冷启动优化、灰度与回滚、成本账。`,
depth:"追问通常是：一个租户突发流量怎么办？长 prompt 把别人的 TPOT 拖垮怎么办？某个模型冷门但必须常驻怎么降成本（答：LoRA 多适配器共享基座 / 按需加载 + warm pool）？",
pitfall:"最常见的失分是**不算数字** —— 上来就画框图、不估容量，会被判定为没有真实经验。第二常见的是忽略冷启动和扩缩。"},

{id:"d2", name:"把一个推理服务的成本降 60%", must:true,
why:"开放题，考的是优先级判断而不是知识量。",
frame:`**先问清楚**：成本构成是什么（GPU 租用还是按 token 计费）？流量特征（重复率高吗、system prompt 长吗）？质量红线在哪？有多少工程时间？

**按性价比排序动手**：① prefix caching（零质量损失，最先做）② 精简 prompt / 限制输出长度 ③ 语义缓存 ④ 模型路由 ⑤ 量化 + 提升批处理并发 ⑥ 蒸馏小模型（长期最优，投入大）⑦ 改部署形态（PD 分离提升利用率）。

**每一步都要说**：预期收益量级、质量风险、怎么验证（A/B + 质量回归）。`,
depth:"追问：怎么量化质量损失？路由分类器判断错了怎么兜底？缓存会不会泄漏租户数据（这是安全题，答不上会扣分）？",
pitfall:"罗列一堆手段但不排序；或者一上来就说「换更小的模型」—— 那是牺牲质量最直接的做法，应该排在后面。"},

{id:"d3", name:"设计千卡训练集群的调度与容错", must:true,
why:"考大规模系统思维，AGI 背景的人最该拿下这道。",
frame:`**调度**：gang scheduling（全起或不起）、拓扑感知（同 job 的卡尽量同 NVLink 域 / 同 leaf switch）、队列与优先级（生产 > 研究）、抢占与 checkpoint 配合。

**容错**：故障检测（心跳、per-rank step 时间、NCCL 超时）→ 快速隔离坏节点 → 从最近 checkpoint 恢复或弹性降级。异步分片 checkpoint 降低写开销。

**静默错误**：定期校验、跨副本比对、loss spike 自动告警与回滚。

**慢节点**：监控 per-rank 时间分布，自动驱逐离群节点。

**利用率**：碎片整理、小任务回填、MIG 分片给推理和调试任务。`,
depth:"追问：checkpoint 频率怎么定（用 MTBF 和写开销算最优点）？一张卡坏了要不要重启整个 job？怎么区分慢节点和通信问题？",
pitfall:"只讲调度不讲容错。千卡规模的核心矛盾就是故障，不提说明没做过。"},

{id:"d4", name:"设计模型评估与发布流水线", must:true,
why:"平台岗高频，而且这是你能在组里主动推动的事 —— 做成了既是绩效也是面试素材。",
frame:`**离线**：多维评测集 → 自动跑分（目标指标 + 通用回归 + 安全）→ LLM-Judge（消偏见）+ 人工抽检 → 与基线对比出报告。
**CI**：prompt 或模型变更触发，产出 diff 报告，不达标阻断发布。
**灰度**：1% 流量 A/B → 看真实业务指标（点踩率、重试率、转人工率）+ 性能 SLO → 逐步放量 → **一键回滚**。
**长期**：badcase 回流形成新评测集，评测集版本化，防止过拟合到评测集。`,
depth:"追问：怎么保证评测集不被污染？离线好线上差怎么排查？Judge 本身要不要评估（要，用与人工的一致率）？",
pitfall:"只讲指标不讲流程，或者不提回滚。"},

{id:"d5", name:"给一个 70B 模型做部署方案选型",
why:"综合题，考你把前面各层串起来的能力。",
frame:`**先问**：延迟要求？并发量？上下文长度？预算和可用硬件？质量容忍度？

**算账**：70B BF16 权重 140 GB → 单卡 80G 放不下 → 至少 TP=2，考虑 KV Cache 后实际要 TP=4 或 8。量化到 FP8/INT4 后权重降到 70/35 GB，可能 TP=2 甚至单卡。

**方案对比**：① BF16 + TP4，质量最好成本最高 ② FP8（H100），几乎无损且真提速 ③ AWQ 4-bit + TP2，成本最低掉点 1-2% ④ 是否 PD 分离取决于流量里 prompt 长度分布。

**结论要给推荐**，并说明在什么条件下会改选另一个。`,
depth:"追问：TP 为什么不设成 8（通信开销递增、单卡利用率下降）？长上下文场景 KV Cache 怎么办？",
pitfall:"不算显存直接给方案。"},

{id:"d6", name:"排查：线上 TTFT P99 突然涨了 3 倍", must:true,
why:"故障排查题越来越常见，因为它最能区分真实经验 —— 而你有。",
frame:`**先分层缩小范围**：所有请求还是某一类？某个模型/租户/区域？什么时间点开始？有没有伴随变更（发版、配置、流量）？

**看指标链**：排队时长涨了 → 容量不足或扩缩失效；排队正常但 prefill 慢 → 是否混进超长 prompt（chunked prefill 失效）；GPU 利用率低但延迟高 → CPU 侧瓶颈或锁竞争；KV Cache 打满 → 请求被抢占重算。

**常见根因**：流量结构变化（某租户开始发长 prompt）、prefix cache 命中率骤降、某节点变慢拖累整体、模型热加载抢资源、依赖服务变慢。

**动作**：先止血（限流、隔离、扩容、回滚），再定位根因，最后补监控和预案。`,
depth:"追问：怎么快速判断是单节点还是全局问题（看 per-node 指标分布）？怎么防止再次发生？",
pitfall:"直接猜原因而不说排查路径。面试官要看的是方法论。"}
];

window.INFRA_MINE = {
title: "把 Bedrock / AGI 的经历挖成 AI Infra 故事",
body: `你的问题不是经历不够，是**没把经历翻译成 AI Infra 的语言**。同一件事，说法不同，可信度差很远：

- ✗「我在 Bedrock 做后端服务开发」
- ✓「我负责 Bedrock 上 XX 模型的推理服务，处理过 P99 延迟尖刺，定位到是长 prompt 的 prefill 阻塞了 decode 批次，通过调整调度把 P99 TPOT 降低了 X%」

下面每个问题，都去翻聊天记录、设计文档、oncall 记录、绩效材料找答案。**找到三个能讲十分钟的，就够撑起一轮面试。**`,
items:[
{q:"你 oncall 处理过的最棘手的一次线上问题是什么？",
 hint:"延迟尖刺、OOM、某租户打爆容量、模型加载失败、扩容不及时 —— 任何一个都是好故事。要素：现象、你怎么缩小范围、根因、止血动作、长期修复、之后加了什么监控。"},
{q:"你做过的任何一次性能优化，数字是多少？",
 hint:"哪怕只是把某接口 P99 从 800ms 降到 300ms。关键是说清瓶颈在哪、为什么是那里、你怎么验证的。"},
{q:"你参与设计过的限流、配额、隔离机制？",
 hint:"直接对应「多租户 LLM 服务」那道系统设计题。把权衡讲出来：为什么选这个方案、放弃了什么。"},
{q:"你见过的成本问题？",
 hint:"GPU 空转、缓存命中率低、某功能特别烧钱。哪怕不是你主导优化的，了解过原因就能讲。"},
{q:"你接触过的容量规划或扩缩容？",
 hint:"怎么估算需要多少卡、按什么指标扩缩、踩过什么坑。"},
{q:"AGI 这边，你碰过训练中断、loss 异常、checkpoint 恢复吗？",
 hint:"大规模训练的故障经验是稀缺品。即使你只是旁观者，把机制搞清楚也能讲。"},
{q:"你做过或见过的评估 / 发布流程？",
 hint:"模型怎么上线的、怎么验证没变差、有没有灰度和回滚。"},
{q:"有没有什么事是你当时做错了、后来改了的？",
 hint:"**最高价值的一类故事**，尤其 Amazon 出身讲 Dive Deep 和 Earn Trust 很自然。资深候选人敢讲失败，会显著加分。"}
]};
