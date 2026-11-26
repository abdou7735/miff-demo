// Outils d'affichage communs.
import { api, DEMO } from "./api.js";
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(tag === "svg" || attrs._svg ? "http://www.w3.org/2000/svg" : "http://www.w3.org/1999/xhtml", tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "_svg" || v === false || v == null) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "html") el.innerHTML = v;
    else if (k === "value" && "value" in el) el.value = v;
    else if (k === "checked") el.checked = !!v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

export function s(tag, attrs = {}, ...kids) { return h(tag, { ...attrs, _svg: true }, ...kids); }

export function initials(m) {
  if (!m) return "?";
  const a = (m.first_name || "").trim()[0] || "";
  const b = (m.last_name || "").trim()[0] || ((m.first_name || "").trim()[1] || "");
  return (a + b).toUpperCase();
}

export function fullName(m) { return m ? `${m.first_name} ${m.last_name || ""}`.trim() : ""; }

export function years(m) {
  const b = (m.birth_date || "").slice(0, 4), d = (m.death_date || "").slice(0, 4);
  if (b && d) return `${b} – ${d}`;
  if (d) return `† ${d}`;
  if (m.deceased) return b ? `${b} – †` : "†";
  return b;
}

export function frDate(iso) {
  if (!iso) return "";
  if (/^\d{4}$/.test(iso)) return iso;
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso.replace(" ", "T") + "Z");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

let toastT;
export function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2800);
}

export function sheet(...content) {
  const close = () => wrap.remove();
  const wrap = h("div", { class: "sheet", onclick: (e) => { if (e.target === wrap) close(); } }, h("div", { role: "dialog" }, ...content));
  document.body.append(wrap);
  return close;
}

export function errBox(e) { return h("div", { class: "err" }, e?.message || String(e)); }

const P = {
  tree: "M12 3v6M5 13v-2h14v2M5 13v4M12 9v8M19 13v4M12 3a2 2 0 1 0 0 .01M5 19a2 2 0 1 0 0 .01M12 19a2 2 0 1 0 0 .01M19 19a2 2 0 1 0 0 .01",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  plus: "M12 5v14M5 12h14",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  scan: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16",
  upload: "M12 16V4M7 9l5-5 5 5M5 20h14",
  back: "M15 18l-6-6 6-6",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-5-6",
  home: "M3 11l9-8 9 8M5 9v12h14V9",
  chat: "M4 5h16v11H9l-5 4zM8 9h8M8 12h5",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0",
};
export function icon(name) {
  return s("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" },
    s("path", { d: P[name] }));
}

const FOLDER_COLORS = ["#7fae9a", "#86bba3", "#8db7ad", "#9dbb8a", "#7fa9a6", "#9097a1", "#a3b0a8"];
export function folderIcon(i) {
  const c = FOLDER_COLORS[i % FOLDER_COLORS.length];
  return s("svg", { viewBox: "0 0 44 36", class: "folder", "aria-hidden": "true" },
    s("path", { d: "M2 6a3 3 0 0 1 3-3h12l4 4h18a3 3 0 0 1 3 3v3H2z", fill: c, opacity: ".35" }),
    s("rect", { x: "2", y: "11", width: "40", height: "23", rx: "3", fill: c }));
}

export const VIS_LABEL = { private: "Privé", family: "Toute la famille", custom: "Certaines personnes" };

// Image ou fichier servi par le serveur Miff (dans la démo : par le navigateur lui-même).
export function apiImg(url, attrs = {}) {
  if (!DEMO) return h("img", { ...attrs, src: url });
  const img = h("img", attrs);
  api.get(url).then((b) => { img.src = URL.createObjectURL(b); }).catch(() => { img.alt = "Aperçu indisponible"; });
  return img;
}

export function apiLink(url, attrs, label, filename) {
  if (!DEMO) return h("a", { ...attrs, href: url, target: filename ? null : "_blank" }, label);
  return h("a", { ...attrs, href: "#", onclick: async (e) => {
    e.preventDefault();
    const b = await api.get(url);
    const u = URL.createObjectURL(b);
    if (filename) { const a = h("a", { href: u, download: filename }); document.body.append(a); a.click(); a.remove(); }
    else window.open(u, "_blank");
  } }, label);
}

// Demande de confirmation (remplace confirm(), qui ne marche pas partout).
export function ask(question, yes = "Oui", no = "Annuler") {
  return new Promise((resolve) => {
    let close;
    const done = (v) => { close(); resolve(v); };
    close = sheet(h("h2", {}, question), h("button", { class: "btn", onclick: () => done(true) }, yes), h("button", { class: "btn ghost", onclick: () => done(false) }, no));
  });
}
