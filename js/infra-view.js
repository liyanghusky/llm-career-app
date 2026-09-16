/* AI Infra 专项视图 */
const INFRA_LV = ["未评", "听过讲不清", "能讲清", "亲手做过"];

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
  const st = infraStat(), gaps = infraGaps();
  return `
  <div class="hd">
    <div class="kicker">AI Infra</div>
    <h1>AI Infra 专项 · 能讲清 ${st.ok}/${st.total}</h1>
    <p>六层知识栈 + ${INFRA_DESIGN.length} 道系统设计题 + 一份把现有经历挖成故事的清单。
       自评标准很严：不看资料能讲五分钟并答得上追问，才算「能讲清」。</p>
  </div>

  <div class="stats s6" style="grid-template-columns:repeat(4,1fr)">
    <div class="stat"><div class="n">${st.mustOk}<small>/${st.mustTotal}</small></div>
      <div class="l">必会项已掌握</div>${barEl(pct(st.mustOk, st.mustTotal), "var(--ac)")}</div>
    <div class="stat"><div class="n">${st.done}</div><div class="l">亲手做过</div>
      ${barEl(pct(st.done, st.total), "var(--ok)")}</div>
    <div class="stat"><div class="n">${st.weak}</div><div class="l">听过但讲不清</div>
      ${barEl(pct(st.weak, st.total), "var(--wr)")}</div>
    <div class="stat"><div class="n">${st.untouched}</div><div class="l">还没自评</div>
      ${barEl(pct(st.untouched, st.total), "var(--tx3)")}</div>
  </div>

  ${gaps.length ? `<div class="revbox">
    <b>这 ${gaps.length} 个「必会」你还讲不清，是优先级最高的缺口：</b>
    <div>${gaps.map(t => `<span class="chip" data-injump="${t.id}">${t.name}</span>`).join("")}</div>
  </div>` : (st.untouched === 0 ? `<div class="revbox"><b>必会项全部过关了。去把系统设计题和经历挖掘那一节做完。</b></div>` : "")}

  <div class="card lc-intro">
    <h2 style="font-size:17px;color:var(--tx);margin-bottom:6px;font-weight:400">${INFRA_INTRO.title}</h2>
    ${md(INFRA_INTRO.body)}
  </div>

  <div class="sect-t">六层知识栈</div>
  ${INFRA_STACK.map(l => {
    const ls = infraLayerStat(l);
    const open = UI.open["il_" + l.id] ? "open" : "";
    return `
    <div class="stage ${open}">
      <div class="stage-h" data-tog="il_${l.id}">
        <span class="stage-dot" style="color:${l.color};background:${l.color}"></span>
        <div class="t">
          <b>${l.name}</b><i>${l.topics.length} 项</i>
          <p>${l.why}</p>
        </div>
        <span class="pct">${ls.ok}/${ls.total}</span>
        <span class="chev">▶</span>
      </div>
      <div class="stage-b">
        ${l.topics.map(t => infraCard(t)).join("")}
      </div>
    </div>`;
  }).join("")}

  <div class="sect-t">AI Infra 系统设计题</div>
  ${INFRA_DESIGN.map(d => {
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
  }).join("")}

  <div class="sect-t">${INFRA_MINE.title}</div>
  <div class="card lc-intro" style="border-bottom:0;padding-bottom:6px">${md(INFRA_MINE.body)}</div>
  ${INFRA_MINE.items.map((it, i) => {
    const k = "im" + i, on = S.infra[k];
    return `
    <div class="node ${on ? "done" : ""}">
      <div class="node-h">
        <div class="chk ${on ? "on" : ""}" data-inset="${k}:${on ? 0 : 2}">✓</div>
        <div class="node-t" data-tog="imq_" style="cursor:default">
          <b>${it.q}</b>
          <div class="node-d" style="display:block;margin-left:0;margin-top:7px">${md(it.hint)}</div>
        </div>
      </div>
    </div>`;
  }).join("")}
  <p class="tiny muted" style="margin-top:14px">找到一个能讲十分钟的就打勾。凑够三个，一轮行为面 + 一轮系统设计的素材就齐了。</p>
  `;
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
