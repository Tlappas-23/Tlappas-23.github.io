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
