/* 阶段 0 课程内容（二）：Python 工程 / PyTorch 基础 */

window.LESSONS.s0n4 = {
title: "Python 工程：写出别人愿意看的代码",
sub: "面试官会看你的 GitHub。算法再好，代码乱七八糟、跑不起来，印象分直接归零。这一课讲怎么把实验写成作品。",
est: "读 70 分钟 + 做题 35 分钟",
sections: [
{h:"1. 环境管理：别再污染全局了",
b:`新手最常见的灾难：所有包都装在系统 Python 里，两个项目要求不同版本的 torch，互相打架，最后整个环境烂掉重装系统。

**规则：每个项目一个独立环境。**

现在最好的工具是 **uv**（Rust 写的，比 pip 快 10~100 倍）：

\`\`\`bash
# 装 uv（一次性）
pip install uv

# 新项目
uv venv                      # 创建虚拟环境到 .venv
source .venv/bin/activate    # Linux/Mac
.venv\\Scripts\\activate       # Windows

uv pip install torch transformers
uv pip freeze > requirements.txt
\`\`\`

conda 也行，尤其是需要管理 CUDA 版本时：

\`\`\`bash
conda create -n llm python=3.11
conda activate llm
\`\`\`

**必须做的一件事**：把依赖固定下来。别人（和三个月后的你）\`pip install -r requirements.txt\` 就能复现。

> **一个血泪教训**：\`requirements.txt\` 里写 \`torch\` 和写 \`torch==2.3.1\` 是两回事。前者半年后会装到一个不兼容的新版本，你的代码突然跑不了，还找不到原因。**关键依赖一定要锁版本。**`},

{h:"2. 项目结构：让人 30 秒看懂",
b:`一个能拿得出手的 ML 项目长这样：

\`\`\`
my-project/
├── README.md           ← 最重要的文件
├── requirements.txt
├── .gitignore
├── config.yaml         ← 超参集中管理，不要散落在代码里
├── src/
│   ├── data.py         ← 数据加载与预处理
│   ├── model.py        ← 模型定义
│   ├── train.py        ← 训练循环
│   └── evaluate.py     ← 评估
├── notebooks/          ← 探索性分析放这里，不要放核心逻辑
├── tests/
└── results/            ← 输出（加进 .gitignore）
\`\`\`

**README 必须包含**（面试官只会看这个）：
1. 一句话说清这个项目**解决什么问题**
2. **效果数字** —— 最好有表格或曲线图
3. 怎么跑起来（复制粘贴就能执行的命令）
4. 关键的**技术选型理由**

**.gitignore 必须包含**：
\`\`\`
.venv/
__pycache__/
*.pth
*.ckpt
data/
wandb/
.env          ← 千万别把 API key 提交上去
\`\`\`

> **真实发生过的事故**：把 OpenAI API key 提交到公开仓库，几小时内被爬虫扫到，账单跑掉几千美元。**API key 一律放 \`.env\` 文件并加进 .gitignore**，代码里用 \`os.getenv("OPENAI_API_KEY")\` 读取。`},

{h:"3. numpy 向量化：慢 100 倍的代码长什么样",
b:`Python 的 for 循环极慢。numpy 把循环下沉到 C 层，速度差距通常是 **50~200 倍**。

**反面教材：**
\`\`\`python
result = []
for i in range(len(a)):
    result.append(a[i] * b[i] + 1)
\`\`\`

**正确写法：**
\`\`\`python
result = a * b + 1        # 整个数组一次性运算
\`\`\`

**广播（Broadcasting）—— 必须掌握的规则**

numpy 允许不同形状的数组运算，规则是**从右往左逐维对齐**，每一维必须满足「相等」或「其中一个是 1」：

\`\`\`python
A.shape = (3, 4)
b.shape =    (4,)      →  b 被复制 3 行，结果 (3, 4)  ✓

A.shape = (3, 4)
b.shape = (3, 1)       →  b 被复制 4 列，结果 (3, 4)  ✓

A.shape = (3, 4)
b.shape = (3,)         →  从右对齐：4 vs 3，不匹配   ✗ 报错
\`\`\`

最后那个是新手最常踩的坑。想让 (3,) 和 (3,4) 相加，必须先 \`b.reshape(3,1)\` 或 \`b[:, None]\`。

**一个实战例子**：给一批向量做归一化

\`\`\`python
X = np.random.randn(1000, 128)          # 1000 个 128 维向量
norms = np.linalg.norm(X, axis=1, keepdims=True)   # (1000, 1)
X_normalized = X / norms                # 广播，(1000,128)/(1000,1)
\`\`\`

\`keepdims=True\` 很关键：不加的话得到 (1000,) 形状，广播时会从右对齐变成 128 vs 1000，直接报错。

**axis 参数的记法**：\`axis=0\` 是沿着行的方向压缩（结果按列汇总），\`axis=1\` 是沿着列的方向压缩（结果按行汇总）。记不住就动手试，print 出 shape 看。`},

{h:"4. 让代码可读：类型注解、命名、函数拆分",
b:`**类型注解**让人和 IDE 都能看懂你的意图：

\`\`\`python
def encode(texts: list[str], max_len: int = 512) -> torch.Tensor:
    """把文本编码成张量。

    Args:
        texts: 待编码的文本列表
        max_len: 超过则截断
    Returns:
        形状为 (len(texts), max_len) 的 int64 张量
    """
\`\`\`

**在 ML 代码里，形状注释比类型注解还重要**：

\`\`\`python
def attention(q, k, v):
    # q, k, v: (B, H, T, D)
    scores = q @ k.transpose(-2, -1)    # (B, H, T, T)
    weights = scores.softmax(-1)         # (B, H, T, T)
    return weights @ v                   # (B, H, T, D)
\`\`\`

这几行形状注释能省掉未来几小时的调试。**养成习惯。**

**命名**：\`data\`、\`temp\`、\`x1\`、\`process()\` 这种名字等于没有名字。写 \`train_texts\`、\`normalized_logits\`、\`build_vocab()\`。

**函数要短**。一个 300 行的 \`main()\` 谁也读不下去。把加载数据、构建模型、训练、评估各自拆成函数。

**工具链（配好就一劳永逸）：**
\`\`\`bash
pip install ruff        # 格式化 + 静态检查，取代 black+flake8+isort
ruff format .
ruff check . --fix
\`\`\``},

{h:"5. 调试：别再满屏 print 了",
b:`**print 调试的升级版**：用 f-string 的 \`=\` 语法，自动打印变量名

\`\`\`python
print(f"{x.shape=}, {x.dtype=}, {x.device=}")
# 输出: x.shape=torch.Size([32, 128]), x.dtype=torch.float32, ...
\`\`\`

**断点调试**（Python 3.7+ 内置）：

\`\`\`python
breakpoint()      # 程序停在这里，进入交互式命令行
\`\`\`

常用命令：\`n\` 下一行、\`s\` 进入函数、\`c\` 继续运行、\`p 变量名\` 打印、\`q\` 退出。

**ML 代码最该检查的几样东西：**

\`\`\`python
print(f"{tensor.shape=}")           # 形状对不对
print(f"{tensor.dtype=}")           # float32? float16? int64?
print(f"{tensor.device=}")          # cpu 还是 cuda
print(f"{tensor.isnan().any()=}")   # 有没有 NaN
print(f"{tensor.min()=}, {tensor.max()=}")   # 数值范围正不正常
print(f"{loss.item()=}")            # loss 是不是在降
\`\`\`

> **训练不收敛时的排查顺序**（这个清单很实用）：
> 1. **先用 2 个样本过拟合** —— 如果连 2 个样本都记不住，说明代码有 bug，不是调参问题
> 2. 检查数据：标签对不对？有没有全是同一类？归一化做了吗？
> 3. 检查 loss 初始值：10 分类任务初始 loss 应该约等于 \`ln(10)=2.3\`，如果差很远说明输出层或损失函数有问题
> 4. 学习率试 3 个数量级：1e-3 / 1e-4 / 1e-5
> 5. 检查梯度：\`param.grad\` 是不是 None（忘了 backward）、是不是全 0、是不是 NaN`},

{h:"6. Git：最少必要知识",
b:`\`\`\`bash
git init
git add -A
git commit -m "描述这次改了什么"
git log --oneline              # 看历史
git diff                       # 看还没暂存的改动
git checkout -b feature-lora   # 开新分支做实验
git switch main                # 切回主分支
\`\`\`

**提交信息要写清「做了什么」而不是「改了代码」**：
- ✗ \`update\`、\`fix bug\`、\`asdf\`
- ✓ \`加入混合检索，Recall@5 从 62% 提升到 89%\`

**对 ML 项目特别有用的两条：**

1. **每个实验开一个分支**，或者至少在 commit message 里写清超参和结果。三个月后你会感谢自己。
2. **永远不要提交大文件**。模型权重（几个 GB）进了 git 历史就再也删不掉，仓库会永久臃肿。用 \`.gitignore\` 排除，需要分享就用 HuggingFace Hub 或 GitHub Release。

**如果提交错了：**
\`\`\`bash
git reset --soft HEAD~1     # 撤销上一次 commit，改动还在暂存区
git reset HEAD~1            # 撤销 commit，改动回到工作区
git restore <file>          # 丢弃某个文件的改动（危险，不可恢复）
\`\`\``}
],
quiz: [
{id:"m4q1", type:"text", q:"numpy 广播：A 的形状是 (5, 3)，b 的形状是 (3,)。执行 A + b 的结果形状是？（填 5,3 这样的格式；如果会报错就填 error）",
ans:["5,3","(5,3)","5 3","5x3","5×3"],
hint:"广播规则是从右往左对齐。A 的最右维是 3，b 的最右维也是 3 —— 匹配。然后 b 没有更多维度了，会被自动补成 1 并复制。",
why:"结果是 **(5, 3)**。\n\n从右往左对齐：\n```\nA: (5, 3)\nb:    (3,)  →  补成 (1, 3)  →  复制 5 行  →  (5, 3)\n```\n\n**对比一下会报错的情况**：如果 b 的形状是 (5,)，从右对齐就是 3 vs 5，既不相等也没有 1，直接报错。这时需要 `b.reshape(5,1)` 变成 (5,1) 才能广播。\n\n这个坑新手必踩一次，提前知道能省时间。"},

{id:"m4q2", type:"mc", q:"X 的形状是 (1000, 128)，想给每个向量做 L2 归一化。下面哪种写法是对的？",
choices:[
"X / np.linalg.norm(X, axis=1)",
"X / np.linalg.norm(X, axis=1, keepdims=True)",
"X / np.linalg.norm(X, axis=0, keepdims=True)",
"X / np.linalg.norm(X)"], ans:1,
hint:"想清楚两件事：① 要沿哪个轴求范数（每个向量是一行，128 个数）② 求完后形状是什么，能不能和 (1000,128) 广播？",
why:"**正确答案是第二个。**\n\n- `axis=1` 表示沿第 1 维（128 那一维）求范数，得到每一行的长度 —— 这才是「每个向量的模」。\n- `keepdims=True` 让结果保持 **(1000, 1)** 而不是塌缩成 (1000,)。\n\n**为什么第一个错**：不加 keepdims 得到 (1000,)，广播时从右对齐是 1000 vs 128 —— 不匹配，报错。\n\n**为什么第三个错**：`axis=0` 是沿 1000 那一维求，得到 (1, 128)，算的是「每个特征维度在全部样本上的范数」，语义完全不对。\n\n**为什么第四个错**：不给 axis 会把整个矩阵当成一个大向量求一个标量范数，所有样本除以同一个数，不是归一化。\n\n这道题浓缩了 numpy 最容易错的两个点：**axis 选哪个** 和 **keepdims 加不加**。"},

{id:"m4q3", type:"num", q:"一个 10 分类任务，模型刚初始化（还没训练）时，交叉熵损失的理论值大约是多少？（保留两位小数，ln10 ≈ 2.303）",
hint:"刚初始化时模型什么都不知道，输出接近均匀分布 —— 每个类别的概率都是 1/10。交叉熵 = -log(正确类的概率)。", ans:2.30, tol:0.05,
why:"随机初始化时输出接近均匀分布，每类概率 1/10。\n\nloss = -ln(1/10) = ln(10) ≈ **2.30**\n\n**这个数字极其有用。** 训练刚开始时打印一下 loss：\n- 约等于 2.3 → 说明模型和损失函数搭得对，可以放心训\n- 远大于 2.3（比如 15） → 输出层初始化有问题，或者 logits 尺度失控\n- 远小于 2.3 → 大概率有**数据泄漏**，或者标签和输入对错了位\n\n**推广公式**：C 分类任务的初始 loss ≈ ln(C)。\n- 二分类：ln2 ≈ 0.69\n- 1000 分类：ln1000 ≈ 6.9\n- 词表 50000 的语言模型：ln50000 ≈ 10.8\n\n**这是排查训练 bug 的第一道检查**，比盲目调参有效得多。"},

{id:"m4q4", type:"mc", q:"你的模型训练时 loss 一直不下降。按照最有效的排查顺序，**第一步**应该做什么？",
choices:[
"把学习率调小 10 倍再试",
"换一个更大的模型",
"用 2~3 个样本跑，看能不能过拟合到 loss 接近 0",
"增加训练轮数"], ans:2,
hint:"在调任何超参之前，你需要先回答一个更根本的问题：这段代码本身到底有没有 bug？怎么用最小的代价验证这件事？",
why:"**第一步永远是：用极少量样本（2~3 个）尝试过拟合。**\n\n逻辑很硬：一个有足够容量的神经网络，**必然**能把 3 个样本完全背下来，loss 应该掉到接近 0。\n\n- **如果背不下来** → 代码有 bug。常见原因：忘了 `optimizer.zero_grad()`、忘了 `loss.backward()`、标签和输入没对齐、优化器没接上模型参数、学习率是 0、模型输出被 detach 了。**这时候调参毫无意义。**\n- **如果能背下来但真实数据上不降** → 代码没问题，这才轮到调学习率、加数据、改架构。\n\n这一步只要几十秒，却能把「代码 bug」和「调参问题」这两类完全不同的问题干净地区分开。\n\n**其余选项的问题**：调学习率、加轮数、换大模型都是在假设「代码是对的」的前提下做的事。如果前提不成立，你可能浪费几天时间调一个根本跑不通的东西。\n\n> 这是 Karpathy 在《A Recipe for Training Neural Networks》里排第一位的建议，也是资深工程师和新手最明显的差别之一。"},

{id:"m4q5", type:"open", q:"你在 GitHub 上放了一个 RAG 项目，面试官点开了。请列出你的 README 必须包含哪些内容，以及 .gitignore 里必须排除什么。说明理由。",
hint:"站在面试官的角度想：他只有 2 分钟，他想知道什么？另外想想哪些文件提交上去会造成安全事故或仓库臃肿。",
ref:"**README 必须有（按重要性排序）：**\n\n1. **一句话说清解决什么问题** —— 面试官前 10 秒就要知道这是什么。不要上来就讲技术栈。\n2. **效果数字/表格** —— 「Recall@5 从 62% 提升到 89%」。这是最能拉开差距的部分，绝大多数人的 README 里没有任何数字。\n3. **演示截图或 GIF** —— 一张图胜过千字，而且证明它真的能跑。\n4. **快速开始** —— 能直接复制粘贴执行的命令。如果面试官想跑但跑不起来，印象分会掉得很惨。\n5. **架构图或流程说明** —— 数据怎么流动的。\n6. **技术选型理由** —— 「为什么用混合检索而不是纯向量」。这证明你在做判断，不是抄教程。\n7. **已知局限 / 后续计划** —— 展示你清楚自己方案的边界，这是成熟度的标志。\n\n**.gitignore 必须排除：**\n\n- **`.env` 和任何含密钥的文件** —— 最重要。API key 泄露到公开仓库会在几小时内被爬虫扫到盗用，而且 git 历史里删不干净。\n- **虚拟环境** `.venv/`、`venv/`、`__pycache__/`\n- **模型权重** `*.pth`、`*.ckpt`、`*.safetensors` —— 几个 GB 进了 git 历史就永久留在仓库里，克隆一次几十分钟。要分享就用 HuggingFace Hub 或 GitHub Release。\n- **数据集** `data/` —— 同理，而且可能有版权或隐私问题。\n- **实验产物** `wandb/`、`runs/`、`outputs/`、`*.log`\n- **IDE 配置** `.vscode/`、`.idea/`、`.DS_Store`\n\n**加分做法：**\n- 提供 `.env.example` 列出需要哪些环境变量（但不含真实值）\n- 提供 Dockerfile，一行命令就能跑起来\n- 加一个 `requirements.txt` 并**锁定版本号**\n- 在 README 顶部放一行 badge（Python 版本、License）"}
]
};

window.LESSONS.s0n5 = {
title: "PyTorch：从张量到完整训练循环",
sub: "这是唯一必须练到肌肉记忆的框架。面试白板题、日常实验、所有项目都靠它。目标：闭卷写出训练循环。",
est: "读 90 分钟 + 做题 40 分钟 + 动手 6 小时",
sections: [
{h:"1. Tensor：会记账的多维数组",
b:`Tensor 基本就是 numpy 数组，多了两个超能力：**能上 GPU**、**能自动求导**。

\`\`\`python
import torch

x = torch.tensor([[1., 2.], [3., 4.]])   # 从 Python 列表
z = torch.zeros(3, 4)                     # 全 0
r = torch.randn(2, 3)                     # 标准正态随机
a = torch.arange(10)                      # 0..9

x.shape       # torch.Size([2, 2])
x.dtype       # torch.float32
x.device      # cpu
\`\`\`

**三个最常用的形状操作，必须分清：**

\`\`\`python
x = torch.randn(2, 3, 4)

x.view(6, 4)          # 改形状，要求内存连续，共享数据
x.reshape(6, 4)       # 同上，但内存不连续时会自动复制（更安全）
x.transpose(0, 1)     # 交换两个维度 → (3, 2, 4)
x.permute(2, 0, 1)    # 任意重排维度 → (4, 2, 3)
x.unsqueeze(0)        # 增加一维 → (1, 2, 3, 4)
x.squeeze()           # 去掉所有大小为 1 的维度
\`\`\`

> **高频坑**：\`transpose\` 之后内存不再连续，直接 \`.view()\` 会报错。解决办法是 \`.contiguous().view()\` 或者干脆用 \`.reshape()\`。
> 手写 Multi-Head Attention 时必然遇到这个问题 —— 因为要先 transpose 把 head 维度换到前面，最后再换回来合并。

**dtype 与 device**：
\`\`\`python
x = x.to('cuda')            # 搬到 GPU
x = x.to(torch.bfloat16)    # 转精度
x = x.to('cuda', torch.bfloat16)   # 一起搞定
\`\`\`

两个最常见的运行时错误：
- \`Expected all tensors to be on the same device\` → 有的张量在 CPU 有的在 GPU
- \`expected scalar type Float but found Half\` → dtype 不一致

**矩阵乘法**：用 \`@\` 运算符（等价于 \`torch.matmul\`）
\`\`\`python
A = torch.randn(32, 128)
B = torch.randn(128, 512)
C = A @ B                   # (32, 512)
\`\`\`

注意区分：\`*\` 是**逐元素相乘**（会广播），\`@\` 才是矩阵乘法。搞混了不一定报错，但结果全错，非常难查。`},

{h:"2. autograd：自动求导是怎么工作的",
b:`这是 PyTorch 的核心魔法。

\`\`\`python
x = torch.tensor(2.0, requires_grad=True)
y = x ** 2 + 3 * x
y.backward()
print(x.grad)        # tensor(7.)
\`\`\`

验算：\`dy/dx = 2x + 3\`，代入 x=2 得 7 ✓

**背后发生了什么？**

当你对 \`requires_grad=True\` 的张量做运算时，PyTorch 会**在后台悄悄记录一张计算图**：记住每一步操作是什么、输入是谁。这叫「动态图」—— 图是在运行时边跑边建的。

调用 \`.backward()\` 时，PyTorch 从结果出发，沿着这张图**反向走一遍**，用链式法则把每一段的局部导数乘起来，把结果累加到每个叶子张量的 \`.grad\` 属性上。

**这就是你上一课手算的那个反向传播，只不过自动化了。**

**三个必须知道的细节：**

**① 梯度是累加的，不是覆盖的**
\`\`\`python
y1 = x ** 2;  y1.backward()    # x.grad = 4
y2 = x ** 2;  y2.backward()    # x.grad = 8  ← 累加了！
\`\`\`
所以每个训练步都必须 \`optimizer.zero_grad()\` 清零。**忘记清零是新手第一大 bug**，表现为 loss 先降后乱跳。

（顺带：累加特性也有正面用途 —— **梯度累积**就是靠它实现「用小显存模拟大 batch」。）

**② 推理时要关掉梯度记录**
\`\`\`python
with torch.no_grad():
    preds = model(x)
\`\`\`
不关的话，PyTorch 会白白维护计算图，**显存翻倍、速度变慢**，而且推理根本不需要梯度。

**③ 从计算图里取数值要用 .item() 或 .detach()**
\`\`\`python
total_loss += loss.item()      # ✓ 取出 Python 数字
total_loss += loss             # ✗ 整张计算图被永久持有 → 显存泄漏
\`\`\`
这个 bug 的典型症状是：训练跑着跑着显存越用越多，最后 OOM。`},

{h:"3. nn.Module：搭模型的标准姿势",
b:`所有模型都继承 \`nn.Module\`，实现两个方法：

\`\`\`python
import torch.nn as nn

class MLP(nn.Module):
    def __init__(self, d_in, d_hidden, d_out):
        super().__init__()                      # 这行不能忘
        self.fc1 = nn.Linear(d_in, d_hidden)
        self.fc2 = nn.Linear(d_hidden, d_out)
        self.act = nn.ReLU()
        self.drop = nn.Dropout(0.1)

    def forward(self, x):                        # x: (B, d_in)
        h = self.act(self.fc1(x))                # (B, d_hidden)
        h = self.drop(h)
        return self.fc2(h)                       # (B, d_out)

model = MLP(784, 256, 10)
out = model(x)        # 注意：调用 model(x)，不要写 model.forward(x)
\`\`\`

**为什么不能直接调 forward？** 因为 \`model(x)\` 会触发 \`__call__\`，它除了调 forward 还会处理 hook 等机制。直接调 forward 会绕过这些。

**几个常用层：**
\`\`\`python
nn.Linear(in, out)          # 全连接：y = xW^T + b
nn.Embedding(vocab, dim)    # 查表：token id → 向量
nn.LayerNorm(dim)           # 层归一化
nn.Dropout(p)               # 训练时随机置零
nn.ReLU() / nn.GELU() / nn.SiLU()
\`\`\`

**训练模式 vs 评估模式（极易出错）：**
\`\`\`python
model.train()    # Dropout 生效，BatchNorm 更新统计量
model.eval()     # Dropout 关闭，BatchNorm 用历史统计量
\`\`\`

> **典型事故**：评估时忘了 \`model.eval()\`，Dropout 还在随机丢神经元，导致验证集分数偏低且每次结果都不一样，你会误以为模型不稳定，白白调好几天参。
> 反过来，评估完忘了切回 \`model.train()\`，正则化失效，模型开始过拟合。
> **养成习惯：eval 函数的开头 \`model.eval()\`，结尾 \`model.train()\`。**

**看参数量：**
\`\`\`python
n = sum(p.numel() for p in model.parameters() if p.requires_grad)
print(f"可训练参数: {n/1e6:.2f}M")
\`\`\``},

{h:"4. Dataset 与 DataLoader",
b:`\`\`\`python
from torch.utils.data import Dataset, DataLoader

class MyDataset(Dataset):
    def __init__(self, texts, labels):
        self.texts, self.labels = texts, labels

    def __len__(self):                  # 总共多少条
        return len(self.texts)

    def __getitem__(self, idx):         # 取第 idx 条
        return self.texts[idx], self.labels[idx]

loader = DataLoader(
    MyDataset(texts, labels),
    batch_size=32,
    shuffle=True,          # 训练集必须 shuffle，验证集不要
    num_workers=4,         # 多进程加载，避免 GPU 等数据
    pin_memory=True,       # 锁页内存，CPU→GPU 传输更快
    drop_last=True,        # 丢掉不完整的最后一批
)

for batch_x, batch_y in loader:
    ...
\`\`\`

**为什么训练集要 shuffle？** 如果数据按类别排序，一个 batch 里全是同一类，梯度方向严重偏斜，训练会震荡甚至不收敛。

**变长序列怎么办？** 文本长度不一，没法直接堆成矩阵。需要自定义 \`collate_fn\` 做 padding：

\`\`\`python
def collate_fn(batch):
    texts, labels = zip(*batch)
    padded = pad_sequence(texts, batch_first=True, padding_value=0)
    return padded, torch.tensor(labels)

loader = DataLoader(ds, batch_size=32, collate_fn=collate_fn)
\`\`\`

同时要生成 **attention mask** 标记哪些位置是真实 token、哪些是 padding，否则模型会去关注无意义的填充位。`},

{h:"5. 完整训练循环：五个步骤，背下来",
b:`这段代码你要能**闭卷默写**。面试白板题经常直接考。

\`\`\`python
model = MLP(784, 256, 10).to(device)
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=0.01)
criterion = nn.CrossEntropyLoss()

for epoch in range(num_epochs):
    model.train()
    for x, y in train_loader:
        x, y = x.to(device), y.to(device)

        optimizer.zero_grad()          # ① 清空上一步的梯度
        out = model(x)                 # ② 前向传播
        loss = criterion(out, y)       # ③ 算损失
        loss.backward()                # ④ 反向传播，填充 .grad
        optimizer.step()               # ⑤ 用梯度更新参数

    # 评估
    model.eval()
    correct = 0
    with torch.no_grad():
        for x, y in val_loader:
            x, y = x.to(device), y.to(device)
            correct += (model(x).argmax(1) == y).sum().item()
    print(f"epoch {epoch}: acc={correct/len(val_set):.4f}")
\`\`\`

**五步口诀：清零 → 前向 → 算损失 → 反向 → 更新。**

**生产级版本还要加这几样：**

\`\`\`python
scaler = torch.amp.GradScaler()

for step, (x, y) in enumerate(train_loader):
    with torch.autocast('cuda', dtype=torch.bfloat16):    # 混合精度
        out = model(x)
        loss = criterion(out, y) / ACC_STEPS              # 梯度累积要先除

    scaler.scale(loss).backward()

    if (step + 1) % ACC_STEPS == 0:
        scaler.unscale_(optimizer)                         # 裁剪前必须 unscale
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)  # 梯度裁剪
        scaler.step(optimizer)
        scaler.update()
        optimizer.zero_grad(set_to_none=True)
        scheduler.step()                                   # 跟着优化器步走
\`\`\`

**四个容易错的点（面试会问）：**
1. 梯度累积时 **loss 要先除以累积步数**，否则等效学习率被放大 N 倍
2. 梯度裁剪前必须 \`unscale_\`，否则裁的是被放大过的梯度，等于没裁
3. \`zero_grad(set_to_none=True)\` 比置零更省显存
4. scheduler 按 **optimizer step** 计数，不是按 batch —— 用了梯度累积时这两者不同

**保存与加载：**
\`\`\`python
torch.save({'model': model.state_dict(),
            'optim': optimizer.state_dict(),
            'epoch': epoch}, 'ckpt.pt')

ckpt = torch.load('ckpt.pt')
model.load_state_dict(ckpt['model'])
\`\`\`
保存 \`state_dict\` 而不是整个 model 对象 —— 后者依赖类定义，换个文件结构就加载不了。`},

{h:"6. 接下来该动手做什么",
b:`读完这一课你只是「知道」，离「会」还差着动手。按这个顺序练：

**① 手写 MLP 训 MNIST（2 小时）**
不许复制代码，闭卷写训练循环。目标准确率 97%+。

**② 手写 CNN 训 CIFAR-10（3 小时）**
体验一下「同样的循环换个模型就能用」。目标 70%+。

**③ 故意制造 bug 再修（1 小时，收益极高）**
依次注释掉 \`zero_grad()\`、\`model.eval()\`、把 \`loss.backward()\` 删掉，观察每种情况下 loss 曲线是什么样。**亲眼见过这些症状，以后线上遇到能秒判。**

**④ 用 2 个样本过拟合**
验证代码正确性的标准动作，练成条件反射。

**通过标准**：不看任何资料，20 分钟内写出一个完整可跑的训练脚本（含数据加载、模型、训练、评估、保存）。

做到这一步，阶段 0 就通关了，可以进阶段 1。`}
],
quiz: [
{id:"m5q1", type:"text", q:"x 的形状是 (2, 3, 4)，执行 x.transpose(0, 2) 之后形状是？（填 4,3,2 这样的格式）",
ans:["4,3,2","(4,3,2)","4 3 2","4x3x2","4×3×2"],
hint:"transpose(0, 2) 表示交换第 0 维和第 2 维，中间的第 1 维不动。原来是 (2, 3, 4)。",
why:"**(4, 3, 2)**。第 0 维的 2 和第 2 维的 4 对调，中间的 3 不变。\n\n**顺带记住这个高频坑**：transpose 之后张量在内存里不再连续，直接调用 `.view()` 会报 `view size is not compatible...`。\n\n解决办法：`.contiguous().view(...)` 或者直接用 `.reshape(...)`（它会在必要时自动复制）。\n\n手写 Multi-Head Attention 时必然遇到 —— 因为要 transpose 把 head 维度换到前面算注意力，算完再换回来合并，那一步就得 `.contiguous()`。"},

{id:"m5q2", type:"num", q:"下面代码最后 x.grad 的值是多少？\n\nx = torch.tensor(3.0, requires_grad=True)\ny = x ** 2\ny.backward()\nz = 2 * x\nz.backward()\nprint(x.grad)",
hint:"关键在于 PyTorch 的梯度是**累加**的，不是覆盖的。分别算出两次 backward 各自贡献多少，然后相加。dy/dx = 2x，dz/dx = 2。", ans:8,
why:"**答案是 8。**\n\n- 第一次：`dy/dx = 2x = 6`，此时 x.grad = 6\n- 第二次：`dz/dx = 2`，**累加**上去 → x.grad = 6 + 2 = **8**\n\n**PyTorch 的梯度默认累加，不覆盖。** 这是新手第一大 bug 的根源 —— 训练循环里忘了 `optimizer.zero_grad()`，梯度会把所有历史步骤累加起来，参数更新量越来越离谱，表现为 loss 先降后剧烈震荡或直接 NaN。\n\n**但这个设计不是缺陷，是特性**：梯度累积（gradient accumulation）正是利用它，让你在小显存上模拟大 batch —— 连续几个 micro-batch 都 backward 但不 step，梯度自动累加，最后一次性更新。"},

{id:"m5q3", type:"mc", q:"下面这段验证代码有一个严重问题，是什么？\n\nmodel.train()\nfor x, y in val_loader:\n    out = model(x)\n    acc += (out.argmax(1) == y).sum()",
choices:[
"应该用 model.eval() 并包在 torch.no_grad() 里",
"argmax 的维度参数应该是 0",
"应该用 val_loader.shuffle = True",
"缺少 optimizer.zero_grad()"], ans:0,
hint:"验证阶段和训练阶段有两个关键区别：① Dropout 和 BatchNorm 的行为该不该一样？② 我们需要计算梯度吗？",
why:"**两个问题叠在一起：**\n\n**① 没调 `model.eval()`** → Dropout 仍在随机丢弃神经元，BatchNorm 仍在用当前 batch 的统计量。后果是验证分数**偏低而且每次都不一样**，你会误判模型不稳定，浪费几天调参。\n\n**② 没用 `torch.no_grad()`** → PyTorch 白白构建计算图，**显存占用翻倍、速度明显变慢**，而且 `acc` 累加的是带梯度的张量，会持有整张计算图导致**显存泄漏**（这里还应该用 `.item()` 取出数值）。\n\n正确写法：\n```python\nmodel.eval()\nwith torch.no_grad():\n    for x, y in val_loader:\n        out = model(x)\n        acc += (out.argmax(1) == y).sum().item()\nmodel.train()      # 别忘了切回来\n```\n\n**验证集不 shuffle** 是对的（选项 C 反而是错的建议）—— shuffle 只对训练集有意义。"},

{id:"m5q4", type:"text", q:"训练循环的五个核心步骤，按正确顺序排列。用序号回答，如 12345。\n\n1) loss.backward()\n2) optimizer.zero_grad()\n3) optimizer.step()\n4) out = model(x)\n5) loss = criterion(out, y)",
ans:["24513","2,4,5,1,3","2 4 5 1 3"],
hint:"口诀：清零 → 前向 → 算损失 → 反向 → 更新。想清楚为什么清零必须在最前面（或者说，在 backward 之前）。",
why:"正确顺序是 **2 → 4 → 5 → 1 → 3**：\n\n```python\noptimizer.zero_grad()      # ② 清空上一步残留的梯度\nout = model(x)             # ④ 前向传播\nloss = criterion(out, y)   # ⑤ 计算损失\nloss.backward()            # ① 反向传播，填充 .grad\noptimizer.step()           # ③ 用 .grad 更新参数\n```\n\n**为什么 zero_grad 必须在 backward 之前？** 因为梯度是累加的。如果不清零，这一步算出的梯度会叠加到上一步的残留上，参数更新方向完全错误。\n\n（把 `zero_grad()` 放在 `step()` 之后也可以，效果等价 —— 只要保证每次 `backward()` 之前梯度是干净的。但放开头更不容易忘。）\n\n**这五行要练到肌肉记忆**，白板面试经常直接让你写。"},

{id:"m5q5", type:"num", q:"一个 nn.Linear(512, 256) 层有多少个可训练参数？（含 bias）",
hint:"Linear 层做的是 y = xW^T + b。权重矩阵是 (out_features, in_features) 形状，另外每个输出维度有一个 bias。", ans:131328,
why:"权重：512 × 256 = 131072\nbias：256\n合计 = **131328**\n\n公式：`in × out + out = out × (in + 1)`\n\n**为什么要会算这个？**\n\n面试常问「估算一下这个模型多大」。比如一个 Transformer 层的参数量：\n- 注意力的 Q/K/V/O 四个投影：`4 × d²`\n- FFN 两个矩阵（4 倍中间维）：`8 × d²`\n- 合计约 **12d²** 每层\n\nd=4096、32 层的模型：`12 × 4096² × 32 ≈ 6.4B`，加上 embedding 差不多就是 7B。\n\n能当场估出这种量级，比说「大概几十亿吧」专业得多。\n\n**顺带一个显存账**：7B 模型用 FP16 推理需要约 14GB（每参数 2 字节），用 AdamW 全参训练需要约 112GB（每参数 16 字节：参数+梯度+m+v）—— 这就是为什么必须用 LoRA。"},

{id:"m5q6", type:"open", q:"你的训练脚本跑到一半，显存占用越来越高，最后 OOM 崩溃。列出三个最可能的原因和对应的修法。",
hint:"想想什么东西会在循环中不断累积却没被释放。特别注意：你在循环里往列表或变量里存了什么？验证的时候做了什么？",
ref:"**① 累加了带计算图的张量（最常见）**\n\n```python\ntotal_loss += loss          # ✗ 整张计算图被持有，永远不释放\ntotal_loss += loss.item()   # ✓ 只取出一个 Python 浮点数\n```\n\n把 loss 张量直接累加，等于把每一步的计算图都串起来永久保存。跑几百步显存必爆。凡是只需要数值的地方，一律用 `.item()` 或 `.detach()`。\n\n**② 验证时忘了 `torch.no_grad()`**\n\n验证阶段仍在构建计算图，显存占用翻倍。而且如果验证 batch 比训练 batch 大，很容易正好在验证时爆掉。\n\n```python\nwith torch.no_grad():\n    ...\n```\n\n**③ 在列表里保存了带梯度的中间结果**\n\n```python\nall_preds.append(out)            # ✗\nall_preds.append(out.detach().cpu())   # ✓ 断开梯度并搬到内存\n```\n\n**其他值得排查的：**\n\n- **序列长度变长**：如果数据没做长度分桶，偶然遇到一个超长样本，注意力的 O(n²) 显存会瞬间峰值爆掉。修法：设 `max_length` 截断，或按长度分桶采样。\n- **忘了 `optimizer.zero_grad(set_to_none=True)`**：用 `set_to_none=True` 会真正释放梯度张量，比置零更省显存。\n- **动态图未释放**：在循环里做 `loss.backward(retain_graph=True)` 而没有必要，图不会被释放。\n\n**排查手法：**\n```python\nprint(torch.cuda.memory_allocated() / 1e9, \"GB\")\n```\n在循环里每隔几步打印一次。**如果这个数字单调递增，就是泄漏**（正常训练应该在一个区间内波动）。\n\n更精细的可以用 `torch.cuda.memory_summary()` 或 PyTorch Profiler 看是谁占的。\n\n**治标手段**（真的只是模型太大时）：减小 batch size、开梯度检查点（`gradient_checkpointing_enable()`，用 30% 时间换 60~70% 激活显存）、混合精度、ZeRO 切分优化器状态。"}
]
};
