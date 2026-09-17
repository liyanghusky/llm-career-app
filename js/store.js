/* 状态管理 + 本地存储 + 轻量 markdown 渲染 */
const KEY = "llm-career-v1";

const S = Object.assign(
  { nodes: {}, q: {}, steps: {}, days: [], fav: {}, quiz: {}, lc: {}, infra: {}, iq: {}, lab: {}, ipj: {} },
  JSON.parse(localStorage.getItem(KEY) || "{}")
);
if (!S.quiz) S.quiz = {};
if (!S.lc) S.lc = {};
if (!S.infra) S.infra = {};
if (!S.iq) S.iq = {};
if (!S.lab) S.lab = {};
if (!S.ipj) S.ipj = {};

function save() {
  const t = today();
  if (!S.days.includes(t)) S.days.push(t);
  localStorage.setItem(KEY, JSON.stringify(S));
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function streak() {
  if (!S.days.length) return 0;
  const set = new Set(S.days);
  let n = 0, d = new Date();
  // 今天没学也允许从昨天往回数
  if (!set.has(today())) d.setDate(d.getDate() - 1);
  for (;;) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!set.has(k)) break;
    n++; d.setDate(d.getDate() - 1);
  }
  return n;
}

/* ── 进度统计 ── */
const allNodes = () => ROADMAP.flatMap(s => s.nodes);
function stageProg(st) {
  const done = st.nodes.filter(n => S.nodes[n.id]).length;
  return { done, total: st.nodes.length, pct: Math.round(done / st.nodes.length * 100) };
}
function roadProg() {
  const all = allNodes();
  const done = all.filter(n => S.nodes[n.id]).length;
  return { done, total: all.length, pct: Math.round(done / all.length * 100) };
}
function qProg() {
  const m = Object.values(S.q);
  const got = m.filter(x => x.m === 2).length;
  const fuzzy = m.filter(x => x.m === 1).length;
  return { got, fuzzy, total: QUESTIONS.length, pct: Math.round(got / QUESTIONS.length * 100) };
}
function catProg(key) {
  const qs = QUESTIONS.filter(q => q.cat === key);
  const got = qs.filter(q => (S.q[q.id] || {}).m === 2).length;
  return { got, total: qs.length };
}
function projProg(p) {
  const done = p.steps.filter((_, i) => S.steps[p.id + "_" + i]).length;
  return { done, total: p.steps.length, pct: Math.round(done / p.steps.length * 100) };
}
function projAny() {
  const started = PROJECTS.filter(p => projProg(p).done > 0).length;
  const fin = PROJECTS.filter(p => projProg(p).pct === 100).length;
  return { started, fin, total: PROJECTS.length };
}

/* ── 间隔重复（简化 SM-2） ── */
const DAY = 864e5;
function rate(id, grade) {           // grade: 0 忘了 / 1 模糊 / 2 掌握
  const cur = S.q[id] || { m: 0, ivl: 0, due: 0 };
  let ivl;
  if (grade === 0) ivl = 0;
  else if (grade === 1) ivl = Math.max(1, Math.round((cur.ivl || 1) * 1.3));
  else ivl = cur.ivl ? Math.round(cur.ivl * 2.5) : 2;
  S.q[id] = { m: grade, ivl, due: Date.now() + ivl * DAY, seen: (cur.seen || 0) + 1 };
  save();
}
function dueList() {
  const now = Date.now();
  return QUESTIONS.filter(q => {
    const r = S.q[q.id];
    return !r || r.due <= now;
  });
}

/* ── 课后题状态 ── */
// S.quiz[qid] = { tries:n, ok:bool, shown:bool, val:"用户填的答案" }
function quizState(id) { return S.quiz[id] || { tries: 0, ok: false, shown: false, val: "" }; }
function normAns(s) {
  return String(s).trim().toLowerCase()
    .replace(/[\s，,]/g, "")
    .replace(/[（）]/g, m => (m === "（" ? "(" : ")"));
}
function checkQuiz(q, val) {
  if (q.type === "num") {
    const v = parseFloat(String(val).replace(/[^\d.\-eE+]/g, ""));
    if (isNaN(v)) return false;
    return Math.abs(v - q.ans) <= (q.tol === undefined ? 0.001 : q.tol);
  }
  if (q.type === "mc") return Number(val) === q.ans;
  if (q.type === "text") return q.ans.some(a => normAns(a) === normAns(val));
  return true;                       // open 题自评
}
function lessonProg(nodeId) {
  const L = (window.LESSONS || {})[nodeId];
  if (!L) return null;
  const done = L.quiz.filter(q => (S.quiz[q.id] || {}).ok).length;
  return { done, total: L.quiz.length, pct: Math.round(done / L.quiz.length * 100) };
}
function lessonsProg(track) {
  const L = window.LESSONS || {};
  const ids = Object.keys(L).filter(id => (L[id].track || "main") === (track || "main"));
  let done = 0, total = 0;
  ids.forEach(id => { const p = lessonProg(id); done += p.done; total += p.total; });
  return { done, total, count: ids.length, pct: total ? Math.round(done / total * 100) : 0 };
}
function lessonIds(track) {
  const L = window.LESSONS || {};
  return Object.keys(L).filter(id => (L[id].track || "main") === (track || "main"));
}

/* ── LeetCode 状态 ──  0 未做 / 1 看了提示 / 2 独立做出 / 3 没做出来 */
const allLC = () => LC_GROUPS.flatMap(g => g.problems);
function lcSet(slug, s) {
  if (s === 0) delete S.lc[slug];
  else S.lc[slug] = { s, ts: Date.now() };
  save();
}
function lcStat() {
  const all = allLC();
  const solo = all.filter(p => (S.lc[p.slug] || {}).s === 2).length;
  const hint = all.filter(p => (S.lc[p.slug] || {}).s === 1).length;
  const fail = all.filter(p => (S.lc[p.slug] || {}).s === 3).length;
  return { solo, hint, fail, total: all.length, touched: solo + hint + fail };
}
function lcGroupStat(g) {
  const solo = g.problems.filter(p => (S.lc[p.slug] || {}).s === 2).length;
  const touched = g.problems.filter(p => S.lc[p.slug]).length;
  return { solo, touched, total: g.problems.length };
}
// 一周前标记为「看了提示 / 没做出来」的题，该回来重做了
function lcReview() {
  const cut = Date.now() - 7 * DAY;
  return allLC().filter(p => {
    const r = S.lc[p.slug];
    return r && (r.s === 1 || r.s === 3) && r.ts <= cut;
  });
}

/* ── Infra 主攻线：题库与实验室 ── */
function iqSet(id, m) {
  if (m === 0) delete S.iq[id]; else S.iq[id] = { m, ts: Date.now() };
  save();
}
function iqStat() {
  const all = window.INFRA_QA || [];
  const got = all.filter(q => (S.iq[q.id] || {}).m === 2).length;
  const fuzzy = all.filter(q => (S.iq[q.id] || {}).m === 1).length;
  return { got, fuzzy, total: all.length, pct: all.length ? Math.round(got / all.length * 100) : 0 };
}
function iqCatStat(key) {
  const qs = (window.INFRA_QA || []).filter(q => q.cat === key);
  return { got: qs.filter(q => (S.iq[q.id] || {}).m === 2).length, total: qs.length };
}
function labSet(id, v) {
  if (!v) delete S.lab[id]; else S.lab[id] = { v, ts: Date.now() };
  save();
}
function labStat() {
  const all = window.INFRA_LABS || [];
  return { done: all.filter(l => (S.lab[l.id] || {}).v === 2).length,
           doing: all.filter(l => (S.lab[l.id] || {}).v === 1).length, total: all.length };
}

/* ── Infra 项目进度（按步骤打勾）── */
function ipjProg(pj) {
  const done = pj.steps.filter((_, i) => S.ipj[pj.id + "_" + i]).length;
  return { done, total: pj.steps.length, pct: Math.round(done / pj.steps.length * 100) };
}
function ipjStat() {
  const all = window.INFRA_PROJECTS || [];
  return { started: all.filter(p => ipjProg(p).done > 0).length,
           fin: all.filter(p => ipjProg(p).pct === 100).length, total: all.length };
}

/* ── markdown（够用即可） ── */
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
function md(src) {
  const out = [];
  const blocks = src.split(/```/);
  blocks.forEach((blk, i) => {
    if (i % 2 === 1) {                                  // 代码块
      const body = blk.replace(/^[a-zA-Z]*\n/, "");
      out.push(`<pre><code>${esc(body.replace(/\n$/, ""))}</code></pre>`);
      return;
    }
    blk.split(/\n{2,}/).forEach(para => {
      let lines = para.split("\n").filter(l => l.trim() !== "");
      if (!lines.length) return;

      if (/^#{2,4}\s/.test(lines[0])) {                 // 小标题
        out.push(`<h3 class="lh3">${inline(lines[0].replace(/^#+\s*/, ""))}</h3>`);
        lines = lines.slice(1);
        if (!lines.length) return;
      }
      if (lines.every(l => l.trim().startsWith(">"))) { // 引用 / 提示框
        const inner = md(lines.map(l => l.replace(/^\s*>\s?/, "")).join("\n"));
        out.push(`<blockquote>${inner}</blockquote>`);
        return;
      }
      if (lines.length === 1 && /^\$\$.*\$\$$/.test(lines[0].trim())) {
        out.push(`<div class="formula">${inline(lines[0].trim().replace(/^\$\$|\$\$$/g, "").trim())}</div>`);
        return;
      }
      if (lines[0].trim().startsWith("|")) {            // 表格
        const rows = lines.filter(l => !/^\s*\|[\s|:-]+\|\s*$/.test(l));
        const cells = r => r.trim().replace(/^\||\|$/g, "").split("|").map(c => inline(c.trim()));
        let h = `<table><thead><tr>${cells(rows[0]).map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>`;
        rows.slice(1).forEach(r => { h += `<tr>${cells(r).map(c => `<td>${c}</td>`).join("")}</tr>`; });
        out.push(h + "</tbody></table>");
        return;
      }
      // 段内混排：连续的列表行聚成列表，其余聚成段落
      let pbuf = [], lbuf = [], ord = false;
      const flushP = () => {
        if (!pbuf.length) return;
        out.push(`<p>${pbuf.map(inline).join("<br>")}</p>`);
        pbuf = [];
      };
      const flushL = () => {
        if (!lbuf.length) return;
        const items = lbuf.map(l => `<li>${inline(l.replace(/^\s*(-|\d+\.)\s*/, ""))}</li>`).join("");
        out.push(ord ? `<ol style="margin-left:20px">${items}</ol>` : `<ul>${items}</ul>`);
        lbuf = [];
      };
      lines.forEach(l => {
        if (/^\s*(-|\d+\.)\s/.test(l)) {
          flushP();
          const isOrd = /^\s*\d+\./.test(l);
          if (lbuf.length && isOrd !== ord) flushL();   // 有序/无序切换时断开
          ord = isOrd;
          lbuf.push(l);
        } else {
          flushL();
          pbuf.push(l);
        }
      });
      flushL(); flushP();
    });
  });
  return out.join("");
}

/* ── 导入 / 导出 ── */
function exportData() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `llm-career-progress-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
function importData(file, cb) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const o = JSON.parse(fr.result);
      ["nodes", "q", "steps", "days", "fav"].forEach(k => { if (o[k]) S[k] = o[k]; });
      save(); cb(true);
    } catch { cb(false); }
  };
  fr.readAsText(file);
}
function resetData() {
  ["nodes", "q", "steps", "fav"].forEach(k => S[k] = {});
  S.days = [];
  localStorage.removeItem(KEY);
}
