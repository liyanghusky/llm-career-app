# 跃迁 · LLM 求职训练台

面向「想转机器学习 / 大语言模型岗位」的一站式学习与面试训练 Web App。
纯静态前端，无后端、无依赖，进度存在浏览器本地，打开即用。

**在线使用：** https://liyanghusky.github.io/llm-career-app/

---

## 四个模块

| 模块 | 内容 | 用途 |
|---|---|---|
| **路线图** | 8 个阶段 / 41 个学习单元 | 20 周主线。每个单元写清「为什么学 / 怎么学 / 学到什么程度算过」 |
| **项目库** | 8 个可写进简历的项目 | 分天任务清单 + 可直接改写的简历描述 + 面试官会追问的问题 |
| **题库** | 11 类 / 75 道高频面试题 | 答案按「面试口头作答」的口径写，含加分点与常见陷阱 |
| **刷卡** | 间隔重复记忆卡 | 评「掌握」的卡隔更久再出现；空格翻面，1/2/3 评级 |

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
js/views.js         五个视图的渲染函数
js/app.js           路由与事件委托
data/roadmap.js     学习路线（window.ROADMAP）
data/projects.js    项目库（window.PROJECTS / PROJECT_COMBOS）
data/questions.js   题库（window.QCATS / QUESTIONS）
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

加项目：往 `data/projects.js` 加一条，字段见现有项目。

改完刷新页面即可，无需构建。
