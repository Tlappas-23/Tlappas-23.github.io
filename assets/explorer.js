/*
  Research explorer. Everything on this page is client-side: the JSON files in
  assets/data/ were exported straight from the research database tables, and
  this script only filters, sorts, and measures distances. No backend, no
  libraries. Each section lazy-loads its data the first time it is opened.
*/
(function () {
  "use strict";
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const cache = {};
  async function data(name) {
    if (!cache[name]) cache[name] = fetch("assets/data/" + name + ".json").then(r => r.json());
    return cache[name];
  }
  const fmt = (v, d) => (v == null ? "" : (+v).toFixed(d == null ? 2 : d));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

  /* Generic sortable table. cols: [{key,label,d(igits),bar(max),cls}] */
  function table(el, cols, rows, opts) {
    opts = opts || {};
    let sortKey = opts.sort, sortDir = opts.dir || -1, limit = opts.limit || 40;
    function render() {
      let r = rows.slice();
      if (sortKey) r.sort((a, b) => {
        const x = a[sortKey], y = b[sortKey];
        if (x == null) return 1; if (y == null) return -1;
        return (typeof x === "string" ? x.localeCompare(y) : x - y) * sortDir;
      });
      const shown = r.slice(0, limit);
      let h = "<table class='xp-table'><thead><tr>";
      for (const c of cols) {
        const arrow = c.key === sortKey ? (sortDir < 0 ? " ↓" : " ↑") : "";
        h += `<th><button data-k="${c.key}">${c.label}${arrow}</button></th>`;
      }
      h += "</tr></thead><tbody>";
      for (const row of shown) {
        h += "<tr>";
        for (const c of cols) {
          let v = row[c.key];
          let cell;
          if (c.bar != null && v != null) {
            const w = Math.max(0, Math.min(100, (v / c.bar) * 100));
            cell = `<span class="pbar"><i style="width:${w}%"></i></span><span class="pv">${fmt(v, c.d)}</span>`;
          } else cell = typeof v === "number" ? fmt(v, c.d) : esc(v == null ? "" : v);
          h += `<td class="${c.cls || ""}">${cell}</td>`;
        }
        h += "</tr>";
      }
      h += "</tbody></table>";
      h += `<p class="xp-count">Showing ${shown.length} of ${r.length}.` +
           (r.length > limit ? ` <button class="xp-more">Show more</button>` : "") + "</p>";
      el.innerHTML = h;
      $$("th button", el).forEach(b => b.addEventListener("click", () => {
        const k = b.dataset.k;
        if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = -1; }
        render();
      }));
      const more = $(".xp-more", el);
      if (more) more.addEventListener("click", () => { limit += 60; render(); });
    }
    render();
    return { update(newRows) { rows = newRows; render(); } };
  }

  /* ---------- Roles ---------- */
  const LENS_PCTS = {
    shot_diet:  [["cs_fga36","C&S vol"],["pu_fga36","Pull-up vol"],["drives36","Drives"],["post36","Post"],["fg3a_rate","3P rate"]],
    defense:    [["stl36","Steals"],["blk36","Blocks"],["rimchal36","Rim chal"],["rim_dfg_shrunk","Rim D"],["defl36","Deflect"]],
    scoring:    [["pts36","Points"],["USG_PCT","Usage"],["TS_PCT","True shooting"],["fta_rate","FT rate"]],
    playmaking: [["AST_PCT","Assist %"],["potast36","Pot. assists"],["timeposs36","Time of poss"],["tov36","Turnovers"]],
  };
  async function initRoles() {
    const rows = await data("roles");
    const box = $("#roles-body");
    let lens = "shot_diet", role = null, season = "", q = "";
    const seasons = [...new Set(rows.map(r => r.s))].sort();
    $("#roles-season").innerHTML = `<option value="">All seasons</option>` +
      seasons.map(s => `<option>${s}</option>`).join("");
    function roleCounts() {
      const c = {};
      rows.forEach(r => { const k = r.roles[lens][0]; c[k] = (c[k] || 0) + 1; });
      return Object.entries(c).sort((a, b) => b[1] - a[1]);
    }
    function draw() {
      const chips = roleCounts().map(([name, n]) =>
        `<button class="chip ${role === name ? "on" : ""}" data-r="${esc(name)}">${esc(name)} <b>${n}</b></button>`).join("");
      $("#roles-chips").innerHTML = chips;
      $$("#roles-chips .chip").forEach(b => b.addEventListener("click", () => {
        role = role === b.dataset.r ? null : b.dataset.r; draw();
      }));
      let r = rows.filter(x => (!role || x.roles[lens][0] === role) &&
                               (!season || x.s === season) &&
                               (!q || x.n.toLowerCase().includes(q)));
      const pcts = LENS_PCTS[lens];
      const flat = r.map(x => {
        const o = { n: x.n, s: x.s, t: x.t, m: x.m, fit: x.roles[lens][1], role: x.roles[lens][0] };
        pcts.forEach(([k]) => o[k] = x.p[k]);
        return o;
      });
      const cols = [{key:"n",label:"Player",cls:"name"},{key:"s",label:"Season"},{key:"t",label:"Team"},
                    {key:"role",label:"Role",cls:"rolecell"},{key:"fit",label:"Fit",d:2}]
        .concat(pcts.map(([k,l]) => ({key:k,label:l+" pct",d:0,bar:100})));
      table(box, cols, flat, { sort: "fit" });
    }
    $$("#roles-lens .chip").forEach(b => b.addEventListener("click", () => {
      $$("#roles-lens .chip").forEach(x => x.classList.remove("on"));
      b.classList.add("on"); lens = b.dataset.l; role = null; draw();
    }));
    $("#roles-season").addEventListener("change", e => { season = e.target.value; draw(); });
    $("#roles-q").addEventListener("input", e => { q = e.target.value.trim().toLowerCase(); draw(); });
    draw();
  }

  /* ---------- Similarity ---------- */
  async function initSim() {
    const [emb, roles] = await Promise.all([data("embeddings"), data("roles")]);
    const roleMap = {};
    roles.forEach(r => roleMap[r.n + "|" + r.s] = r.roles);
    const list = $("#sim-list");
    list.innerHTML = emb.map((r, i) => `<option value="${esc(r.n)} · ${r.s}">`).join("");
    function run(label) {
      const m = label.split(" · ");
      const i = emb.findIndex(r => r.n === m[0] && r.s === m[1]);
      if (i < 0) return;
      const v = emb[i].v;
      const d = emb.map((r, j) => {
        if (j === i) return null;
        let s = 0;
        for (let k = 0; k < 32; k++) { const t = r.v[k] - v[k]; s += t * t; }
        return { n: r.n, s: r.s, t: r.t, dist: Math.sqrt(s), j };
      }).filter(Boolean).sort((a, b) => a.dist - b.dist).slice(0, 12);
      const rows = d.map(x => {
        const rr = roleMap[x.n + "|" + x.s] || {};
        return { n: x.n, s: x.s, t: x.t, dist: x.dist,
                 sd: rr.shot_diet ? rr.shot_diet[0] : "", df: rr.defense ? rr.defense[0] : "" };
      });
      $("#sim-title").textContent = "Closest style matches to " + label;
      table($("#sim-body"),
        [{key:"n",label:"Player",cls:"name"},{key:"s",label:"Season"},{key:"t",label:"Team"},
         {key:"dist",label:"Distance",d:2},{key:"sd",label:"Shot diet role"},{key:"df",label:"Defensive role"}],
        rows, { sort: "dist", dir: 1, limit: 12 });
    }
    $("#sim-q").addEventListener("change", e => run(e.target.value));
    run("Alex Caruso · 2023-24");
    $("#sim-q").value = "Alex Caruso · 2023-24";
  }

  /* ---------- Trajectory ---------- */
  async function initTraj() {
    const rows = await data("watchlist");
    table($("#traj-body"),
      [{key:"n",label:"Player",cls:"name"},{key:"t",label:"Team"},{key:"a",label:"Age",d:0},
       {key:"m",label:"Minutes",d:0},{key:"pct",label:"Value pct",d:1},{key:"tr",label:"Prior trend",d:1},
       {key:"rise",label:"P(rise)",d:3,bar:1},{key:"fall",label:"P(fall)",d:3,bar:1}],
      rows, { sort: "rise" });
  }

  /* ---------- Clutch ---------- */
  async function initClutch() {
    const rows = await data("clutch");
    table($("#clutch-body"),
      [{key:"n",label:"Player",cls:"name"},{key:"s",label:"Season"},{key:"t",label:"Team"},{key:"a",label:"Age",d:0},
       {key:"base",label:"Ordinary share",d:3},{key:"cl",label:"Clutch share",d:3},
       {key:"lift",label:"Clutch lift",d:3},{key:"poss",label:"Clutch poss"},{key:"score",label:"Bench score",d:2}],
      rows, { sort: "lift" });
  }

  /* ---------- Teams ---------- */
  async function initTeams() {
    const [tb, tp] = await Promise.all([data("teams_bench"), data("teams_playoff")]);
    table($("#teams-bench-body"),
      [{key:"n",label:"Team",cls:"name"},{key:"s",label:"Season"},{key:"net",label:"Net rtg",d:1},
       {key:"snet",label:"Starter net",d:1},{key:"pts",label:"Bench pts share",d:3},
       {key:"ts",label:"Bench TS",d:3},{key:"eff",label:"Effort /36",d:1}],
      tb, { sort: "eff", limit: 15 });
    table($("#teams-po-body"),
      [{key:"n",label:"Team",cls:"name"},{key:"s",label:"Season"},{key:"rs",label:"RS net",d:1},
       {key:"po",label:"Playoff net",d:1},{key:"w",label:"W"},{key:"l",label:"L"},
       {key:"opp",label:"Opp strength",d:1},{key:"adj",label:"Adjusted resid",d:1}],
      tp, { sort: "adj", limit: 15 });
  }

  /* ---------- Tabs ---------- */
  const INIT = { roles: initRoles, similarity: initSim, trajectory: initTraj, clutch: initClutch, teams: initTeams };
  const done = {};
  function show(id) {
    $$(".xp-section").forEach(s => s.hidden = s.id !== "xp-" + id);
    $$(".xp-tabs .chip").forEach(b => b.classList.toggle("on", b.dataset.t === id));
    if (!done[id] && INIT[id]) { done[id] = true; INIT[id](); }
    history.replaceState(null, "", "#" + id);
  }
  $$(".xp-tabs .chip").forEach(b => b.addEventListener("click", () => show(b.dataset.t)));
  const start = location.hash.replace("#", "");
  show(INIT[start] ? start : "roles");
})();
