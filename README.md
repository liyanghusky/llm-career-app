# 跃迁 · LLM 求职训练台

面向「想转机器学习 / 大语言模型岗位」的一站式学习与面试训练 Web App。
纯静态前端，无后端、无依赖，进度存在浏览器本地，打开即用。

**两个地址，功能完全一致：**

- **静态版** — https://liyanghusky.github.io/llm-career-app/ （填一次 API key 即可开启詳解）
- **Artifact 版** — https://claude.ai/artifact/UbCacFuqM3WWL4VNw8i46k （无需配置，自动可用）

界面是**侘寂 / 和紙**风格：米白纸张底纹、墨色正文、陶土色点缀、发丝级分隔线、衬线字体，
和 [渡 / Kindle-Sender](https://github.com/liyanghusky) 同一套视觉语言。

### ✦ 逐段問 AI 詳解

课程正文、题目解析、算法题思路的**每一个段落**，鼠标移上去都会出现「詳解」。
点开是一个批注式面板：

- 5 个预设追问：更简单地讲一遍 / 举个具体例子 / 为什么是这样 / 面试会怎么问 / 和什么有关联
- 也可以自由提问，支持多轮对话，流式输出，可随时停止
- 自动带上上下文：课程名、小节名、所属题目、你选中的那段原文
- 助教人设固定为「面向高中理科基础，先讲直觉再讲严谨，解释每个符号，高频考点补一行面试要点」
- 对话存在浏览器本地，关掉再打开还在

**两条通路，自动择优：**

| 环境 | 通路 | 需要配置 |
|---|---|---|
| Artifact 版 | Artifact 运行时的 `sample` capability，走你自己的 Claude 账号 | 无 |
| 静态版 | 浏览器直连模型 API | 点 ⚙ 填一个 API key |

静态版支持 Anthropic（官方允许浏览器直连）以及任意 OpenAI 兼容端点，内置 DeepSeek、
Kimi、智谱 GLM、硅基流动、OpenAI 的预设，也可填自定义地址（本地 Ollama / one-api 都行）。

> **关于 key 的安全性**：key 只写进你这台设备的 `localStorage`，请求由你的浏览器直接发往你选的
> 服务商，不经过 GitHub Pages、不经过任何中间服务器，仓库里也没有任何 key。
> 想撤销随时在 ⚙ 里把服务商切回「关闭詳解」，或清空浏览器数据。
> 如果某个服务商报「连不上」，通常是它不允许浏览器跨域直连（CORS）—— Anthropic 和 DeepSeek 可以。

---

## 四个模块

| 模块 | 内容 | 用途 |
|---|---|---|
| **路线图** | 8 个阶段 / 41 个学习单元 | 20 周主线。每个单元写清「为什么学 / 怎么学 / 学到什么程度算过」 |
| **阶段 0 课程** | 5 节完整教材 / 33 道课后题 | 从「向量是什么」讲起，不预设大学基础。**课后题不给答案**，要自己算 |
| **项目库** | 8 个可写进简历的项目 | 分天任务清单 + 可直接改写的简历描述 + 面试官会追问的问题 |
| **题库** | 11 类 / 75 道高频面试题 | 答案按「面试口头作答」的口径写，含加分点与常见陷阱 |
| **刷卡** | 间隔重复记忆卡 | 评「掌握」的卡隔更久再出现；空格翻面，1/2/3 评级 |
| **算法题** | 10 组 / 50 道精选 LeetCode | 按模式分组，分层提示，解法默认折叠，逼你先自己想 |

### 阶段 0 的完整课程

面向**有高中理科基础、没学过线代和概率论**的自学者，从零讲起：

1. **线性代数** — 向量 → 点积 → 矩阵作为变换 → 矩阵乘法 → 秩 → SVD → 算一笔 LoRA 的账
2. **概率统计** — 条件概率 → 贝叶斯（含癌症检测悖论）→ 期望方差 → 极大似然 → 推出交叉熵
3. **微积分与优化** — 导数 → 梯度 → 链式法则 → **手算一次完整反向传播** → SGD 到 AdamW
4. **Python 工程** — 环境管理、项目结构、numpy 向量化与广播、调试清单、Git
5. **PyTorch** — Tensor → autograd 原理 → nn.Module → 完整训练循环（要求闭卷默写）

**课后题的设计**：填空/选择/开放三种题型，提交后才判对错。答错可重试，卡住有分层提示，
试满两次才解锁「放弃看解析」。开放题必须先写下自己的答案才能看参考答案 —— 不给你抄近路的机会。

### 路线图阶段

0. 地基（数学 / PyTorch）→ 1. 经典机器学习 → 2. 深度学习与 NLP →
3. **Transformer 与 LLM 原理** → 4. 微调与对齐 → 5. RAG 与 Agent →
6. 推理部署与工程化 → 7. 冲刺求职

### 题库分类

数学&统计 · 经典机器学习 · 深度学习 · NLP 基础 · **Transformer & LLM** ·
训练&对齐 · **RAG & Agent** · 推理&部署 · LLM 系统设计 · 手撕代码 · 行为面&简历

### 项目组合（按目标岗位挑 3 个）

- **RAG / LLM 应用工程师** — 需求量最大、转行最现实
- **算法工程师（LLM 方向）** — 手写 Transformer + 微调 + 评估体系
- **AI Infra / 推理优化** — 竞争者最少，适合有后端/系统背景
- **垂直行业解决方案** — 知识库 + 领域微调 + 文档理解

---

## 本地运行

任意静态服务器即可：

```bash
python -m http.server 8811
```

然后打开 http://localhost:8811

## 数据与备份

所有进度（勾选状态、题目评级、项目步骤、连续天数）存在浏览器 `localStorage`，
**不会上传任何地方**。换设备或清缓存前，点右上角 ⚙ 导出 JSON 备份。

## 项目结构

```
index.html          应用外壳
css/app.css         深色技术台面主题
js/store.js         状态 / localStorage / 间隔重复 / markdown 渲染
js/views.js         各视图的渲染函数
js/ai.js            逐段 AI 詳解（Artifact sample / 自带 key 直连两条通路）
js/app.js           路由与事件委托
artifact.html       Artifact 版入口（无 doctype/head/body，由平台包壳）
data/roadmap.js     学习路线（window.ROADMAP）
data/projects.js    项目库（window.PROJECTS / PROJECT_COMBOS）
data/questions.js   题库（window.QCATS / QUESTIONS）
data/lessons1.js    阶段 0 课程：线代 / 概率 / 微积分（window.LESSONS）
data/lessons2.js    阶段 0 课程：Python / PyTorch
data/leetcode.js    算法题（window.LC_INTRO / LC_GROUPS）
```

数据层用 JS 全局变量而非 `fetch`，因此 `file://` 直接双击 `index.html` 也能跑。

## 扩展内容

加题目：往 `data/questions.js` 的 `QUESTIONS` 数组里加一条

```js
{ id:"x1", cat:"llm", level:2, tags:["注意力"],
  q:"问题…", a:"答案，支持 **粗体** `代码` 列表 表格 和 ```代码块```" }
```

加学习单元：往 `data/roadmap.js` 对应阶段的 `nodes` 里加
`{ id, name, est, why, how, check, res:[[名称, 链接]] }`。

给某个学习单元加课程：在 `window.LESSONS` 里用**该单元的 id 作 key**，路线图会自动出现
「开始学习」按钮。结构：

```js
window.LESSONS.s1n1 = {
  title, sub, est,
  sections: [{ h:"小节标题", b:"markdown 正文" }],
  quiz: [
    { id, type:"num",  q, hint, ans: 42, tol: 0.01, why },
    { id, type:"mc",   q, hint, choices:[...], ans: 1, why },
    { id, type:"text", q, hint, ans:["可接受答案1","答案2"], why },
    { id, type:"open", q, hint, ref:"参考答案" },
  ]
};
```

正文的 markdown 额外支持 `### 小标题`、`> 提示框`、以及独占一行的 `$$公式$$`。

加项目：往 `data/projects.js` 加一条，字段见现有项目。

改完刷新页面即可，无需构建。
