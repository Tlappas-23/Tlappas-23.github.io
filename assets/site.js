/* Scroll reveal for elements tagged .reveal.
   Progressive enhancement only: if JavaScript is off, the reader
   prefers reduced motion, or IntersectionObserver is unavailable,
   everything stays fully visible. Each element reveals once and is
   then unobserved so there is no ongoing work. */
document.documentElement.classList.add("js");
(function () {
  var els = document.querySelectorAll(".reveal");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    els.forEach(function (el) { el.classList.add("in"); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { rootMargin: "0px 0px -6% 0px" });
  els.forEach(function (el) { io.observe(el); });
})();

/* Study navigator on the case studies page. Watches the five articles
   and lights up the link for the one currently on screen. Same rules
   as the reveal: no observer support, no navigator, no problem. */
(function () {
  var links = document.querySelectorAll(".side-toc a");
  if (!links.length || !("IntersectionObserver" in window)) return;
  var byId = {};
  links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      links.forEach(function (a) { a.classList.remove("active"); });
      var a = byId[e.target.id];
      if (a) a.classList.add("active");
    });
  }, { rootMargin: "-35% 0px -55% 0px" });
  document.querySelectorAll("article.case[id]").forEach(function (el) { io.observe(el); });
})();

/* Definition tooltips. Any element with data-tip gets a styled tooltip on
   hover and keyboard focus. One fixed-position singleton, so it never gets
   clipped by the tables' scroll containers. */
(function () {
  const tip = document.createElement("div");
  tip.className = "xp-tip";
  tip.hidden = true;
  tip.setAttribute("role", "tooltip");
  document.body.appendChild(tip);
  let current = null;
  function show(el) {
    const text = el.getAttribute("data-tip");
    if (!text) return;
    current = el;
    tip.textContent = text;
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    tip.style.left = "0px"; tip.style.top = "0px";
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = Math.max(8, Math.min(r.left, window.innerWidth - w - 12));
    let y = r.bottom + 8;
    if (y + h > window.innerHeight - 8) y = r.top - h - 8;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }
  function hide() { tip.hidden = true; current = null; }
  document.addEventListener("mouseover", e => {
    const el = e.target.closest("[data-tip]");
    if (el && el !== current) show(el);
    else if (!el) hide();
  });
  document.addEventListener("focusin", e => {
    const el = e.target.closest("[data-tip]");
    if (el) show(el); else hide();
  });
  window.addEventListener("scroll", hide, true);
})();
