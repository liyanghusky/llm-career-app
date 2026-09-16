/* 各视图渲染 */
const UI = { cat: null, lv: 0, mode: "all", kw: "", open: {} };
const DRILL = { pool: [], i: 0, shown: false, done: 0 };

const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
const barEl = (p, c) => `<div class="bar"><i style="width:${p}%;background:${c || "var(--ac)"}"></i></div>`;

/* ════════ 总览 ════════ */
function viewHome() {
  const r = roadProg(), q = qProg(), pj = projAny(), due = dueList().length;
  const lp = lessonsProg(), lc = lcStat();

  // 下一步建议
  const nexts = [];
  const nd = allNodes().filter(n => !S.nodes[n.id]).slice(0, 3);
  nd.forEach(n => {
    const st = ROADMAP.find(s => s.nodes.includes(n));
    const has = !!LESSONS[n.id];
    nexts.push({
      v: has ? "lesson:" + n.id : "roadmap", t: n.name,
      s: has ? `${st.name} · 有完整课程和课后题 · 预估 ${n.est}` : `${st.name} · 预估 ${n.est || "—"}`,
      tag: "学"
    });
  });
  const lcr = lcReview();
  if (lcr.length) nexts.push({ v: "lc", t: `${lcr.length} 道算法题该复习了`, s: "一周前没独立做出来的题，回来重做", tag: "码" });
  if (due) nexts.push({ v: "drill", t: `有 ${due} 张卡片待复习`, s: "间隔重复安排的复习队列，10 分钟搞定", tag: "练" });
  const npj = PROJECTS.find(p => projProg(p).done > 0 && projProg(p).pct < 100)
    || PROJECTS.find(p => projProg(p).done === 0);
  if (npj) {
    const pp = projProg(npj);
    nexts.push({ v: "project", t: npj.name, s: pp.done ? `进行中 ${pp.done}/${pp.total} 步` : `还没开始 · 预估 ${npj.days}`, tag: "做" });
  }

  const planRows = ROADMAP.map(st => {
    const p = stageProg(st);
    const cls = p.pct === 100 ? "done" : (p.done > 0 ? "cur" : "");
    return `<div class="${cls}"><b>${st.weeks.replace("第 ", "").replace(" 周", "w")}</b>
      <span>${st.name.replace(/^阶段 \d+ · /, "")} —— ${p.done}/${p.total}</span></div>`;
  }).join("");

  return `
  <div class="hero">
    <div class="kicker">ML / LLM Job Prep</div>
    <h1>把「想转 LLM」变成一条能走完的路</h1>
    <p>${ROADMAP.length} 个阶段、${r.total} 个学习单元、${PROJECTS.length} 个简历项目、${q.total} 道面试题、${lc.total} 道算法题。
       阶段 0 有<b>从零讲起的完整课程和课后题</b>（不给答案，要你自己算）。所有进度存在本地浏览器，随时导出备份。</p>
    <div class="cta">
      <button class="btn" data-lesson="s0n1">从第一课开始学 →</button>
      <button class="btn sec" data-go="roadmap">看完整路线图</button>
      <button class="btn sec" data-go="lc">算法题</button>
      <button class="btn sec" data-go="drill">今日复习 ${due ? `(${due})` : ""}</button>
    </div>
  </div>

  <div class="stats s6">
    <div class="stat"><div class="n">${r.pct}<small>%</small></div><div class="l">路线图 ${r.done}/${r.total}</div>${barEl(r.pct)}</div>
    <div class="stat"><div class="n">${lp.done}<small>/${lp.total}</small></div><div class="l">课后题答对</div>${barEl(lp.pct, "var(--ac2)")}</div>
    <div class="stat"><div class="n">${q.got}<small>/${q.total}</small></div><div class="l">面试题掌握</div>${barEl(q.pct, "var(--ok)")}</div>
    <div class="stat"><div class="n">${lc.solo}<small>/${lc.total}</small></div><div class="l">算法题独立做出</div>${barEl(pct(lc.solo, lc.total), "var(--pu)")}</div>
    <div class="stat"><div class="n">${pj.fin}<small>/${pj.total}</small></div><div class="l">项目完成</div>${barEl(pct(pj.fin, pj.total), "var(--bad)")}</div>
    <div class="stat"><div class="n">${streak()}<small>天</small></div><div class="l">连续学习</div>${barEl(Math.min(100, streak() * 10), "var(--wr)")}</div>
  </div>

  <div class="two">
    <div>
      <div class="sect-t">接下来做什么</div>
      <div class="next">
        ${nexts.length ? nexts.map(n => `
          <div class="nx" data-go="${n.v}">
            <div class="ix">${n.tag}</div>
            <div><b>${n.t}</b><span>${n.s}</span></div>
          </div>`).join("") : `<div class="card muted tiny">全部完成了 —— 去投简历吧。</div>`}
      </div>

      <div class="sect-t">怎么用这个 App</div>
      <div class="card tiny muted" style="line-height:1.9">
        <b style="color:var(--tx)">路线图</b> 是主线。<b style="color:var(--ac2)">阶段 0 的五节都有完整课程</b> —— 从「向量是什么」讲起，不预设任何大学基础，每节末尾有课后题。<br>
        <b style="color:var(--tx)">课后题不给答案</b>，要你填进去提交。错了能重试，卡住了有分层提示，试两次以上才解锁解析。<br>
        <b style="color:var(--tx)">项目库</b> 是简历的弹药，每个项目给了分天任务、简历写法和面试官会追问的点。<br>
        <b style="color:var(--tx)">题库 / 刷卡</b> 按分类刷，间隔重复安排复习，评「掌握」的卡会隔更久再出现。<br>
        <b style="color:var(--tx)">LeetCode</b> 精选 ${lc.total} 题按模式分组，解法默认折叠，逼你先自己想。<br><br>
        <div class="ai-note callout">
          <b>✦ AI 詳解已启用</b> —— 课程正文、题目解析、算法题的<b>每一段</b>，鼠标移上去都会出现
          「詳解」。点开可以让模型针对那一段展开讲、举例子、推公式，也能接着追问，像批注一样。
          对话存在本地，下次打开还在。
        </div>
        <div class="ai-off-note callout warm">
          <b>✦ 开启「逐段問 AI 詳解」</b> —— 点右上角 <b>⚙</b> 填一个 API key（Anthropic、DeepSeek、
          Kimi、智谱都行，key 只存在你自己的浏览器里）。开启后，正文和解析的每一段鼠标移上去
          都会出现「詳解」，点开能让模型针对那一段展开讲、举例子、推公式，还能接着追问。
          在 <a href="https://claude.ai/artifact/UbCacFuqM3WWL4VNw8i46k">Artifact 版</a> 打开则无需配置，直接可用。
        </div>
        <span style="color:var(--wr)">一条建议：</span>课后题一定要动笔算，面试题一定要出声讲。心里懂和讲得清楚是两回事，面试考的是后者。
      </div>
    </div>

    <div>
      <div class="sect-t">20 周节奏</div>
      <div class="plan">${planRows}</div>
      <div class="sect-t">项目组合推荐</div>
      <div class="cbox">
        ${PROJECT_COMBOS.map(c => `<div style="margin-bottom:12px">
          <b>${c.name}</b>
          <p>${c.note}</p>
          <div class="ids">${c.ids.map(id => {
            const p = PROJECTS.find(x => x.id === id);
            return `<span data-proj="${id}">› ${p.name}</span>`;
          }).join("")}</div>
        </div>`).join("")}
      </div>
    </div>
  </div>`;
}

/* ════════ 路线图 ════════ */
function viewRoadmap() {
  const r = roadProg();
  return `
  <div class="hd">
    <div class="kicker">Roadmap</div>
    <h1>学习路线图 · ${r.done}/${r.total} 已完成</h1>
    <p>按阶段推进，不要跳阶段。每个单元点开有「为什么学 / 怎么学 / 通过标准」。
       预估时长按每天 2-3 小时的业余节奏给的，全职学习可以压缩一半。</p>
  </div>
  ${ROADMAP.map(st => {
    const p = stageProg(st);
    const open = UI.open["st_" + st.id] ? "open" : "";
    return `
    <div class="stage ${open}" data-stage="${st.id}">
      <div class="stage-h" data-tog="st_${st.id}">
        <span class="stage-dot" style="color:${st.color};background:${st.color}"></span>
        <div class="t">
          <b>${st.name}</b><i>${st.weeks}</i>
          <p>${st.goal}</p>
        </div>
        <span class="pct">${p.done}/${p.total}</span>
        <span class="chev">▶</span>
      </div>
      <div class="stage-b">
        ${st.skip ? `<div class="stage-note">${st.skip}</div>` : ""}
        ${st.nodes.map(n => {
          const done = S.nodes[n.id] ? "done" : "";
          const op = UI.open["nd_" + n.id] ? "open" : "";
          return `
          <div class="node ${done} ${op}">
            <div class="node-h">
              <div class="chk ${S.nodes[n.id] ? "on" : ""}" data-node="${n.id}">✓</div>
              <div class="node-t" data-tog="nd_${n.id}">
                <b>${n.name}</b>
                ${n.est ? `<span class="est">${n.est}</span>` : ""}
                ${n.key ? `<span class="key-tag">重点</span>` : ""}
              </div>
            </div>
            <div class="node-d">
              ${n.why ? `<p><b>为什么</b>${md(n.why).replace(/^<p>|<\/p>$/g, "")}</p>` : ""}
              ${n.how ? `<p><b>怎么学</b>${md(n.how).replace(/^<p>|<\/p>$/g, "")}</p>` : ""}
              ${n.check ? `<p><b>通过标准</b>${md(n.check).replace(/^<p>|<\/p>$/g, "")}</p>` : ""}
              ${n.res ? `<p class="res">${n.res.map(x => `<a href="${x[1]}" target="_blank" rel="noopener">${x[0]} ↗</a>`).join("")}</p>` : ""}
              ${LESSONS[n.id] ? (() => {
                const lp = lessonProg(n.id);
                return `<p style="margin-top:12px"><button class="btn sm" data-lesson="${n.id}">
                  ${lp.done ? `继续学习（课后题 ${lp.done}/${lp.total}）` : "开始学习 · 完整课程 →"}
                </button></p>`;
              })() : ""}
            </div>
          </div>`;
        }).join("")}
      </div>
    </div>`;
  }).join("")}`;
}

/* ════════ 项目库 ════════ */
function viewProject() {
  const a = projAny();
  return `
  <div class="hd">
    <div class="kicker">Portfolio</div>
    <h1>简历项目库 · ${a.fin}/${a.total} 完成</h1>
    <p>不用全做。按下面的组合挑 3 个，做深比做多重要得多。
       每个项目点开有分天任务清单、可直接改写的简历描述，以及面试官大概率会追问的问题。</p>
  </div>

  <div class="pgrid">
    ${PROJECTS.map(p => {
      const pp = projProg(p);
      return `
      <div class="pcard" data-proj="${p.id}" style="--c:${p.color}">
        <div class="tier">${p.tier} · ${p.days}</div>
        <h3>${p.name}</h3>
        <p>${p.tagline}</p>
        <div class="chips">${p.stack.slice(0, 4).map(s => `<span class="chip">${s}</span>`).join("")}</div>
        <div class="pmeta">
          <span class="stars">${"★".repeat(p.stars)}${"☆".repeat(5 - p.stars)}</span>
          <span>简历权重</span>
          <span style="margin-left:auto">${pp.done}/${pp.total} 步</span>
        </div>
        <div class="pbar">${barEl(pp.pct, p.color)}</div>
      </div>`;
    }).join("")}
  </div>

  <div class="sect-t">按目标岗位挑组合</div>
  <div class="combo">
    ${PROJECT_COMBOS.map(c => `
    <div class="cbox">
      <b>${c.name}</b>
      <p>${c.note}</p>
      <div class="ids">${c.ids.map(id => {
        const p = PROJECTS.find(x => x.id === id);
        return `<span data-proj="${id}">› ${p.name}</span>`;
      }).join("")}</div>
    </div>`).join("")}
  </div>`;
}

function projModal(id) {
  const p = PROJECTS.find(x => x.id === id);
  const pp = projProg(p);
  return `
  <div class="kicker" style="color:${p.color}">${p.tier} · ${p.days} · 简历权重 ${"★".repeat(p.stars)}</div>
  <h2>${p.name}</h2>
  <p class="muted" style="margin-top:9px;font-size:13.5px">${p.tagline}</p>
  <div class="chips" style="margin-top:12px">${p.stack.map(s => `<span class="chip">${s}</span>`).join("")}</div>

  <h4>为什么做这个</h4>
  <div style="font-size:13.5px;color:var(--tx2);line-height:1.85">${md(p.why)}</div>

  <h4>任务清单 · ${pp.done}/${pp.total}</h4>
  <div class="steps">
    ${p.steps.map((s, i) => {
      const k = p.id + "_" + i, on = S.steps[k];
      return `<div class="step ${on ? "done" : ""}">
        <div class="chk sc ${on ? "on" : ""}" data-step="${k}">✓</div>
        <div><b>${s.t}</b><p>${md(s.d).replace(/^<p>|<\/p>$/g, "")}</p></div>
      </div>`;
    }).join("")}
  </div>

  <h4>简历怎么写</h4>
  <div class="rbox">${p.resume}</div>
  <p class="tiny muted" style="margin-top:8px">把 X 换成你的真实数字。没有真实业务数据就自建评测集 —— 有数字永远比没数字强。</p>

  <h4>面试官会追问</h4>
  <ul class="asks">${p.asks.map(a => `<li>${a}</li>`).join("")}</ul>

  <div class="pitfall"><b>常见翻车点：</b>${p.pitfall}</div>`;
}

/* ════════ 题库 ════════ */
function filtered() {
  const kw = UI.kw.trim().toLowerCase();
  return QUESTIONS.filter(q => {
    if (UI.cat && q.cat !== UI.cat) return false;
    if (UI.lv && q.level !== UI.lv) return false;
    const m = (S.q[q.id] || {}).m || 0;
    if (UI.mode === "todo" && m === 2) return false;
    if (UI.mode === "fuzzy" && m !== 1) return false;
    if (UI.mode === "fav" && !S.fav[q.id]) return false;
    if (kw && !(q.q + q.a + (q.tags || []).join("")).toLowerCase().includes(kw)) return false;
    return true;
  });
}
function viewBank() {
  const q = qProg(), list = filtered();
  return `
  <div class="hd">
    <div class="kicker">Question Bank</div>
    <h1>面试题库 · 已掌握 ${q.got}/${q.total}</h1>
    <p>答案按「面试口头作答」的口径写，包含面试官想听的关键词和加分点。读完点开评级，评级会喂给刷卡模块安排复习。</p>
  </div>

  <div class="catgrid">
    ${QCATS.map(c => {
      const p = catProg(c.key);
      return `<div class="catc ${UI.cat === c.key ? "on" : ""}" data-cat="${c.key}">
        <span class="ic">${c.icon}</span>
        <b>${c.name}</b>
        <div class="m">${p.got}/${p.total} 掌握</div>
      </div>`;
    }).join("")}
  </div>

  <div class="filters">
    <input class="search" id="kw" placeholder="搜索题目、答案、标签…" value="${UI.kw}">
    ${UI.cat ? `<button class="fbtn on" data-cat="">✕ ${QCATS.find(c => c.key === UI.cat).name}</button>` : ""}
    <button class="fbtn ${UI.lv === 0 ? "on" : ""}" data-lv="0">全部难度</button>
    <button class="fbtn ${UI.lv === 1 ? "on" : ""}" data-lv="1">基础</button>
    <button class="fbtn ${UI.lv === 2 ? "on" : ""}" data-lv="2">进阶</button>
    <button class="fbtn ${UI.lv === 3 ? "on" : ""}" data-lv="3">硬核</button>
    <button class="fbtn ${UI.mode === "all" ? "on" : ""}" data-mode="all">全部</button>
    <button class="fbtn ${UI.mode === "todo" ? "on" : ""}" data-mode="todo">未掌握</button>
    <button class="fbtn ${UI.mode === "fuzzy" ? "on" : ""}" data-mode="fuzzy">模糊</button>
    <button class="fbtn ${UI.mode === "fav" ? "on" : ""}" data-mode="fav">★ 收藏</button>
  </div>

  <div class="tiny muted" style="margin-bottom:10px">共 ${list.length} 题</div>
  ${list.length ? list.map(qq => qCard(qq)).join("") : `<div class="empty">没有符合条件的题目</div>`}`;
}
function qCard(q) {
  const st = S.q[q.id] || {}, m = st.m || 0;
  const op = UI.open["q_" + q.id] ? "open" : "";
  const lvName = ["", "基础", "进阶", "硬核"][q.level];
  return `
  <div class="q ${op}">
    <div class="q-h" data-tog="q_${q.id}">
      <span class="mstate s${m}"></span>
      <div class="qt">${q.q}</div>
      <span class="lv lv${q.level}">${lvName}</span>
    </div>
    <div class="q-b">
      ${md(q.a)}
      <div class="rate">
        <button class="a0 ${m === 0 && st.seen ? "on" : ""}" data-rate="${q.id}:0">忘了</button>
        <button class="a1 ${m === 1 ? "on" : ""}" data-rate="${q.id}:1">模糊</button>
        <button class="a2 ${m === 2 ? "on" : ""}" data-rate="${q.id}:2">掌握</button>
        <button style="margin-left:auto" data-fav="${q.id}">${S.fav[q.id] ? "★ 已收藏" : "☆ 收藏"}</button>
      </div>
    </div>
  </div>`;
}

/* ════════ 刷卡 ════════ */
function buildPool() {
  let pool = dueList();
  if (UI.cat) pool = pool.filter(q => q.cat === UI.cat);
  if (!pool.length) pool = (UI.cat ? QUESTIONS.filter(q => q.cat === UI.cat) : QUESTIONS).slice();
  DRILL.pool = pool.sort(() => Math.random() - 0.5);
  DRILL.i = 0; DRILL.shown = false;
}
function viewDrill() {
  if (!DRILL.pool.length) buildPool();
  const q = DRILL.pool[DRILL.i];
  if (!q) {
    return `<div class="drill"><div class="empty">
      <div style="font-size:34px;margin-bottom:12px">✓</div>
      这一轮 ${DRILL.done} 张卡片过完了。<br><br>
      <button class="btn" data-redrill="1">再来一轮</button>
    </div></div>`;
  }
  const cat = QCATS.find(c => c.key === q.cat);
  return `
  <div class="drill">
    <div class="dstat">
      <span>本轮 <b>${DRILL.i + 1}</b> / ${DRILL.pool.length}</span>
      <span>今日已过 <b>${DRILL.done}</b></span>
      <span>待复习 <b>${dueList().length}</b></span>
    </div>
    <div class="dcard">
      <div class="dcat">${cat.icon}　${cat.name}　·　${["", "基础", "进阶", "硬核"][q.level]}</div>
      <div class="dq">${q.q}</div>
      ${DRILL.shown
        ? `<div class="da">${md(q.a)}</div>`
        : `<div class="dhint">先出声把答案讲一遍，再点「看答案」对照<br><span class="tiny">空格键翻面 · 1/2/3 评级</span></div>`}
    </div>
    <div class="dctl">
      ${DRILL.shown
        ? `<button class="again" data-drate="0">忘了</button>
           <button class="hard"  data-drate="1">模糊</button>
           <button class="good"  data-drate="2">掌握</button>`
        : `<button class="show" data-show="1">看答案</button>
           <button data-skip="1">跳过</button>`}
    </div>
    <div class="filters" style="justify-content:center;margin-top:20px">
      <button class="fbtn ${!UI.cat ? "on" : ""}" data-dcat="">全部分类</button>
      ${QCATS.map(c => `<button class="fbtn ${UI.cat === c.key ? "on" : ""}" data-dcat="${c.key}">${c.name}</button>`).join("")}
    </div>
  </div>`;
}

/* ════════ 课程（阶段 0 具体内容）════════ */
function viewLesson(nodeId) {
  const L = LESSONS[nodeId];
  if (!L) return `<div class="empty">这一节的详细课程还没写，先看路线图里的要点。</div>`;
  const st = ROADMAP.find(s => s.nodes.some(n => n.id === nodeId));
  const p = lessonProg(nodeId);
  const sibs = Object.keys(LESSONS);
  const idx = sibs.indexOf(nodeId);

  return `
  <div class="lesson">
    <div class="lbar">
      <span class="fbtn" data-go="roadmap">← 路线图</span>
      <span class="tiny muted">${st ? st.name : ""}</span>
      <span class="tiny mono" style="margin-left:auto;color:var(--tx3)">${L.est}</span>
    </div>

    <div class="lhead">
      <h1>${L.title}</h1>
      <p>${L.sub}</p>
    </div>

    <div class="ltoc">
      <b>本课目录</b>
      ${L.sections.map((s, i) => `<a href="#sec${i}" data-sec="${i}">${s.h}</a>`).join("")}
      <a href="#quizsec" data-sec="q" class="qlink">课后题 ${p.done}/${p.total}</a>
    </div>

    ${L.sections.map((s, i) => `
      <section class="lsec" id="sec${i}">
        <h2>${s.h}</h2>
        ${md(s.b)}
      </section>`).join("")}

    <section class="lsec" id="quizsec">
      <div class="quiz-head">
        <h2>课后题 · ${p.done}/${p.total}</h2>
        <p>这些题不会直接给你答案。<b>先动笔算</b>，填进去提交，错了可以再试。实在卡住再看提示。</p>
      </div>
      ${L.quiz.map((q, i) => quizCard(q, i + 1)).join("")}
    </section>

    <div class="lfoot">
      ${p.pct === 100
        ? `<div class="lfoot-ok">课后题全部答对了。${S.nodes[nodeId] ? "" : `<button class="btn" data-node="${nodeId}" style="margin-left:10px">标记这一节完成</button>`}</div>`
        : `<div class="tiny muted">还有 ${p.total - p.done} 道没答对。做完再去下一节，效果差别很大。</div>`}
      <div class="lnav">
        ${idx > 0 ? `<button class="btn sec" data-lesson="${sibs[idx - 1]}">← 上一节</button>` : "<span></span>"}
        ${idx < sibs.length - 1 ? `<button class="btn sec" data-lesson="${sibs[idx + 1]}">下一节 →</button>` : "<span></span>"}
      </div>
    </div>
  </div>`;
}

function quizCard(q, no) {
  const s = quizState(q.id);
  const showHint = UI.open["hint_" + q.id];
  const showWhy = s.ok || s.shown;
  const cls = s.ok ? "ok" : (s.tries > 0 && !s.ok ? "bad" : "");

  let input = "";
  if (q.type === "mc") {
    input = `<div class="choices">${q.choices.map((c, i) => `
      <label class="ch ${String(s.val) === String(i) ? "sel" : ""} ${showWhy && i === q.ans ? "right" : ""}">
        <input type="radio" name="${q.id}" value="${i}" ${String(s.val) === String(i) ? "checked" : ""} data-qin="${q.id}">
        <span>${String.fromCharCode(65 + i)}.</span> ${c}
      </label>`).join("")}</div>`;
  } else if (q.type === "open") {
    input = `<textarea class="qta" data-qin="${q.id}" placeholder="把你的答案写在这里。写出来和想一遍完全是两回事 —— 这一步别跳。">${s.val || ""}</textarea>`;
  } else {
    input = `<input class="qinput" data-qin="${q.id}" value="${s.val || ""}"
      placeholder="${q.type === "num" ? "填数字" : "填答案"}" autocomplete="off">`;
  }

  return `
  <div class="qz ${cls}">
    <div class="qz-q"><span class="qz-no">${no}</span>${md(q.q)}</div>
    ${input}
    <div class="qz-ctl">
      ${q.type === "open"
        ? `<button class="btn sec sm" data-qopen="${q.id}">写完了，看参考答案</button>`
        : `<button class="btn sm" data-qsub="${q.id}">提交</button>`}
      <button class="btn sec sm" data-qhint="${q.id}">${showHint ? "收起提示" : "看提示"}</button>
      ${!s.ok && s.tries >= 2 && q.type !== "open"
        ? `<button class="btn sec sm" data-qgive="${q.id}" style="color:var(--tx3)">放弃，看解析</button>` : ""}
      ${s.tries > 0 && !s.ok && !s.shown ? `<span class="qz-msg bad">不对，再想想（已试 ${s.tries} 次）</span>` : ""}
      ${s.ok ? `<span class="qz-msg ok">✓ 答对了</span>` : ""}
    </div>
    ${showHint ? `<div class="qz-hint"><b>提示</b>${md(q.hint)}</div>` : ""}
    ${showWhy ? `<div class="qz-why"><b>${q.type === "open" ? "参考答案" : "解析"}</b>${md(q.why || q.ref)}</div>` : ""}
  </div>`;
}

/* ════════ LeetCode ════════ */
function viewLc() {
  const st = lcStat(), rev = lcReview();
  return `
  <div class="hd">
    <div class="kicker">LeetCode</div>
    <h1>算法题 · 独立做出 ${st.solo}/${st.total}</h1>
    <p>精选 ${st.total} 题，按模式分组。目标不是刷得多，是把每一类的套路吃透。</p>
  </div>

  <div class="stats" style="grid-template-columns:repeat(4,1fr)">
    <div class="stat"><div class="n">${st.solo}<small>/${st.total}</small></div><div class="l">独立做出</div>${barEl(pct(st.solo, st.total), "var(--ok)")}</div>
    <div class="stat"><div class="n">${st.hint}</div><div class="l">看了提示</div>${barEl(pct(st.hint, st.total), "var(--wr)")}</div>
    <div class="stat"><div class="n">${st.fail}</div><div class="l">没做出来</div>${barEl(pct(st.fail, st.total), "var(--bad)")}</div>
    <div class="stat"><div class="n">${rev.length}</div><div class="l">该复习了</div>${barEl(pct(rev.length, st.total), "var(--pu)")}</div>
  </div>

  ${rev.length ? `<div class="revbox">
    <b>这 ${rev.length} 道题一周前你没独立做出来，该回来重做了：</b>
    <div>${rev.map(p => `<span class="chip" data-lcjump="${p.slug}">${p.n ? p.n + ". " : ""}${p.name}</span>`).join("")}</div>
  </div>` : ""}

  <div class="card lc-intro">
    <h2 style="font-size:17px;color:#eaf0fb;margin-bottom:4px">${LC_INTRO.title}</h2>
    ${md(LC_INTRO.body)}
  </div>

  ${LC_GROUPS.map(g => {
    const gs = lcGroupStat(g);
    const open = UI.open["lg_" + g.key] ? "open" : "";
    return `
    <div class="stage ${open}">
      <div class="stage-h" data-tog="lg_${g.key}">
        <span class="stage-dot" style="color:${g.color};background:${g.color}"></span>
        <div class="t">
          <b>${g.name}</b><i>${g.problems.length} 题</i>
          <p>${g.problems.filter(p => p.must).length} 道必刷</p>
        </div>
        <span class="pct">${gs.solo}/${gs.total}</span>
        <span class="chev">▶</span>
      </div>
      <div class="stage-b">
        <div class="lc-pattern">${md(g.pattern)}</div>
        ${g.problems.map(p => lcCard(p, g.color)).join("")}
      </div>
    </div>`;
  }).join("")}`;
}

function lcCard(p, color) {
  const r = S.lc[p.slug] || {};
  const op = UI.open["lc_" + p.slug] ? "open" : "";
  const lvc = { "易": "lv1", "中": "lv2", "难": "lv3" }[p.lv];
  const isLeet = p.n > 0;
  return `
  <div class="lcp ${op} s${r.s || 0}">
    <div class="lcp-h" data-tog="lc_${p.slug}">
      <span class="lcdot"></span>
      <div class="lcp-t">
        <b>${isLeet ? p.n + ". " : ""}${p.name}</b>
        ${p.must ? `<span class="key-tag">必刷</span>` : ""}
      </div>
      <span class="lv ${lvc}">${p.lv}</span>
      <span class="chev">▶</span>
    </div>
    <div class="lcp-b">
      <p class="lcwhy"><b>为什么考它</b>${p.why}</p>
      ${isLeet ? `<p><a href="https://leetcode.cn/problems/${p.slug}/" target="_blank" rel="noopener">去 LeetCode 做这题 ↗</a></p>` : ""}

      <div class="hintbox">
        ${p.hints.map((h, i) => {
          const k = "lch_" + p.slug + "_" + i;
          return UI.open[k]
            ? `<div class="hint-on"><b>提示 ${i + 1}</b>${h}</div>`
            : `<button class="btn sec sm" data-tog="${k}">看提示 ${i + 1}${i ? "（还是卡住）" : ""}</button>`;
        }).join("")}
      </div>

      ${UI.open["lck_" + p.slug]
        ? `<div class="keybox"><b>解法要点</b>${md(p.key)}<div class="cx">${p.cx}</div></div>`
        : `<button class="btn sec sm" data-tog="lck_${p.slug}" style="color:var(--tx3)">展开解法要点（先自己想满 20 分钟）</button>`}

      <div class="lcrate">
        <span class="tiny muted">做完了标一下：</span>
        <button class="fbtn ${r.s === 2 ? "on" : ""}" data-lc="${p.slug}:2">独立做出</button>
        <button class="fbtn ${r.s === 1 ? "on" : ""}" data-lc="${p.slug}:1">看了提示</button>
        <button class="fbtn ${r.s === 3 ? "on" : ""}" data-lc="${p.slug}:3">没做出来</button>
        ${r.s ? `<button class="fbtn" data-lc="${p.slug}:0">清除</button>` : ""}
      </div>
    </div>
  </div>`;
}

/* ════════ 设置 ════════ */
function dataModal() {
  const r = roadProg(), q = qProg();
  return `
  <h2>进度数据</h2>
  <p class="muted tiny" style="margin-top:8px">数据只保存在这台设备的浏览器里。换电脑或清缓存前记得导出。</p>
  <h4>当前进度</h4>
  <div class="card tiny" style="line-height:2">
    路线图 ${r.done}/${r.total} · 题目掌握 ${q.got} 模糊 ${q.fuzzy} · 项目步骤 ${Object.keys(S.steps).length} 项 · 学习天数 ${S.days.length} 天
  </div>
  <h4>AI 詳解</h4>
  <div>${typeof aiSettingsHTML === "function" ? aiSettingsHTML() : ""}</div>
  <h4>操作</h4>
  <div style="display:flex;gap:9px;flex-wrap:wrap">
    <button class="btn" id="expBtn">导出 JSON</button>
    <button class="btn sec" id="impBtn">导入 JSON</button>
    <button class="btn sec" id="rstBtn" style="color:var(--bad)">清空全部进度</button>
    <input type="file" id="impFile" accept=".json" hidden>
  </div>`;
}
