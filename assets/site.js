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
