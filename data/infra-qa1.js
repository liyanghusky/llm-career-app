/* Inference & ML Infra 主攻线 · 深度题库（一）
   面向 NVIDIA / Meta / Google / Microsoft / OpenAI / Anthropic 的 infra 岗。
   答案按「白板口头作答 + 接得住追问」的标准写，带真实数字。
*/
window.INFRA_QCATS = [
  { key:"gpu",   name:"GPU 与性能基础", icon:"▣", desc:"所有优化的第一性原理。答不上这层，后面全是背书" },
  { key:"kernel",name:"CUDA 与 kernel", icon:"⌗", desc:"NVIDIA 的核心筛子，其他家要求能读懂能判断" },
  { key:"engine",name:"推理引擎内部",   icon:"⚙", desc:"vLLM / TRT-LLM / SGLang 到底怎么工作的" },
  { key:"kv",    name:"内存与 KV Cache",icon:"▤", desc:"决定并发上限的那件事" },
  { key:"quant", name:"量化与压缩",     icon:"◱", desc:"降本第一手段，选型题高频" },
  { key:"dinf",  name:"分布式推理",     icon:"⇄", desc:"单卡放不下之后的世界" },
  { key:"dtrain",name:"分布式训练",     icon:"⇶", desc:"你在 AGI 最可能碰到的一层" },
  { key:"serve", name:"服务化与平台",   icon:"▥", desc:"你在 Bedrock 的主场，讲清楚就是优势" },
  { key:"cost",  name:"成本与容量",     icon:"¤", desc:"所有公司都关心，能排优先级就加分" },
  { key:"debug", name:"性能调试",       icon:"⌕", desc:"最能区分真做过和只读过的一类题" }
];

window.INFRA_QA = [

/* ══════════ GPU 与性能基础 ══════════ */
{id:"g1",cat:"gpu",level:1,tags:["Roofline"],q:"怎么判断一个算子是 compute-bound 还是 memory-bound？给出可操作的方法。",
a:`**一句话**：算算术强度（FLOP/Byte），和硬件的 ridge point 比。

**算术强度** = 这个算子做的浮点运算次数 ÷ 它必须搬动的字节数。
**Ridge point** = 硬件峰值算力 ÷ 峰值带宽。H100 SXM 大约 \`989 TFLOPS(BF16) / 3.35 TB/s ≈ 295 FLOP/Byte\`。

低于 ridge point → memory-bound，优化访存（融合、减少读写、提高数据复用）。
高于 → compute-bound，优化算力（用上 Tensor Core、提高 occupancy）。

**几个要能张口就说的数**：
- 逐元素加法 \`c=a+b\`：2 读 1 写，1 次加法 → **约 0.08 FLOP/Byte**，永远 memory-bound。
- GEMM \`n=4096\`：\`2n³ FLOP / 3n²×2 Byte\` → **约 683 FLOP/Byte**，compute-bound。
- **LLM decode，batch=1，FP16 权重**：每读 2 字节权重做 1 次乘加（2 FLOP）→ **1 FLOP/Byte**。比 ridge point 低 295 倍，算力几乎全在空转。

**实测方法**：Nsight Compute 看 \`sm__throughput\` 和 \`dram__throughput\` 两个百分比，谁接近 100% 谁是瓶颈；都不高就是 latency-bound（occupancy 不足或依赖链太长）。

> **必须补的一句**：同一个算子在不同卡上可能落在 ridge point 两侧。batch=32 的 decode 在消费级卡（无 Tensor Core，ridge ≈16）上已经 compute-bound，在 H100 上仍然 memory-bound。**「是不是访存瓶颈」永远要连着硬件一起说** —— 这是面试里最容易露怯的地方。`,
ask:"NVIDIA 必问。Meta/Google 会包装成「这个服务慢在哪，你怎么定位」。"},

{id:"g2",cat:"gpu",level:2,tags:["带宽"],q:"为什么 LLM 推理的 decode 阶段增大 batch 几乎白赚吞吐？收益什么时候消失？",
a:`因为 decode 是**访存瓶颈**：每生成一个 token，都要把**整个模型的权重**从 HBM 读一遍。batch=1 时读 14GB 权重只服务 1 个请求；batch=32 时读同样的 14GB 却服务 32 个请求 —— 权重读取被摊薄了 32 倍。

算术强度随 batch 线性增长：\`AI ≈ batch × (2 FLOP / 2 Byte) = batch\`（FP16 权重）。

**收益消失的两个拐点**：

1. **算术强度追上 ridge point**。H100 的 ridge ≈ 295，所以理论上 batch 到几百才转成 compute-bound。但实践中远早于此就受限，因为——
2. **KV Cache 吃满显存**。这才是真实的天花板。70B 模型 GQA(8组) 下每 token 的 KV 约 320KB，2000 token 上下文 → 每请求 640MB。80GB 卡装完权重（FP8 约 70GB）后只剩 10GB → **只能放 15 个并发**。你根本到不了 batch=295。

**所以真实的优化顺序是**：先想办法压 KV Cache（GQA/MLA、KV 量化、PagedAttention 消碎片），把并发做上去，batch 自然就大了。**"增大 batch" 不是一个可以直接拧的旋钮，它是 KV 容量的结果。**

追问「那为什么不无限加 batch」时，除了显存，还要提：batch 越大单请求的 TPOT 越差（排队 + 逐 iteration 调度），所以要按 SLO 设 \`max_num_seqs\` 上限。`,
ask:"「吞吐-延迟权衡」这条线上的必答题。"},

{id:"g3",cat:"gpu",level:2,tags:["互联"],q:"NVLink、PCIe、InfiniBand 的带宽层级是多少？由此推导 3D 并行的切分策略。",
a:`**带宽层级（H100 世代）**：
- HBM3：约 3.35 TB/s
- **NVLink 4.0**：单卡 900 GB/s 双向，经 NVSwitch 全互联（机内 8 卡）
- **InfiniBand NDR**：400 Gb/s ≈ 50 GB/s 单端口（跨机）
- PCIe 5.0 x16：约 64 GB/s 双向（CPU↔GPU）

记住这个不等式：**HBM ≫ NVLink ≫ IB ≈ PCIe**，NVLink 比 IB 高约 18 倍。

**推导切分策略** —— 按各并行方式的通信频率和通信量排：

| 并行 | 通信时机 | 通信量 | 该放哪 |
|---|---|---|---|
| **TP** | 每层前后向各一次 All-Reduce | 激活大小 × 层数（极频繁） | **机内 NVLink**，TP ≤ 8 |
| **EP** | 每个 MoE 层两次 All-to-All | 激活 × 层数 | 机内优先 |
| **PP** | 每个 stage 边界传激活 | 只有边界激活（最小） | **跨机 IB** |
| **DP** | 每 step 末一次 All-Reduce | 模型大小，但频率极低 | **最外层** |

所以标准布局是 \`TP(机内) × PP(机间) × DP(集群)\`。

**这不是约定俗成，是从带宽算出来的**。面试官追问「为什么 TP 不跨机」时，答案是：TP 每层都要同步，跨机会把通信开销放大近 20 倍，直接吃掉并行带来的收益。

加分：能提一句 TP=8 已经接近收益拐点 —— 再往上单卡计算量太小，通信占比反而上升。`,
ask:"训练方向必问，且一定追问「为什么这么排」。能从带宽推导 vs 背下来，区分度极大。"},

{id:"g4",cat:"gpu",level:2,tags:["精度"],q:"BF16 / FP16 / FP8 / INT4 各自的适用场景？FP8 训练的难点在哪？",
a:`**先分清两件事：动态范围（指数位）和精度（尾数位）。**

| 格式 | 指数 | 尾数 | 特点 |
|---|---|---|---|
| FP32 | 8 | 23 | 基准 |
| **BF16** | 8 | 7 | 范围同 FP32，**不需要 loss scaling**，训练默认 |
| FP16 | 5 | 10 | 范围窄（最小约 6e-5），小梯度下溢，**必须 loss scaling** |
| **FP8 E4M3** | 4 | 3 | 前向/权重，范围更窄 |
| FP8 E5M2 | 5 | 2 | 梯度（要更大范围） |
| INT4/NF4 | — | — | 只用于推理权重 |

核心认知一句话：**深度学习对动态范围敏感，对精度不敏感。** 这解释了 BF16 为什么赢。

**FP8 训练的难点是 scaling 粒度**。FP8 E4M3 的可表示范围只有约 ±448，而 Transformer 的激活有严重离群值，单个 per-tensor 的缩放因子根本罩不住 —— 要么离群值溢出，要么正常值全被压到 0 附近损失精度。

解法是细化粒度：per-channel → per-block（DeepSeek-V3 用 128×128 的块级 scaling）→ 配合 delayed scaling（用上一步的 amax 历史来定这一步的缩放）。另外累加必须在 FP32 里做，否则长序列 GEMM 的累加误差会炸。

**推理侧 FP8 是特例**：H100 有原生 FP8 Tensor Core，所以 FP8 不只省显存，**是真的提算力**（约 2 倍于 BF16）。而 INT4 权重量化在多数实现里计算时还要反量化回 FP16，**省的是显存和带宽，不是算力** —— 这个区别是高区分度的追问点。`,
ask:"「BF16 和 FP16 怎么选」是送分题，追问会到 FP8 的 scaling。"},

{id:"g5",cat:"gpu",level:1,tags:["显存"],q:"当场估算：70B 模型推理要几张 80G 卡？训练呢？",
a:`**推理（设参数量 N=70B）**：
- BF16 权重：\`2N\` = **140 GB** → 单卡 80G 放不下，至少 TP=2
- 但还要留 KV Cache 和激活。TP=2 时每卡 70GB 权重，只剩 ~8GB 给 KV → 并发太低
- **实际选 TP=4**：每卡 35GB 权重，剩 ~40GB 给 KV，能撑起有意义的并发
- FP8 量化后权重 70GB → TP=2 可行；INT4 约 35GB → 单卡勉强可行

**KV Cache 怎么算**（这一步必须会）：
\`2 × 层数 × KV头数 × 头维度 × 序列长 × batch × 精度字节\`
70B（80 层、GQA 8 组 × 128 维）FP16：\`2×80×8×128×2\` = **327 KB/token**
4k 上下文 × 32 并发 → \`327KB × 4096 × 32\` ≈ **43 GB**。这就是为什么 TP=4。

**训练（AdamW 混合精度）**：每参数 16 字节
- 参数 FP32 4 + 梯度 4 + 动量 m 4 + 二阶矩 v 4 = **16N = 1120 GB**
- 加激活（长序列时可能超过权重本身）
- 所以 70B 全参训练需要 **至少 16-32 张 80G 卡**，还得配 ZeRO/FSDP 切分 + 梯度检查点

**60 秒口算模板**：推理显存 ≈ 2N + KV；训练显存 ≈ 16N + 激活。记住这两个系数，任何模型都能当场算。`,
ask:"极高频。几乎每家 infra 岗都会让你现场估。"},

{id:"g6",cat:"gpu",level:3,tags:["架构"],q:"Hopper 相比 Ampere 的关键架构改进有哪些？对推理有什么影响？",
a:`**四个对 LLM 有实际影响的点**：

1. **FP8 Tensor Core**（E4M3/E5M2）—— 算力约为 BF16 的 2 倍，且有硬件转换单元。这是 H100 推理相比 A100 提升最大的单项。
2. **TMA（Tensor Memory Accelerator）** —— 异步的大块数据搬运引擎，由硬件负责 HBM↔SMEM 的地址计算和搬运，让 kernel 能把访存和计算真正重叠。FlashAttention-3 的主要提速来源之一。
3. **分布式共享内存（DSMEM）+ Thread Block Cluster** —— 同一个 cluster 内的多个 block 可以直接互访 shared memory，减少绕 HBM 的往返。
4. **更快的 NVLink（900 GB/s）与 NVSwitch** —— 让 TP=8 的机内通信成本进一步下降。

另外 HBM3 带宽 3.35 TB/s（A100 HBM2e 约 2 TB/s），以及 Transformer Engine 做动态 FP8 scaling。

**回答姿势**：不要背参数表，要说**每一项改变了什么优化决策**。比如「有了 FP8 Tensor Core，量化从『省显存』变成了『省显存又提算力』，所以 H100 上的最优部署方案和 A100 上不一样 —— A100 上 AWQ 4-bit 是主流，H100 上应该优先试 FP8」。

如果被问到 Blackwell：FP4 支持、双 die 设计、更大的 HBM3e 容量与带宽、以及第二代 Transformer Engine。但**别装懂细节**，说清趋势（精度继续下探、容量和互联继续加码）比报错参数好。`,
ask:"NVIDIA 会问。其他家问到 FP8 就够了。"},

{id:"g7",cat:"gpu",level:2,tags:["分片"],q:"MIG 和 MPS 有什么区别？什么场景用哪个？",
a:`两者都是把一张卡给多个任务用，但隔离级别完全不同。

**MPS（Multi-Process Service）**：多个进程的 kernel 共享同一个 GPU 上下文并发执行。
- 优点：切换开销小，能提高小 kernel 的 SM 利用率
- 缺点：**没有内存隔离和错误隔离** —— 一个进程 OOM 或崩溃可能拖垮其他进程；也没有 QoS 保证
- 适合：可信的同构小任务（比如同一个服务的多副本）

**MIG（Multi-Instance GPU，A100 起）**：在硬件层把一张卡切成最多 7 个实例，每个实例有**独立的 SM、L2 片区、显存通道**。
- 优点：真正的硬件隔离，性能可预测，故障不扩散
- 缺点：切分粒度固定（要按预设 profile），切换要重配；单实例算力上限被锁死
- 适合：**多租户推理小模型**、研究/调试任务与生产任务共卡、需要 SLO 保证的场景

**实践判断**：
- 生产多租户 → MIG（隔离是刚需）
- 训练集群里给调试任务腾资源 → MIG 切一小块
- 单一服务想提利用率 → 不用这两个，直接用引擎自身的 continuous batching，效果更好

**关键认知**：对 LLM 推理来说，MIG 往往不是最优解 —— 因为大模型本来就需要整卡甚至多卡，切小了装不下。MIG 主要适合小模型（embedding、reranker、分类器）的多租户托管。这句话能显示你想过它的适用边界。`,
ask:"平台岗会问，尤其是做多租户的。"},

{id:"g8",cat:"gpu",level:3,tags:["带宽"],q:"你怎么实测一张卡的有效显存带宽和有效算力？为什么实测值达不到标称值？",
a:`**实测方法**：
- **带宽**：跑一个纯访存的大规模逐元素操作，比如 \`c = a + b\`（2 读 1 写）。\`带宽 = 3 × N × 元素字节 / 耗时\`。数组要足够大（远超 L2，比如 \`1<<24\` 个 float），并预热多轮、用 \`cudaDeviceSynchronize\` 或 \`torch.cuda.synchronize()\` 正确计时。
- **算力**：跑大方阵 GEMM（n=4096 或 8192），\`TFLOPS = 2n³ / 耗时\`。分别测 FP32 / TF32 / BF16 / FP16 / FP8。

**实测通常只有标称的 70-90%，原因**：
- 带宽侧：DRAM 刷新、行激活开销、访存不完全合并、ECC 开销。**85% 左右算正常上限。**
- 算力侧：GEMM 的 tile 边界效应、L2 命中率、功耗/温度墙降频、以及 kernel launch 开销。大矩阵能到 90%+，小矩阵可能只有 30%。

**一个能体现你真测过的观察**：如果 FP16 的实测 TFLOPS **低于** FP32，说明这张卡没有 Tensor Core（比如 GTX 16 系列砍掉了），半精度只能走普通 CUDA core 还多了转换开销。同理 TF32 与 FP32 完全相同说明不是 Ampere 及以上。

**为什么面试官在意这个**：因为优化工作的第一步永远是建立 baseline 和理论上限。不知道这张卡能跑多少，就不知道 40% 利用率是该优化还是已经到顶。`,
ask:"NVIDIA 和各家性能团队会问。能报出「85% 是正常上限」这种经验值很加分。"},

/* ══════════ CUDA 与 kernel ══════════ */
{id:"k1",cat:"kernel",level:2,tags:["CUDA"],q:"什么是访存合并（coalesced access）？为什么它是最常见的性能杀手？",
a:`GPU 的一个 warp 是 32 个线程**同时**执行同一条指令。当这 32 个线程访问显存时：

- **合并**：它们访问的地址落在同一个（或少数几个）对齐的 128 字节缓存行内 → 硬件把它们合成 **1 次**内存事务
- **不合并**：地址分散 → 退化成最多 **32 次**独立事务

差距可以到 **32 倍**。这就是为什么它是杀手。

**典型踩坑**：二维数组按列访问。
\`\`\`
// 行优先存储，thread i 访问 A[i][col] —— 地址间隔 = 行长，完全不合并
float v = A[tid * N + col];        // ✗
// 改成 thread i 访问 A[row][i] —— 地址连续，完美合并
float v = A[row * N + tid];        // ✓
\`\`\`

**解法**：
1. 调整数据布局（AoS → SoA）
2. 先合并地读进 shared memory，再在 SMEM 里做不规则访问（SMEM 没有合并要求，但要避 bank conflict）
3. 转置类操作用 SMEM 做分块转置

**顺带说 bank conflict**：SMEM 分 32 个 bank，同一 warp 内多个线程访问**同一 bank 的不同地址**会串行化。经典解法是 padding（把行宽从 32 改成 33）让访问错开 bank。

面试里能把「HBM 要合并、SMEM 要避 bank conflict」这两件事分清，就说明你真写过 kernel。`,
ask:"NVIDIA 深挖。可能让你现场指出一段 kernel 的访存问题。"},

{id:"k2",cat:"kernel",level:2,tags:["融合"],q:"算子融合的收益怎么估？CUDA Graph 又解决什么问题？两者是一回事吗？",
a:`**不是一回事，解决的是两个不同层面的开销。**

**算子融合解决 HBM 往返。** 每个 kernel 都要：读 HBM → 算 → 写回 HBM。逐元素算子（bias、激活、残差、LayerNorm）算得极少但访存很多，单独跑纯属浪费带宽。

收益估算：把 k 个逐元素 kernel 融成 1 个，HBM 流量从 \`2k\` 次（每个读一次写一次）降到约 2 次 → **理论加速接近 k 倍**（因为这些算子是纯 memory-bound）。实测把 \`Linear→Bias→GELU\` 融合通常省 20-40% 的该段耗时。

**CUDA Graph 解决 CPU 侧的 launch 开销。** 每次 \`cudaLaunchKernel\` 有几微秒的 CPU 开销。decode 一步要跑几百个 kernel，每个 kernel 本身可能只要几十微秒 —— 小 batch 时 **CPU launch 开销能占到总时间的 30% 以上**，GPU 在等 CPU 喂活。

CUDA Graph 把整个 decode step 的 kernel 序列**录制成一张图**，之后一次提交、由 GPU 驱动按图执行，CPU 只需一次调用。

**判断用哪个**：
- Nsight Systems 里看到 GPU 有大量空隙、CPU 侧 launch 密集 → **CUDA Graph**
- 看到很多短小的 memory-bound kernel 连续排列 → **融合**
- 两者叠加用，vLLM 就同时做了这两件事（\`enforce_eager=False\` 开的就是 CUDA Graph）

**Graph 的限制**（能说出来加分）：图是静态的，形状必须固定。所以实现上要为不同 batch size 预先捕获多张图（vLLM 会捕获一组离散的 batch size 再向上取整 padding）。动态形状变化频繁的场景用不了。`,
ask:"「你会怎么优化这个推理服务」的标准展开方向。"},

{id:"k3",cat:"kernel",level:3,tags:["FlashAttention"],q:"FlashAttention 为什么快？online softmax 怎么保证数值稳定和正确性？",
a:`**标准注意力的问题**：要物化 \`N×N\` 的分数矩阵。显存 \`O(N²)\`，而且要把这个大矩阵**写回 HBM 再读回来**做 softmax，再读一次乘 V —— 全是带宽浪费。

**FlashAttention 的核心是 tiling + online softmax**：把 Q/K/V 切成能装进 SMEM 的块，在片上算完一块的部分注意力，用在线更新的方式累积结果，**永远不物化完整的 N×N 矩阵**。

代价是反向传播时要重算注意力（不存中间矩阵）。但因为整体是**访存瓶颈**，重算的算力开销远小于省下的访存时间 —— 这是「**用算力换访存**」的典范，和梯度检查点「用算力换显存」是同一类思想。

**online softmax 的机制**（要能在白板上写）：
标准 softmax 需要先看到全部元素求最大值和分母。在线版本维护两个运行量：\`m\`（当前最大值）和 \`l\`（当前分母）。来了新块后：
\`\`\`
m_new = max(m_old, max(新块))
l_new = l_old × exp(m_old − m_new) + Σ exp(新块 − m_new)
O_new = O_old × (l_old × exp(m_old − m_new) / l_new) + 新块贡献 / l_new
\`\`\`
关键是那个 **\`exp(m_old − m_new)\` 的修正因子** —— 每次最大值更新时，把之前累积的结果按新基准重新缩放。减去最大值保证指数不溢出（数值稳定），修正因子保证结果与一次性计算**完全相等**（不是近似）。

**版本差异**：FA2 改进了并行切分和 work partitioning（把 warp 的分工重排，减少 SMEM 读写）；FA3 利用 Hopper 的 TMA 做异步搬运、支持 FP8。

**高频追问**：FA 和 PagedAttention 什么关系？答：**正交，可叠加**。FA 优化的是单次注意力计算的访存；PagedAttention 优化的是 KV Cache 的显存分配。vLLM 里两者同时在用。`,
ask:"LLM infra 岗几乎必问。"},

{id:"k4",cat:"kernel",level:2,tags:["Triton"],q:"Triton 是什么？相比手写 CUDA 的取舍是什么？",
a:`Triton 是一个用 **Python 语法写 GPU kernel** 的 DSL + 编译器。你以「块（block）」为单位思考，编译器自动处理 SMEM 分配、访存合并、向量化、以及 warp 级的调度。

\`\`\`python
@triton.jit
def add_kernel(x_ptr, y_ptr, out_ptr, n, BLOCK: tl.constexpr):
    pid = tl.program_id(0)
    offs = pid * BLOCK + tl.arange(0, BLOCK)
    mask = offs < n
    x = tl.load(x_ptr + offs, mask=mask)
    y = tl.load(y_ptr + offs, mask=mask)
    tl.store(out_ptr + offs, x + y, mask=mask)
\`\`\`

**取舍**：
- 性能通常能到手写 CUDA 的 **80-95%**，开发效率高一个量级
- 你放弃的是对 warp 级原语（shuffle、mma 指令）的精细控制，极致优化的 GEMM 还是得手写或用 cuBLAS/CUTLASS
- 自动调优（\`triton.autotune\`）能帮你搜 BLOCK_SIZE、num_warps、num_stages

**生态位**：PyTorch 的 \`torch.compile\` 后端 Inductor **生成的就是 Triton 代码**；vLLM、Unsloth、liger-kernel 里有大量 Triton kernel。所以看懂 Triton 等于能看懂 torch.compile 的产物，这在调试性能问题时很实用。

**对转型的意义**：这是系统工程师进入 kernel 层**最现实的入口** —— 不用啃几个月 CUDA 就能产出真实的优化成果写进简历。

**一个实操坑**：Triton 官方不支持 Windows，要在 WSL2 或 Linux 上做。`,
ask:"简历上有 Triton 经验会显著提升 kernel 方向的可信度。"},

{id:"k5",cat:"kernel",level:3,tags:["GEMM"],q:"GEMM 在 GPU 上是怎么优化的？为什么 decode 阶段的 GEMM 效率特别低？",
a:`**GEMM 优化的层级结构**（从大到小的 tiling）：
1. **Block tile**：把输出矩阵切块，每个 thread block 负责一块，把对应的 A/B 子块加载进 SMEM
2. **Warp tile**：block 内再按 warp 切分
3. **Thread tile / 寄存器分块**：每个线程在寄存器里累积一小块结果，最大化数据复用
4. **Tensor Core（mma 指令）**：用 \`wmma\`/\`mma.sync\` 做 16×16×16 这类固定形状的矩阵乘累加
5. **软件流水（multi-stage）**：用异步拷贝（Ampere 的 \`cp.async\`、Hopper 的 TMA）把下一块的加载与当前块的计算重叠，掩盖访存延迟

核心思想一句话：**让每个从 HBM 读进来的数据被复用尽可能多次**，把算术强度拉高到 compute-bound 区间。

**为什么 decode 的 GEMM 效率低**：
decode 时是 \`(batch, 1, hidden) × (hidden, out)\` —— **M 维只有 batch 那么大（甚至=1）**。这是极度「瘦」的矩阵乘，实际退化成 **GEMV（矩阵向量乘）**。

后果：
- 没有 M 维可供 tiling，数据复用度极低 → 算术强度 ≈ 1，彻底 memory-bound
- Tensor Core 要求最小 16×16 的形状，M=1 时大部分计算单元空转
- 只能靠**提高 batch** 把 M 撑起来，或者用专门的 GEMV kernel（跳过 Tensor Core，用普通 core 但优化访存）

**这解释了三件事**：为什么 decode 慢、为什么 continuous batching 收益巨大、为什么投机解码有效（一次验证 k 个 token 把 M 从 1 变成 k，几乎不增加耗时）。

**面试价值**：能把「decode 慢」从现象追到「GEMM 退化成 GEMV」这个层面，是很强的信号。`,
ask:"NVIDIA 和推理团队会深挖。"},

{id:"k6",cat:"kernel",level:2,tags:["profiling"],q:"拿到一个慢 kernel，你用 Nsight Compute 看哪几个指标？按什么顺序判断？",
a:`**按这个顺序，每一步都排除一类可能**：

**① 先看两个 throughput**
- \`sm__throughput.avg.pct_of_peak_sustained_elapsed\`（算力利用率）
- \`gpu__dram_throughput.avg.pct_of_peak_sustained_elapsed\`（带宽利用率）

谁接近 100% 谁是瓶颈。**两个都低 → latency-bound**，进第 ②。

**② latency-bound 的排查**
- \`sm__warps_active.avg.pct_of_peak_sustained_active\`（achieved occupancy）：太低说明没有足够的 warp 来掩盖访存延迟。看是被寄存器数还是 SMEM 用量限制的（\`launch__registers_per_thread\`、\`launch__shared_mem_per_block\`）
- \`stall reasons\`（\`smsp__pcsamp_warps_issue_stalled_*\`）：卡在 \`long_scoreboard\` = 等全局内存；\`barrier\` = 同步太多；\`mio_throttle\` = SMEM/L1 压力大

**③ memory-bound 的排查**
- \`l1tex__t_sectors_pipe_lsu_mem_global_op_ld.sum\` 与请求数的比值 → 判断**访存是否合并**（理想是每个请求 4 个 sector；如果是 32 就完全不合并）
- \`l2 hit rate\`：低说明数据复用差，考虑 tiling
- \`shared memory bank conflict\` 计数

**④ compute-bound 的排查**
- Tensor Core 利用率（\`sm__pipe_tensor_op_hmma_cycles_active\`）：如果是 0，说明该用 TC 却没用上（dtype 不对或形状不满足）
- 指令混合：是不是有大量低吞吐指令（如 \`__expf\`、整数除法）

**要说出的方法论**：先定性（哪一类瓶颈），再定量（具体哪个指标超标），最后才改代码。**新手的典型错误是直接凭感觉改 BLOCK_SIZE 碰运气。**

补一句工具分工：**Nsight Systems** 看时间线和 CPU-GPU 协同（找空隙、找 launch 开销、找同步点）；**Nsight Compute** 深挖单个 kernel。先用前者定位哪个 kernel 值得看，再用后者钻进去。`,
ask:"NVIDIA 必问。其他家问「你怎么 profile」时能报出指标名会很突出。"},

/* ══════════ 推理引擎内部 ══════════ */
{id:"e1",cat:"engine",level:1,tags:["调度"],q:"Prefill 和 Decode 的特性差异是什么？为什么混在一起调度会有问题，怎么解决？",
a:`**Prefill**：并行处理整个 prompt，大矩阵乘，**compute-bound**，GPU 利用率高。决定 **TTFT**。
**Decode**：逐 token 生成，每步只算 1 个 token 却要读全部权重和 KV，**memory-bound**，算力利用率常低于 5%。决定 **TPOT**。

**混在一起的问题**：一个 batch 里如果混进一个长 prompt 的 prefill（比如 8k token），这一次 iteration 会被它拖到几百毫秒，而同批所有正在 decode 的请求都要等 —— 造成 **TPOT 尖刺**。用户体感是「打字突然卡一下」。

**两条解法**：

**① Chunked Prefill**：把长 prefill 切成固定 token 预算的小块（比如每次最多 512 token），和 decode 请求混在同一个 iteration 里，用 token 预算控制每次 iteration 的总工作量。
- 优点：实现简单，单集群内就能做，TPOT 平滑
- 代价：prefill 被拉长，TTFT 略升；需要调 \`max_num_batched_tokens\`

**② PD 分离（Prefill-Decode Disaggregation）**：prefill 和 decode 跑在**不同的 GPU 池**，各自独立扩缩。prefill 完成后把 KV Cache 通过高速网络传给 decode 池。
- 优点：两边都能按自己的特性优化（prefill 池可以用更少但更强的卡、decode 池优化显存容量），互不干扰，SLO 可分别保证
- 代价：**增加了 KV 传输开销**（一个 8k 上下文的 70B 模型 KV 可能几 GB，需要 RDMA/NVLink 级的互联才划算）、系统复杂度上升、要处理传输失败
- 代表：DeepSeek 的部署、Mooncake、DistServe

**什么时候不值得分离**：请求的 prompt 长度分布很集中且都很短（prefill 本来就快）、或者集群规模小（分池导致两边都利用率不足）、或者网络不够快（传 KV 的时间超过重算）。

**这道题是当前最高频的推理面试题**，一定会追问 KV 传输怎么处理。`,
ask:"最高频。必追问 PD 分离的 KV 传输开销和适用边界。"},

{id:"e2",cat:"engine",level:2,tags:["调度"],q:"Continuous batching 的调度器大致怎么实现？每个 iteration 要做哪些决策？",
a:`**和静态批处理的区别**：静态批要等最长的那个请求生成完才整批返回，短请求的槽位空转。Continuous batching 以 **iteration（一步 decode）** 为调度单位，任何请求一出 EOS 就立刻踢出、马上换新请求进来。

**每个 iteration 的决策流程**：

1. **回收**：把上一步完成的请求（出 EOS 或达到 max_tokens）移出 running 集合，释放它们的 KV block
2. **准入（admission）**：从 waiting 队列里挑请求加入 running。约束有三个：
   - \`max_num_seqs\`：并发请求数上限
   - \`max_num_batched_tokens\`：本次 iteration 的 token 预算（prefill 的 token 数 + decode 的 1×batch）
   - **KV 显存是否够**：能否为新请求分配到足够的 block（还要为它未来的增长预留，或采用按需分配 + 抢占）
3. **抢占（preemption）**：如果显存不足且有高优先级请求，挑一个受害者踢出。两种处理方式：
   - **Swap**：把它的 KV 换出到 CPU 内存，之后换回来（省算力，但占 PCIe 带宽）
   - **Recompute**：直接丢弃 KV，之后重新 prefill（省带宽，但重算）
   - 短 prompt 用 recompute 更划算，长 prompt 用 swap
4. **组 batch 并执行**：把 prefill（可能是 chunked）和 decode 的请求拼成一次前向
5. **采样与更新**：对每个序列采样下一个 token，更新它的 KV block 表和长度

**调度策略的权衡**：
- **FCFS** 最简单但长请求会饿死短请求
- 按剩余长度或优先级排序能改善 P99，但需要预测输出长度（不准）
- 生产上常见做法是分级队列：交互式 vs 批处理走不同池子，各有 token 预算

**高区分度的追问**：「怎么决定 swap 还是 recompute」「max_num_batched_tokens 设多大」—— 答案都是「看 prompt 长度分布和 SLO 侧重」，并且要说自己会怎么实测。`,
ask:"vLLM/SGLang 相关必问。能讲抢占策略是加分点。"},

{id:"e3",cat:"engine",level:2,tags:["PagedAttention"],q:"PagedAttention 解决什么问题？block size 怎么选？",
a:`**解决的是 KV Cache 的显存碎片。**

传统实现要为每个请求**预分配 max_len 的连续显存**。问题：
- **内部碎片**：请求实际只生成 100 token，却占了 2048 的空间
- **外部碎片**：不同长度的请求进出，留下用不上的空隙
- 实测浪费达 **60-80%**

PagedAttention 借鉴操作系统的虚拟内存：把 KV Cache 切成**固定大小的 block**（默认 16 token），用**块表（block table）**把逻辑位置映射到物理块，**按需分配、物理上不必连续**。注意力 kernel 改造成能按块表 gather。

**收益**：显存利用率接近 100%（唯一浪费是最后一个块的零头，平均半个 block）→ 同样显存能放 **2-4 倍**的并发 → 吞吐提升数倍。

**额外收益：前缀共享**。多个请求共用同一 system prompt 时，物理块**只存一份**，用引用计数 + copy-on-write。这就是 prefix caching 的实现基础，也让并行采样（一个 prompt 出 n 个候选）几乎免费。

**block size 怎么选**：
- **太小**（如 1-4）：块表变长，kernel 里的 gather 间接寻址开销上升，访存合并变差
- **太大**（如 128）：最后一块的浪费变大（平均浪费 block_size/2 个 token 的空间），前缀共享的粒度也变粗
- **16 是经验甜点**，兼顾访存效率和碎片
- 如果场景是长上下文 + 高共享（比如固定长 system prompt），可以试大一点的块让共享更高效

**追问准备**：「PagedAttention 有没有代价」→ 有：kernel 复杂度上升、间接寻址带来约 5-10% 的注意力计算开销，但换来的并发提升远大于此。`,
ask:"必问。追问 block size 和抢占。"},

{id:"e4",cat:"engine",level:3,tags:["缓存"],q:"Prefix caching 怎么实现？RadixAttention 相比简单的前缀哈希好在哪？",
a:`**简单实现（vLLM 早期）**：把 prompt 按 block 切分，对每个 block 的**内容 + 它之前所有内容**做哈希，用哈希表查是否已有对应的物理块。命中就直接引用，不重算。

**局限**：只能匹配**完整的 block 前缀**，而且哈希表是平的 —— 多个请求共享部分前缀时，查找和淘汰都不高效，也不好做「最长公共前缀」的匹配。

**RadixAttention（SGLang）**：用一棵 **radix tree（压缩前缀树）** 组织所有缓存的 KV。
- 树的每条边是一段 token 序列，节点持有对应的 KV block 引用
- 新请求来了，沿树走最长公共前缀 → 自动得到**最大可复用的部分**，不受 block 对齐限制
- 淘汰用 **LRU + 引用计数**，可以按子树整体淘汰，且不会淘汰正在使用的节点

**优势场景**：
- **多轮对话**：每一轮都完整复用前面所有轮次，第 n 轮只需 prefill 新增部分
- **few-shot 模板**：大量请求共享同一组示例
- **树状搜索**（如 self-consistency、beam-like 采样）：天然的分支共享
- **Agent 循环**：system prompt + 工具定义 + 历史，前缀极长且高度重复

**收益量级**：固定长 system prompt 的场景，TTFT 能降 50-90%，输入侧算力成本近乎归零。这是**性价比最高、且零质量损失**的优化，任何降本讨论都该从它开始。

**要能说的工程细节**：
- 缓存是有状态的，多副本部署时要考虑**亲和性路由**（把同一会话的请求路由到同一实例），否则缓存命中率会被打散
- 缓存占显存，要和 KV Cache 的容量做权衡（\`gpu_memory_utilization\` 里怎么分配）
- **安全**：跨租户共享前缀有信息泄漏风险（能通过命中时延推测别人的 prompt），多租户场景要按租户隔离缓存命名空间 —— 这一点面试官问到会很欣赏`,
ask:"进阶题。能提到多租户缓存的安全问题会很突出。"},

{id:"e5",cat:"engine",level:2,tags:["投机解码"],q:"投机解码的收益模型是什么？什么情况下反而变慢？",
a:`**机制**：草稿模型一次预测 k 个 token，大模型**一次前向并行验证**这 k 个，接受匹配的前缀，从第一个不匹配处重采样。

**为什么快**：decode 是访存瓶颈，大模型验证 k 个 token 和验证 1 个耗时几乎一样（都要完整读一遍权重，只是 GEMM 的 M 维从 1 变成 k，仍远未 compute-bound）。**多验证的那几个是白赚的。**

**质量严格无损** —— 通过设计好的拒绝采样，最终输出分布与直接采样**数学上完全一致**，可证明。这是核心卖点。

**收益模型**：设草稿长度 k、单 token 接受率 α，则一次验证的期望接受数约为
\`E = (1 − α^(k+1)) / (1 − α)\`
加速比 ≈ \`E / (1 + k × c)\`，其中 c 是草稿模型相对大模型的单步成本比。

所以三个变量：**接受率 α 越高越好、草稿越便宜越好、k 要适中**（k 太大时后面的 token 几乎必被拒，白算）。实测典型 1.5-3 倍。

**什么情况下反而变慢**（这是高区分度的部分）：

1. **高并发时**。batch 大的时候 GPU 已经不闲了，验证 k 个 token 的额外算力不再免费，投机解码等于**和正常请求抢算力**，吞吐反而下降。所以生产上常按负载动态开关。
2. **接受率低**。草稿模型和目标模型分布差太远（比如领域不匹配、或草稿模型太小），α 低于约 0.6 时收益就很薄了。
3. **草稿模型太贵**。用 7B 给 13B 做草稿基本不划算。

**变体的演进逻辑**：
- **Medusa**：在原模型上加多个预测头，省掉独立草稿模型的显存和调度复杂度
- **EAGLE**：在特征层（而非 token 层）做草稿，接受率显著更高
- **Lookahead / n-gram**：完全不用草稿模型，用上下文里的 n-gram 猜，对重复性强的文本（代码、长文档摘要）特别有效，成本接近零

**面试要点**：主动说出「高并发收益衰减」这一条，能立刻区分「读过论文」和「真跑过压测」。`,
ask:"高频。必追问为什么无损、什么时候不该用。"},

{id:"e6",cat:"engine",level:3,tags:["LoRA"],q:"怎么在一个服务里同时提供几十个 LoRA 适配器？",
a:`**朴素做法的问题**：每个 adapter 合并进基座各存一份 → 显存爆炸（几十个 7B 副本）；或者每次切换都重新合并 → 延迟不可接受。

**正确做法：共享基座 + 批内多 adapter**。
基座权重只存一份，每个 adapter 只存它的低秩矩阵 \`B(d×r)\` 和 \`A(r×k)\` —— r=16 时一个 adapter 只有几十 MB。

关键难点是**一个 batch 里的请求用不同的 adapter**，不能简单地做一次 GEMM。解法：
- **分组 GEMM（grouped/segmented GEMM）**：按 adapter 把 batch 内的请求分段，对每段用对应的 \`BA\` 做小 GEMM。代表实现是 **Punica** 的 SGMV（Segmented Gather Matrix-Vector）kernel。
- **S-LoRA** 在此之上做了 adapter 的**分页显存管理**（类似 PagedAttention 但管 adapter 权重）、以及 adapter 的换入换出与预取，支持上千个 adapter。

**工程要点**：
- adapter 要能**热加载/卸载**，用 LRU 管理常驻集合，冷的放 CPU 内存或对象存储
- 路由层要知道每个请求要哪个 adapter，并尽量把同 adapter 的请求**攒到一起**（提高分组 GEMM 效率），但不能攒太久（伤延迟）
- rank 不一致的 adapter 混批会更复杂，实践中常统一 rank 或按 rank 分组

**收益**：单卡服务几十上百个垂直场景的微调模型，成本接近服务一个模型。这对平台型产品（比如 Bedrock 上的 custom model）是刚需能力。

**面试价值**：这题直接对应「一个模型冷门但必须常驻怎么降成本」那个追问 —— 答案就是多 adapter 共享基座。你在 Bedrock 如果碰过 custom model 的托管，这是极好的故事。`,
ask:"平台型岗位的进阶题。和「多租户降本」那道设计题强相关。"},

{id:"e7",cat:"engine",level:2,tags:["结构化输出"],q:"怎么保证模型输出严格符合 JSON Schema？约束解码是怎么实现的？",
a:`**三个层次，成本和可靠性递增**：

**① Prompt + 重试**：最简单，让模型输出 JSON，用 pydantic 校验，失败重试。成本高（重试浪费）、不保证。

**② 约束解码（constrained decoding）**：在**采样阶段**屏蔽所有会导致非法输出的 token。实现方式：
- 把 JSON Schema 或正则编译成**有限状态机（FSM）**
- 每一步根据当前状态算出「合法的下一个 token 集合」，把其余 token 的 logits 设成 \`-inf\`
- 这样**每一步生成都不可能越界**，输出必然合法

代表实现：**Outlines**（把正则/schema 编译成 FSM，预计算状态→允许token 的映射表）、**XGrammar**（用下推自动机处理递归语法，支持上下文无关文法，性能优化到接近零开销）、llama.cpp 的 GBNF。

**关键工程问题**：
- **预计算开销**：token 级的 FSM 转移表可能很大（词表 15 万 × 状态数），要做压缩和缓存。同一个 schema 复用时几乎零成本，schema 频繁变化则要注意编译开销。
- **tokenization 边界**：一个合法字符串可能被切成多种 token 组合，FSM 必须在 token 层而不是字符层工作，这是实现难点。
- **性能**：做得好的实现（XGrammar）额外开销可以压到 1% 以下；做得差的会明显拖慢。

**③ 模型侧保证**：用支持原生 tool use / structured output 的模型，服务端已经内置了约束解码。

**要补的一句认知**：约束解码保证的是**语法合法**，不保证**语义正确** —— 模型仍然可以填出格式正确但内容错误的值。所以业务校验（比如金额合计对不对）还是要做。这句话能显示你不是把它当银弹。`,
ask:"做 Agent / 结构化抽取的岗位会问。"},

{id:"e8",cat:"engine",level:2,tags:["引擎选型"],q:"vLLM、TensorRT-LLM、SGLang 怎么选？各自的优劣。",
a:`**vLLM** —— 社区最活跃，上手最快
- 优势：PagedAttention 原创、模型支持最广最新、OpenAI 兼容 API 开箱可用、迭代极快
- 劣势：极致性能不如 TRT-LLM（尤其小 batch 低延迟场景）、Python 调度有一定开销
- 适合：绝大多数场景的默认选择，尤其模型换得勤

**TensorRT-LLM** —— NVIDIA 官方，性能天花板
- 优势：深度利用硬件（FP8、自定义 kernel、CUDA Graph、in-flight batching），**同硬件上通常延迟最低、吞吐最高**；和 Triton Inference Server 集成好
- 劣势：需要**预编译 engine**（改模型、改并行度、改精度都要重新编译，几分钟到几十分钟）、新模型支持慢、调试门槛高、只支持 NVIDIA
- 适合：模型固定、规模大、对延迟和成本极度敏感的生产环境

**SGLang** —— 结构化与复用见长
- 优势：**RadixAttention** 的前缀复用做得最好（多轮对话、Agent、树状搜索场景优势明显）、内置结构化输出（XGrammar）、前端 DSL 方便写复杂的多步生成流程
- 劣势：生态比 vLLM 小
- 适合：Agent、多轮对话、需要大量前缀复用或结构化输出的场景

**怎么答这道题**：不要评优劣，要给**决策树**：
1. 模型经常换、要快速上线 → vLLM
2. 模型固定、要榨干每一分成本、有工程资源做编译流水线 → TRT-LLM
3. 主要负载是多轮对话/Agent/高前缀复用 → SGLang
4. 端侧或无 GPU → llama.cpp

然后加一句：**「我会用自己的真实流量做 A/B 压测再定」**，并说明你会测什么（不同并发下的 TTFT/TPOT/吞吐曲线、显存占用、以及切换的工程成本）。这比背结论强得多。`,
ask:"选型题高频。给决策树 + 说要实测，比报结论好。"},

/* ══════════ 内存与 KV Cache ══════════ */
{id:"v1",cat:"kv",level:1,tags:["KV"],q:"精确写出 KV Cache 的显存公式，并解释 GQA 和 MLA 各自怎么压缩它。",
a:`**公式**：
\`\`\`
KV 显存 = 2 × L × H_kv × D_head × S × B × bytes
\`\`\`
2 是 K 和 V 各一份，L 层数，H_kv 是 **KV 头数**（注意不是 Q 头数），D_head 每头维度，S 序列长，B batch，bytes 精度字节数。

**算例（LLaMA-2 7B，MHA，32 层 32 头 128 维，FP16）**：
\`2 × 32 × 32 × 128 × 2\` = **512 KB / token**
4096 上下文 → 2 GB / 请求。一张 80G 卡装完 14GB 权重，剩 66GB 只能放 **33 个并发**。

**GQA（Grouped Query Attention）**：多个 Q 头共享一组 KV。32 头分 8 组 → \`H_kv\` 从 32 降到 8，**KV 直接省 4 倍**（512KB → 128KB/token）。质量几乎无损，是 LLaMA-2 70B 之后的标配。
- 极端情况 MQA（\`H_kv=1\`）省 32 倍，但质量掉点明显、训练不稳

**MLA（Multi-head Latent Attention，DeepSeek）**：不是减少头数，而是**把 KV 投影到一个低维潜向量**存储，用的时候再升维还原。
- 缓存的是潜向量（比如 512 维）而不是 \`H_kv × D_head\`（8×128=1024 维）
- 实际压缩比 GQA 更狠，而且论文报告效果**反超 MHA**（低秩投影起到了正则作用）
- 代价是多了升降维的计算，且实现更复杂（要和 RoPE 配合做特殊处理）

**第三条路：KV 量化**。把 KV 从 FP16 降到 FP8 或 INT8，直接省 2 倍，可以和 GQA/MLA 叠加。长上下文高并发场景性价比很高但讨论较少。

**面试模板**：被问「怎么提高并发」，答案永远是先算 KV 公式，指出它是瓶颈，然后从「减少 H_kv / 降低精度 / 消除碎片（PagedAttention）/ 复用前缀（prefix caching）」四个方向给方案。`,
ask:"必问。要能当场算数。"},

{id:"v2",cat:"kv",level:2,tags:["KV"],q:"KV Cache 量化到 FP8 或 INT8 有什么坑？怎么评估掉点？",
a:`**为什么值得做**：长上下文高并发时 KV Cache 往往**比权重还大**。128k 上下文的 70B 模型，单请求 KV 就可能几十 GB。量化 KV 到 8-bit 直接翻倍并发，是很直接的收益。

**坑一：K 和 V 的分布不一样。**
研究（KIVI 等）发现 **K 有明显的 per-channel 离群值**（某些通道数值特别大），而 V 的分布相对均匀。所以：
- **K 适合 per-channel 量化**（每个通道一个 scale）
- **V 适合 per-token 量化**（每个 token 一个 scale）
用统一的 per-tensor 量化会因为 K 的离群值把有效位数全浪费掉，掉点明显。

**坑二：RoPE 的位置。**
如果在量化后才施加 RoPE，旋转会把量化误差放大且分布变形。通常要在 RoPE 之后再量化（缓存旋转后的 K）。

**坑三：kernel 支持。**
注意力 kernel 要能直接读量化后的 KV 并在计算时反量化，否则反量化的开销吃掉收益。这需要引擎原生支持（vLLM 的 \`kv_cache_dtype="fp8"\`），不是改个配置那么简单。

**坑四：误差随序列长度累积。**
早期 token 的 KV 被反复参与后续每一步的注意力计算，量化误差在长序列上有累积效应。常见缓解是**保留最近 N 个 token 和最开始几个 token 为全精度**（StreamingLLM 观察到开头的 attention sink token 极其重要），中间的量化。

**怎么评估掉点** —— 不要只看 PPL：
- PPL 对 KV 量化不敏感，可能几乎不变但下游任务崩
- 要测**长上下文召回**（needle-in-a-haystack）—— KV 量化最容易伤这个
- 测**多轮对话一致性**和长生成的后半段质量
- 测目标任务的真实指标
- FP8 在 H100 上有硬件支持，通常比 INT8 更稳（有指数位，动态范围好）

**面试价值**：能说出 K/V 分布不同这一条，说明你真读过相关工作。`,
ask:"长上下文场景的进阶题。"},

{id:"v3",cat:"kv",level:3,tags:["KV"],q:"长上下文的 KV 压缩有哪些思路？各自的取舍。",
a:`四类思路，从保守到激进：

**① 精度压缩（KV 量化）** —— 无损语义，2-4 倍收益，最安全。见前一题。

**② 结构性减少（GQA / MLA）** —— 在模型架构层面减少 KV 的维度。要在**训练时**就定下来（或做 GQA 转换 + 少量继续训练），推理侧改不了。

**③ Token 淘汰（eviction）** —— 只保留"重要"的 token 的 KV，扔掉其余：
- **StreamingLLM**：保留开头少数几个 **attention sink** token + 最近的滑动窗口。关键发现是开头的 token 即使语义无关也承载了大量注意力质量，扔掉会崩。实现极简，适合无限长流式对话。
- **H2O（Heavy Hitter Oracle）**：按累积注意力分数保留"重头"token，动态淘汰。
- **SnapKV**：在 prefill 结束时根据 prompt 末尾的注意力模式，一次性挑出要保留的 KV。对长 prompt 短输出的场景（文档问答）特别有效。
- **取舍**：这类方法**会丢信息**，长上下文精确召回（needle）会受损。适合对话/摘要，不适合"从 100 页里找一个数字"。

**④ 层级/共享压缩**：
- 跨层共享 KV（CLA 等）：相邻层复用同一份 KV
- KV offload 到 CPU/NVMe：不是压缩而是搬走，见下题

**怎么选**：
- 要**精确召回** → 只用①②，加算力（序列并行/Ring Attention）而不是丢 KV
- 流式无限对话 → StreamingLLM
- 长 prompt 短答（RAG、文档 QA）→ SnapKV
- 通用服务 → ①（KV 量化）+ prefix caching，最稳

**面试要点**：主动指出③会丢信息、以及它适合哪类任务不适合哪类，比罗列方法名重要得多。`,
ask:"长上下文方向的深度题。"},

{id:"v4",cat:"kv",level:2,tags:["KV"],q:"把 KV Cache offload 到 CPU 内存或 NVMe，什么时候划算？",
a:`**先算带宽账**，这决定一切：
- HBM3：3.35 TB/s
- PCIe 5.0 x16：约 64 GB/s（**低 50 倍**）
- NVMe SSD：约 7 GB/s（**低 480 倍**）

**decode 阶段每一步都要读全部 KV**。如果 KV 在 CPU 内存里，每步都要通过 PCIe 搬一遍 —— 那 decode 会慢到完全不可用。所以**热路径上的 KV 绝不能 offload**。

**那什么时候划算**：

**① 被抢占请求的暂存（swap）**。请求被踢出 running 集合时，把它的 KV 换出到 CPU，等重新调度时换回。这时 KV 是**冷的**，不在每步热路径上，换入换出各一次。
- 对比 recompute：长 prompt 用 swap（重算贵），短 prompt 用 recompute（传输贵）。分界点大致是「重算耗时 vs 传输耗时」，可以实测标定。

**② 跨请求的前缀缓存的第二级存储**。热前缀留在 HBM，温的放 CPU 内存，冷的放 NVMe/对象存储。命中时搬一次，之后整轮对话都在 HBM 里用。Mooncake 就是把 KV 缓存做成了一个分布式的多级存储池。
- 这个场景划算，因为**搬一次换来省掉整个 prefill**。8k prompt 的 prefill 可能几百毫秒，而搬几 GB KV 走 RDMA 只要几十毫秒。

**③ 超长上下文的分块处理**（研究方向，如 InfiniGen）—— 按注意力稀疏性只把可能被关注的 KV 块预取回 HBM。依赖注意力稀疏的假设，工程上还不成熟。

**回答模板**：先摆带宽层级，指出 decode 热路径不可 offload，然后说明「冷数据 + 一次性搬运换掉重算」这个模式才是它的正确用法。这个思路清晰度比记住工具名重要。`,
ask:"追问抢占策略时会引到这里。"},

{id:"v5",cat:"kv",level:2,tags:["碎片"],q:"除了 PagedAttention，还有哪些显存管理的实际问题？",
a:`**① PyTorch 缓存分配器的碎片。**
PyTorch 不把显存还给驱动，而是自己缓存复用。长跑服务里不同大小的张量反复申请释放会产生碎片，表现为「明明 \`memory_allocated\` 只有 40GB，却在 60GB 时就 OOM」。
- 诊断：对比 \`torch.cuda.memory_allocated()\`（真实占用）和 \`memory_reserved()\`（向驱动申请的），差值就是碎片 + 缓存
- 缓解：\`PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True\`（可扩展段，显著减少碎片）、或设 \`max_split_size_mb\`
- 极端情况 \`torch.cuda.empty_cache()\`，但会让后续申请变慢

**② CUDA context 和 kernel 的固定开销。**
每个进程的 CUDA context 占几百 MB；cuBLAS/cuDNN 的 workspace、NCCL 的通信缓冲区也各占一块。算容量时要留出这部分（通常 1-2 GB），这就是为什么 \`gpu_memory_utilization\` 默认设 0.9 而不是 1.0。

**③ 激活显存的峰值。**
prefill 阶段的激活可能是个大峰值，尤其长 prompt。一个只按「权重 + KV」算容量的服务，在遇到超长 prompt 时会突然 OOM。要按最坏情况的 prefill chunk 预留。

**④ 显存泄漏的常见来源**（服务跑几小时慢慢涨）：
- 累加了带计算图的张量（\`total += loss\` 而不是 \`loss.item()\`）
- 把带梯度的中间结果存进列表
- 请求对象没释放导致 KV block 引用计数不归零
- 诊断手法：定期打 \`memory_allocated\`，**单调递增就是泄漏**（正常应在区间内波动）

**⑤ 多卡的显存不均衡。**
PP 并行时不同 stage 的层数/激活不同；TP 时 embedding 和 lm_head 的切分方式会造成首尾卡多占。要按实际测量调整切分，而不是均分层数。

**面试价值**：这些都是「真跑过生产服务」才会遇到的问题，随便讲透两三个就很有说服力。`,
ask:"「你 oncall 处理过什么显存问题」的标准弹药。"},

/* ══════════ 量化与压缩 ══════════ */
{id:"q1",cat:"quant",level:2,tags:["量化"],q:"GPTQ 和 AWQ 的算法差异是什么？为什么生产上 AWQ 更常用？",
a:`**GPTQ**：基于 OBQ/OBS 的思路。逐层、**逐列**量化权重，每量化一列就用 Hessian 的逆信息去**补偿**剩余未量化列的误差，使整层输出的重建误差最小。
- 需要校准数据来估 Hessian（\`H = 2XXᵀ\`）
- 需要矩阵分解（Cholesky）和逐列迭代，**量化过程较慢**
- 对校准集有一定敏感性

**AWQ（Activation-aware Weight Quantization）**：核心观察是 **权重的重要性由激活幅度决定** —— 大约 1% 的「显著权重」（对应激活值大的输入通道）承载了主要的精度影响。
- 做法：按激活的 per-channel 尺度，对这些通道**先放大权重再量化**（等价地把缩放因子吸收进前一层），使显著权重在量化后保留更多有效位
- **不需要反向传播、不需要 Hessian**，只需要统计激活的幅度 → 量化快得多
- 对校准集不敏感，**泛化更好**（换领域数据不容易崩）

**为什么生产选 AWQ**：
1. 量化快（分钟级 vs GPTQ 的几十分钟到小时）→ 迭代和上线成本低
2. 对校准数据不敏感 → 不用担心校准集和线上分布不匹配
3. 精度相当或更好，且有高效的推理 kernel（AWQ 的 W4A16 GEMM）
4. 工程上更可预测，不会出现「换个校准集结果差很多」的情况

**必须补的关键认知**：
W4A16（4-bit 权重、16-bit 激活）在多数实现里，**计算时要把权重反量化回 FP16 再做 GEMM**。所以：
- 省的是**显存和显存带宽** → decode 阶段（memory-bound）明显提速
- **不省算力** → prefill 阶段（compute-bound）可能反而略慢（多了反量化开销）

而 **FP8 在 H100 上有原生 Tensor Core**，是真正的算力翻倍，prefill 和 decode 都受益。所以 H100 上应该优先考虑 FP8 而不是 4-bit —— **这个判断能明显区分懂和不懂**。`,
ask:"选型题高频。「省显存还是省算力」是关键区分点。"},

{id:"q2",cat:"quant",level:3,tags:["量化"],q:"激活量化为什么比权重量化难？SmoothQuant 怎么解决？",
a:`**难点：LLM 的激活有极端离群值（outlier）。**

实测发现 Transformer 某些隐藏维度上的激活值能比其他维度大 **100 倍以上**，而且这些离群通道是**系统性的**（固定在某些 channel 上，跨样本一致）。

后果：per-tensor 量化时，缩放因子被离群值撑大，绝大多数正常值被压缩到量化区间的极小部分，有效位数只剩两三位 → 精度崩塌。

而**权重的分布要平坦得多**（近似高斯，没有极端离群），所以权重量化到 4-bit 都还能接受，激活量化到 8-bit 就已经很难。

**SmoothQuant 的思路：把难度从激活迁移一部分到权重。**

利用一个等价变换：
\`\`\`
Y = (X · diag(s)⁻¹) · (diag(s) · W)
\`\`\`
数学上完全等价，但把激活的第 j 个通道除以 \`s_j\`、权重的第 j 行乘以 \`s_j\`。选 \`s_j\` 使激活的离群被压平、而权重的增幅仍在可量化范围内。论文用
\`s_j = max(|X_j|)^α / max(|W_j|)^(1−α)\`，α 通常取 0.5 做平衡。

关键是这个缩放可以**离线吸收进前一层的权重或 LayerNorm 参数**，推理时零额外开销。

**结果**：使 **W8A8** 变得可行 → 能用上 INT8 Tensor Core，**真正省算力**（不只是省显存），吞吐提升明显。

**其他路线**：
- **LLM.int8()**：把离群通道单独拎出来用 FP16 算，其余 INT8。精度好但实现有分支、性能不理想
- **FP8**：有指数位，动态范围天然宽，对离群值容忍度高得多 —— 这是 H100 之后 FP8 逐渐取代 INT8 激活量化的根本原因

**面试价值**：「为什么激活比权重难量化」是个很好的甄别题，答案是「离群值 + 分布差异」，能顺着讲到 SmoothQuant 和 FP8 就很完整。`,
ask:"进阶题。能讲清离群值问题的很少。"},

{id:"q3",cat:"quant",level:2,tags:["评估"],q:"量化后怎么评估质量？为什么不能只看 PPL？",
a:`**PPL 的问题：它太钝了。**
困惑度是在大量普通文本上的平均预测损失。量化带来的损伤往往集中在**少数关键位置**（长距离依赖、精确数字、罕见 token），这些在平均值里被淹没。实测常见「PPL 只涨 0.05，但代码生成通过率掉 8%」。

**该建的评估矩阵**：

**① 目标任务的真实指标** —— 最重要。你的服务是干什么的就测什么（代码用 pass@1、抽取用字段级准确率、对话用人工/Judge 打分）。

**② 能力分项的标准集**：
- 知识：MMLU / C-Eval（量化对知识伤害相对小）
- **推理：GSM8K / MATH（量化最容易伤这个** —— 多步推理里一步错就全错，是最敏感的探针）
- 代码：HumanEval / MBPP（执行结果可验证，信号干净）
- **长上下文召回：needle-in-a-haystack**（KV 量化必测）

**③ 鲁棒性与格式**：
- 指令遵循、JSON 格式合法率（量化后格式崩掉是常见现象）
- 拒答率变化、安全性回归

**④ 生成稳定性**：同一 prompt 多次采样的方差、长生成后半段的退化、复读率。

**⑤ 分布对齐检查**（进阶）：对同一批 prompt，比较量化前后输出 token 分布的 KL 散度，或 top-1 一致率。这能在跑完整评测前快速发现问题。

**工程流程**：
- 固定 \`temperature=0\` 做可复现对比，再单独测采样场景
- 建**回归门禁**：目标指标掉超过阈值就阻断上线
- 保留 badcase 集，专门收集量化后变差的例子

**要说的那句话**：「我会先用 PPL 做快速 smoke test，但**上线决策必须基于目标任务指标 + 推理和长上下文这两个敏感探针**」。这显示你知道指标的适用边界。`,
ask:"「你怎么验证量化是安全的」。平台岗和算法岗都会问。"},

{id:"q4",cat:"quant",level:2,tags:["剪枝"],q:"稀疏化和剪枝在 LLM 推理里实用吗？",
a:`**诚实的答案：目前实用性远不如量化。** 但要能说清为什么。

**非结构化稀疏**（随便把小权重置零，如 SparseGPT、Wanda）
- 能做到 50-60% 稀疏度而精度损失可接受
- **但硬件不加速** —— 随机的零分布无法转成有效的算力节省，需要稀疏 GEMM，而稀疏 GEMM 在这个稀疏度下通常比稠密还慢
- 只能省存储，而存储用量化省得更彻底、更简单
- **结论：一般不划算**

**结构化稀疏 2:4**（Ampere 起硬件支持）
- 每 4 个权重里恰好 2 个为零，硬件 Sparse Tensor Core 能给**理论 2 倍**算力
- 实际收益通常不到 2 倍，且需要「训练时就用 2:4 约束」或剪枝后微调恢复精度
- 精度损失比同等压缩率的量化更大
- **结论：有场景但门槛高**，适合模型固定、愿意投入微调的情况

**结构化剪枝（整层/整头/整通道）**
- 直接删掉一些注意力头、FFN 通道甚至整层 → 是真正的稠密小模型，**推理确定性加速**
- 代价是精度损失明显，通常需要**继续预训练或蒸馏**恢复（成本不低）
- 代表：LLM-Pruner、Sheared-LLaMA、NVIDIA 的 Minitron（剪枝 + 蒸馏）
- **结论：当作「造一个更小模型」的手段是有效的**，比从头训小模型省算力。Minitron 系列证明了这条路可行

**MoE 视角**：MoE 本质是一种**动态结构化稀疏** —— 每 token 只激活部分专家。这是目前工业界最成功的稀疏形式，但它需要在预训练阶段设计，不是事后剪枝。

**一句话总结**：**降本优先级上，量化 > 蒸馏/剪枝造小模型 > 稀疏化**。量化便宜且收益确定；剪枝+蒸馏投入大但能得到真正的小模型；非结构化稀疏目前基本是学术方向。`,
ask:"追问「除了量化还有什么压缩手段」时用。敢说「不实用」并给理由是加分的。"}
];
