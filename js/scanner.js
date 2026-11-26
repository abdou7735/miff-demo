// Scanner intégré : caméra, cadre vert qui suit la feuille, redressement, plusieurs pages.
import { api } from "./api.js?v=1795724117";
import { h, s, toast } from "./ui.js?v=1795724117";

const canLive = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.isSecureContext);

// Charge une image (fichier ou blob) en tenant compte de la rotation du téléphone, et la réduit.
async function normalize(blob, max = 3000) {
  const bmp = await createImageBitmap(blob).catch(() => null);
  if (!bmp) return blob;
  const sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
}

async function shrink(blob, max = 900) { return normalize(blob, max); }

async function detect(blob) {
  const fd = new FormData();
  fd.append("image", blob, "frame.jpg");
  try { return (await api.form("/api/scan/detect", fd)).quad; } catch { return null; }
}

const DEFAULT_QUAD = [[0.08, 0.08], [0.92, 0.08], [0.92, 0.92], [0.08, 0.92]];

function fitRect(cw, ch, w, h) {
  const k = Math.min(cw / w, ch / h);
  return { x: (cw - w * k) / 2, y: (ch - h * k) / 2, w: w * k, h: h * k };
}

export function openScanner({ onDone, onCancel }) {
  const pages = []; // { blob, url }
  let mode = "color";
  let stream = null, loop = null, stopped = false, auto = true;
  const root = h("div", { class: "cam", role: "dialog", "aria-label": "Scanner un document" });
  document.body.append(root);
  document.body.style.overflow = "hidden";

  function close(result) {
    stopped = true; stopCam();
    root.remove(); document.body.style.overflow = "";
    pages.forEach((p) => URL.revokeObjectURL(p.url));
    result ? onDone(result) : onCancel && onCancel();
  }
  function stopCam() {
    clearTimeout(loop); loop = null;
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  }

  const fileInput = h("input", { type: "file", accept: "image/*", capture: "environment", hidden: true,
    onchange: async (e) => {
      const f = e.target.files[0]; e.target.value = "";
      if (!f) return;
      const img = await normalize(f);
      const q = await detect(await shrink(img));
      adjust(img, q);
    } });

  function thumbs() {
    const last = pages[pages.length - 1];
    return h("div", { class: "thumbs" }, last ? [h("img", { src: last.url, alt: "" }), h("span", { class: "n" }, pages.length)] : null);
  }

  function bottom(shutter) {
    return h("div", { class: "cambot" }, thumbs(), shutter,
      h("button", { class: "camsave", disabled: !pages.length, onclick: review }, pages.length ? `Enregistrer (${pages.length})` : ""));
  }

  // ---------- 1. Prise de vue
  async function capture() {
    stopped = false;
    root.replaceChildren();
    const label = pages.length ? `Page ${pages.length + 1} : placez la suivante` : "Placez la feuille dans le cadre";
    const autoBtn = h("button", { onclick: () => { auto = !auto; autoBtn.textContent = auto ? "Auto" : "Manuel"; } }, auto ? "Auto" : "Manuel");
    root.append(h("div", { class: "camtop" }, h("button", { onclick: () => close() }, "Annuler"), h("span", { class: "pill" }, label), canLive() ? autoBtn : h("span")));

    if (!canLive()) {
      root.append(h("div", { class: "view", style: "display:grid;place-items:center;padding:24px;text-align:center" },
        h("div", {}, h("p", {}, "Touchez le bouton pour prendre la page en photo."),
          h("p", { class: "small", style: "color:#b9cfc3" }, "Le cadre en direct demande une adresse sécurisée (https). Les bords sont quand même détectés après la photo."))),
        bottom(h("button", { class: "shutter", "aria-label": "Prendre la photo", onclick: () => fileInput.click() })), fileInput);
      return;
    }

    const video = h("video", { playsinline: true, autoplay: true, muted: true });
    const overlay = s("svg", {});
    const view = h("div", { class: "view" }, video, overlay);
    const shutter = h("button", { class: "shutter", "aria-label": "Prendre la photo", onclick: () => shoot() });
    root.append(view, bottom(shutter), h("div", { class: "camhint" }, "Le cadre vert suit les bords de la feuille. La photo est redressée et recadrée automatiquement."), fileInput);
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1920 } }, audio: false });
    } catch (e) {
      toast("Caméra indisponible : autorisez-la dans les réglages du téléphone.");
      fileInput.click();
      return;
    }
    video.srcObject = stream;
    await video.play().catch(() => {});
    let quad = null, prev = null, stable = 0, busy = false;
    const small = document.createElement("canvas");

    const drawQuad = () => {
      overlay.replaceChildren();
      if (!quad || !video.videoWidth) return;
      const cw = view.clientWidth, ch = view.clientHeight;
      overlay.setAttribute("viewBox", `0 0 ${cw} ${ch}`);
      const r = fitRect(cw, ch, video.videoWidth, video.videoHeight);
      const pts = quad.map(([x, y]) => [r.x + x * r.w, r.y + y * r.h]);
      overlay.append(s("polygon", { points: pts.map((p) => p.join(",")).join(" "), fill: "rgba(92,196,154,.18)", stroke: "#5cc49a", "stroke-width": "4", "stroke-linejoin": "round" }));
      for (const p of pts) overlay.append(s("circle", { cx: p[0], cy: p[1], r: 9, fill: "#5cc49a" }));
    };

    const tick = async () => {
      if (stopped || !stream) return;
      if (!busy && video.videoWidth) {
        busy = true;
        const k = 480 / Math.max(video.videoWidth, video.videoHeight);
        small.width = Math.round(video.videoWidth * k); small.height = Math.round(video.videoHeight * k);
        small.getContext("2d").drawImage(video, 0, 0, small.width, small.height);
        const blob = await new Promise((r) => small.toBlob(r, "image/jpeg", 0.6));
        quad = await detect(blob);
        busy = false;
        drawQuad();
        if (quad && prev && quad.every((p, i) => Math.hypot(p[0] - prev[i][0], p[1] - prev[i][1]) < 0.02)) stable++;
        else stable = 0;
        prev = quad;
        if (auto && stable >= 3) { stable = 0; shoot(); return; }
      }
      loop = setTimeout(tick, 450);
    };
    tick();

    async function shoot() {
      if (!video.videoWidth) return;
      shutter.disabled = true;
      const c = document.createElement("canvas");
      c.width = video.videoWidth; c.height = video.videoHeight;
      c.getContext("2d").drawImage(video, 0, 0);
      const q = quad;
      stopCam();
      const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.92));
      adjust(blob, q);
    }
  }

  // ---------- 2. Vérifier / ajuster les coins
  function adjust(blob, q) {
    stopped = true; stopCam();
    root.replaceChildren();
    const url = URL.createObjectURL(blob);
    let quad = (q || DEFAULT_QUAD).map((p) => [...p]);
    const img = h("img", { src: url, alt: "Photo de la page" });
    const overlay = s("svg", {});
    const view = h("div", { class: "view" }, img, overlay);
    let drag = -1;
    const rect = () => fitRect(view.clientWidth, view.clientHeight, img.naturalWidth, img.naturalHeight);
    const draw = () => {
      if (!img.naturalWidth) return;
      overlay.replaceChildren();
      overlay.setAttribute("viewBox", `0 0 ${view.clientWidth} ${view.clientHeight}`);
      const r = rect();
      const pts = quad.map(([x, y]) => [r.x + x * r.w, r.y + y * r.h]);
      overlay.append(s("polygon", { points: pts.map((p) => p.join(",")).join(" "), fill: "rgba(92,196,154,.15)", stroke: "#5cc49a", "stroke-width": "3" }));
      pts.forEach((p, i) => overlay.append(s("circle", { class: "handle", cx: p[0], cy: p[1], r: 16, "data-i": i })));
    };
    img.onload = draw;
    window.addEventListener("resize", draw);
    overlay.addEventListener("pointerdown", (e) => {
      const r = view.getBoundingClientRect();
      const rr = rect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      let best = -1, bd = 50;
      quad.forEach(([x, y], i) => { const d = Math.hypot(rr.x + x * rr.w - px, rr.y + y * rr.h - py); if (d < bd) { bd = d; best = i; } });
      drag = best;
      if (drag >= 0) overlay.setPointerCapture(e.pointerId);
    });
    overlay.addEventListener("pointermove", (e) => {
      if (drag < 0) return;
      const r = view.getBoundingClientRect(), rr = rect();
      quad[drag] = [Math.min(1, Math.max(0, (e.clientX - r.left - rr.x) / rr.w)), Math.min(1, Math.max(0, (e.clientY - r.top - rr.y) / rr.h))];
      draw();
    });
    overlay.addEventListener("pointerup", () => { drag = -1; });

    const modes = h("div", { class: "modes" }, [["color", "Couleur"], ["gray", "Gris"], ["bw", "Noir et blanc"]].map(([k, l]) =>
      h("button", { class: mode === k ? "on" : "", onclick: (e) => { mode = k; [...modes.children].forEach((b) => b.classList.remove("on")); e.target.classList.add("on"); } }, l)));
    const ok = h("button", { class: "shutter", "aria-label": "Valider la page", style: "background:#5cc49a" });
    ok.onclick = async () => {
      ok.disabled = true;
      const fd = new FormData();
      fd.append("image", blob, "page.jpg");
      fd.append("quad", JSON.stringify(quad));
      fd.append("mode", mode);
      try {
        const out = await api.form("/api/scan/process", fd);
        pages.push({ blob: out, url: URL.createObjectURL(out) });
        URL.revokeObjectURL(url);
        window.removeEventListener("resize", draw);
        toast(`Page ${pages.length} ajoutée`);
        capture();
      } catch (e) { toast(e.message); ok.disabled = false; }
    };
    root.append(
      h("div", { class: "camtop" }, h("button", { onclick: () => { URL.revokeObjectURL(url); capture(); } }, "Reprendre"),
        h("span", { class: "pill" }, "Ajustez les coins si besoin"), h("span")),
      view, modes,
      h("div", { class: "cambot" }, thumbs(), ok, h("span", { class: "camhint", style: "padding:0;text-align:right" }, "Valider")));
  }

  // ---------- 3. Revoir les pages et créer le PDF
  function review() {
    stopped = true; stopCam();
    root.replaceChildren();
    const grid = h("div", { class: "pages" });
    const render = () => {
      grid.replaceChildren(...pages.map((p, i) => h("figure", {}, h("img", { src: p.url, alt: `Page ${i + 1}` }),
        h("button", { "aria-label": `Retirer la page ${i + 1}`, onclick: () => { URL.revokeObjectURL(p.url); pages.splice(i, 1); pages.length ? render() : capture(); } }, "×"),
        h("figcaption", { class: "small", style: "text-align:center;color:#b9cfc3" }, `Page ${i + 1}`))));
    };
    render();
    root.append(
      h("div", { class: "camtop" }, h("button", { onclick: capture }, "+ Page"), h("span", { class: "pill" }, "Vérifiez les pages"), h("button", { onclick: () => close() }, "Annuler")),
      h("div", { style: "flex:1;overflow:auto" }, grid),
      h("div", { style: "padding:0 18px calc(18px + var(--safeB))" },
        h("button", { class: "btn", onclick: () => close(pages.map((p) => p.blob)) }, `Créer le PDF (${pages.length} page${pages.length > 1 ? "s" : ""})`)));
  }

  capture();
}
