/* 状态管理 + 本地存储 + 轻量 markdown 渲染 */
const KEY = "llm-career-v1";

const S = Object.assign(
  { nodes: {}, q: {}, steps: {}, days: [], fav: {} },
  JSON.parse(localStorage.getItem(KEY) || "{}")
);

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
      const lines = para.split("\n").filter(l => l.trim() !== "");
      if (!lines.length) return;

      if (lines[0].trim().startsWith("|")) {            // 表格
        const rows = lines.filter(l => !/^\s*\|[\s|:-]+\|\s*$/.test(l));
        const cells = r => r.trim().replace(/^\||\|$/g, "").split("|").map(c => inline(c.trim()));
        let h = `<table><thead><tr>${cells(rows[0]).map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>`;
        rows.slice(1).forEach(r => { h += `<tr>${cells(r).map(c => `<td>${c}</td>`).join("")}</tr>`; });
        out.push(h + "</tbody></table>");
        return;
      }
      if (/^\s*[-\d]/.test(lines[0]) && lines.every(l => /^\s*(-|\d+\.)\s/.test(l))) {
        const ord = /^\s*\d+\./.test(lines[0]);
        const items = lines.map(l => `<li>${inline(l.replace(/^\s*(-|\d+\.)\s*/, ""))}</li>`).join("");
        out.push(ord ? `<ol style="margin-left:20px">${items}</ol>` : `<ul>${items}</ul>`);
        return;
      }
      out.push(`<p>${lines.map(inline).join("<br>")}</p>`);
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
