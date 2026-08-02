/* Scroll-reveal: progressive enhancement only.
   Elements stay fully visible when JS is off, motion is reduced,
   or IntersectionObserver is unavailable. */
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
