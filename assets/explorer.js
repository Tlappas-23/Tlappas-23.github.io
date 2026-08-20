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
        const tipAttr = c.tip ? ` data-tip="${esc(c.tip)}"` : "";
        h += `<th class="${c.cls || ""}"><button data-k="${c.key}"${tipAttr}>${c.label}${arrow}</button></th>`;
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
  const PCT_SUFFIX = " Shown as a within-season percentile, 0 to 100, among all 1,000+ minute players that season; higher always means more of the named skill.";
  const LENS_PCTS = {
    shot_diet:  [["cs_fga36","C&S vol","Catch-and-shoot field goal attempts per 36 minutes."],
                 ["pu_fga36","Pull-up vol","Pull-up jumper attempts per 36 minutes."],
                 ["drives36","Drives","Drives to the basket per 36 minutes."],
                 ["post36","Post","Post touches per 36 minutes."],
                 ["fg3a_rate","3P rate","Share of field goal attempts taken from three."]],
    defense:    [["stl36","Steals","Steals per 36 minutes."],
                 ["blk36","Blocks","Blocks per 36 minutes."],
                 ["rimchal36","Rim chal","Opponent rim attempts this player defended, per 36 minutes: rim-protection workload."],
                 ["rim_dfg_shrunk","Rim D","Opponent field goal percentage at the rim when this player defends it, shrunk toward league average by empirical Bayes (about 60 attempts to be trusted half-and-half) and inverted so higher means better rim defense."],
                 ["defl36","Deflect","Deflections per 36 minutes."]],
    scoring:    [["pts36","Points","Points per 36 minutes."],
                 ["USG_PCT","Usage","Share of team possessions this player finishes with a shot, foul drawn, or turnover while on the floor."],
                 ["TS_PCT","True shooting","Scoring efficiency including threes and free throws: points over 2 x (FGA + 0.44 x FTA)."],
                 ["fta_rate","FT rate","Free throw attempts per field goal attempt: foul-drawing independent of minutes."]],
    playmaking: [["AST_PCT","Assist %","Share of teammate field goals this player assisted while on the floor."],
                 ["potast36","Pot. assists","Passes that would have been assists had the shot gone in, per 36 minutes."],
                 ["timeposs36","Time of poss","Minutes of ball possession per 36 minutes played."],
                 ["tov36","Turnovers","Turnovers per 36 minutes."]],
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
                    {key:"role",label:"Role",cls:"rolecell",tip:"The cluster this player-season is assigned to under the selected lens."},
                    {key:"fit",label:"Fit",d:2,cls:"num",tip:"Assignment confidence: this player's silhouette score for the lens. Near zero means a boundary case between two roles, treated as a hybrid; around +0.3 or higher means comfortably inside the role."}]
        .concat(pcts.map(([k,l,tp]) => ({key:k,label:l,d:0,bar:100,cls:"num",tip:tp + PCT_SUFFIX})));
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
         {key:"dist",label:"Distance",d:2,cls:"num",tip:"Euclidean distance between the two player-seasons in the standardized 32-dimensional style embedding. Smaller means more similar style; the space measures how a player plays, not how well."},
         {key:"sd",label:"Shot diet role",tip:"This player-season's shot-diet cluster from the role-lens study."},
         {key:"df",label:"Defensive role",tip:"This player-season's defensive cluster from the role-lens study."}],
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
      [{key:"n",label:"Player",cls:"name"},{key:"t",label:"Team"},
       {key:"a",label:"Age",d:0,cls:"num",tip:"Age in the 2025-26 season."},
       {key:"m",label:"Minutes",d:0,cls:"num",tip:"Total minutes played in 2025-26. The pool requires 500 or more."},
       {key:"pct",label:"Value pct",d:1,cls:"num",tip:"League-relative value: the player's PIE (the league's all-in-one impact estimate) ranked as a percentile within the 2025-26 season, 0 to 100."},
       {key:"tr",label:"Prior trend",d:1,cls:"num",tip:"Change in value percentile from 2024-25 to 2025-26, in points. Players without a qualifying prior season carry the pool median (about zero)."},
       {key:"rise",label:"P(rise)",d:3,bar:1,cls:"num",tip:"Model probability of gaining more than 10 value-percentile points in 2026-27. A development-evidence estimate driven mainly by current level, age, prior trend, and the geometry of the bounded scale; graded by the season itself."},
       {key:"fall",label:"P(fall)",d:3,bar:1,cls:"num",tip:"Model probability of losing more than 10 value-percentile points in 2026-27, with the same caveats as P(rise)."}],
      rows, { sort: "rise" });
  }

  /* ---------- Clutch ---------- */
  async function initClutch() {
    const rows = await data("clutch");
    table($("#clutch-body"),
      [{key:"n",label:"Player",cls:"name"},{key:"s",label:"Season"},{key:"t",label:"Team"},
       {key:"a",label:"Age",d:0,cls:"num",tip:"Age that season."},
       {key:"base",label:"Ordinary share",d:3,cls:"num",tip:"Share of his team's available non-clutch minutes (team non-clutch minutes times five players): his ordinary role."},
       {key:"cl",label:"Clutch share",d:3,cls:"num",tip:"Share of his team's available clutch minutes, using the league's clutch definition: last five minutes, margin within five points."},
       {key:"lift",label:"Clutch lift",d:3,cls:"num",tip:"Clutch share minus ordinary share: how much the coach promotes (positive) or demotes (negative) this player when the game is tight. The study's trust measure; it repeats year over year at +0.34."},
       {key:"poss",label:"Clutch poss",d:0,cls:"num",tip:"Total clutch possessions that season. The median is 46, which is why the study treats clutch results as noise rather than skill."},
       {key:"score",label:"Bench score",d:2,cls:"num",tip:"Equal-weight z-score composite of clutch lift, non-clutch true shooting, and on-court net rating. Clutch performance is excluded by design, because the reliability gate showed there is nothing in it to weight."}],
      rows, { sort: "lift" });
  }

  /* ---------- Teams (each table stands alone on its study page) ---------- */
  async function initTeamsBench() {
    const tb = await data("teams_bench");
    table($("#teams-bench-body"),
      [{key:"n",label:"Team",cls:"name"},{key:"s",label:"Season"},
       {key:"net",label:"Net rtg",d:1,cls:"num",tip:"Team net rating: points scored minus allowed per 100 possessions over the regular season."},
       {key:"snet",label:"Starter net",d:1,cls:"num",tip:"Net rating of the team's starting lineups. The study's control variable: raw bench numbers mislead without it."},
       {key:"pts",label:"Bench pts share",d:3,cls:"num",tip:"Share of the team's points scored by bench players, using the league's per-game starter definition."},
       {key:"ts",label:"Bench TS",d:3,cls:"num",tip:"Minutes-weighted true shooting of the team's bench players (200+ bench minutes each). The one traditional bench statistic whose association with winning survives the starter control."},
       {key:"eff",label:"Effort /36",d:1,cls:"num",tip:"Deflections + loose balls recovered + charges drawn + contested shots by bench players, per 36 bench minutes. The production-free effort index; its association with winning also survives the starter control."}],
      tb, { sort: "eff", limit: 15 });
  }
  async function initTeamsPlayoff() {
    const tp = await data("teams_playoff");
    table($("#teams-po-body"),
      [{key:"n",label:"Team",cls:"name"},{key:"s",label:"Season"},
       {key:"rs",label:"RS net",d:1,cls:"num",tip:"Regular season net rating: points scored minus allowed per 100 possessions."},
       {key:"po",label:"Playoff net",d:1,cls:"num",tip:"Net rating across that playoff run. Far noisier than the regular season: a seven-game series is a tiny sample."},
       {key:"w",label:"W",d:0,cls:"num",tip:"Playoff wins."},{key:"l",label:"L",d:0,cls:"num",tip:"Playoff losses."},
       {key:"opp",label:"Opp strength",d:1,cls:"num",tip:"Average regular season net rating of the playoff opponents actually faced, weighted by games played. Ranges from -0.5 to +12.7 in this sample."},
       {key:"adj",label:"Adjusted resid",d:1,cls:"num",tip:"Playoff performance relative to what regular season net rating predicts, additionally adjusted for opponent strength. Positive means the team overperformed both its record and its bracket."}],
      tp, { sort: "adj", limit: 15 });
  }

  /* ---------- Auto-init: each study page carries only its own section ---------- */
  const INIT = { "xp-roles": initRoles, "xp-similarity": initSim, "xp-trajectory": initTraj,
                 "xp-clutch": initClutch, "xp-teams-bench": initTeamsBench, "xp-teams-playoff": initTeamsPlayoff };
  for (const id in INIT) {
    const el = document.getElementById(id);
    if (el) { el.hidden = false; INIT[id](); }
  }
})();
