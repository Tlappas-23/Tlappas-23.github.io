/*
  Figure viewer.

  The method charts are drawn at roughly 2,100 pixels and rendered into a
  1,120-pixel column, so every axis label on the page is being shown at about
  half the resolution it was drawn for. On a high-density display that reads
  fine; on anything else the reader is squinting at the part that carries the
  argument.

  Clicking a figure opens it at full size, and the caption comes with it. That
  second part is the point: a chart pulled out of its context is a picture, and
  the caption is what makes it evidence.

  Built on <dialog>, which gives focus trapping, Escape-to-close, inertness of
  the page behind, and the top layer without any of it being hand-rolled.
  Progressive enhancement throughout: with JavaScript off, or on a browser
  without dialog support, the figures stay exactly as they are.
*/
(function () {
  "use strict";

  var panels = document.querySelectorAll(".fig-panel");
  if (!panels.length || typeof HTMLDialogElement !== "function") return;

  var dialog = document.createElement("dialog");
  dialog.className = "fig-zoom";
  dialog.innerHTML =
    '<button class="fig-zoom-close" type="button" aria-label="Close figure">Close</button>' +
    '<div class="fig-zoom-scroll"><img alt=""></div>' +
    '<p class="fig-zoom-cap"></p>';
  document.body.appendChild(dialog);

  var zImg = dialog.querySelector("img");
  var zCap = dialog.querySelector(".fig-zoom-cap");

  function open(img, caption) {
    // currentSrc respects any responsive selection the browser already made.
    zImg.src = img.currentSrc || img.src;
    zImg.alt = img.alt;
    zCap.textContent = caption;
    zCap.hidden = !caption;
    dialog.showModal();
    // Lock the page behind so a trackpad flick does not scroll it under the
    // dialog, which <dialog> does not prevent on its own.
    document.body.style.overflow = "hidden";
  }

  dialog.addEventListener("close", function () {
    document.body.style.overflow = "";
    zImg.removeAttribute("src");
  });

  dialog.querySelector(".fig-zoom-close").addEventListener("click", function () {
    dialog.close();
  });

  // Clicking the backdrop closes. The dialog's own box is a child, so a click
  // landing on the dialog element itself can only have hit the backdrop.
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog) dialog.close();
  });

  Array.prototype.forEach.call(panels, function (panel) {
    var img = panel.querySelector("img");
    if (!img) return;

    var fig = panel.closest("figure");
    var capEl = fig && fig.querySelector("figcaption");
    var caption = capEl ? capEl.textContent.trim() : "";

    // The panel becomes the control rather than wrapping the image in a
    // button, so the existing layout and border-radius are untouched.
    panel.classList.add("is-zoomable");
    panel.setAttribute("role", "button");
    panel.setAttribute("tabindex", "0");
    panel.setAttribute("aria-label", "Open figure at full size");

    panel.addEventListener("click", function () { open(img, caption); });
    panel.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open(img, caption);
      }
    });
  });
})();
