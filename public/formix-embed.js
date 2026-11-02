(function () {
  "use strict";
  var script = document.currentScript;
  var base = script && script.src ? new URL(script.src).origin : window.location.origin;
  document.querySelectorAll("[data-formix-form]").forEach(function (mount) {
    if (mount.dataset.formixMounted) return;
    var formId = mount.getAttribute("data-formix-form");
    if (!formId) return;
    mount.dataset.formixMounted = "true";
    var frame = document.createElement("iframe");
    frame.src = base + "/f/" + encodeURIComponent(formId) + "?embed=1";
    frame.title = mount.getAttribute("data-formix-title") || "Formix form";
    frame.loading = "lazy";
    frame.style.width = "100%";
    frame.style.height = (mount.getAttribute("data-formix-height") || "640") + "px";
    frame.style.border = "0";
    frame.style.display = "block";
    frame.setAttribute("allow", "clipboard-write");
    mount.appendChild(frame);
    window.addEventListener("message", function (event) {
      if (event.origin !== base || event.source !== frame.contentWindow) return;
      if (!event.data || event.data.type !== "formix:resize" || event.data.formId !== formId) return;
      var height = Math.max(320, Math.min(4000, Number(event.data.height) || 640));
      frame.style.height = height + "px";
    });
  });
})();
