"""
Roofline 实测 —— AI Infra 第一层「算术强度」那节的动手练习。

测三件事：
  1. 这张卡实际能跑到多少显存带宽（访存瓶颈的上限）
  2. 实际能跑到多少算力（算力瓶颈的上限）
  3. 两者相除得到 ridge point —— 算术强度低于它的算子就是 memory-bound

用法：python tools/gpu_bench.py
"""
import torch, time, sys

if not torch.cuda.is_available():
    sys.exit("没有可用的 CUDA 设备")

dev = torch.device("cuda")
prop = torch.cuda.get_device_properties(0)


def timed(fn, warmup=5, iters=30):
    """返回单次调用的秒数（已同步、已预热）"""
    for _ in range(warmup):
        fn()
    torch.cuda.synchronize()
    t0 = time.perf_counter()
    for _ in range(iters):
        fn()
    torch.cuda.synchronize()
    return (time.perf_counter() - t0) / iters


def bandwidth_gbs(n_elem=1 << 24, dtype=torch.float32):
    """逐元素加法 c = a + b：读 2 份、写 1 份，纯访存瓶颈"""
    a = torch.randn(n_elem, device=dev, dtype=dtype)
    b = torch.randn(n_elem, device=dev, dtype=dtype)
    c = torch.empty_like(a)
    itemsize = a.element_size()
    bytes_moved = 3 * n_elem * itemsize          # 2 读 + 1 写
    t = timed(lambda: torch.add(a, b, out=c))
    return bytes_moved / t / 1e9


def tflops(n=4096, dtype=torch.float32):
    """方阵乘 (n,n)@(n,n)：2*n^3 次浮点运算，算力瓶颈"""
    a = torch.randn(n, n, device=dev, dtype=dtype)
    b = torch.randn(n, n, device=dev, dtype=dtype)
    flop = 2 * n ** 3
    t = timed(lambda: torch.mm(a, b), warmup=10, iters=20)
    return flop / t / 1e12


def intensity(flop, bytes_):
    return flop / bytes_


print("=" * 62)
print(f"  {prop.name}   sm_{prop.major}{prop.minor}   "
      f"{prop.total_memory/1e9:.1f} GB   {prop.multi_processor_count} SMs")
print("=" * 62)

bw = bandwidth_gbs()
print(f"\n[1] 实测显存带宽        {bw:8.1f} GB/s")
print(f"    （逐元素加法，算术强度约 {intensity(1, 12):.2f} FLOP/Byte —— 彻底的 memory-bound）")

print("\n[2] 实测算力")
res = {}
for name, dt in [("FP32", torch.float32), ("FP16", torch.float16)]:
    try:
        tf = tflops(dtype=dt)
        res[name] = tf
        print(f"    {name:5s}{tf:8.2f} TFLOPS")
    except Exception as e:
        print(f"    {name:5s}  不支持 ({type(e).__name__})")

# TF32 开关对比（Ampere 以上才有效果）
torch.backends.cuda.matmul.allow_tf32 = True
try:
    tf32 = tflops(dtype=torch.float32)
    print(f"    TF32 {tf32:8.2f} TFLOPS   （相对 FP32 {tf32/res['FP32']:.2f}x）")
except Exception:
    pass
torch.backends.cuda.matmul.allow_tf32 = False

peak = max(res.values())
ridge = peak * 1e12 / (bw * 1e9)
print(f"\n[3] Ridge point         {ridge:8.1f} FLOP/Byte")
print("    算子的算术强度低于这个数 → memory-bound，优化访存")
print("    高于这个数               → compute-bound，优化算力")

print("\n[4] 几个算子的算术强度对照")
rows = [
    ("逐元素加法 a+b",        1, 12,        "永远 memory-bound"),
    ("LayerNorm（近似）",      5, 8,         "memory-bound"),
    ("矩阵乘 4096³",          2 * 4096**3, 3 * 4096**2 * 4, "compute-bound"),
    ("LLM decode FP16，bs=1", 2, 2,         "极端 memory-bound"),
    ("LLM decode FP16，bs=32", 2 * 32, 2,   "看拐点决定"),
    ("LLM decode FP16，bs=128", 2 * 128, 2, "已经 compute-bound"),
]
for name, fl, by, note in rows:
    ai = intensity(fl, by)
    verdict = "memory-bound" if ai < ridge else "compute-bound"
    print(f"    {name:22s} {ai:10.1f} FLOP/Byte   {verdict:14s} {note}")

has_tc = prop.major >= 8 or (prop.major == 7 and prop.minor in (0, 2))
fp16_note = ("FP16 比 FP32 慢 —— 这张卡没有 Tensor Core（GTX 16 系列砍掉了）。"
             if res.get("FP16", 0) < res.get("FP32", 1) else
             "FP16 比 FP32 快，说明 Tensor Core 在起作用。")

print(f"""
[5] 怎么读这组数字

    · {fp16_note}
      有 Tensor Core 的卡上 FP16/BF16 通常快 8-16 倍，这是 H100 的 ridge point
      高达约 295 而这张卡只有 {ridge:.0f} 的根本原因 —— 分子（算力）差了两个量级。

    · 同一个算子，在不同卡上可能落在拐点两侧。batch=32 的 decode 在这张卡上
      已经 compute-bound，在 H100 上却仍然是 memory-bound。
      **「是不是访存瓶颈」永远要连着硬件一起说**，这是面试里容易露怯的地方。

    · decode 阶段 bs=1 的算术强度只有 1（FP16 权重：读 2 字节做 2 次浮点运算），
      而拐点是 {ridge:.0f} —— 差 {ridge:.0f} 倍，算力几乎全在空转。

    由此推出三个结论（面试直接能用）：
      · 增大 batch 几乎白赚吞吐 —— 权重只读一遍，却服务了更多请求
      · KV Cache 大小直接决定能塞多少并发，所以 GQA / MLA / KV 量化很关键
      · 投机解码有效，因为验证 k 个 token 和验证 1 个的耗时几乎一样
""")
