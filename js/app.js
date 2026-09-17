/* 路由 + 事件 */
let view = location.hash.replace("#", "") || "home";
const app = document.getElementById("app");
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modalBody");

const RENDER = { home: viewHome, roadmap: viewRoadmap, project: viewProject, bank: viewBank, drill: viewDrill, lc: viewLc, infra: viewInfra };

function render(keepScroll) {
  const y = window.scrollY;
  app.innerHTML = view.startsWith("lesson:")
    ? viewLesson(view.slice(7))
    : (RENDER[view] || viewHome)();
  const tabKey = view.startsWith("lesson:") ? "roadmap" : view;
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.view === tabKey));
  document.getElementById("streak").textContent = streak() ? `${streak()}d 连续` : "";
  if (typeof aiDecorate === "function") aiDecorate();
  if (keepScroll) window.scrollTo(0, y);
  else window.scrollTo(0, 0);
}
function go(v) {
  view = v; location.hash = v;
  if (v === "drill" && !DRILL.pool.length) buildPool();
  render();
}
window.addEventListener("hashchange", () => {
  const v = location.hash.replace("#", "") || "home";
  if (v !== view && !v.startsWith("sec") && v !== "quizsec") { view = v; render(); }
});

/* ── 顶部导航 ── */
document.getElementById("tabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-view]");
  if (b) go(b.dataset.view);
});

/* ── 弹窗 ── */
function openModal(html) {
  modalBody.innerHTML = html; modal.hidden = false; document.body.style.overflow = "hidden";
  if (typeof aiDecorate === "function") aiDecorate();
}
function closeModal() { modal.hidden = true; document.body.style.overflow = ""; }
document.getElementById("modalX").onclick = closeModal;
modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
document.getElementById("btnData").onclick = () => openModal(dataModal());

/* ── 主体事件委托 ── */
document.body.addEventListener("click", e => {
  const t = e.target;

  // 折叠展开
  const tog = t.closest("[data-tog]");
  if (tog) {
    const k = tog.dataset.tog;
    UI.open[k] = !UI.open[k];
    render(true);
    return;
  }
  // 路线图勾选
  const nd = t.closest("[data-node]");
  if (nd) {
    const id = nd.dataset.node;
    S.nodes[id] ? delete S.nodes[id] : (S.nodes[id] = 1);
    save(); render(true); return;
  }
  // 项目步骤勾选
  const sp = t.closest("[data-step]");
  if (sp) {
    const k = sp.dataset.step;
    S.steps[k] ? delete S.steps[k] : (S.steps[k] = 1);
    save();
    const pid = k.split("_")[0];
    openModal(projModal(pid));
    return;
  }
  // 跳转
  const g = t.closest("[data-go]");
  if (g) { go(g.dataset.go); return; }
  // 打开课程
  const ls = t.closest("[data-lesson]");
  if (ls) { go("lesson:" + ls.dataset.lesson); return; }
  // 目录锚点
  const sec = t.closest("[data-sec]");
  if (sec) {
    e.preventDefault();
    const id = sec.dataset.sec === "q" ? "quizsec" : "sec" + sec.dataset.sec;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  // ── 课后题 ──
  const qs = t.closest("[data-qsub]");
  if (qs) {
    const id = qs.dataset.qsub;
    const q = findQuiz(id);
    const cur = quizState(id);
    const ok = checkQuiz(q, cur.val);
    S.quiz[id] = { ...cur, tries: cur.tries + 1, ok, shown: cur.shown || ok };
    save(); render(true); return;
  }
  const qo = t.closest("[data-qopen]");
  if (qo) {
    const id = qo.dataset.qopen;
    const cur = quizState(id);
    if (!String(cur.val || "").trim()) {
      alert("先把你的答案写下来再看参考答案。\n写出来和想一遍完全是两回事 —— 这一步别跳。");
      return;
    }
    S.quiz[id] = { ...cur, tries: cur.tries + 1, ok: true, shown: true };
    save(); render(true); return;
  }
  const qh = t.closest("[data-qhint]");
  if (qh) { const k = "hint_" + qh.dataset.qhint; UI.open[k] = !UI.open[k]; render(true); return; }
  const qg = t.closest("[data-qgive]");
  if (qg) {
    const id = qg.dataset.qgive;
    S.quiz[id] = { ...quizState(id), shown: true };
    save(); render(true); return;
  }

  // ── Infra 主攻线：分区 / 题库 / 实验室 ──
  const isec = t.closest("[data-isec]");
  if (isec) { UI.isec = isec.dataset.isec; render(); return; }
  const iqc = t.closest("[data-iqcat]");
  if (iqc) { UI.iqcat = iqc.dataset.iqcat || null; render(true); return; }
  const iqm = t.closest("[data-iqmode]");
  if (iqm) { UI.iqmode = iqm.dataset.iqmode || null; render(true); return; }
  const iqs = t.closest("[data-iqset]");
  if (iqs) { const [id, m] = iqs.dataset.iqset.split(":"); iqSet(id, +m); render(true); return; }
  const lbs = t.closest("[data-labset]");
  if (lbs) { const [id, v] = lbs.dataset.labset.split(":"); labSet(id, +v); render(true); return; }

  // ── AI Infra 自评 ──
  const inb = t.closest("[data-inset]");
  if (inb) {
    const [id, n] = inb.dataset.inset.split(":");
    infraSet(id, +n); render(true); return;
  }
  const inj = t.closest("[data-injump]");
  if (inj) {
    const id = inj.dataset.injump;
    const layer = INFRA_STACK.find(l => l.topics.some(x => x.id === id));
    UI.open["il_" + layer.id] = true;
    UI.open["it_" + id] = true;
    render(true);
    setTimeout(() => document.getElementById("in-" + id)
      ?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    return;
  }

  // ── LeetCode ──
  const lcb = t.closest("[data-lc]");
  if (lcb) {
    const [slug, s] = lcb.dataset.lc.split(":");
    lcSet(slug, +s); render(true); return;
  }
  const lj = t.closest("[data-lcjump]");
  if (lj) {
    const slug = lj.dataset.lcjump;
    const grp = LC_GROUPS.find(gp => gp.problems.some(p => p.slug === slug));
    UI.open["lg_" + grp.key] = true;
    UI.open["lc_" + slug] = true;
    render(true);
    setTimeout(() => document.querySelector(`[data-tog="lc_${slug}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    return;
  }
  // 项目详情
  const pj = t.closest("[data-proj]");
  if (pj) { openModal(projModal(pj.dataset.proj)); return; }

  // 题库筛选
  const c = t.closest("[data-cat]");
  if (c) { UI.cat = c.dataset.cat || null; render(true); return; }
  const lv = t.closest("[data-lv]");
  if (lv) { UI.lv = +lv.dataset.lv; render(true); return; }
  const mo = t.closest("[data-mode]");
  if (mo) { UI.mode = mo.dataset.mode; render(true); return; }
  // 评级
  const rt = t.closest("[data-rate]");
  if (rt) {
    const [id, g2] = rt.dataset.rate.split(":");
    rate(id, +g2); render(true); return;
  }
  const fv = t.closest("[data-fav]");
  if (fv) {
    const id = fv.dataset.fav;
    S.fav[id] ? delete S.fav[id] : (S.fav[id] = 1);
    save(); render(true); return;
  }

  // 刷卡
  if (t.closest("[data-show]")) { DRILL.shown = true; render(true); return; }
  if (t.closest("[data-skip]")) { DRILL.i++; DRILL.shown = false; render(true); return; }
  const dr = t.closest("[data-drate]");
  if (dr) {
    const q = DRILL.pool[DRILL.i];
    if (q) rate(q.id, +dr.dataset.drate);
    DRILL.i++; DRILL.done++; DRILL.shown = false; render(true); return;
  }
  if (t.closest("[data-redrill]")) { buildPool(); render(true); return; }
  const dc = t.closest("[data-dcat]");
  if (dc) { UI.cat = dc.dataset.dcat || null; buildPool(); render(true); return; }

  // 数据管理
  if (t.id === "expBtn") { exportData(); return; }
  if (t.id === "impBtn") { document.getElementById("impFile").click(); return; }
  if (t.id === "rstBtn") {
    if (confirm("确定清空所有学习进度？此操作不可撤销。建议先导出备份。")) {
      resetData(); closeModal(); render();
    }
    return;
  }
});

/* 导入文件 */
document.body.addEventListener("change", e => {
  if (e.target.id === "impFile" && e.target.files[0]) {
    importData(e.target.files[0], ok => {
      alert(ok ? "导入成功" : "文件格式不对");
      closeModal(); render();
    });
  }
});

/* 按 id 找到课后题定义 */
function findQuiz(id) {
  for (const k in LESSONS) {
    const q = LESSONS[k].quiz.find(x => x.id === id);
    if (q) return q;
  }
  return null;
}

/* 课后题输入：静默存值，不重渲染（否则输入框失焦） */
document.body.addEventListener("input", e => {
  const qi = e.target.closest("[data-qin]");
  if (qi && e.target.type !== "radio") {
    const id = qi.dataset.qin;
    S.quiz[id] = { ...quizState(id), val: e.target.value };
    clearTimeout(window.__qsave);
    window.__qsave = setTimeout(save, 400);
  }
});
/* 单选题：存值后重渲染以更新选中样式 */
document.body.addEventListener("change", e => {
  const qi = e.target.closest("[data-qin]");
  if (qi && e.target.type === "radio") {
    const id = qi.dataset.qin;
    S.quiz[id] = { ...quizState(id), val: e.target.value };
    save(); render(true);
  }
});
/* 课后题输入框回车即提交 */
document.body.addEventListener("keydown", e => {
  const qi = e.target.closest("[data-qin]");
  if (qi && e.key === "Enter" && e.target.tagName === "INPUT") {
    e.preventDefault();
    document.querySelector(`[data-qsub="${qi.dataset.qin}"]`)?.click();
  }
});

/* 搜索框（保持焦点） */
document.body.addEventListener("input", e => {
  if (e.target.id === "iqkw") {
    UI.iqkw = e.target.value;
    const pos = e.target.selectionStart;
    render(true);
    const el = document.getElementById("iqkw");
    if (el) { el.focus(); el.setSelectionRange(pos, pos); }
    return;
  }
  if (e.target.id === "kw") {
    UI.kw = e.target.value;
    const pos = e.target.selectionStart;
    render(true);
    const el = document.getElementById("kw");
    if (el) { el.focus(); el.setSelectionRange(pos, pos); }
  }
});

/* 键盘快捷键 */
document.addEventListener("keydown", e => {
  if (!modal.hidden && e.key === "Escape") { closeModal(); return; }
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (view !== "drill") return;
  if (e.code === "Space") {
    e.preventDefault();
    if (!DRILL.shown) { DRILL.shown = true; render(true); }
    return;
  }
  if (DRILL.shown && ["1", "2", "3"].includes(e.key)) {
    const q = DRILL.pool[DRILL.i];
    if (q) rate(q.id, +e.key - 1);
    DRILL.i++; DRILL.done++; DRILL.shown = false; render(true);
  }
});

save();       // 记录今天的活跃
render();
