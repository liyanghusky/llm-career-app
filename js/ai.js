/* 逐块「问 AI 详解」
   只在 Artifact 运行时可用（claude.use("sample")）。
   静态托管（GitHub Pages）下 window.claude 不存在 → 整个功能静默隐藏。
*/
const AIKEY = "llm-career-ai-v1";
const AI = { sample: null, ready: false, ctl: {} };
const AIT = JSON.parse(localStorage.getItem(AIKEY) || "{}");   // aiid -> {turns, open}
function aiSave() { try { localStorage.setItem(AIKEY, JSON.stringify(AIT)); } catch {} }

const AI_PRESETS = [
  ["更简单地讲一遍", "这一段我没看懂，请用更简单的话、从头讲一遍，可以打比方。"],
  ["举个具体例子", "给我一个具体的、带真实数字的例子，一步步演算给我看。"],
  ["为什么是这样", "为什么是这样？请把背后的道理或推导讲清楚，不要只告诉我结论。"],
  ["面试会怎么问", "面试官会围绕这个知识点问什么？给我 2-3 个典型问法和满分答法的要点。"],
  ["和什么有关联", "这个知识点和我学的其他东西（机器学习 / 大模型）有什么联系？它在实际工作里用在哪？"]
];

const AI_RULES = `你是一个机器学习/大语言模型自学网站的助教。

学习者的情况：高中理科基础，聪明、逻辑好，但没有系统学过大学线性代数、概率论和机器学习。他正在自学准备找 LLM 相关的工作。

回答规则：
- 用中文，口语化、直接。不要开场白，不要「好的，我来为你解释」这类客套，直接进入正题。
- 先给直觉，再给严谨表述。能打比方就打比方，能举带数字的具体例子就举。
- 出现公式时，把每一个符号分别说明是什么意思，不要假设他认识。
- 不要重复他已经看到的原文，要补充原文没讲透的部分。
- 如果这个点是面试高频考点，最后用一行点出「面试要点」。
- 默认控制在 400 字以内。他明确要求展开时才写长。
- 可以用 markdown：**粗体**、\`代码\`、- 列表、\`\`\`代码块\`\`\`。不要用一级二级标题。`;

function aiHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return "a" + (h >>> 0).toString(36);
}

/* 哪些容器里的内容块可以被追问 */
const AI_CONTAINERS = [".lsec", ".qz-q", ".qz-why", ".qz-hint", ".q-b",
  ".lcp-b", ".lc-pattern", ".lc-intro", ".node-d", ".keybox", ".hint-on"];
const AI_BLOCKS = ":scope > p, :scope > pre, :scope > blockquote, :scope > table, " +
  ":scope > .formula, :scope > .lh3, :scope > ul > li, :scope > ol > li";

function aiCtx(el) {
  const lesson = document.querySelector(".lhead h1")?.textContent || "";
  const sec = el.closest(".lsec")?.querySelector("h2")?.textContent || "";
  const qz = el.closest(".qz")?.querySelector(".qz-q")?.innerText.replace(/^\d+\s*/, "") || "";
  const lcp = el.closest(".lcp")?.querySelector(".lcp-t b")?.textContent || "";
  const parts = [];
  if (lesson) parts.push(`课程：《${lesson}》`);
  if (sec) parts.push(`小节：${sec}`);
  if (qz) parts.push(`所属题目：${qz.slice(0, 120)}`);
  if (lcp) parts.push(`所属算法题：${lcp}`);
  return parts.join("\n");
}

function aiDecorate() {
  if (!AI.ready) return;
  document.querySelectorAll(AI_CONTAINERS.join(",")).forEach(box => {
    box.querySelectorAll(AI_BLOCKS).forEach(el => {
      if (el.dataset.aiid) return;
      const txt = (el.innerText || "").trim();
      if (txt.length < 12) return;                       // 太短的不值得问
      const id = aiHash(txt.slice(0, 400));
      el.dataset.aiid = id;
      el.classList.add("aiblk");
      const b = document.createElement("button");
      b.className = "aibtn";
      b.type = "button";
      b.title = "让 AI 详细解释这一段";
      b.textContent = "详解";
      b.onclick = ev => { ev.stopPropagation(); aiToggle(id, el); };
      el.appendChild(b);
      if (AIT[id] && AIT[id].open) aiMount(id, el);
    });
  });
}

function aiToggle(id, el) {
  AIT[id] = AIT[id] || { turns: [], open: false };
  AIT[id].open = !AIT[id].open;
  aiSave();
  if (AIT[id].open) {
    aiMount(id, el);
    if (!AIT[id].turns.length) {
      const p = document.getElementById("aip-" + id);
      p?.querySelector(".ai-ta")?.focus();
    }
  } else {
    document.getElementById("aip-" + id)?.remove();
  }
}

function aiMount(id, el) {
  if (document.getElementById("aip-" + id)) return;
  const p = document.createElement("div");
  p.className = "aipanel";
  p.id = "aip-" + id;
  el.insertAdjacentElement("afterend", p);
  aiPaint(id);
}

function aiPaint(id) {
  const p = document.getElementById("aip-" + id);
  if (!p) return;
  const t = AIT[id] || { turns: [] };
  const busy = !!AI.ctl[id];

  p.innerHTML = `
    <div class="ai-head">
      <span class="ai-tag">AI 详解</span>
      ${t.turns.length ? `<button class="ai-x" data-aiclear="${id}" title="清空这段对话">清空</button>` : ""}
      <button class="ai-x" data-aiclose="${id}" title="收起">✕</button>
    </div>
    <div class="ai-body">
      ${t.turns.map(m => m.role === "user"
        ? `<div class="ai-u">${md(m.content)}</div>`
        : `<div class="ai-a">${md(m.content)}</div>`).join("")}
      ${busy ? `<div class="ai-a ai-live" id="ail-${id}"><span class="ai-think">正在思考…</span></div>` : ""}
    </div>
    ${busy
      ? `<div class="ai-ctl"><button class="btn sec sm" data-aistop="${id}">停止</button></div>`
      : `<div class="ai-presets">
           ${AI_PRESETS.map((x, i) => `<button class="fbtn" data-aiask="${id}:${i}">${x[0]}</button>`).join("")}
         </div>
         <div class="ai-ctl">
           <textarea class="ai-ta" data-aita="${id}" rows="1"
             placeholder="哪里不懂就问哪里…"></textarea>
           <button class="btn sm" data-aisend="${id}">问</button>
         </div>`}
  `;
}

async function aiAsk(id, question) {
  if (!AI.ready || AI.ctl[id]) return;
  const el = document.querySelector(`[data-aiid="${id}"]`);
  if (!el) return;

  const t = (AIT[id] = AIT[id] || { turns: [], open: true });
  const blockText = (el.innerText || "").replace(/详解$/, "").trim().slice(0, 3000);

  // 第一轮带上完整上下文；后续只追加问题（页面自己维护对话）
  const input = [{ role: "user", content: `${AI_RULES}\n\n${aiCtx(el)}\n\n学习者正在看的这段内容：\n"""\n${blockText}\n"""` }];
  t.turns.forEach(m => input.push({ role: m.role, content: m.content }));
  input.push({ role: "user", content: question });

  t.turns.push({ role: "user", content: question });
  const ctl = new AbortController();
  AI.ctl[id] = ctl;
  aiSave(); aiPaint(id);

  let acc = "";
  try {
    const { text } = await AI.sample(input, {
      signal: ctl.signal,
      cache: false,
      onText: ({ text }) => {
        acc = text;
        const live = document.getElementById("ail-" + id);
        if (live) live.innerHTML = md(text);
      }
    });
    t.turns.push({ role: "assistant", content: text });
  } catch (e) {
    const keep = e && e.text;
    if (keep) t.turns.push({ role: "assistant", content: keep + "\n\n*（回答被中断）*" });
    else if (e && e.code === "cancelled") { /* 用户主动停止，不留痕 */ }
    else t.turns.push({ role: "assistant", content: "*" + aiErr(e && e.code) + "*" });
  } finally {
    delete AI.ctl[id];
    aiSave(); aiPaint(id);
  }
}

function aiErr(code) {
  switch (code) {
    case "not_granted": return "你拒绝了这个页面调用 Claude。刷新页面后重新允许才能用。";
    case "rate_limited": return "问得太快了，或者今天的用量到上限了。等一会儿再试。";
    case "session_expired": return "登录过期了，重新登录 claude.ai 再试。";
    case "prompt_too_large": return "这段内容太长了，选一小段再问。";
    case "refused": return "Claude 不愿意回答这个问题，换个问法试试。";
    case "empty_completion": return "没生成出内容，换个问法试试。";
    default: return "出了点问题，再试一次。";
  }
}

/* ── 事件（独立监听，不触发全局 render，避免打断流式输出）── */
document.addEventListener("click", e => {
  const ask = e.target.closest("[data-aiask]");
  if (ask) {
    const [id, i] = ask.dataset.aiask.split(":");
    aiAsk(id, AI_PRESETS[+i][1]);
    return;
  }
  const send = e.target.closest("[data-aisend]");
  if (send) {
    const id = send.dataset.aisend;
    const ta = document.querySelector(`[data-aita="${id}"]`);
    const v = (ta?.value || "").trim();
    if (v) { ta.value = ""; aiAsk(id, v); }
    return;
  }
  const stop = e.target.closest("[data-aistop]");
  if (stop) { AI.ctl[stop.dataset.aistop]?.abort(); return; }
  const cls = e.target.closest("[data-aiclose]");
  if (cls) {
    const id = cls.dataset.aiclose;
    AIT[id].open = false; aiSave();
    document.getElementById("aip-" + id)?.remove();
    return;
  }
  const clr = e.target.closest("[data-aiclear]");
  if (clr) {
    const id = clr.dataset.aiclear;
    AIT[id].turns = []; aiSave(); aiPaint(id);
    return;
  }
}, true);

document.addEventListener("keydown", e => {
  const ta = e.target.closest?.("[data-aita]");
  if (ta && e.key === "Enter" && !e.shiftKey) {
    e.preventDefault(); e.stopPropagation();
    const v = ta.value.trim();
    if (v) { ta.value = ""; aiAsk(ta.dataset.aita, v); }
  }
}, true);

/* 输入框自动长高 */
document.addEventListener("input", e => {
  const ta = e.target.closest?.("[data-aita]");
  if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; }
}, true);

/* ── 启动 ── */
(async () => {
  if (!window.claude || typeof window.claude.use !== "function") return;
  let s = null;
  try { s = await window.claude.use("sample"); } catch { s = null; }
  if (!s) return;
  AI.sample = s;
  AI.ready = true;
  document.body.classList.add("ai-on");
  aiDecorate();
})();
