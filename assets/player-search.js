/*
  Homepage player lookup. Type a name, pick a suggestion, pick a season, and
  the card renders that player-season from the research tables: four role
  labels with fit scores, key percentiles, nearest style matches, and any
  watch-list or clutch-trust rows. All client-side; the JSON loads once,
  lazily, the first time the search box is focused.
*/
(function () {
  "use strict";
  const $ = (s, el) => (el || document).querySelector(s);
  const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const box = $("#player-search");
  if (!box) return;
  const input = $(".ps-input", box), sug = $(".ps-sug", box), card = $(".ps-card", box);

  let DATA = null, loading = null;
  function load() {
    if (loading) return loading;
    loading = Promise.all(
      ["roles", "embeddings", "watchlist", "clutch"].map(n =>
        fetch("assets/data/" + n + ".json").then(r => r.json()))
    ).then(([roles, emb, wl, cl]) => {
      const players = {};
      roles.forEach(r => { (players[r.n] = players[r.n] || []).push(r); });
      for (const n in players) players[n].sort((a, b) => a.s.localeCompare(b.s));
      const embIx = {};
      emb.forEach((r, i) => embIx[r.n + "|" + r.s] = i);
      const wlIx = {}; wl.forEach(r => wlIx[r.n] = r);
      const clIx = {}; cl.forEach(r => clIx[r.n + "|" + r.s] = r);
      DATA = { players, names: Object.keys(players).sort(), emb, embIx, wlIx, clIx };
    }).catch(() => {
      card.innerHTML = '<p class="ps-empty">The live lookup loads its data over HTTP, so it works on the hosted site; opening the file directly will not populate it.</p>';
    });
    return loading;
  }

  const PCTS = [["pts36","Scoring volume"],["TS_PCT","True shooting"],["USG_PCT","Usage"],
                ["AST_PCT","Assist rate"],["pu_fga36","Pull-up volume"],["rim_dfg_shrunk","Rim protection"]];
  const LENSES = [["shot_diet","Shot diet"],["defense","Defense"],["scoring","Scoring"],["playmaking","Playmaking"]];

  function neighbors(name, season, k) {
    const i = DATA.embIx[name + "|" + season];
    if (i == null) return [];
    const v = DATA.emb[i].v, out = [];
    DATA.emb.forEach((r, j) => {
      if (r.n === name) return;
      let s = 0;
      for (let t = 0; t < 32; t++) { const d = r.v[t] - v[t]; s += d * d; }
      out.push({ n: r.n, s: r.s, t: r.t, d: Math.sqrt(s) });
    });
    out.sort((a, b) => a.d - b.d);
    return out.slice(0, k);
  }

  function renderCard(name, season) {
    const rows = DATA.players[name];
    if (!rows) return;
    const row = rows.find(r => r.s === season) || rows[rows.length - 1];
    season = row.s;
    const chips = rows.map(r =>
      `<button class="chip ${r.s === season ? "on" : ""}" data-season="${r.s}">${r.s}</button>`).join("");
    const roleRows = LENSES.map(([k, lab]) => {
      const [role, fit] = row.roles[k];
      const hybrid = fit < 0.1 ? ' <span class="ps-hybrid" title="Low fit: boundary case">boundary</span>' : "";
      return `<div class="ps-role"><span class="k">${lab}</span><span class="v">${esc(role)}${hybrid}</span><span class="fit">fit ${fit.toFixed(2)}</span></div>`;
    }).join("");
    const bars = PCTS.map(([k, lab]) => {
      const v = row.p[k];
      return `<div class="ps-pct"><span class="k">${lab}</span><span class="pbar"><i style="width:${Math.min(100, v)}%"></i></span><span class="pv">${Math.round(v)}</span></div>`;
    }).join("");
    const nb = neighbors(name, season, 5).map(x =>
      `<button class="ps-nb" data-n="${esc(x.n)}" data-s="${x.s}">${esc(x.n)} <span>${x.s} · ${x.t}</span></button>`).join("");
    let extra = "";
    const wl = DATA.wlIx[name];
    if (wl && season === "2025-26")
      extra += `<p class="ps-extra">2026-27 outlook from the trajectory study: P(rise) ${wl.rise.toFixed(2)}, P(fall) ${wl.fall.toFixed(2)}. Development-evidence probabilities, graded by the season itself.</p>`;
    const cl = DATA.clIx[name + "|" + season];
    if (cl)
      extra += `<p class="ps-extra">Bench-clutch study, this season: clutch lift ${cl.lift >= 0 ? "+" : ""}${cl.lift.toFixed(3)} (share of team clutch minutes minus ordinary share).</p>`;
    card.innerHTML = `
      <div class="ps-head">
        <h3>${esc(name)} <span class="ps-team">${row.t} · ${Math.round(row.m).toLocaleString()} min</span></h3>
        <div class="ps-seasons">${chips}</div>
      </div>
      <div class="ps-grid">
        <div><p class="ps-sub">Role lenses</p>${roleRows}</div>
        <div><p class="ps-sub">Within-season percentiles</p>${bars}</div>
      </div>
      <p class="ps-sub" style="margin-top:0.9rem;">Closest style matches</p>
      <div class="ps-nbrow">${nb}</div>
      ${extra}
      <p class="ps-more-link"><a href="research.html">Open the research section</a> for the studies and tables behind this card.</p>`;
    card.querySelectorAll(".chip").forEach(b =>
      b.addEventListener("click", () => renderCard(name, b.dataset.season)));
    card.querySelectorAll(".ps-nb").forEach(b =>
      b.addEventListener("click", () => { input.value = b.dataset.n; renderCard(b.dataset.n, b.dataset.s); }));
  }

  let cursor = -1, matches = [];
  function suggest() {
    const q = norm(input.value.trim());
    if (!DATA || q.length < 2) { sug.hidden = true; sug.innerHTML = ""; cursor = -1; return; }
    matches = DATA.names.filter(n => norm(n).includes(q)).slice(0, 8);
    cursor = -1;
    if (!matches.length) { sug.hidden = true; return; }
    sug.innerHTML = matches.map((n, i) => {
      const seasons = DATA.players[n].map(r => r.s.slice(2)).join(", ");
      return `<li role="option" data-n="${esc(n)}" class="${i === cursor ? "on" : ""}">${esc(n)} <span>${seasons}</span></li>`;
    }).join("");
    sug.hidden = false;
    sug.querySelectorAll("li").forEach(li =>
      li.addEventListener("mousedown", e => { e.preventDefault(); pick(li.dataset.n); }));
  }
  function pick(name) {
    input.value = name;
    sug.hidden = true;
    renderCard(name, DATA.players[name][DATA.players[name].length - 1].s);
  }
  input.addEventListener("focus", () => { load().then(() => suggest()); });
  input.addEventListener("input", () => { load().then(() => suggest()); });
  input.addEventListener("keydown", e => {
    if (sug.hidden) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      cursor = (cursor + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
      sug.querySelectorAll("li").forEach((li, i) => li.classList.toggle("on", i === cursor));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(matches[cursor >= 0 ? cursor : 0]);
    } else if (e.key === "Escape") sug.hidden = true;
  });
  document.addEventListener("click", e => { if (!box.contains(e.target)) sug.hidden = true; });
})();
