/* 逐段「问 AI 详解」
   两条通路：
   1) Artifact 运行时 claude.use("sample") —— 用查看者自己的 Claude 账号，无需配置
   2) 自带 API key，浏览器直连模型 —— 静态托管（GitHub Pages）下使用
      key 只存在本机 localStorage，只发往你选定的那个服务商，不经过任何第三方
*/
const AIKEY  = "llm-career-ai-v1";
const AICKEY = "llm-career-ai-cfg";

const AI = { sample: null, runtime: false, ctl: {}, active: null, open: new Set(), num: {} };
const AIT = JSON.parse(localStorage.getItem(AIKEY) || "{}");     // aiid -> {turns, open}
let AICFG = Object.assign(
  { mode: "off", key: "", base: "", model: "" },
  JSON.parse(localStorage.getItem(AICKEY) || "{}")
);
function aiSave()    { try { localStorage.setItem(AIKEY, JSON.stringify(AIT)); } catch {} }

/* 布局偏好：栏宽 + 每张卡被拖过的高度 */
const AILKEY = "llm-career-ai-layout";
const AIL = Object.assign({ railW: 0, h: {}, float: {} },
  JSON.parse(localStorage.getItem(AILKEY) || "{}"));
if (!AIL.float) AIL.float = {};
function aiLSave() { try { localStorage.setItem(AILKEY, JSON.stringify(AIL)); } catch {} }
function aiApplyRailW() {
  if (AIL.railW) document.documentElement.style.setProperty("--rail-w", AIL.railW + "px");
  else document.documentElement.style.removeProperty("--rail-w");
}
function aiCfgSave() { try { localStorage.setItem(AICKEY, JSON.stringify(AICFG)); } catch {} }

/* 服务商预设 —— base 为 OpenAI 兼容端点 */
const AI_VENDORS = [
  { id:"anthropic", name:"Anthropic（Claude）", base:"", model:"claude-sonnet-5",
    keyHint:"sk-ant-…", note:"官方支持浏览器直连。效果最好。" },
  { id:"deepseek",  name:"DeepSeek", base:"https://api.deepseek.com/v1", model:"deepseek-chat",
    keyHint:"sk-…", note:"国内可直连，便宜，中文讲解够用。" },
  { id:"moonshot",  name:"Kimi（Moonshot）", base:"https://api.moonshot.cn/v1", model:"moonshot-v1-8k",
    keyHint:"sk-…", note:"国内可直连。" },
  { id:"zhipu",     name:"智谱 GLM", base:"https://open.bigmodel.cn/api/paas/v4", model:"glm-4-flash",
    keyHint:"…", note:"glm-4-flash 免费额度大。" },
  { id:"silicon",   name:"硅基流动", base:"https://api.siliconflow.cn/v1", model:"Qwen/Qwen2.5-14B-Instruct",
    keyHint:"sk-…", note:"聚合多家开源模型。" },
  { id:"openai",    name:"OpenAI", base:"https://api.openai.com/v1", model:"gpt-4o-mini",
    keyHint:"sk-…", note:"国内需自备网络。" },
  { id:"custom",    name:"自定义 OpenAI 兼容端点", base:"", model:"",
    keyHint:"你的 key", note:"本地 Ollama / one-api / 任何兼容服务。" }
];

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

const aiOn = () => AI.runtime || (AICFG.mode !== "off" && !!AICFG.key);

/* ── 统一调用层 ── */
async function aiCall(ctxTurn, turns, question, { onText, signal }) {
  // 1) Artifact 运行时
  if (AI.runtime) {
    const input = [{ role: "user", content: ctxTurn }];
    turns.forEach(m => input.push({ role: m.role, content: m.content }));
    input.push({ role: "user", content: question });
    const { text } = await AI.sample(input, { signal, cache: false, onText: u => onText(u.text) });
    return text;
  }
  // 2) 自带 key
  const v = AI_VENDORS.find(x => x.id === AICFG.mode);
  if (!v) throw { code: "no_config" };
  const msgs = [...turns.map(m => ({ role: m.role, content: m.content })),
                { role: "user", content: question }];
  return AICFG.mode === "anthropic"
    ? anthropicStream(ctxTurn, msgs, { onText, signal })
    : openaiStream(ctxTurn, msgs, { onText, signal });
}

async function readSSE(res, signal, pick, onText) {
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.text()).slice(0, 300); } catch {}
    throw { code: res.status === 401 || res.status === 403 ? "bad_key"
          : res.status === 429 ? "rate_limited" : "http_" + res.status, detail };
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", acc = "";
  for (;;) {
    if (signal?.aborted) { reader.cancel().catch(() => {}); throw { code: "cancelled", text: acc }; }
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      let j; try { j = JSON.parse(raw); } catch { continue; }
      const piece = pick(j);
      if (piece) { acc += piece; onText(acc); }
    }
  }
  if (!acc.trim()) throw { code: "empty_completion" };
  return acc;
}

function anthropicStream(sys, msgs, { onText, signal }) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": AICFG.key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: AICFG.model || "claude-sonnet-5",
      max_tokens: 1600, stream: true, system: sys, messages: msgs
    })
  }).then(r => readSSE(r, signal,
    j => (j.type === "content_block_delta" && j.delta?.type === "text_delta") ? j.delta.text : "",
    onText));
}

function openaiStream(sys, msgs, { onText, signal }) {
  const base = (AICFG.base || "").replace(/\/+$/, "");
  return fetch(base + "/chat/completions", {
    method: "POST", signal,
    headers: { "content-type": "application/json", authorization: "Bearer " + AICFG.key },
    body: JSON.stringify({
      model: AICFG.model, stream: true, max_tokens: 1600,
      messages: [{ role: "system", content: sys }, ...msgs]
    })
  }).then(r => readSSE(r, signal, j => j.choices?.[0]?.delta?.content || "", onText));
}

function aiErr(e) {
  const c = e && e.code;
  if (c === "bad_key")        return "API key 不对，或者没有权限。去 ⚙ 里检查一下。";
  if (c === "rate_limited")   return "请求太频繁，或者余额/额度不够了。等一会儿再试。";
  if (c === "no_config")      return "还没配置 AI。点右上角 ⚙ 设置一下。";
  if (c === "not_granted")    return "你拒绝了这个页面调用 Claude。刷新页面重新允许才能用。";
  if (c === "session_expired")return "登录过期了，重新登录 claude.ai 再试。";
  if (c === "prompt_too_large")return "这段内容太长了，选一小段再问。";
  if (c === "refused")        return "模型不愿意回答，换个问法试试。";
  if (c === "empty_completion")return "没生成出内容，换个问法试试。";
  if (e instanceof TypeError || c === undefined)
    return "连不上这个服务商 —— 多半是它不允许浏览器直连（CORS）。换 Anthropic 或 DeepSeek 试试，它们支持。";
  if (String(c).startsWith("http_")) return "服务商返回错误 " + String(c).slice(5) + "。" + (e.detail || "");
  return "出了点问题，再试一次。";
}

/* ── 内容块装饰 ── */
function aiHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return "a" + (h >>> 0).toString(36);
}
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

function aiWide() { return window.innerWidth >= 1280; }

function aiDecorate() {
  document.body.classList.toggle("ai-on", aiOn());
  if (!aiOn()) {
    document.querySelectorAll(".aibtn").forEach(b => b.remove());
    document.querySelectorAll("[data-aiid]").forEach(e => {
      delete e.dataset.aiid; e.classList.remove("aiblk", "ai-has", "ai-active");
    });
    document.getElementById("airail")?.remove();
    document.body.classList.remove("ai-rail-on");
    return;
  }
  document.querySelectorAll(AI_CONTAINERS.join(",")).forEach(box => {
    box.querySelectorAll(AI_BLOCKS).forEach(el => {
      if (el.dataset.aiid) return;
      const txt = (el.innerText || "").trim();
      if (txt.length < 12) return;
      const id = aiHash(txt.slice(0, 400));
      el.dataset.aiid = id;
      el.classList.add("aiblk");
      const b = document.createElement("button");
      b.className = "aibtn"; b.type = "button";
      b.title = "针对这一段问 AI";
      b.textContent = "詳解";
      b.onclick = ev => { ev.stopPropagation(); aiOpen(id); };
      el.appendChild(b);
    });
  });
  aiRender();
}

/* ── 右侧批注栏 ── */
const AI_RO = new ResizeObserver(() => aiLayoutSoon());
let aiLayoutTimer = null;
function aiLayoutSoon() {
  // 用定时器而不是 rAF：后台标签页里 rAF 会被暂停，布局就停在旧位置
  clearTimeout(aiLayoutTimer);
  aiLayoutTimer = setTimeout(aiLayout, 16);
}

function aiRailEl() {
  let r = document.getElementById("airail");
  if (!r) {
    r = document.createElement("div");
    r.id = "airail"; r.className = "airail";
    document.body.appendChild(r);
  }
  return r;
}

/* 当前页面上有锚点的卡片，按锚点位置从上到下排序 */
function aiCardIds() {
  return Object.keys(AIT)
    .filter(id => document.querySelector('[data-aiid="' + id + '"]'))
    .map(id => ({
      id,
      y: document.querySelector('[data-aiid="' + id + '"]').getBoundingClientRect().top + window.scrollY
    }))
    .sort((p, q) => p.y - q.y)
    .map(x => x.id);
}

function aiBlockText(id) {
  const el = document.querySelector('[data-aiid="' + id + '"]');
  return el ? (el.innerText || "").replace(/詳解\s*$/, "").trim() : "";
}

function aiRender() {
  const ids = aiCardIds();
  document.body.classList.toggle("ai-rail-on", ids.length > 0);
  if (!ids.length) {
    document.getElementById("airail")?.remove();
    const g = document.getElementById("airailgrip"); if (g) g.style.display = "none";
    document.getElementById("ailines")?.remove();
    return;
  }

  AI.num = {};
  ids.forEach((id, i) => { AI.num[id] = i + 1; });

  const rail = aiRailEl();
  rail.innerHTML = ids.map(id => aiCardHTML(id)).join("");
  rail.querySelectorAll(".aicard").forEach(c => AI_RO.observe(c));

  aiApplyRailW();
  aiGripEl();
  document.querySelectorAll("[data-aiid]").forEach(el => {
    const id = el.dataset.aiid;
    el.classList.toggle("ai-has", ids.includes(id));
    el.classList.toggle("ai-active", AI.active === id);
  });
  aiLayoutSoon();
}

function aiCardHTML(id) {
  const t = AIT[id] || { turns: [] };
  const busy = !!AI.ctl[id];
  const active = AI.active === id;
  const full = aiBlockText(id);
  const quote = full.slice(0, 90) + (full.length > 90 ? "…" : "");
  // 展开：正在提问、正在生成、或用户点开了。否则只显示最后一轮回答的前几行
  const expanded = active || busy || AI.open.has(id);
  const last = [...t.turns].reverse().find(m => m.role === "assistant");

  let body;
  if (expanded) {
    body = t.turns.map(m => m.role === "user"
      ? '<div class="ai-u">' + md(m.content) + '</div>'
      : '<div class="ai-a">' + md(m.content) + '</div>').join("") +
      (busy ? '<div class="ai-a" id="ail-' + id + '"><span class="ai-think">正在思考</span></div>' : "");
  } else if (last) {
    body = '<div class="ai-a clamp">' + md(last.content) + '</div>' +
      (t.turns.length > 2 ? '<div class="aic-more">共 ' + t.turns.filter(m => m.role === "user").length + ' 问</div>' : "");
  } else {
    body = '';
  }

  let foot;
  if (busy) {
    foot = '<div class="ai-ctl"><button class="btn sec sm" data-aistop="' + id + '">停止</button></div>';
  } else if (active) {
    foot = '<div class="ai-presets">' +
      AI_PRESETS.map((x, i) => '<button class="fbtn" data-aiask="' + id + ':' + i + '">' + x[0] + '</button>').join("") +
      '</div><div class="ai-ctl">' +
      '<textarea class="ai-ta" data-aita="' + id + '" rows="1" placeholder="哪里不懂就问哪里…"></textarea>' +
      '<button class="btn sm" data-aisend="' + id + '">問</button></div>';
  } else {
    foot = '<div class="ai-ctl">' +
      '<button class="btn sec sm" data-aifocus="' + id + '">' + (t.turns.length ? "继续追问" : "提问") + '</button>' +
      (t.turns.length ? '<button class="btn sec sm" data-aitoggle="' + id + '" style="margin-left:auto">' +
        (expanded ? "收起" : "展开") + '</button>' : "") +
      '</div>';
  }

  const fl = AIL.float[id];
  return '\n  <div class="aicard ' + (active ? "active " : "") + (expanded ? "exp " : "") +
    (fl ? "floating" : "") + '" data-card="' + id + '">\n' +
    '    <div class="aic-head" data-aidrag="' + id + '" ' +
        (fl ? '' : 'data-aiscroll="' + id + '" ') + 'title="' +
        (fl ? '拖动移动窗口' : '拖动可拖出为浮窗，点击跳到原文') + '">\n' +
    '      <span class="aic-n">' + (AI.num[id] || "") + '</span>\n' +
    '      <span class="aic-q">' + quote + '</span>\n' +
    (fl ? '      <button class="ai-x" data-aidock="' + id + '" title="放回原段落旁">↩</button>\n' : '') +
    '      <button class="ai-x" data-aidel="' + id + '" title="删除这条批注">✕</button>\n' +
    '    </div>\n' +
    (body
      ? '    <div class="aic-body" ' + (expanded ? '' : 'data-aitoggle="' + id + '"') +
        (expanded && AIL.h[id] ? ' style="height:' + AIL.h[id] + 'px;max-height:none"' : '') +
        '>' + body + '</div>\n'
      : '') +
    foot +
    (expanded ? '<div class="aic-grip" data-aigrip="' + id + '" title="拖动调整高度，双击还原"></div>' : '') +
    (fl ? '<div class="aic-corner" data-aicorner="' + id + '" title="拖动调整窗口大小"></div>' : '') +
    '\n  </div>';
}

/* 卡片对齐各自的锚点段落，重叠时顺延 */
function aiLayout() {
  const rail = document.getElementById("airail");
  if (!rail) return;
  const cards = [...rail.querySelectorAll(".aicard")];
  if (!aiWide()) {
    rail.classList.add("narrow");
    rail.style.height = "";
    cards.forEach(c => { c.style.top = ""; });
    return;
  }
  rail.classList.remove("narrow");
  const railTop = rail.getBoundingClientRect().top + window.scrollY;
  let prev = 0;
  cards.forEach(c => {
    const id = c.dataset.card;
    const fl = AIL.float[id];
    if (fl) {                                  // 浮窗：固定在视口坐标
      c.style.display = "";
      c.style.top = "";
      c.style.left = Math.round(fl.x) + "px";
      c.style.setProperty("top", Math.round(fl.y) + "px", "important");
      c.style.width = Math.round(fl.w) + "px";
      return;
    }
    c.style.left = ""; c.style.width = "";
    const anchor = document.querySelector('[data-aiid="' + id + '"]');
    if (!anchor) { c.style.display = "none"; return; }
    c.style.display = "";
    const aTop = anchor.getBoundingClientRect().top + window.scrollY - railTop;
    const top = Math.max(aTop, prev);
    c.style.top = top + "px";
    prev = top + c.offsetHeight + 14;
  });
  rail.style.height = (prev + 60) + "px";
  aiDrawLines(cards);
}

/* 从段落右缘牵一条曲线到对应卡片，并在段落侧点一个带编号的锚点 */
function aiLinesEl() {
  let g = document.getElementById("ailines");
  if (!g) {
    g = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    g.id = "ailines"; g.setAttribute("class", "ailines");
    document.body.appendChild(g);
  }
  return g;
}

function aiDrawLines(cards) {
  const svg = aiLinesEl();
  if (!aiWide()) { svg.innerHTML = ""; svg.style.display = "none"; return; }
  svg.style.display = "";
  svg.setAttribute("width", document.documentElement.scrollWidth);
  svg.setAttribute("height", document.documentElement.scrollHeight);

  const NS = "http://www.w3.org/2000/svg";
  const parts = [];
  cards.forEach(c => {
    const id = c.dataset.card;
    const a = document.querySelector('[data-aiid="' + id + '"]');
    if (!a || c.style.display === "none") return;
    const ar = a.getBoundingClientRect(), cr = c.getBoundingClientRect();
    // 锚点滚出视口太远时不画线，避免横跨整页的长线
    if (AIL.float[id] && (ar.bottom < -80 || ar.top > innerHeight + 80)) return;
    const x1 = ar.right + scrollX + 6;
    const y1 = ar.top + scrollY + Math.min(ar.height / 2, 13);
    const x2 = cr.left + scrollX - 5;
    const y2 = cr.top + scrollY + 20;
    const mid = (x1 + x2) / 2;
    parts.push(
      '<path class="ailine" data-for="' + id + '" d="M ' + x1 + ' ' + y1 +
      ' C ' + mid + ' ' + y1 + ', ' + mid + ' ' + y2 + ', ' + x2 + ' ' + y2 + '"/>' +
      '<circle class="aidot" data-for="' + id + '" cx="' + x1 + '" cy="' + y1 + '" r="3.5"/>' +
      '<text class="ainum" data-for="' + id + '" x="' + (x1 + 11) + '" y="' + (y1 + 4) + '">' +
      (AI.num[id] || "") + '</text>');
  });
  svg.innerHTML = parts.join("");
}

/* ── 拖拽调整：批注栏宽度 ── */
function aiGripEl() {
  let g = document.getElementById("airailgrip");
  if (!g) {
    g = document.createElement("div");
    g.id = "airailgrip"; g.className = "airailgrip";
    g.title = "左右拖动调整批注栏宽度，双击还原";
    document.body.appendChild(g);
    g.addEventListener("mousedown", ev => {
      ev.preventDefault();
      document.body.classList.add("ai-dragging");
      const gap = parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue("--rail-gap")) || 46;
      const move = e => {
        const w = window.innerWidth - e.clientX - gap;
        const max = Math.min(900, window.innerWidth - 520);
        AIL.railW = Math.round(Math.max(360, Math.min(max, w)));
        aiApplyRailW();
        aiLayoutSoon();
      };
      const up = () => {
        document.body.classList.remove("ai-dragging");
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        aiLSave(); aiLayoutSoon();
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
    g.addEventListener("dblclick", () => {
      AIL.railW = 0; aiApplyRailW(); aiLSave(); aiLayoutSoon();
    });
  }
  g.style.display = aiWide() && document.body.classList.contains("ai-rail-on") ? "" : "none";
  return g;
}

/* ── 拖拽：把卡片拖成浮窗，或移动已有浮窗 ── */
document.addEventListener("mousedown", e => {
  const head = e.target.closest("[data-aidrag]");
  if (!head || e.target.closest("button")) return;
  const id = head.dataset.aidrag;
  const card = head.closest(".aicard");
  const r0 = card.getBoundingClientRect();
  const sx = e.clientX, sy = e.clientY;
  const offX = sx - r0.left, offY = sy - r0.top;
  let moved = false;

  const move = ev => {
    if (!moved && Math.abs(ev.clientX - sx) < 4 && Math.abs(ev.clientY - sy) < 4) return;
    if (!moved) {                                   // 越过阈值才脱锚
      moved = true;
      document.body.classList.add("ai-dragging-card");
      card.classList.add("floating", "nodrag-anim");
      AIL.float[id] = { x: r0.left, y: r0.top, w: r0.width };
    }
    const w = AIL.float[id].w;
    AIL.float[id].x = Math.max(8, Math.min(innerWidth - w - 8, ev.clientX - offX));
    AIL.float[id].y = Math.max(8, Math.min(innerHeight - 60, ev.clientY - offY));
    card.style.left = Math.round(AIL.float[id].x) + "px";
    card.style.setProperty("top", Math.round(AIL.float[id].y) + "px", "important");
    card.style.width = Math.round(w) + "px";
    aiLayoutSoon();
  };
  const up = () => {
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
    document.body.classList.remove("ai-dragging-card");
    card.classList.remove("nodrag-anim");
    if (moved) { aiLSave(); aiRender(); }
  };
  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);
});

/* 浮窗右下角：同时改宽高 */
document.addEventListener("mousedown", e => {
  const corner = e.target.closest("[data-aicorner]");
  if (!corner) return;
  e.preventDefault(); e.stopPropagation();
  const id = corner.dataset.aicorner;
  const card = corner.closest(".aicard");
  const bodyEl = card.querySelector(".aic-body");
  const sx = e.clientX, sy = e.clientY;
  const w0 = card.offsetWidth, h0 = bodyEl ? bodyEl.offsetHeight : 0;
  document.body.classList.add("ai-dragging-corner");
  const move = ev => {
    const w = Math.max(300, Math.min(900, w0 + ev.clientX - sx));
    AIL.float[id].w = Math.round(w);
    card.style.width = AIL.float[id].w + "px";
    if (bodyEl) {
      const h = Math.max(80, Math.min(900, h0 + ev.clientY - sy));
      AIL.h[id] = Math.round(h);
      bodyEl.style.height = h + "px";
      bodyEl.style.maxHeight = "none";
    }
    aiLayoutSoon();
  };
  const up = () => {
    document.body.classList.remove("ai-dragging-corner");
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
    aiLSave(); aiLayoutSoon();
  };
  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);
});

/* 浮窗时滚动要重画连线（卡片是视口坐标，锚点是文档坐标） */
addEventListener("scroll", () => {
  if (Object.keys(AIL.float).length) aiLayoutSoon();
}, { passive: true });

/* ── 拖拽调整：单张卡片高度 ── */
document.addEventListener("mousedown", e => {
  const grip = e.target.closest("[data-aigrip]");
  if (!grip) return;
  e.preventDefault();
  const id = grip.dataset.aigrip;
  const card = grip.closest(".aicard");
  const bodyEl = card.querySelector(".aic-body");
  if (!bodyEl) return;
  const startY = e.clientY, startH = bodyEl.offsetHeight;
  document.body.classList.add("ai-dragging-v");
  const move = ev => {
    const h = Math.max(80, Math.min(900, startH + (ev.clientY - startY)));
    AIL.h[id] = Math.round(h);
    bodyEl.style.height = h + "px";
    bodyEl.style.maxHeight = "none";
    aiLayoutSoon();
  };
  const up = () => {
    document.body.classList.remove("ai-dragging-v");
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
    aiLSave(); aiLayoutSoon();
  };
  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);
});
document.addEventListener("dblclick", e => {
  const grip = e.target.closest("[data-aigrip]");
  if (!grip) return;
  delete AIL.h[grip.dataset.aigrip];
  aiLSave(); aiRender();
});

/* 悬停卡片时点亮它那条线和对应段落 */
document.addEventListener("mouseover", e => {
  const card = e.target.closest?.(".aicard");
  const id = card?.dataset.card;
  document.querySelectorAll(".ailine,.aidot,.ainum").forEach(n =>
    n.classList.toggle("hot", !!id && n.dataset.for === id));
  document.querySelectorAll("[data-aiid]").forEach(n =>
    n.classList.toggle("ai-hover", !!id && n.dataset.aiid === id));
});
window.addEventListener("resize", aiLayoutSoon);

function aiOpen(id) {
  AIT[id] = AIT[id] || { turns: [] };
  AI.active = id;
  aiSave(); aiRender();
  setTimeout(() => {
    const card = document.querySelector('.aicard[data-card="' + id + '"]');
    card?.querySelector(".ai-ta")?.focus({ preventScroll: true });
    if (!aiWide()) card?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 60);
}

function aiRemove(id) {
  delete AIT[id];
  delete AIL.float[id]; delete AIL.h[id]; aiLSave();
  if (AI.active === id) AI.active = null;
  aiSave(); aiRender();
}

async function aiAsk(id, question) {
  if (!aiOn() || AI.ctl[id]) return;
  const el = document.querySelector('[data-aiid="' + id + '"]');
  if (!el) return;
  const t = (AIT[id] = AIT[id] || { turns: [] });
  const blockText = aiBlockText(id).slice(0, 3000);
  const ctxTurn = AI_RULES + "\n\n" + aiCtx(el) +
    '\n\n学习者正在看的这段内容：\n"""\n' + blockText + '\n"""';

  t.turns.push({ role: "user", content: question });
  const ctl = new AbortController();
  AI.ctl[id] = ctl;
  AI.active = id;
  aiSave(); aiRender();

  try {
    const text = await aiCall(ctxTurn, t.turns.slice(0, -1), question, {
      signal: ctl.signal,
      onText: txt => {
        const live = document.getElementById("ail-" + id);
        if (live) { live.innerHTML = md(txt); aiLayoutSoon(); }
      }
    });
    t.turns.push({ role: "assistant", content: text });
  } catch (e) {
    if (e && (e.code === "cancelled" || e.name === "AbortError")) {
      if (e.text) t.turns.push({ role: "assistant", content: e.text + "\n\n*（已停止）*" });
      else t.turns.pop();
    } else if (e && e.text) {
      t.turns.push({ role: "assistant", content: e.text + "\n\n*（回答被中断）*" });
    } else {
      t.turns.push({ role: "assistant", content: "*" + aiErr(e) + "*" });
    }
  } finally {
    delete AI.ctl[id];
    AI.open.add(id);            // 刚问完的保持展开
    aiSave(); aiRender();
  }
}

/* ── 设置面板（嵌在 ⚙ 弹窗里）── */
function aiSettingsHTML() {
  if (AI.runtime) {
    return `<div class="rbox">正在 Claude Artifact 里运行，<b>詳解已自动可用</b>，用的是你自己的 Claude 账号，不需要配置 API key。</div>`;
  }
  const v = AI_VENDORS.find(x => x.id === AICFG.mode);
  return `
  <p class="tiny muted" style="margin-bottom:12px">
    静态网页没法直接借用 Claude，需要你自己的 API key 才能开启「詳解」。
    <b>key 只保存在这台设备的浏览器里</b>，请求直接从你的浏览器发往你选的服务商，不经过我或任何第三方。
  </p>
  <div class="aicfg">
    <label>服务商</label>
    <select id="aiVendor">
      <option value="off"${AICFG.mode === "off" ? " selected" : ""}>关闭詳解</option>
      ${AI_VENDORS.map(x => `<option value="${x.id}"${AICFG.mode === x.id ? " selected" : ""}>${x.name}</option>`).join("")}
    </select>
    ${v ? `<p class="tiny muted" style="margin:-4px 0 4px">${v.note}</p>` : ""}
    ${AICFG.mode !== "off" ? `
      <label>API Key</label>
      <input id="aiKey" type="password" autocomplete="off" spellcheck="false"
             placeholder="${v ? v.keyHint : ""}" value="${AICFG.key ? AICFG.key.replace(/./g, "•") : ""}"
             data-has="${AICFG.key ? 1 : 0}">
      ${AICFG.mode !== "anthropic" ? `
        <label>接口地址（OpenAI 兼容）</label>
        <input id="aiBase" spellcheck="false" value="${AICFG.base || ""}" placeholder="https://api.example.com/v1">` : ""}
      <label>模型</label>
      <input id="aiModel" spellcheck="false" value="${AICFG.model || ""}" placeholder="${v ? v.model : ""}">
      <div style="display:flex;gap:9px;margin-top:6px;align-items:center;flex-wrap:wrap">
        <button class="btn sm" id="aiSaveBtn">保存</button>
        <button class="btn sec sm" id="aiTestBtn">测试连接</button>
        <span id="aiTestMsg" class="tiny muted"></span>
      </div>` : ""}
  </div>`;
}

async function aiTest(msgEl) {
  msgEl.textContent = "连接中…";
  try {
    const txt = await aiCall("你是一个测试用的助手。", [], "只回复两个字：可以", { onText: () => {} });
    msgEl.textContent = "✓ 通了：" + txt.trim().slice(0, 20);
    msgEl.style.color = "var(--ok)";
  } catch (e) {
    msgEl.textContent = "✕ " + aiErr(e);
    msgEl.style.color = "var(--bad)";
  }
}

/* ── 事件（独立监听，不触发全局 render，避免打断流式输出）── */
document.addEventListener("click", e => {
  const ask = e.target.closest("[data-aiask]");
  if (ask) { const [id, i] = ask.dataset.aiask.split(":"); aiAsk(id, AI_PRESETS[+i][1]); return; }

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

  const del = e.target.closest("[data-aidel]");
  if (del) { e.stopPropagation(); aiRemove(del.dataset.aidel); return; }
  const dock = e.target.closest("[data-aidock]");
  if (dock) {
    const id = dock.dataset.aidock;
    delete AIL.float[id];
    aiLSave(); aiRender();
    document.querySelector('[data-aiid="' + id + '"]')
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const foc = e.target.closest("[data-aifocus]");
  if (foc) { aiOpen(foc.dataset.aifocus); return; }
  const tg = e.target.closest("[data-aitoggle]");
  if (tg) {
    const id = tg.dataset.aitoggle;
    AI.open.has(id) ? AI.open.delete(id) : AI.open.add(id);
    aiRender(); return;
  }
  const scr = e.target.closest("[data-aiscroll]");
  if (scr) {
    document.querySelector('[data-aiid="' + scr.dataset.aiscroll + '"]')
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (e.target.id === "aiSaveBtn") {
    const keyEl = document.getElementById("aiKey");
    if (keyEl && !/^•+$/.test(keyEl.value)) AICFG.key = keyEl.value.trim();
    const baseEl = document.getElementById("aiBase");
    const vend = AI_VENDORS.find(x => x.id === AICFG.mode);
    AICFG.base = baseEl ? baseEl.value.trim() : (vend ? vend.base : "");
    if (!AICFG.base && vend) AICFG.base = vend.base;
    const mEl = document.getElementById("aiModel");
    AICFG.model = (mEl && mEl.value.trim()) || (vend ? vend.model : "");
    aiCfgSave();
    const msg = document.getElementById("aiTestMsg");
    if (msg) { msg.textContent = "已保存"; msg.style.color = "var(--ok)"; }
    aiDecorate();
    return;
  }
  if (e.target.id === "aiTestBtn") { aiTest(document.getElementById("aiTestMsg")); return; }
}, true);

document.addEventListener("change", e => {
  if (e.target.id === "aiVendor") {
    const vend = AI_VENDORS.find(x => x.id === e.target.value);
    AICFG.mode = e.target.value;
    if (vend) { AICFG.base = vend.base; AICFG.model = vend.model; }
    aiCfgSave();
    const box = document.querySelector(".aicfg")?.parentElement;
    if (box) box.innerHTML = aiSettingsHTML();
    aiDecorate();
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

document.addEventListener("input", e => {
  const ta = e.target.closest?.("[data-aita]");
  if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; }
  if (e.target.id === "aiKey" && e.target.dataset.has === "1") {
    e.target.dataset.has = "0";                       // 开始改了就不再当作掩码
  }
}, true);

document.addEventListener("keydown", e => {
  if (e.key === "Escape" && AI.active && document.getElementById("modal")?.hidden !== false) {
    AI.active = null; aiRender();
  }
}, true);

/* ── 启动：优先 Artifact 运行时 ── */
(async () => {
  if (window.claude && typeof window.claude.use === "function") {
    let s = null;
    try { s = await window.claude.use("sample"); } catch { s = null; }
    if (s) { AI.sample = s; AI.runtime = true; }
  }
  aiDecorate();
})();
