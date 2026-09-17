/* AI Infra 专项视图 */
const INFRA_LV = ["未评", "听过讲不清", "能讲清", "亲手做过"];
const IQ_LV = ["未评", "模糊", "掌握"];
const ISEC = [
  ["course", "课程"], ["stack", "知识栈"], ["qa", "深度题库"],
  ["proj", "项目 Demo"], ["lab", "实验室"],
  ["design", "系统设计"], ["plan", "12 周计划"], ["pitch", "定位与简历"]
];
if (!UI.isec) UI.isec = "course";

const allInfraTopics = () => INFRA_STACK.flatMap(l => l.topics);
function infraSet(id, s) {
  if (s === 0) delete S.infra[id]; else S.infra[id] = { s, ts: Date.now() };
  save();
}
function infraStat() {
  const all = allInfraTopics();
  const must = all.filter(t => t.must);
  const lv = id => (S.infra[id] || {}).s || 0;
  return {
    total: all.length,
    ok: all.filter(t => lv(t.id) >= 2).length,
    done: all.filter(t => lv(t.id) === 3).length,
    weak: all.filter(t => lv(t.id) === 1).length,
    mustTotal: must.length,
    mustOk: must.filter(t => lv(t.id) >= 2).length,
    untouched: all.filter(t => lv(t.id) === 0).length
  };
}
function infraLayerStat(l) {
  const lv = id => (S.infra[id] || {}).s || 0;
  return { ok: l.topics.filter(t => lv(t.id) >= 2).length, total: l.topics.length };
}
function infraGaps() {
  const lv = id => (S.infra[id] || {}).s || 0;
  return allInfraTopics().filter(t => t.must && lv(t.id) <= 1);
}

function viewInfra() {
  const st = infraStat(), iq = iqStat(), lab = labStat(), gaps = infraGaps();
  const ilp = lessonsProg("infra"), ipj = ipjStat();
  return `
  <div class="hd">
    <div class="kicker">Inference &amp; ML Infra · 主攻线</div>
    <h1>AI Infra 主攻线</h1>
    <p>主线路线图偏算法工程师；这一条是专门给 <b>MLE Inference / ML Infra</b> 岗位准备的平行主攻线：
       ${ilp.count} 节课程（讲义 + 课后题）、六层知识栈、${iq.total} 道深度题库、
       ${ipj.total} 个项目 Demo、${lab.total} 个动手实验、${INFRA_DESIGN.length} 道系统设计题、12 周计划，
       以及怎么把自己从「后端开发」重新定位成「Infra」。</p>
  </div>

  <div class="stats s6" style="grid-template-columns:repeat(5,1fr)">
    <div class="stat"><div class="n">${ilp.done}<small>/${ilp.total}</small></div>
      <div class="l">课后题答对</div>${barEl(ilp.pct, "var(--ac)")}</div>
    <div class="stat"><div class="n">${st.mustOk}<small>/${st.mustTotal}</small></div>
      <div class="l">知识栈必会</div>${barEl(pct(st.mustOk, st.mustTotal), "var(--ac2)")}</div>
    <div class="stat"><div class="n">${iq.got}<small>/${iq.total}</small></div>
      <div class="l">深度题掌握</div>${barEl(iq.pct, "var(--ok)")}</div>
    <div class="stat"><div class="n">${ipj.fin}<small>/${ipj.total}</small></div>
      <div class="l">项目完成 · ${ipj.started} 在做</div>${barEl(pct(ipj.fin, ipj.total), "var(--pu)")}</div>
    <div class="stat"><div class="n">${lab.done}<small>/${lab.total}</small></div>
      <div class="l">实验完成</div>${barEl(pct(lab.done, lab.total), "var(--wr)")}</div>
  </div>

  <div class="filters" style="margin-bottom:22px">
    ${ISEC.map(([k, n]) => `<button class="fbtn ${UI.isec === k ? "on" : ""}" data-isec="${k}">${n}</button>`).join("")}
  </div>

  ${UI.isec === "course" ? iSecCourse() : ""}
  ${UI.isec === "proj"   ? iSecProj() : ""}
  ${UI.isec === "stack"  ? iSecStack(gaps) : ""}
  ${UI.isec === "qa"     ? iSecQA() : ""}
  ${UI.isec === "lab"    ? iSecLab() : ""}
  ${UI.isec === "design" ? iSecDesign() : ""}
  ${UI.isec === "plan"   ? iSecPlan() : ""}
  ${UI.isec === "pitch"  ? iSecPitch() : ""}
  `;
}

/* ───── 分区：课程 ───── */
function iSecCourse() {
  const ids = lessonIds("infra");
  return `
  <div class="card lc-intro">
    <p><b>这六节课和阶段 0 的课程完全同构</b>：讲义分小节讲，末尾有课后题。
       课后题<b>不会直接给答案</b> —— 填进去提交才判对错，错了能重试，卡住有提示，
       试满两次才解锁解析，开放题必须先写下自己的答案。</p>
    <p>顺序是有依赖的：第 1 课的性能直觉是后面所有内容的地基，建议按顺序走。
       每节读完先做课后题，再去「深度题库」里刷对应分类的题。</p>
  </div>
  ${ids.map((id, i) => {
    const L = LESSONS[id], p = lessonProg(id);
    return `
    <div class="lcp ${p.pct === 100 ? "s2" : (p.done ? "s1" : "s0")}">
      <div class="lcp-h" data-lesson="${id}" style="cursor:pointer">
        <span class="lcdot"></span>
        <div class="lcp-t">
          <b>第 ${i + 1} 课 · ${L.title}</b>
          <span class="est">${L.est}</span>
          <p style="font-size:13.5px;color:var(--tx2);margin-top:5px;font-weight:300">${L.sub}</p>
        </div>
        <span class="pct" style="font-size:12px;color:var(--tx3)">课后题 ${p.done}/${p.total}</span>
        <span class="chev">▶</span>
      </div>
    </div>`;
  }).join("")}
  <p class="tiny muted" style="margin-top:14px">点标题进入课程。进度自动保存。</p>`;
}

/* ───── 分区：项目 Demo ───── */
function iSecProj() {
  return `
  <div class="card lc-intro">${md(INFRA_PROJ_INTRO)}</div>
  ${INFRA_PROJECTS.map(pj => {
    const pr = ipjProg(pj);
    const op = UI.open["ip_" + pj.id] ? "open" : "";
    return `
    <div class="lcp ${op} s${pr.pct === 100 ? 2 : (pr.done ? 1 : 0)}">
      <div class="lcp-h" data-tog="ip_${pj.id}">
        <span class="lcdot"></span>
        <div class="lcp-t">
          <b>${pj.id} · ${pj.name}</b>
          ${pj.must ? `<span class="key-tag">推荐</span>` : ""}
          <span class="est">${pj.tier} · ${pj.days} · ${"★".repeat(pj.stars)}</span>
          <p style="font-size:13.5px;color:var(--tx2);margin-top:5px;font-weight:300">${pj.tagline}</p>
        </div>
        <span class="pct" style="font-size:12px;color:var(--tx3)">${pr.done}/${pr.total}</span>
        <span class="chev">▶</span>
      </div>
      <div class="lcp-b">
        <div class="chips">${pj.stack.map(x => `<span class="chip">${x}</span>`).join("")}</div>
        <div class="lcwhy" style="margin-top:12px"><b>为什么做这个</b>${md(pj.why)}</div>
        <div class="steps" style="margin-top:6px">
          ${pj.steps.map((st, i) => {
            const k = pj.id + "_" + i, on = S.ipj[k];
            return `<div class="step ${on ? "done" : ""}">
              <div class="chk sc ${on ? "on" : ""}" data-ipjstep="${k}">✓</div>
              <div><b>${st.t}</b><p>${md(st.d).replace(/^<p>|<\/p>$/g, "")}</p></div>
            </div>`;
          }).join("")}
        </div>
        <div class="rbox" style="margin-top:14px">
          <b style="display:block;font-size:10px;letter-spacing:.2em;color:var(--ok);margin-bottom:6px">简历怎么写</b>
          ${pj.resume}
        </div>
        <p class="tiny muted" style="margin-top:8px">把 X/Y/Z 换成你自己测出来的数字。没有数字的项目在面试里会被问穿。</p>
        <div class="hint-on" style="margin-top:12px"><b>面试官会追问</b>
          <ul style="margin-left:16px">${pj.asks.map(a => `<li>${a}</li>`).join("")}</ul>
        </div>
        <div class="pitfall" style="margin-top:12px"><b>常见翻车点：</b>${md(pj.pitfall).replace(/^<p>|<\/p>$/g, "")}</div>
      </div>
    </div>`;
  }).join("")}`;
}

/* ───── 分区：知识栈 ───── */
function iSecStack(gaps) {
  const st = infraStat();
  return `
  ${gaps.length ? `<div class="revbox">
    <b>这 ${gaps.length} 个「必会」你还讲不清，优先级最高：</b>
    <div>${gaps.map(t => `<span class="chip" data-injump="${t.id}">${t.name}</span>`).join("")}</div>
  </div>` : (st.untouched === 0 ? `<div class="revbox"><b>必会项全部过关。去做深度题库和实验室。</b></div>` : "")}

  <div class="card lc-intro">
    <h2 style="font-size:17px;color:var(--tx);margin-bottom:6px;font-weight:400">${INFRA_INTRO.title}</h2>
    ${md(INFRA_INTRO.body)}
  </div>

  ${INFRA_STACK.map(l => {
    const ls = infraLayerStat(l);
    const open = UI.open["il_" + l.id] ? "open" : "";
    return `
    <div class="stage ${open}">
      <div class="stage-h" data-tog="il_${l.id}">
        <span class="stage-dot" style="color:${l.color};background:${l.color}"></span>
        <div class="t"><b>${l.name}</b><i>${l.topics.length} 项</i><p>${l.why}</p></div>
        <span class="pct">${ls.ok}/${ls.total}</span><span class="chev">▶</span>
      </div>
      <div class="stage-b">${l.topics.map(t => infraCard(t)).join("")}</div>
    </div>`;
  }).join("")}`;
}

/* ───── 分区：深度题库 ───── */
function iSecQA() {
  const kw = (UI.iqkw || "").trim().toLowerCase();
  let list = INFRA_QA;
  if (UI.iqcat) list = list.filter(q => q.cat === UI.iqcat);
  if (UI.iqmode === "todo") list = list.filter(q => ((S.iq[q.id] || {}).m || 0) !== 2);
  if (kw) list = list.filter(q => (q.q + q.a + (q.tags || []).join("")).toLowerCase().includes(kw));

  return `
  <div class="catgrid">
    ${INFRA_QCATS.map(c => {
      const p = iqCatStat(c.key);
      return `<div class="catc ${UI.iqcat === c.key ? "on" : ""}" data-iqcat="${c.key}">
        <span class="ic">${c.icon}</span><b>${c.name}</b>
        <div class="m">${p.got}/${p.total} 掌握</div></div>`;
    }).join("")}
  </div>

  <div class="filters">
    <input class="search" id="iqkw" placeholder="搜索题目、答案、标签…" value="${UI.iqkw || ""}">
    ${UI.iqcat ? `<button class="fbtn on" data-iqcat="">✕ ${INFRA_QCATS.find(c => c.key === UI.iqcat).name}</button>` : ""}
    <button class="fbtn ${!UI.iqmode ? "on" : ""}" data-iqmode="">全部</button>
    <button class="fbtn ${UI.iqmode === "todo" ? "on" : ""}" data-iqmode="todo">未掌握</button>
  </div>
  <div class="tiny muted" style="margin-bottom:10px">共 ${list.length} 题</div>

  ${list.length ? list.map(q => {
    const m = (S.iq[q.id] || {}).m || 0;
    const op = UI.open["iq_" + q.id] ? "open" : "";
    const lvName = ["", "基础", "进阶", "硬核"][q.level];
    return `
    <div class="q ${op}">
      <div class="q-h" data-tog="iq_${q.id}">
        <span class="mstate s${m}"></span>
        <div class="qt">${q.q}</div>
        <span class="lv lv${q.level}">${lvName}</span>
      </div>
      <div class="q-b">
        ${md(q.a)}
        ${q.ask ? `<div class="hint-on" style="margin-top:12px"><b>面试怎么问</b>${q.ask}</div>` : ""}
        <div class="rate">
          <button class="a1 ${m === 1 ? "on" : ""}" data-iqset="${q.id}:1">模糊</button>
          <button class="a2 ${m === 2 ? "on" : ""}" data-iqset="${q.id}:2">掌握</button>
          ${m ? `<button class="a0" data-iqset="${q.id}:0">清除</button>` : ""}
        </div>
      </div>
    </div>`;
  }).join("") : `<div class="empty">没有符合条件的题目</div>`}`;
}

/* ───── 分区：实验室 ───── */
function iSecLab() {
  return `
  <div class="card lc-intro">${md(INFRA_LAB_INTRO)}</div>
  ${INFRA_LABS.map(l => {
    const v = (S.lab[l.id] || {}).v || 0;
    const op = UI.open["lb_" + l.id] ? "open" : "";
    return `
    <div class="lcp ${op} s${v === 2 ? 2 : (v === 1 ? 1 : 0)}">
      <div class="lcp-h" data-tog="lb_${l.id}">
        <span class="lcdot"></span>
        <div class="lcp-t"><b>${l.id} · ${l.name}</b>
          ${l.must ? `<span class="key-tag">必做</span>` : ""}
          <span class="est">${l.days} · ${l.where}</span></div>
        <span class="chev">▶</span>
      </div>
      <div class="lcp-b">
        <p class="lcwhy"><b>为什么做</b>${md(l.why).replace(/^<p>|<\/p>$/g, "")}</p>
        <div class="keybox"><b>步骤</b>
          <ol style="margin-left:18px">${l.steps.map(x => `<li>${md(x).replace(/^<p>|<\/p>$/g, "")}</li>`).join("")}</ol>
        </div>
        <div class="rbox"><b style="display:block;font-size:10px;letter-spacing:.2em;color:var(--ok);margin-bottom:6px">产出</b>${l.deliver}</div>
        <div class="hint-on" style="margin-top:12px"><b>参考数字</b>${md(l.numbers).replace(/^<p>|<\/p>$/g, "")}</div>
        ${l.stretch ? `<div class="qz-hint"><b>进阶</b>${l.stretch}</div>` : ""}
        ${l.ref ? `<p class="tiny muted" style="margin-top:10px">${md(l.ref).replace(/^<p>|<\/p>$/g, "")}</p>` : ""}
        <div class="lcrate">
          <span class="tiny muted">状态：</span>
          <button class="fbtn ${v === 1 ? "on" : ""}" data-labset="${l.id}:1">在做</button>
          <button class="fbtn ${v === 2 ? "on" : ""}" data-labset="${l.id}:2">做完了</button>
          ${v ? `<button class="fbtn" data-labset="${l.id}:0">清除</button>` : ""}
        </div>
      </div>
    </div>`;
  }).join("")}`;
}

/* ───── 分区：系统设计 ───── */
function iSecDesign() {
  return INFRA_DESIGN.map(d => {
    const open = UI.open["id_" + d.id] ? "open" : "";
    return `
    <div class="lcp ${open}">
      <div class="lcp-h" data-tog="id_${d.id}">
        <span class="lcdot" style="${(S.infra[d.id] || {}).s >= 2 ? "background:var(--ok);border-color:var(--ok)" : ""}"></span>
        <div class="lcp-t"><b>${d.name}</b>${d.must ? `<span class="key-tag">必会</span>` : ""}</div>
        <span class="chev">▶</span>
      </div>
      <div class="lcp-b">
        <p class="lcwhy"><b>为什么考它</b>${d.why}</p>
        ${UI.open["idf_" + d.id]
          ? `<div class="keybox"><b>答题框架</b>${md(d.frame)}</div>
             <div class="hint-on"><b>常见追问</b>${d.depth}</div>
             <div class="pitfall" style="margin-top:12px"><b>翻车点：</b>${d.pitfall}</div>`
          : `<button class="btn sec sm" data-tog="idf_${d.id}">展开答题框架（先自己打一遍腹稿）</button>`}
        <div class="lcrate">
          <span class="tiny muted">自评：</span>
          ${[1, 2, 3].map(n => `<button class="fbtn ${(S.infra[d.id] || {}).s === n ? "on" : ""}"
            data-inset="${d.id}:${n}">${INFRA_LV[n]}</button>`).join("")}
        </div>
      </div>
    </div>`;
  }).join("");
}

/* ───── 分区：12 周计划 ───── */
function iSecPlan() {
  return `
  <div class="card lc-intro">${md(INFRA_PLAN_INTRO)}</div>
  ${INFRA_PLAN.map(w => `
    <div class="node" style="border-top:1px solid var(--line)">
      <div class="node-h">
        <div class="chk ${S.infra["pw_" + w.w] ? "on" : ""}" data-inset="pw_${w.w}:${S.infra["pw_" + w.w] ? 0 : 2}">✓</div>
        <div class="node-t" style="cursor:default">
          <b>${w.w} · ${w.focus}</b>
          ${w.key ? `<span class="key-tag">不可砍</span>` : ""}
          ${w.opt ? `<span class="est">可选</span>` : ""}
          <div class="node-d" style="display:block;margin-left:0;margin-top:8px">
            <ul>${w.do.map(x => `<li>${md(x).replace(/^<p>|<\/p>$/g, "")}</li>`).join("")}</ul>
            <p><b>产出</b>${w.deliver}</p>
          </div>
        </div>
      </div>
    </div>`).join("")}`;
}

/* ───── 分区：定位与简历 ───── */
function iSecPitch() {
  return `
  <div class="card lc-intro">
    <h2 style="font-size:17px;color:var(--tx);margin-bottom:6px;font-weight:400">${INFRA_PITCH.title}</h2>
    ${md(INFRA_PITCH.body)}
  </div>
  <div class="steps" style="margin-top:16px">
    ${INFRA_PITCH.pairs.map(([bad, good]) => `
      <div class="step" style="flex-direction:column;gap:7px">
        <p style="color:var(--tx3)">${bad}</p>
        <p style="color:var(--tx);font-weight:400">${good}</p>
      </div>`).join("")}
  </div>
  <div class="card lc-intro" style="margin-top:20px">${md(INFRA_PITCH.tail)}</div>

  <div class="sect-t">把已有经历挖成故事</div>
  <div class="card lc-intro" style="border-bottom:0;padding-bottom:6px">${md(INFRA_MINE.body)}</div>
  ${INFRA_MINE.items.map((it, i) => {
    const k = "im" + i, on = S.infra[k];
    return `
    <div class="node ${on ? "done" : ""}">
      <div class="node-h">
        <div class="chk ${on ? "on" : ""}" data-inset="${k}:${on ? 0 : 2}">✓</div>
        <div class="node-t" style="cursor:default">
          <b>${it.q}</b>
          <div class="node-d" style="display:block;margin-left:0;margin-top:7px">${md(it.hint)}</div>
        </div>
      </div>
    </div>`;
  }).join("")}
  <p class="tiny muted" style="margin-top:14px">找到三个能讲十分钟的故事，一轮行为面 + 一轮系统设计的素材就齐了。</p>`;
}

function infraCard(t) {
  const cur = (S.infra[t.id] || {}).s || 0;
  const open = UI.open["it_" + t.id] ? "open" : "";
  return `
  <div class="lcp ${open} s${cur >= 2 ? 2 : (cur === 1 ? 1 : 0)}" id="in-${t.id}">
    <div class="lcp-h" data-tog="it_${t.id}">
      <span class="lcdot"></span>
      <div class="lcp-t"><b>${t.name}</b>${t.must ? `<span class="key-tag">必会</span>` : ""}</div>
      ${cur ? `<span class="lv ${cur === 3 ? "lv1" : cur === 2 ? "lv1" : "lv2"}">${INFRA_LV[cur]}</span>` : ""}
      <span class="chev">▶</span>
    </div>
    <div class="lcp-b">
      ${md(t.what)}
      <div class="hint-on" style="margin-top:12px"><b>面试怎么问</b>${t.ask}</div>
      <div class="keybox"><b>算掌握的标准</b>${md(t.check)}</div>
      <div class="qz-hint"><b>动手做什么</b>${md(t.hands)}</div>
      <div class="lcrate">
        <span class="tiny muted">自评：</span>
        ${[1, 2, 3].map(n => `<button class="fbtn ${cur === n ? "on" : ""}"
          data-inset="${t.id}:${n}">${INFRA_LV[n]}</button>`).join("")}
        ${cur ? `<button class="fbtn" data-inset="${t.id}:0">清除</button>` : ""}
      </div>
    </div>
  </div>`;
}
