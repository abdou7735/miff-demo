// Les écrans de l'appli.
import { api } from "./api.js?v=1795725424";
import { openScanner } from "./scanner.js?v=1795725424";
import { drawTree, familyView } from "./tree.js?v=1795725424";
import { api as _a, DEMO } from "./api.js?v=1795725424";
import { apiImg, apiLink, ask, errBox, folderIcon, frDate, fullName, h, icon, initials, sheet, squareJpeg, toast, VIS_LABEL, years } from "./ui.js?v=1795725424";

export const state = { me: null, members: [], groups: null, treeScale: null, docTab: "dossiers", generation: null, pending: null };

export async function loadMembers() {
  state.members = await api.get("/api/members");
  return state.members;
}
const M = (id) => state.members.find((m) => m.id === id);

function av(m, cls = "") {
  const dead = m && (m.deceased || m.death_date);
  const photo = m && (m.photo || M(m.id)?.photo);
  return h("span", { class: `av ${m && state.me && m.id === state.me.member.id ? "self" : dead ? "dead" : ""} ${photo ? "pic" : ""} ${cls}`,
    style: photo ? `background-image:url("${photo}")` : null }, photo ? "" : initials(m));
}

// ================================================================ WhatsApp

async function whatsappCard() {
  const wa = await api.get("/api/whatsapp").catch(() => null);
  if (!wa) return null;
  const num = h("input", { class: "field", type: "tel", placeholder: "+974 5000 0000", value: wa.my_number ? "+" + wa.my_number : "" });
  const saveNum = h("button", { class: "btn sec", onclick: async () => {
    try { const r = await api.put("/api/whatsapp/me", { number: num.value }); num.value = r.my_number ? "+" + r.my_number : ""; toast(r.my_number ? "Numéro relié" : "Numéro retiré"); } catch (e) { toast(e.message); }
  } }, "Enregistrer mon numéro");
  const head = [h("h3", {}, "📲 Envoyer un document par WhatsApp"),
    h("p", { class: "small muted", style: "margin:0" }, "Envoyez une photo ou un PDF au numéro de Miff sur WhatsApp : il est lu, rangé dans le bon dossier, et vous recevez une réponse. Écrivez un titre en légende si vous voulez.")];
  if (wa.demo) {
    const file = h("input", { type: "file", accept: "image/*,application/pdf", hidden: true });
    const caption = h("input", { class: "field", placeholder: "Légende (facultatif), ex. Bulletin de Maya 2025" });
    const convo = h("div", { class: "wachat" });
    file.onchange = async () => {
      const f = file.files[0]; if (!f) return;
      convo.append(h("div", { class: "wame" }, "📎 ", f.name, caption.value ? h("div", {}, caption.value) : null));
      const wait = h("div", { class: "wabot" }, "… lecture du document");
      convo.append(wait);
      try {
        const fd = new FormData(); fd.append("file", f, f.name); fd.append("caption", caption.value);
        const r = await api.form("/api/whatsapp/simulate", fd);
        wait.replaceChildren(r.reply, h("div", {}, h("a", { href: `#/document/${r.id}` }, "Voir le document")));
      } catch (e) { wait.textContent = "❌ " + e.message; }
      file.value = ""; caption.value = "";
    };
    return h("div", { class: "card" }, head,
      h("p", { class: "small", style: "margin:10px 0 0" }, "Dans la démo, essayez comme si vous l'envoyiez sur WhatsApp :"),
      caption, h("button", { class: "btn", onclick: () => file.click() }, "Envoyer une photo au bot"), file, convo);
  }
  if (!wa.enabled) return h("div", { class: "card" }, head, h("p", { class: "small", style: "margin:10px 0 0" }, state.me.is_admin
    ? "Le bot n'est pas encore activé sur ce NAS. Suivez le guide « Bot WhatsApp » pour le relier à votre numéro WhatsApp Business."
    : "Le bot n'est pas encore activé. Demandez à l'administrateur de la famille."));
  return h("div", { class: "card" }, head,
    wa.bot_number ? h("p", {}, "Numéro de Miff : ", h("a", { href: `https://wa.me/${wa.bot_number.replace(/\D/g, "")}`, target: "_blank", rel: "noopener" }, h("b", {}, wa.bot_number))) : null,
    h("label", { class: "lbl" }, "Mon numéro WhatsApp (avec l'indicatif)"), num, saveNum);
}

// ================================================================ Anniversaires

function localISO(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

// Les anniversaires des prochains jours (personnes en vie dont on connaît la date de naissance).
export function upcomingBirthdays(days = 30) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const out = [];
  for (const m of state.members || []) {
    if (!m.birth_date || m.deceased || m.death_date) continue;
    const [y, mo, d] = m.birth_date.split("-").map(Number);
    if (!y || !mo || !d) continue;
    let next = new Date(today.getFullYear(), mo - 1, d);
    if (next < today) next = new Date(today.getFullYear() + 1, mo - 1, d);
    const inDays = Math.round((next - today) / 86400000);
    if (inDays <= days) out.push({ m, inDays, age: next.getFullYear() - y });
  }
  return out.sort((a, b) => a.inDays - b.inDays || a.m.first_name.localeCompare(b.m.first_name));
}
const whenTxt = (n) => (n === 0 ? "Aujourd'hui" : n === 1 ? "Demain" : `Dans ${n} jours`);

function wishButton(m, label = "Lui souhaiter") {
  if (m.id === state.me.member.id || !m.has_account) return null;
  const key = dmKey(state.me.member.id, m.id);
  return h("a", { class: "btn sec small", href: `#/chat/${key}`, onclick: () => { state.draft = { key, text: `Joyeux anniversaire ${m.first_name} ! 🎂` }; } }, label);
}

function birthdayBanner() {
  const list = upcomingBirthdays(1);
  if (!list.length) return null;
  return h("div", { class: "bday" }, list.map(({ m, inDays, age }) => h("div", { class: "bdayrow" },
    h("span", { class: "bdayic" }, "🎂"),
    h("a", { href: `#/personne/${m.id}` }, av(m)),
    h("span", { class: "bdaytxt" }, m.id === state.me.member.id ? (inDays ? "Demain, c'est ton anniversaire !" : "Joyeux anniversaire ! Toute la famille pense à toi.")
      : [h("b", {}, whenTxt(inDays)), `, ${m.first_name} fête ses ${age} ans`]),
    inDays === 0 ? wishButton(m) : null)));
}

export function birthdaysToday() {
  if (localStorage.getItem("miff-bday-seen") === localISO(new Date())) return 0;
  return upcomingBirthdays(0).filter((b) => b.m.id !== state.me?.member.id).length;
}

function photoSheet(p) {
  const input = h("input", { type: "file", accept: "image/*", hidden: true, onchange: async () => {
    const f = input.files[0]; if (!f) return;
    try {
      const fd = new FormData(); fd.append("photo", await squareJpeg(f), "photo.jpg");
      const r = await api.form(`/api/members/${p.id}/photo`, fd); close(); toast("Photo enregistrée");
      if (p.id === state.me.member.id) state.me.member.photo = r.photo;
      await loadMembers(); window.dispatchEvent(new HashChangeEvent("hashchange"));
    } catch (e) { toast(e.message); }
  } });
  const close = sheet(h("h2", {}, p.id === state.me.member.id ? "Ma photo" : `Photo de ${p.first_name}`),
    h("p", { class: "muted" }, "Elle remplace les initiales dans l'arbre, sur la fiche et dans le chat."),
    input,
    h("button", { class: "btn", onclick: () => input.click() }, p.photo ? "Changer la photo" : "Choisir une photo"),
    p.photo ? h("button", { class: "btn ghost", onclick: async () => {
      try { await api.del(`/api/members/${p.id}/photo`); close(); toast("Photo retirée"); if (p.id === state.me.member.id) state.me.member.photo = ""; await loadMembers(); window.dispatchEvent(new HashChangeEvent("hashchange")); } catch (e) { toast(e.message); }
    } }, "Retirer la photo") : null,
    h("button", { class: "btn ghost", onclick: () => close() }, "Annuler"));
}
function personChip(id) {
  const m = M(id); if (!m) return null;
  return h("a", { class: "person", href: `#/personne/${id}` }, av(m), m.first_name);
}

// ================================================================ Connexion / installation

export function viewLogin() {
  const err = h("div");
  const u = h("input", { class: "field", autocomplete: "username", autocapitalize: "none", id: "u" });
  const p = h("input", { class: "field", type: "password", autocomplete: "current-password", id: "p" });
  const go = async (e) => {
    e.preventDefault(); err.replaceChildren();
    try { await api.post("/api/login", { username: u.value, password: p.value }); location.hash = "#/arbre"; location.reload(); }
    catch (x) { err.replaceChildren(errBox(x)); }
  };
  return h("form", { class: "login", onsubmit: go },
    h("img", { class: "logo", src: "icons/icon-192.png", alt: "" }),
    h("h1", {}, "Bienvenue sur Miff"),
    h("p", {}, "L'arbre et les papiers de la famille, rangés à la maison."),
    h("label", { class: "lbl", for: "u" }, "Identifiant"), u,
    h("label", { class: "lbl", for: "p" }, "Mot de passe"), p,
    err, h("button", { class: "btn", type: "submit" }, "Se connecter"),
    DEMO ? h("div", { class: "hint" }, "Démonstration : identifiant ", h("b", {}, "ambdoulhafour"), " (ou youssra, ibrahim, ines), mot de passe ", h("b", {}, "demo1234"), ".")
      : h("p", { class: "small", style: "margin-top:18px" }, "Pas encore de compte ? Demandez votre lien d'invitation à l'administrateur de la famille."));
}

export function viewSetup() {
  const known = ["Ambdouloih", "Ambdoulhafour", "Youssrine", "Youssra", "Youmna", "Alhadad", "Assad", "Mogni", "Yankoub", "Abder", "Said", ""];
  const f = {};
  const inp = (k, attrs = {}) => (f[k] = h("input", { class: "field", id: k, ...attrs }));
  const sibBox = h("div", { style: "display:grid;gap:8px" });
  const addSib = (v = "") => sibBox.append(h("input", { class: "field", value: v, placeholder: "Prénom", "aria-label": "Prénom d'un frère ou d'une sœur" }));
  known.forEach(addSib);
  const err = h("div");
  const go = async (e) => {
    e.preventDefault(); err.replaceChildren();
    try {
      await api.post("/api/setup", {
        first_name: f.first.value, last_name: f.last.value, sex: f.sex.value, username: f.user.value, password: f.pass.value,
        father: f.father.value, mother: f.mother.value, siblings: [...sibBox.querySelectorAll("input")].map((i) => i.value).filter(Boolean),
      });
      location.hash = "#/arbre"; location.reload();
    } catch (x) { err.replaceChildren(errBox(x)); err.scrollIntoView({ behavior: "smooth" }); }
  };
  return h("form", { class: "login", onsubmit: go },
    h("img", { class: "logo", src: "icons/icon-192.png", alt: "" }),
    h("h1", {}, "Installer Miff"),
    h("p", {}, "Première ouverture : créez votre compte (vous serez l'administrateur) et le début de l'arbre."),
    h("h2", {}, "Vous"),
    h("label", { class: "lbl", for: "first" }, "Prénom"), inp("first", { required: true }),
    h("label", { class: "lbl", for: "last" }, "Nom de famille"), inp("last"),
    h("label", { class: "lbl", for: "sex" }, "Vous êtes"), (f.sex = h("select", { class: "field", id: "sex" }, h("option", { value: "M" }, "Un homme"), h("option", { value: "F" }, "Une femme"))),
    h("label", { class: "lbl", for: "user" }, "Identifiant de connexion"), inp("user", { required: true, autocapitalize: "none", placeholder: "ex. ibra" }),
    h("label", { class: "lbl", for: "pass" }, "Mot de passe (8 caractères minimum)"), inp("pass", { type: "password", required: true, minlength: 8, autocomplete: "new-password" }),
    h("h2", {}, "Vos parents"),
    h("label", { class: "lbl", for: "father" }, "Prénom du père"), inp("father"),
    h("label", { class: "lbl", for: "mother" }, "Prénom de la mère"), inp("mother"),
    h("h2", {}, "Vos frères et sœurs"),
    h("p", { class: "small" }, "Les prénoms déjà connus sont remplis. Votre propre prénom sera ignoré dans cette liste. Complétez la case vide."),
    sibBox, h("button", { type: "button", class: "btn ghost", onclick: () => addSib() }, "+ Ajouter un frère ou une sœur"),
    err, h("button", { class: "btn", type: "submit" }, "Créer la famille"));
}

export async function viewInvite(token) {
  let info;
  try { info = await api.get(`/api/invites/${encodeURIComponent(token)}`); }
  catch (e) { return h("div", { class: "login" }, h("h1", {}, "Lien d'invitation"), errBox(e), h("a", { class: "btn", href: "#/connexion" }, "Aller à la connexion")); }
  const u = h("input", { class: "field", id: "u", autocapitalize: "none", value: info.first_name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "") });
  const p = h("input", { class: "field", id: "p", type: "password", minlength: 8, required: true, autocomplete: "new-password" });
  const err = h("div");
  return h("form", { class: "login", onsubmit: async (e) => {
    e.preventDefault(); err.replaceChildren();
    try { await api.post(`/api/invites/${encodeURIComponent(token)}/accept`, { username: u.value, password: p.value }); location.hash = "#/arbre"; location.reload(); }
    catch (x) { err.replaceChildren(errBox(x)); }
  } },
    h("img", { class: "logo", src: "icons/icon-192.png", alt: "" }),
    h("h1", {}, `Bonjour ${info.first_name} !`),
    h("p", {}, "La famille vous invite sur Miff. Choisissez votre identifiant et votre mot de passe."),
    h("label", { class: "lbl", for: "u" }, "Identifiant"), u,
    h("label", { class: "lbl", for: "p" }, "Mot de passe (8 caractères minimum)"), p,
    err, h("button", { class: "btn", type: "submit" }, "Créer mon compte"));
}

// ================================================================ Arbre et fiches

export async function viewTree() {
  await loadMembers();
  const meId = state.me.member.id;
  if (!state.tree) state.tree = { focus: null, center: meId };
  const st = state.tree;
  if (!M(st.center)) st.center = meId;
  if (st.focus && !M(st.focus)) st.focus = null;
  const world = h("div", { class: "treeworld" });
  const box = h("div", { class: "treecanvas", "aria-label": "Arbre : glissez pour vous déplacer, pincez ou utilisez la molette pour zoomer" }, world);
  const pick = (id) => (location.hash = `#/personne/${id}`);
  const banner = h("div");
  const info = h("div", { class: "hint" });
  // La vue : décalage (x, y) et zoom (k). L'arbre est dessiné une fois, on le déplace en entier.
  const v = { x: 0, y: 0, k: 1 };
  let svg = null, W = 0, H = 0, anim = null;
  const MAX = 2.5, M_ = 8;
  const dims = () => [box.clientWidth || Math.min(window.innerWidth, 560), box.clientHeight || 480];
  // Zoom minimal : tout l'arbre tient dans le cadre.
  const fitK = () => { const [bw, bh] = dims(); return Math.min(1, (bw - 2 * M_) / W, (bh - 2 * M_) / H); };
  const apply = () => {
    const [bw, bh] = dims();
    v.k = Math.min(MAX, Math.max(fitK(), v.k));
    // L'arbre ne sort jamais du cadre : centré s'il est plus petit, bords collés sinon.
    const w = W * v.k, hh = H * v.k;
    v.x = w + 2 * M_ <= bw ? (bw - w) / 2 : Math.min(M_, Math.max(bw - w - M_, v.x));
    v.y = hh + 2 * M_ <= bh ? (bh - hh) / 2 : Math.min(M_, Math.max(bh - hh - M_, v.y));
    world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.k})`;
  };
  const zoomAt = (k, cx, cy) => {
    k = Math.min(MAX, Math.max(fitK(), k));
    v.x = cx - (cx - v.x) * (k / v.k); v.y = cy - (cy - v.y) * (k / v.k); v.k = k; apply();
  };
  const centerOn = (id, fit) => {
    const [bw, bh] = dims();
    if (fit) { v.k = fitK(); apply(); return; }
    const p = svg._pos(id);
    v.x = p ? bw / 2 - p.x * v.k : (bw - W * v.k) / 2;
    v.y = p ? bh / 2 - p.y * v.k : M_;
    apply();
  };
  function render(recenter) {
    const openFamily = (id) => { st.focus = id; st.center = id; anim = "zin"; render(true); };
    svg = drawTree(state.members, meId, pick, { scale: 1, focus: st.focus, onFamily: openFamily });
    W = Number(svg.getAttribute("width")); H = Number(svg.getAttribute("height"));
    world.replaceChildren(svg);
    if (anim) { svg.classList.add(anim); anim = null; }
    // Le cadre prend la hauteur de l'arbre en entier (sans grand vide), dans la limite de l'écran.
    requestAnimationFrame(() => {
      if (box.classList.contains("full")) return;
      const bw = box.clientWidth || 360, need = H * Math.min(1, (bw - 2 * M_) / W) + 2 * M_;
      box.style.height = `${Math.round(Math.max(340, Math.min(need, window.innerHeight * 0.7)))}px`;
      apply();
    });
    const f = st.focus && M(st.focus);
    const sp = f && (f.spouses || []).map(M).filter(Boolean)[0];
    banner.replaceChildren(...(f ? [h("div", { class: "centerbar" },
      h("button", { onclick: () => { const back = st.focus; st.focus = null; st.center = back; anim = "zout"; render(true); } }, "← Toute la famille"),
      h("span", {}, "Famille de ", h("b", {}, f.first_name), sp ? [" & ", h("b", {}, sp.first_name)] : null))] : []));
    const shown = svg.querySelectorAll(".node").length;
    info.textContent = `Glissez pour vous déplacer, pincez (ou molette) pour zoomer. Touchez une personne pour ouvrir sa fiche. Touchez le petit rond à côté de quelqu'un de marié pour voir sa famille.`;
    if (recenter) requestAnimationFrame(() => centerOn(st.center, true));
    else apply();
  }

  // Glisser avec un doigt ou la souris, pincer avec deux doigts.
  const pts = new Map();
  let drag = null, moved = false;
  const local = (e) => { const r = box.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const startGesture = () => {
    const ps = [...pts.values()];
    if (ps.length === 1) drag = { mode: "pan", x: ps[0][0], y: ps[0][1], vx: v.x, vy: v.y };
    else if (ps.length === 2) drag = { mode: "pinch", d: Math.hypot(ps[0][0] - ps[1][0], ps[0][1] - ps[1][1]), k: v.k,
      cx: (ps[0][0] + ps[1][0]) / 2, cy: (ps[0][1] + ps[1][1]) / 2, vx: v.x, vy: v.y };
  };
  box.addEventListener("pointerdown", (e) => {
    if (e.button && e.button !== 0) return;
    pts.set(e.pointerId, local(e)); moved = false; startGesture();
    box.classList.add("grabbing");
  });
  window.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId) || !drag) return;
    pts.set(e.pointerId, local(e));
    const ps = [...pts.values()];
    if (drag.mode === "pan" && ps.length === 1) {
      const dx = ps[0][0] - drag.x, dy = ps[0][1] - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      if (moved) { v.x = drag.vx + dx; v.y = drag.vy + dy; apply(); }
    } else if (drag.mode === "pinch" && ps.length === 2) {
      moved = true;
      const d = Math.hypot(ps[0][0] - ps[1][0], ps[0][1] - ps[1][1]);
      const cx = (ps[0][0] + ps[1][0]) / 2, cy = (ps[0][1] + ps[1][1]) / 2;
      const k = Math.min(MAX, Math.max(fitK(), drag.k * d / drag.d));
      // Le point entre les deux doigts reste sous les doigts.
      v.x = cx - (drag.cx - drag.vx) * (k / drag.k); v.y = cy - (drag.cy - drag.vy) * (k / drag.k); v.k = k; apply();
    }
  });
  const end = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size) startGesture(); else { drag = null; box.classList.remove("grabbing"); }
  };
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
  // Après un glissement, on n'ouvre pas la fiche par erreur.
  box.addEventListener("click", (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  box.addEventListener("wheel", (e) => {
    e.preventDefault();
    const [cx, cy] = local(e);
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) >= 40 && !e.deltaX) zoomAt(v.k * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), cx, cy);
    else { v.x -= e.deltaX; v.y -= e.deltaY; apply(); }
  }, { passive: false });
  box.addEventListener("dblclick", (e) => { const [cx, cy] = local(e); zoomAt(v.k * 1.6, cx, cy); });
  const zoomBtn = (f) => zoomAt(v.k * f, box.clientWidth / 2, box.clientHeight / 2);
  const full = () => {
    const on = !box.classList.contains("full");
    box.classList.toggle("full", on); document.body.classList.toggle("treefull", on);
    requestAnimationFrame(() => centerOn(st.center, true));
  };
  const tools = h("div", { class: "treetools" },
    h("button", { "aria-label": "Dézoomer", onclick: () => zoomBtn(1 / 1.3) }, "−"),
    h("button", { "aria-label": "Zoomer", onclick: () => zoomBtn(1.3) }, "+"),
    h("button", { "aria-label": "Voir tout l'arbre", onclick: () => centerOn(st.center, true) }, "◎"),
    h("button", { "aria-label": "Plein écran", onclick: full }, "⛶"));
  box.append(tools);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && box.classList.contains("full")) full(); });
  window.addEventListener("resize", () => { if (box.isConnected && svg) apply(); });
  window.addEventListener("hashchange", () => document.body.classList.remove("treefull"), { once: true });

  const results = h("div", { class: "wrapchips", style: "margin-top:8px" });
  const search = h("input", { class: "field", type: "search", placeholder: "Chercher quelqu'un (prénom)", "aria-label": "Chercher quelqu'un dans l'arbre", oninput: () => {
    const q = norm(search.value.trim());
    results.replaceChildren(...(q ? state.members.filter((m) => norm(fullName(m)).includes(q)).slice(0, 6).map((m) =>
      h("button", { class: "chip", onclick: () => { goTo(m.id); search.value = ""; results.replaceChildren(); } }, m.first_name, m.relation && m.relation !== "Moi" ? ` · ${m.relation.toLowerCase()}` : "")) : []));
  } });
  // Aller à quelqu'un : dans toute la famille si on l'y voit, sinon dans le foyer qui le contient.
  const goTo = (id) => {
    st.center = id;
    for (const focus of [null, ...homesOf(id)]) {
      if (familyView(state.members, meId, focus).shown.has(id)) { st.focus = focus; break; }
    }
    render(false);
    requestAnimationFrame(() => { v.k = Math.max(fitK(), 1); centerOn(id, false); });
  };
  // Les foyers qui peuvent contenir quelqu'un : le sien, puis celui de ses parents, grands-parents…
  const homesOf = (id) => {
    const out = [], x0 = M(id);
    if (x0 && (x0.spouses?.length || state.members.some((k) => k.father_id === id || k.mother_id === id))) out.push(id);
    for (let x = x0; x; ) {
      const ps = [x.father_id, x.mother_id].map(M).filter(Boolean);
      const blood = ps.find((p) => p.father_id || p.mother_id) || ps[0];
      if (blood) out.push(blood.id);
      x = blood;
    }
    return out;
  };
  render(true);
  const me = M(meId);
  return [
    birthdayBanner(),
    banner,
    box,
    h("div", { class: "legend" }, h("span", {}, h("i", { class: "me" }), "Moi"), h("span", {}, h("i", { style: "background:#d6f0e0" }), h("i", { style: "background:#d6e7fa;margin-left:-4px" }), h("i", { style: "background:#fadbe5;margin-left:-4px" }), "Une couleur par famille"), h("span", {}, h("i", { class: "dead" }), "Décédé")),
    info, search, results,
    h("button", { class: "btn", onclick: () => birthSheet() }, "👶 Annoncer une naissance"),
    h("button", { class: "btn sec", style: "margin-top:10px", onclick: () => editPerson(null, { sibling_of: me?.id }) }, "+ Ajouter un frère ou une sœur"),
  ];
}

function norm(t) { return (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }

export async function viewPerson(id) {
  await loadMembers();
  let p;
  try { p = await api.get(`/api/members/${id}`); } catch (e) { return errBox(e); }
  const isMe = p.id === state.me.member.id;
  const rel = (label, ids) => ids.length ? [h("dt", {}, label), h("dd", {}, h("div", { class: "people" }, ids.map(personChip)))] : [];
  const infos = [];
  const priv = new Set(p.private_fields || []);
  const lock = (k) => (p.can_edit && priv.has(k) ? h("span", { class: "privtag" }, "🔒 privé") : null);
  const info = (k, label, value) => { if (value) infos.push(h("dt", {}, label), h("dd", {}, value, lock(k))); };
  info("birth_date", "Naissance", frDate(p.birth_date));
  info("birth_place", "Lieu de naissance", p.birth_place);
  if (p.death_date || p.deceased) infos.push(h("dt", {}, "Décès"), h("dd", {}, frDate(p.death_date) || "Oui"));
  if (p.birth_name) infos.push(h("dt", {}, "Nom de naissance"), h("dd", {}, p.birth_name));
  info("city", "Habite à", p.city);
  info("job", "Métier", p.job);
  info("phone", "Téléphone", p.phone && h("a", { href: `tel:${p.phone.replace(/\s/g, "")}` }, p.phone));
  info("email", "E-mail", p.email && h("a", { href: `mailto:${p.email}` }, p.email));
  const actions = [];
  actions.push(h("div", { class: "row" },
    h("button", { class: "btn sec", onclick: () => { state.tree = { focus: (p.spouses.length || p.children.length) ? p.id : null, center: p.id }; location.hash = "#/arbre"; } }, "Voir sa famille dans l'arbre"),
    !isMe && p.has_account ? h("a", { class: "btn sec", href: `#/chat/${dmKey(state.me.member.id, p.id)}` }, `Écrire à ${p.first_name}`) : null));
  if (p.can_edit) actions.push(h("div", { class: "row" },
    h("button", { class: "btn sec", onclick: () => editPerson(p) }, "Modifier la fiche"),
    h("button", { class: "btn sec", onclick: () => privacySheet(p, isMe) }, isMe ? "Ce que la famille voit" : "Infos visibles")));
  actions.push(h("div", { class: "row" },
    h("button", { class: "btn sec", onclick: () => editPerson(null, { parent_of: p.id }) }, "+ Parent"),
    h("button", { class: "btn sec", onclick: () => editPerson(null, { spouse_of: p.id }) }, "+ Conjoint"),
    h("button", { class: "btn sec", onclick: () => editPerson(null, childDefaults(p)) }, "+ Enfant")));
  if (state.me.is_admin && !p.has_account) actions.push(h("button", { class: "btn", onclick: () => inviteSheet(p) }, `Inviter ${p.first_name} sur Miff`));
  if (state.me.is_admin && !p.has_account) actions.push(h("button", { class: "btn danger", onclick: async () => {
    if (!await ask(`Retirer ${p.first_name} de l'arbre ?`)) return;
    try { await api.del(`/api/members/${p.id}`); toast("Personne retirée"); location.hash = "#/arbre"; } catch (e) { toast(e.message); }
  } }, "Retirer de l'arbre"));
  return [
    h("div", { class: "prof" }, p.can_edit ? h("button", { class: "avbtn", "aria-label": "Changer la photo", onclick: () => photoSheet(p) }, av(p, "big"), h("span", { class: "avedit" }, "📷")) : av(p, "big"), h("div", {}, h("h2", {}, fullName(p)),
      h("div", { class: "muted" }, [p.relation, years(p), p.has_account ? "a un compte" : "pas encore de compte"].filter(Boolean).join(" · ")))),
    infos.length ? h("div", { class: "card" }, h("dl", { class: "rel", style: "margin:0" }, infos)) : null,
    p.notes ? h("div", { class: "hint" }, p.notes, lock("notes")) : null,
    !p.can_edit && p.hidden_count ? h("p", { class: "muted small" }, `🔒 ${p.first_name} garde ${p.hidden_count > 1 ? p.hidden_count + " infos" : "une info"} pour ${p.sex === "F" ? "elle" : "lui"}.`) : null,
    h("h2", {}, isMe ? "Mes documents" : `Documents de ${p.first_name}`),
    p.documents.length ? h("div", { class: "card" }, p.documents.map(docRow)) : h("div", { class: "hint" }, "Aucun document visible pour vous."),
    h("h2", {}, "Sa famille"),
    h("div", { class: "card" }, h("dl", { class: "rel", style: "margin:0" },
      rel("Parents", p.parents), rel(p.spouses.length > 1 ? "Conjoints" : "Conjoint", p.spouses), rel("Frères et sœurs", p.siblings), rel("Enfants", p.children)),
      !p.parents.length && !p.spouses.length && !p.siblings.length && !p.children.length ? h("p", { class: "muted", style: "margin:0" }, "Pas encore de liens dans l'arbre.") : null),
    ...actions,
  ];
}

const INFO_LABELS = [["birth_date", "Date de naissance"], ["birth_place", "Lieu de naissance"], ["city", "Ville"], ["job", "Métier"],
  ["phone", "Téléphone"], ["email", "E-mail"], ["notes", "Notes, souvenirs"]];

function memberBody(p, extra = {}) {
  const k = ["first_name", "last_name", "birth_name", "sex", "birth_date", "birth_place", "death_date", "deceased", "notes",
    "phone", "email", "city", "job", "father_id", "mother_id"];
  return { ...Object.fromEntries(k.map((x) => [x, p[x] ?? ""])), father_id: p.father_id, mother_id: p.mother_id, deceased: !!p.deceased, ...extra };
}

function privacySheet(p, isMe) {
  const priv = new Set(p.private_fields || []);
  const boxes = INFO_LABELS.map(([k, label]) => {
    const cb = h("input", { type: "checkbox", checked: !priv.has(k) });
    cb.dataset.k = k;
    return h("label", { class: "privrow" }, h("span", {}, h("b", {}, label), h("small", { class: "muted" }, p[k] ? (k === "birth_date" ? frDate(p[k]) : String(p[k]).slice(0, 40)) : "pas rempli")), cb);
  });
  const err = h("div");
  const close = sheet(h("h2", {}, isMe ? "Ce que la famille voit" : `Infos de ${p.first_name} visibles par la famille`),
    h("p", { class: "muted" }, "Coché : toute la famille le voit sur ta fiche. Décoché : seulement toi (et l'administrateur)."),
    h("div", { class: "card" }, boxes),
    err,
    h("button", { class: "btn", onclick: async () => {
      const private_fields = boxes.map((b) => b.querySelector("input")).filter((c) => !c.checked).map((c) => c.dataset.k);
      try { await api.patch(`/api/members/${p.id}`, memberBody(p, { private_fields })); close(); toast("C'est enregistré"); window.dispatchEvent(new HashChangeEvent("hashchange")); }
      catch (x) { err.replaceChildren(errBox(x)); }
    } }, "Enregistrer"),
    h("button", { class: "btn ghost", onclick: () => close() }, "Annuler"));
}

function childDefaults(p) {
  const o = {};
  if (p.sex === "F") o.mother_id = p.id; else o.father_id = p.id;
  const sp = p.spouses[0];
  if (sp) { const s = M(sp); if (s) { if (p.sex === "F") o.father_id = s.id; else o.mother_id = s.id; } }
  return o;
}

function editPerson(p, preset = {}) {
  const isNew = !p;
  p = p || { first_name: "", last_name: "", birth_name: "", sex: "", birth_date: "", birth_place: "", death_date: "", deceased: false, notes: "", phone: "", email: "", city: "", job: "", father_id: null, mother_id: null, ...preset };
  const f = {};
  const field = (k, label, attrs = {}) => [h("label", { class: "lbl", for: "e-" + k }, label), (f[k] = h("input", { class: "field", id: "e-" + k, value: p[k] || "", ...attrs }))];
  const peopleSelect = (k, sex) => {
    f[k] = h("select", { class: "field", id: "e-" + k }, h("option", { value: "" }, "Inconnu(e)"),
      state.members.filter((m) => m.id !== p.id && (!m.sex || m.sex === sex)).sort((a, b) => a.first_name.localeCompare(b.first_name))
        .map((m) => h("option", { value: m.id, selected: p[k] === m.id }, fullName(m))));
    return f[k];
  };
  let title = isNew ? "Ajouter une personne" : `Modifier ${p.first_name}`;
  if (preset.parent_of) title = `Ajouter un parent de ${M(preset.parent_of)?.first_name}`;
  if (preset.spouse_of) title = `Ajouter le conjoint de ${M(preset.spouse_of)?.first_name}`;
  if (preset.sibling_of) title = `Ajouter un frère ou une sœur`;
  const err = h("div");
  const showParents = !preset.parent_of && !preset.sibling_of && !preset.spouse_of;
  const close = sheet(h("form", { onsubmit: async (e) => {
    e.preventDefault();
    const body = {
      first_name: f.first_name.value, last_name: f.last_name.value, birth_name: f.birth_name.value, sex: f.sex.value,
      birth_date: f.birth_date.value, birth_place: f.birth_place.value, death_date: f.death_date.value, deceased: f.deceased.checked,
      notes: f.notes.value, phone: f.phone.value, email: f.email.value, city: f.city.value, job: f.job.value,
      father_id: showParents ? (Number(f.father_id.value) || null) : p.father_id,
      mother_id: showParents ? (Number(f.mother_id.value) || null) : p.mother_id,
      parent_of: preset.parent_of, spouse_of: preset.spouse_of, sibling_of: preset.sibling_of,
    };
    try {
      if (isNew) { const r = await api.post("/api/members", body); close(); toast("Personne ajoutée"); location.hash = `#/personne/${r.id}`; }
      else { await api.patch(`/api/members/${p.id}`, body); close(); toast("Fiche enregistrée"); window.dispatchEvent(new HashChangeEvent("hashchange")); }
    } catch (x) { err.replaceChildren(errBox(x)); }
  } },
    h("h2", {}, title),
    field("first_name", "Prénom", { required: true }), field("last_name", "Nom"),
    h("label", { class: "lbl", for: "e-sex" }, "Sexe"),
    (f.sex = h("select", { class: "field", id: "e-sex" }, [["", "—"], ["M", "Homme"], ["F", "Femme"]].map(([v, l]) => h("option", { value: v, selected: p.sex === v }, l)))),
    field("birth_date", "Date de naissance", { type: "date" }), field("birth_place", "Lieu de naissance"),
    field("birth_name", "Nom de naissance (si différent)"),
    field("city", "Ville où il ou elle habite"), field("job", "Métier"),
    field("phone", "Téléphone", { type: "tel" }), field("email", "E-mail", { type: "email" }),
    showParents ? [h("label", { class: "lbl", for: "e-father_id" }, "Père"), peopleSelect("father_id", "M"), h("label", { class: "lbl", for: "e-mother_id" }, "Mère"), peopleSelect("mother_id", "F")] : null,
    h("label", { class: "lbl" }, (f.deceased = h("input", { type: "checkbox", checked: !!p.deceased })), "Décédé(e)"),
    field("death_date", "Date de décès", { type: "date" }),
    h("label", { class: "lbl", for: "e-notes" }, "Notes, souvenirs"), (f.notes = h("textarea", { class: "field", id: "e-notes" }, p.notes || "")),
    err, h("button", { class: "btn", type: "submit" }, "Enregistrer"), h("button", { class: "btn ghost", type: "button", onclick: () => close() }, "Annuler")));
}

async function inviteSheet(p) {
  try {
    const { token } = await api.post("/api/invites", { member_id: p.id });
    const url = `${location.origin}/#/invitation/${token}`;
    const text = `${p.first_name}, voici ton lien pour rejoindre Miff, l'appli de la famille : ${url}`;
    sheet(h("h2", {}, `Inviter ${p.first_name}`),
      h("p", {}, "Envoyez ce lien à la personne (WhatsApp, SMS…). Il est valable 14 jours et ne sert qu'une fois."),
      h("div", { class: "linkbox" }, url),
      navigator.share ? h("button", { class: "btn", onclick: () => navigator.share({ title: "Miff", text }).catch(() => {}) }, "Partager le lien") : null,
      h("button", { class: "btn sec", onclick: () => navigator.clipboard?.writeText(url).then(() => toast("Lien copié")) }, "Copier le lien"),
      h("a", { class: "btn ghost", href: `https://wa.me/?text=${encodeURIComponent(text)}`, target: "_blank", rel: "noopener" }, "Envoyer par WhatsApp"));
  } catch (e) { toast(e.message); }
}

// ================================================================ Documents

function visBadge(d) {
  let txt = VIS_LABEL[d.visibility] || "Privé";
  if (d.visibility === "custom" && d.targets?.length) txt = targetsLabel(d.targets);
  return h("span", { class: `badge b-${d.visibility}` }, d.visibility === "private" ? "🔒 " : "", txt);
}

function targetsLabel(targets) {
  const names = targets.map((t) => {
    const [k, v] = t.split(":");
    if (k === "rel") return (state.me.relation_groups[v] || v).replace(/^Mes |^Mon /, "").replace(/^./, (c) => c.toUpperCase());
    if (k === "mem") return M(Number(v))?.first_name || "?";
    if (k === "grp") return state.groups?.custom.find((g) => g.id === Number(v))?.name || "Groupe";
    return t;
  });
  return names.slice(0, 3).join(", ") + (names.length > 3 ? "…" : "");
}

// Document qui expire bientôt (ou déjà expiré).
function expiryInfo(d) {
  if (!d.expires_on) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(d.expires_on + "T00:00:00") - today) / 86400000);
  if (days > 120) return null;
  if (days < 0) return { cls: "exp-red", txt: `Expiré depuis le ${frDate(d.expires_on)}`, short: "⛔ Expiré" };
  const when = days === 0 ? "aujourd'hui" : days < 31 ? `dans ${days} jour${days > 1 ? "s" : ""}` : `dans ${Math.round(days / 30)} mois`;
  return { cls: days < 31 ? "exp-red" : "exp-warn", txt: `Expire ${when} (le ${frDate(d.expires_on)})`, short: `⚠️ Expire ${when}` };
}
function expiryBadge(d) { const e = expiryInfo(d); return e ? h("span", { class: `badge ${e.cls}` }, e.short) : null; }

function docRow(d) {
  if (d.locked) {
    const st = d.request?.status === "pending" ? "Demande envoyée" : d.request?.status === "refused" ? "Demande refusée" : "Demander l'accès";
    return h("a", { class: "doc locked", href: `#/document/${d.id}` },
      h("span", { class: "ic lock" }, icon("lock")),
      h("span", {}, h("b", {}, d.title), h("span", { class: "m" }, [d.folder_name, d.person_name, d.owner_name ? `ajouté par ${d.owner_name}` : ""].filter(Boolean).join(" · ")), h("br"),
        h("span", { class: "badge b-private" }, "🔒 ", st)));
  }
  const meta = [d.person_name, d.year, !d.mine && d.owner_name ? `ajouté par ${d.owner_name}` : ""].filter(Boolean).join(" · ");
  return h("a", { class: "doc", href: `#/document/${d.id}` },
    h("span", { class: "ic" }, "PDF"),
    h("span", {}, h("b", {}, d.title), h("span", { class: "m" }, [d.folder_name, meta].filter(Boolean).join(" · ")), h("br"), visBadge(d), " ", expiryBadge(d)));
}

export async function viewDocuments() {
  if (!state.groups) state.groups = await api.get("/api/groups").catch(() => null);
  const box = h("div");
  const tabs = h("div", { class: "sub" });
  const gens = h("div", { class: "chips" });
  const search = h("input", { class: "field", type: "search", placeholder: "Rechercher (ex. bulletin 2012, Yusra…)", style: "margin-top:12px",
    oninput: debounce(() => render(), 300) });
  let data;
  async function render() {
    const gq = state.generation == null ? "" : `generation=${state.generation}`;
    data = await api.get(`/api/folders?${gq}`);
    tabs.replaceChildren(...[["dossiers", "Dossiers"], ["mine", `Les miens (${data.mine_count})`], ["shared", `Partagés (${data.shared_count})`]].map(([k, l]) =>
      h("button", { class: state.docTab === k ? "on" : "", onclick: () => { state.docTab = k; render(); } }, l)));
    gens.replaceChildren(h("button", { class: `chip ${state.generation == null ? "on" : ""}`, onclick: () => { state.generation = null; render(); } }, "Toute la famille"),
      ...data.generations.map((g) => h("button", { class: `chip ${state.generation === g.value ? "on" : ""}`, onclick: () => { state.generation = g.value; render(); } }, g.label)));
    if (search.value.trim()) {
      const docs = await api.get(`/api/documents?q=${encodeURIComponent(search.value)}&${gq}`);
      box.replaceChildren(docs.length ? h("div", { class: "card" }, docs.map(docRow)) : h("div", { class: "empty" }, "Aucun document trouvé."));
      return;
    }
    if (state.docTab === "dossiers") {
      box.replaceChildren(h("div", { class: "card" }, data.folders.map((f, i) =>
        h("a", { class: "frow", href: `#/dossier/${f.id}` }, folderIcon(i), h("span", {}, h("b", {}, f.name), h("small", {}, f.children.map((c) => c.name).join(", "))), h("em", {}, f.count)))),
        h("div", { class: "hint" }, "Les documents sont rangés automatiquement. Vous ne voyez que ceux qui vous sont partagés. Choisissez une génération pour ne voir que ses documents."));
    } else {
      const docs = await api.get(`/api/documents?scope=${state.docTab}&${gq}`);
      box.replaceChildren(docs.length ? h("div", { class: "card" }, docs.map(docRow)) : h("div", { class: "empty" }, state.docTab === "mine" ? "Vous n'avez encore ajouté aucun document." : "Personne ne vous a encore partagé de document."));
    }
  }
  await render();
  return [tabs, gens, search, box];
}

export async function viewFolder(id) {
  if (!state.groups) state.groups = await api.get("/api/groups").catch(() => null);
  const gq = state.generation == null ? "" : `&generation=${state.generation}`;
  const data = await api.get(`/api/folders?${gq.slice(1)}`);
  const top = data.folders.find((f) => f.id === id) || data.folders.find((f) => f.children.some((c) => c.id === id));
  if (!top) return errBox("Dossier introuvable");
  const sub = top.id === id ? null : top.children.find((c) => c.id === id);
  const docs = await api.get(`/api/documents?folder=${id}${gq}`);
  const people = [...new Set(docs.map((d) => d.person_id).filter(Boolean))];
  const list = h("div");
  const show = (pid) => {
    const ds = pid ? docs.filter((d) => d.person_id === pid) : docs;
    list.replaceChildren(ds.length ? h("div", { class: "card" }, ds.map(docRow)) : h("div", { class: "empty" }, "Aucun document ici pour le moment."));
  };
  const chips = people.length > 1 ? h("div", { class: "chips" }, h("button", { class: "chip on", onclick: (e) => pick(e, null) }, "Tous"),
    people.map((pid) => h("button", { class: "chip", onclick: (e) => pick(e, pid) }, M(pid)?.first_name || "?"))) : null;
  function pick(e, pid) { chips.querySelectorAll(".chip").forEach((c) => c.classList.remove("on")); e.target.classList.add("on"); show(pid); }
  show(null);
  return [
    h("div", { class: "crumb" }, h("a", { href: "#/documents" }, "Documents"), "›", sub ? [h("a", { href: `#/dossier/${top.id}` }, top.name), "›", h("span", {}, sub.name)] : h("span", {}, top.name)),
    !sub ? h("div", { class: "card" }, top.children.map((c, i) => h("a", { class: "frow", href: `#/dossier/${c.id}` }, folderIcon(i + 2), h("span", {}, h("b", {}, c.name)), h("em", {}, c.count)))) : null,
    !sub && docs.length ? h("h2", {}, "Tous les documents") : null,
    chips, list,
  ];
}

export async function viewDocument(id) {
  if (!state.groups) state.groups = await api.get("/api/groups").catch(() => null);
  let d;
  try { d = await api.get(`/api/documents/${id}`); } catch (e) { return errBox(e); }
  if (d.locked) return lockedDocView(d);
  const fileUrl = `/api/documents/${id}/file`;
  const fields = Object.values(d.fields || {});
  const out = [
    h("div", { class: "crumb" }, h("a", { href: "#/documents" }, "Documents"), "›", h("span", {}, d.parent_folder_name), "›", h("a", { href: `#/dossier/${d.folder_id}` }, d.folder_name)),
    h("h2", { style: "margin-top:4px" }, d.title),
    h("div", { class: "muted small" }, [d.doc_type_label, d.person_name, `${d.pages} page${d.pages > 1 ? "s" : ""}`, `ajouté le ${frDate(d.created_at)}`, !d.mine ? `par ${d.owner_name}` : ""].filter(Boolean).join(" · ")),
    visBadge(d),
    (() => { const e = expiryInfo(d); return e ? h("div", { class: `expbox ${e.cls}` }, e.cls === "exp-red" ? "⛔ " : "⚠️ ", e.txt, ". Pensez à le renouveler.") : null; })(),
    d.seen_by ? h("div", { class: "seen" }, `Visible par : ${d.seen_by.join(", ") || "personne d'autre"}`) : null,
    h("div", { class: "pageimgs" }, Array.from({ length: Math.min(d.pages, 20) }, (_, i) =>
      apiImg(`/api/documents/${id}/page/${i + 1}`, { alt: `Page ${i + 1}`, loading: "lazy" }))),
    h("div", { class: "row" }, apiLink(fileUrl, { class: "btn" }, "Ouvrir"), apiLink(fileUrl + "?download=1", { class: "btn sec" }, "Télécharger", d.title + (d.mime === "application/pdf" ? ".pdf" : ".jpg"))),
    fields.length ? h("div", { class: "card" }, h("h3", {}, "Informations"), h("dl", { class: "rel", style: "margin:0" }, fields.map((f) => [h("dt", {}, f.label), h("dd", {}, f.value)]))) : null,
  ];
  if (d.granted_until !== undefined) out.splice(4, 0, h("div", { class: "seen" }, d.granted_until ? `Accès accordé jusqu'au ${frDate(d.granted_until)}` : "Accès accordé sans limite de durée"));
  if (d.mine && d.pending_requests?.length) out.push(h("h2", {}, "Demandes en attente"), ...d.pending_requests.map((r) => requestCard(r)));
  if (d.mine && d.grants?.length) out.push(h("div", { class: "card" }, h("h3", {}, "Accès accordés à la demande"),
    d.grants.map((g) => h("div", { class: "set" }, h("span", {}, h("b", {}, g.name), " · ", g.until ? `jusqu'au ${frDate(g.until)}` : "sans limite"),
      h("button", { class: "linkbtn", onclick: async () => { if (!await ask(`Retirer l'accès de ${g.name} ?`)) return; await api.del(`/api/documents/${id}/grants/${g.member_id}`); toast("Accès retiré"); window.dispatchEvent(new HashChangeEvent("hashchange")); } }, "Retirer")))));
  if (d.mine) {
    out.push(h("button", { class: "btn ghost", onclick: () => location.hash = `#/modifier/${id}` }, "Modifier ou changer qui le voit"));
    out.push(h("button", { class: "btn danger", onclick: async () => {
      if (!await ask("Supprimer définitivement ce document ?")) return;
      await api.del(`/api/documents/${id}`); toast("Document supprimé"); location.hash = "#/documents";
    } }, "Supprimer"));
  }
  return out;
}

// ================================================================ Ajouter (scanner, importer, vérifier)

export function viewAdd() {
  const fileIn = h("input", { type: "file", accept: "application/pdf,image/*", multiple: true, hidden: true,
    onchange: (e) => { const fs = [...e.target.files]; e.target.value = ""; if (fs.length) analyze(fs); } });
  const status = h("div");
  async function analyze(files) {
    status.replaceChildren(h("div", { class: "card", style: "text-align:center" }, h("div", { class: "spinner" }), h("b", {}, "Lecture du document…"), h("p", { class: "muted small" }, "Le NAS lit le texte et cherche de quel document il s'agit. Cela peut prendre quelques secondes.")));
    const fd = new FormData();
    files.forEach((f, i) => fd.append("files", f, f.name || `page-${i + 1}.jpg`));
    try {
      const r = await api.form("/api/uploads", fd);
      state.pending = r;
      location.hash = "#/verifier";
    } catch (e) { status.replaceChildren(errBox(e)); }
  }
  return [
    h("button", { class: "scanbig", onclick: () => openScanner({ onDone: (blobs) => analyze(blobs.map((b, i) => new File([b], `scan-page-${i + 1}.jpg`, { type: "image/jpeg" }))) }) },
      icon("scan"), h("span", {}, h("b", {}, "Scanner un document"), h("small", {}, "Avec l'appareil photo. Bords détectés, plusieurs pages, un seul PDF."))),
    h("button", { class: "scanbig alt", style: "margin-top:12px", onclick: () => fileIn.click() },
      icon("upload"), h("span", {}, h("b", {}, "Importer un fichier"), h("small", {}, "PDF ou photos déjà sur le téléphone."))),
    fileIn, status,
    h("div", { class: "hint" }, "Après l'envoi, Miff reconnaît le document (bulletin, acte de naissance…), remplit les cases et propose le bon dossier. Vous vérifiez, puis vous validez."),
  ];
}

export async function viewVerify() {
  const pend = state.pending;
  if (!pend) { location.hash = "#/ajouter"; return []; }
  const s = pend.suggestion;
  await loadMembers();
  return docForm({
    header: h("div", { class: "detected" }, h("b", {}, pend.filename + (pend.pages > 1 ? ` (${pend.pages} pages)` : "")),
      s.recognized ? `Reconnu : ${s.doc_type_label.toLowerCase()}. Les cases sont remplies avec ce qui a été lu sur le document.`
        : pend.text_found ? "Type de document non reconnu : choisissez le dossier vous-même." : "Aucun texte lisible : remplissez les cases vous-même."),
    preview: `/api/uploads/${pend.upload_id}/preview`,
    values: { title: s.title, folder_id: s.folder_id, person_id: s.person_id, year: s.year, fields: s.fields, doc_type: s.doc_type, visibility: s.visibility.visibility, targets: s.visibility.targets },
    warn: { title: s.type_confidence < 0.6, folder_id: s.type_confidence < 0.6, person_id: s.person_confidence < 0.6 },
    submitLabel: "Valider et ranger",
    onSubmit: async (body) => {
      const r = await api.post("/api/documents", { ...body, upload_id: pend.upload_id, doc_type: s.doc_type });
      state.pending = null; toast("Document rangé"); location.hash = `#/document/${r.id}`;
    },
  });
}

export async function viewEditDoc(id) {
  const d = await api.get(`/api/documents/${id}`);
  await loadMembers();
  return docForm({
    header: null, preview: null,
    values: { title: d.title, folder_id: d.folder_id, person_id: d.person_id, year: d.year, fields: d.fields, visibility: d.visibility, targets: d.targets, hidden: d.hidden },
    warn: {}, submitLabel: "Enregistrer",
    onSubmit: async (body) => { await api.patch(`/api/documents/${id}`, body); toast("Modifications enregistrées"); location.hash = `#/document/${id}`; },
  });
}

async function docForm({ header, preview, values, warn, submitLabel, onSubmit }) {
  const fdata = await api.get("/api/folders");
  if (!state.groups) state.groups = await api.get("/api/groups");
  const groups = state.groups;
  const tag = (on) => on ? h("span", { class: "tag warn" }, "À vérifier") : null;
  const title = h("input", { class: `field ${warn.title ? "warn" : ""}`, id: "d-title", value: values.title || "", required: true });
  const folder = h("select", { class: `field ${warn.folder_id ? "warn" : ""}`, id: "d-folder" },
    fdata.folders.map((t) => h("optgroup", { label: t.name }, t.children.map((c) => h("option", { value: c.id, selected: c.id === values.folder_id }, c.name)))));
  const person = h("select", { class: `field ${warn.person_id ? "warn" : ""}`, id: "d-person" }, h("option", { value: "" }, "Personne en particulier"),
    state.members.slice().sort((a, b) => a.first_name.localeCompare(b.first_name)).map((m) => h("option", { value: m.id, selected: m.id === values.person_id }, fullName(m) + (m.id === state.me.member.id ? " (moi)" : ""))));
  const year = h("input", { class: "field", id: "d-year", inputmode: "numeric", value: values.year || "", placeholder: "ex. 2013" });
  // Date d'expiration (carte d'identité, passeport…) : Miff prévient avant qu'elle arrive.
  const hasExp = values.fields && values.fields.expiration;
  const expIn = hasExp ? null : h("input", { class: "field", id: "d-exp", type: "date" });
  const fieldInputs = {};
  const fieldsBox = Object.entries(values.fields || {}).map(([k, f]) => {
    const low = f.confidence != null && f.confidence < 0.6;
    fieldInputs[k] = { label: f.label, el: h("input", { class: `field ${low ? "warn" : ""}`, value: f.value }) };
    return [h("label", { class: "lbl" }, f.label, tag(low)), fieldInputs[k].el];
  });

  // Qui peut voir ?
  let vis = values.visibility || "private";
  const targets = new Set(values.targets || []);
  const optsBox = h("div", { class: "opts" });
  const customBox = h("div");
  const seen = h("div", { class: "seen" });
  let hidden = !!values.hidden;
  const hideBox = h("div");
  const renderVis = () => {
    hideBox.replaceChildren(vis === "family" ? null : h("label", { class: "lbl", style: "font-weight:500" }, h("input", { type: "checkbox", checked: hidden, onchange: (e) => { hidden = e.target.checked; } }),
      "Cacher complètement aux autres (sans cadenas, on ne peut pas le demander)"));
    optsBox.replaceChildren(...[["private", "Privé", "Moi seulement (et la personne concernée)"], ["custom", "Certaines personnes", "Un groupe ou des personnes choisies"], ["family", "Toute la famille", "Tous les membres de Miff"]].map(([k, l, d]) =>
      h("label", { class: `opt ${vis === k ? "on" : ""}` }, h("input", { type: "radio", name: "vis", checked: vis === k, onchange: () => { vis = k; renderVis(); } }), h("span", {}, h("b", {}, l), h("small", {}, d)))));
    if (vis !== "custom") { customBox.replaceChildren(); return; }
    const chip = (key, label) => h("button", { type: "button", class: `chip ${targets.has(key) ? "on" : ""}`, onclick: () => { targets.has(key) ? targets.delete(key) : targets.add(key); renderVis(); } }, label);
    customBox.replaceChildren(
      h("div", { class: "lbl" }, "Groupes"),
      h("div", { class: "wrapchips" }, groups.relations.map((g) => chip(`rel:${g.key}`, g.name)), groups.custom.map((g) => chip(`grp:${g.id}`, g.name))),
      h("div", { class: "lbl" }, "Ou des personnes"),
      h("div", { class: "wrapchips" }, state.members.filter((m) => m.id !== state.me.member.id).sort((a, b) => a.first_name.localeCompare(b.first_name)).map((m) => chip(`mem:${m.id}`, m.first_name))),
      seen);
    const ids = new Set();
    for (const t of targets) {
      const [k, v] = t.split(":");
      if (k === "rel") (groups.relations.find((g) => g.key === v)?.member_ids || []).forEach((i) => ids.add(i));
      if (k === "grp") (groups.custom.find((g) => g.id === Number(v))?.member_ids || []).forEach((i) => ids.add(i));
      if (k === "mem") ids.add(Number(v));
    }
    seen.textContent = ids.size ? `Le verront : ${[...ids].map((i) => M(i)?.first_name).filter(Boolean).join(", ")}` : "Choisissez au moins un groupe ou une personne.";
  };
  renderVis();
  const err = h("div");
  const btn = h("button", { class: "btn", type: "submit" }, submitLabel);
  return h("form", { onsubmit: async (e) => {
    e.preventDefault(); err.replaceChildren();
    if (vis === "custom" && !targets.size) { err.replaceChildren(errBox("Choisissez qui peut voir le document.")); return; }
    const fields = {};
    for (const [k, f] of Object.entries(fieldInputs)) fields[k] = { label: f.label, value: f.el.value };
    if (expIn && expIn.value) { const [y, mo, d] = expIn.value.split("-"); fields.expiration = { label: "Date d'expiration", value: `${d}/${mo}/${y}` }; }
    btn.disabled = true;
    try {
      await onSubmit({ title: title.value, folder_id: Number(folder.value), person_id: Number(person.value) || null, year: year.value, fields, visibility: vis, targets: [...targets], hidden: vis !== "family" && hidden });
    } catch (x) { err.replaceChildren(errBox(x)); btn.disabled = false; }
  } },
    header,
    preview ? h("details", { style: "margin-top:12px", open: true }, h("summary", { class: "muted" }, "Voir le document"), h("div", { class: "pageimgs" }, apiImg(preview, { alt: "Première page" }))) : null,
    fieldsBox.length ? [h("div", { class: "lbl", style: "margin-top:18px" }, "Informations lues sur le document"), h("div", { class: "card", style: "margin-top:0" }, fieldsBox)] : null,
    h("label", { class: "lbl", for: "d-title" }, "Titre", tag(warn.title)), title,
    h("label", { class: "lbl", for: "d-folder" }, "Dossier", tag(warn.folder_id)), folder,
    h("label", { class: "lbl", for: "d-person" }, "Ce document concerne", tag(warn.person_id)), person,
    h("label", { class: "lbl", for: "d-year" }, "Année"), year,
    expIn ? [h("label", { class: "lbl", for: "d-exp" }, "Date d'expiration (si le document en a une)"), expIn] : null,
    h("div", { class: "lbl", style: "margin-top:22px" }, "Qui peut voir ce document ?"), optsBox, customBox, hideBox,
    err, btn);
}

// ================================================================ Réglages

export async function viewSettings() {
  const me = state.me;
  const defaults = await api.get("/api/settings/defaults");
  state.groups = await api.get("/api/groups");
  await loadMembers();
  const relOpts = [["private", "Privé"], ["family", "Toute la famille"],
    ...state.groups.relations.map((g) => [`custom:rel:${g.key}`, g.name]),
    ...(state.groups.relations.some((g) => g.key === "siblings") && state.groups.relations.some((g) => g.key === "parents") ? [["custom:rel:siblings,rel:parents", "Frères, sœurs et parents"]] : []),
    ...state.groups.custom.map((g) => [`custom:grp:${g.id}`, g.name])];
  const sel = (sub) => {
    const opts = relOpts.some(([v]) => v === sub.value) ? relOpts : [...relOpts, [sub.value, "Personnalisé"]];
    return h("select", { class: "field", "aria-label": sub.name, onchange: async (e) => {
      await api.put("/api/settings/defaults", { values: { [sub.id]: e.target.value } }); toast("Enregistré");
    } }, opts.map(([v, l]) => h("option", { value: v, selected: v === sub.value }, l)));
  };
  const demoBlock = [];
  if (DEMO) {
    const users = await _a.get("/api/demo/users");
    demoBlock.push(h("div", { class: "card" }, h("h3", {}, "Démonstration : essayer l'appli comme…"),
      h("p", { class: "small muted", style: "margin:0 0 8px" }, "Changez de personne pour voir que chacun ne voit que les documents qui lui sont partagés. Par exemple, Inès (une cousine) ne voit pas l'acte de naissance que Youssra partage avec ses frères, sœurs et parents."),
      h("div", { class: "wrapchips" }, users.map((u) => h("button", { class: `chip ${u.is_me ? "on" : ""}`, onclick: async () => { await _a.post("/api/demo/switch", { user_id: u.id }); location.hash = "#/arbre"; location.reload(); } }, u.first_name))),
      h("button", { class: "btn ghost", onclick: async () => { if (!await ask("Effacer vos essais et remettre la démo à zéro ?")) return; await _a.post("/api/demo/reset"); location.hash = "#/arbre"; location.reload(); } }, "Remettre la démo à zéro")));
  }
  const out = [
    ...demoBlock,
    h("div", { class: "prof" }, av(me.member, "big"), h("div", {}, h("h2", {}, fullName(me.member)), h("div", { class: "muted" }, `Identifiant : ${me.username}${me.is_admin ? " · administrateur" : ""}`))),
    h("a", { class: "btn sec", href: `#/personne/${me.member.id}` }, "Voir ma fiche"),
    await whatsappCard(),
    installCard(),
    h("h2", {}, "Visibilité par défaut, dossier par dossier"),
    h("p", { class: "small muted", style: "margin:0" }, "C'est le choix proposé quand vous ajoutez un document. Vous pouvez toujours le changer au moment de l'envoi."),
    ...defaults.map((t) => h("div", { class: "card" }, h("h3", {}, t.name), t.children.map((c) => h("div", { class: "set" }, h("span", {}, c.name), sel(c))))),
    h("h2", {}, "Mes groupes"),
    h("p", { class: "small muted", style: "margin:0" }, "Les groupes « frères et sœurs », « parents », « cousins »… sont calculés tout seuls à partir de l'arbre. Vous pouvez aussi créer les vôtres."),
    h("div", { class: "card" }, state.groups.relations.map((g) => h("div", { class: "set" }, h("b", {}, g.name), h("span", { class: "small muted" }, g.member_ids.map((i) => M(i)?.first_name).join(", ")))),
      state.groups.custom.map((g) => h("div", { class: "set" }, h("b", {}, g.name), h("span", { class: "small muted" }, g.member_ids.map((i) => M(i)?.first_name).join(", "), " ",
        h("button", { class: "chip", onclick: async () => { if (await ask(`Supprimer le groupe « ${g.name} » ?`)) { await api.del(`/api/groups/${g.id}`); rerender(); } } }, "Supprimer"))))),
    h("button", { class: "btn sec", onclick: newGroup }, "+ Créer un groupe"),
  ];
  if (me.is_admin) {
    const accs = await api.get("/api/accounts");
    const without = state.members.filter((m) => !m.has_account && !m.deceased && !m.death_date);
    out.push(h("h2", {}, "Comptes de la famille"),
      h("div", { class: "card" }, accs.map((a) => h("div", { class: "set" }, h("span", {}, `${a.first_name} ${a.last_name}`.trim(), h("br"), h("small", { class: "muted" }, a.username)),
        a.member_id === me.member.id ? h("span", { class: "small muted" }, "vous") : h("button", { class: "chip", onclick: async () => {
          if (!await ask(`Donner un mot de passe provisoire à ${a.first_name} ?`)) return;
          const r = await api.post(`/api/accounts/${a.id}/reset`);
          sheet(h("h2", {}, "Mot de passe provisoire"), h("p", {}, `Donnez ce mot de passe à ${a.first_name}. Il pourra le changer dans ses réglages.`), h("div", { class: "linkbox" }, r.temporary_password));
        } }, "Mot de passe oublié")))),
      without.length ? h("div", { class: "hint" }, "Pas encore de compte : ", without.map((m) => m.first_name).join(", "), ". Ouvrez leur fiche dans l'arbre et touchez « Inviter ».") : null);
  }
  out.push(h("h2", {}, "Sécurité"), h("button", { class: "btn ghost", onclick: changePassword }, "Changer mon mot de passe"),
    h("button", { class: "btn danger", onclick: async () => { await api.post("/api/logout"); location.hash = "#/connexion"; location.reload(); } }, "Se déconnecter"),
    h("p", { class: "small muted", style: "text-align:center;margin-top:20px" }, `Miff ${me.ocr ? "· lecture automatique active" : "· lecture automatique indisponible (Tesseract manquant)"}`));
  return out;
}

function rerender() { window.dispatchEvent(new HashChangeEvent("hashchange")); }

function newGroup() {
  const name = h("input", { class: "field", required: true, placeholder: "ex. Succession de grand-père" });
  const chosen = new Set();
  const box = h("div", { class: "wrapchips" });
  const render = () => box.replaceChildren(...state.members.filter((m) => m.id !== state.me.member.id).sort((a, b) => a.first_name.localeCompare(b.first_name))
    .map((m) => h("button", { type: "button", class: `chip ${chosen.has(m.id) ? "on" : ""}`, onclick: () => { chosen.has(m.id) ? chosen.delete(m.id) : chosen.add(m.id); render(); } }, m.first_name)));
  render();
  const close = sheet(h("form", { onsubmit: async (e) => {
    e.preventDefault();
    if (!chosen.size) return toast("Choisissez au moins une personne");
    await api.post("/api/groups", { name: name.value, member_ids: [...chosen] }); close(); toast("Groupe créé"); rerender();
  } }, h("h2", {}, "Nouveau groupe"), h("label", { class: "lbl" }, "Nom du groupe"), name, h("div", { class: "lbl" }, "Personnes"), box,
    h("button", { class: "btn", type: "submit" }, "Créer le groupe")));
}

function changePassword() {
  const o = h("input", { class: "field", type: "password", autocomplete: "current-password", required: true });
  const n = h("input", { class: "field", type: "password", autocomplete: "new-password", minlength: 8, required: true });
  const err = h("div");
  const close = sheet(h("form", { onsubmit: async (e) => {
    e.preventDefault();
    try { await api.post("/api/me/password", { old: o.value, new: n.value }); close(); toast("Mot de passe changé"); } catch (x) { err.replaceChildren(errBox(x)); }
  } }, h("h2", {}, "Changer mon mot de passe"), h("label", { class: "lbl" }, "Mot de passe actuel"), o, h("label", { class: "lbl" }, "Nouveau mot de passe (8 caractères minimum)"), n, err,
    h("button", { class: "btn", type: "submit" }, "Changer")));
}

// Installer l'appli sur le téléphone
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; });

function installCard() {
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return h("div", { class: "card install" }, h("h3", {}, "📲 Installer Miff sur ce téléphone"),
    deferredPrompt ? h("button", { class: "btn", style: "margin-top:4px", onclick: async () => { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; rerender(); } }, "Installer l'appli") : null,
    ios ? h("div", {}, "Sur iPhone, dans Safari :", h("ol", {}, h("li", {}, "touchez le bouton Partager (le carré avec une flèche) ;"), h("li", {}, "choisissez « Sur l'écran d'accueil » ;"), h("li", {}, "touchez « Ajouter ». L'icône Miff apparaît avec vos applis.")))
      : h("div", {}, "Sur Android, dans Chrome :", h("ol", {}, h("li", {}, "touchez le menu ⋮ en haut à droite ;"), h("li", {}, "choisissez « Installer l'application » (ou « Ajouter à l'écran d'accueil »)."))));
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// ================================================================ Documents à cadenas et demandes d'accès

const DURATIONS = [["once", "Une seule fois", "24 heures"], ["7d", "7 jours", "puis l'accès s'arrête"], ["always", "Pour toujours", "jusqu'à ce qu'il le retire"]];
const durLabel = (k) => (DURATIONS.find((d) => d[0] === k) || DURATIONS[1])[1].toLowerCase();

function lockedDocView(d) {
  const r = d.request;
  const status = !r ? null
    : r.status === "pending" ? h("div", { class: "detected" }, h("b", {}, "Demande envoyée"), `${d.owner_name || "Le propriétaire"} a été prévenu. Vous recevrez une notification avec sa réponse.`)
    : r.status === "refused" ? h("div", { class: "err" }, `Demande refusée${r.answer ? ` : « ${r.answer} »` : "."}`)
    : null;
  return [
    h("div", { class: "crumb" }, h("a", { href: "#/documents" }, "Documents"), "›", h("span", {}, d.parent_folder_name), "›", h("a", { href: `#/dossier/${d.folder_id}` }, d.folder_name)),
    h("div", { class: "lockhero" }, h("span", { class: "ic lock big" }, icon("lock")),
      h("h2", {}, d.title), h("div", { class: "muted small" }, [d.person_name, d.owner_name ? `ajouté par ${d.owner_name}` : ""].filter(Boolean).join(" · ")),
      h("p", {}, `Ce document est privé. Vous pouvez demander à ${d.owner_name || "son propriétaire"} de vous le montrer, en expliquant pourquoi.`)),
    status,
    !r || r.status !== "pending" ? h("button", { class: "btn", onclick: () => requestSheet(d) }, r?.status === "refused" ? "Redemander l'accès" : "Demander l'accès") : null,
  ];
}

function requestSheet(d) {
  let dur = "7d";
  const reason = h("textarea", { class: "field", id: "rq-reason", placeholder: "Ex. : j'en ai besoin pour mon dossier de bourse", maxlength: 500 });
  const opts = h("div", { class: "opts" });
  const renderOpts = () => opts.replaceChildren(...DURATIONS.map(([k, l, s2]) => h("label", { class: `opt ${dur === k ? "on" : ""}` },
    h("input", { type: "radio", name: "dur", checked: dur === k, onchange: () => { dur = k; renderOpts(); } }), h("span", {}, h("b", {}, l), h("small", {}, s2)))));
  renderOpts();
  const err = h("div");
  const close = sheet(h("form", { onsubmit: async (e) => {
    e.preventDefault(); err.replaceChildren();
    try { await api.post(`/api/documents/${d.id}/request`, { reason: reason.value, duration: dur }); close(); toast("Demande envoyée"); window.dispatchEvent(new HashChangeEvent("hashchange")); }
    catch (x) { err.replaceChildren(errBox(x)); }
  } },
    h("h2", {}, "Demander l'accès"),
    h("p", { class: "muted", style: "margin-top:0" }, `${d.title}${d.person_name ? " · " + d.person_name : ""}`),
    h("label", { class: "lbl", for: "rq-reason" }, "Pourquoi en avez-vous besoin ?"), reason,
    h("div", { class: "lbl" }, "Pendant combien de temps ?"), opts,
    err, h("button", { class: "btn", type: "submit" }, "Envoyer la demande"), h("button", { class: "btn ghost", type: "button", onclick: () => close() }, "Annuler")));
  setTimeout(() => reason.focus(), 50);
}

function requestCard(r, after) {
  const answer = (accept) => answerSheet(r, accept, after);
  return h("div", { class: "card req" },
    h("div", { class: "reqhead" }, av(M(r.from_member)), h("span", {}, h("b", {}, r.from_name), " demande à voir ", h("a", { href: `#/document/${r.doc_id}` }, r.doc_title))),
    h("blockquote", {}, r.reason),
    h("div", { class: "small muted" }, `Durée demandée : ${durLabel(r.duration)} · ${frDate(r.at)}`),
    h("div", { class: "row" }, h("button", { class: "btn", onclick: () => answer(true) }, "Accepter"), h("button", { class: "btn ghost", onclick: () => answer(false) }, "Refuser")));
}

function answerSheet(r, accept, after) {
  const refresh = () => (after ? after() : window.dispatchEvent(new HashChangeEvent("hashchange")));
  {
    let dur = r.duration;
    const msg = h("input", { class: "field", placeholder: accept ? "Un petit mot (facultatif)" : "Pourquoi ? (facultatif)" });
    const opts = h("div", { class: "opts" });
    const renderOpts = () => opts.replaceChildren(...DURATIONS.map(([k, l, s2]) => h("label", { class: `opt ${dur === k ? "on" : ""}` },
      h("input", { type: "radio", name: "adur", checked: dur === k, onchange: () => { dur = k; renderOpts(); } }), h("span", {}, h("b", {}, l), h("small", {}, s2)))));
    renderOpts();
    const close = sheet(h("h2", {}, accept ? `Montrer le document à ${r.from_name}` : `Refuser la demande de ${r.from_name}`),
      accept ? [h("div", { class: "lbl" }, "Pendant combien de temps ?"), opts] : null,
      msg,
      h("button", { class: accept ? "btn" : "btn danger", onclick: async () => {
        try { await api.post(`/api/requests/${r.id}/answer`, { accept, duration: dur, message: msg.value }); close(); toast(accept ? "Accès accordé" : "Demande refusée"); refresh(); }
        catch (x) { toast(x.message); }
      } }, accept ? "Accepter" : "Refuser"),
      h("button", { class: "btn ghost", onclick: () => close() }, "Annuler"));
  }
}

// ================================================================ Notifications

export async function viewNotifications() {
  await loadMembers();
  const data = await api.get("/api/notifications");
  api.post("/api/notifications/read").then(() => refreshBadges()).catch(() => {});
  const stLabel = { pending: "en attente", accepted: "acceptée", refused: "refusée" };
  localStorage.setItem("miff-bday-seen", localISO(new Date()));
  const bdays = upcomingBirthdays(30);
  const exp = await api.get("/api/expiring").catch(() => []);
  return [
    exp.length ? [h("h2", { style: "margin-top:4px" }, "📄 Documents à renouveler"), h("div", { class: "card" }, exp.map((d) => {
      const e = expiryInfo(d) || { txt: "" };
      return h("a", { class: "notif new", href: `#/document/${d.id}` }, h("span", { class: "nic" }, e.cls === "exp-red" ? "⛔" : "⚠️"),
        h("span", {}, h("b", {}, d.title), h("small", {}, e.txt)));
    }))] : null,
    data.requests.length ? [h("h2", { style: "margin-top:4px" }, "À vous de répondre"), ...data.requests.map((r) => requestCard(r))] : null,
    bdays.length ? [h("h2", { style: "margin-top:4px" }, "🎂 Anniversaires à venir"), h("div", { class: "card" }, bdays.map(({ m, inDays, age }) =>
      h("div", { class: `notif ${inDays === 0 ? "new" : ""}` }, h("a", { href: `#/personne/${m.id}` }, av(m)),
        h("span", {}, h("a", { href: `#/personne/${m.id}`, class: "plain" }, h("b", {}, fullName(m))), h("small", {}, `${whenTxt(inDays)} · ${age} ans · ${frDate(m.birth_date).replace(/ \d{4}$/, "")}`)),
        inDays === 0 ? wishButton(m, "Souhaiter") : null)))] : null,
    h("h2", {}, "Notifications"),
    data.notifications.length ? h("div", { class: "card" }, data.notifications.map((n) => h("a", { class: `notif ${n.read ? "" : "new"}`, href: n.link || "#/arbre" },
      h("span", { class: "nic" }, { birth: "👶", request: "🔑", answer: "✉️" }[n.kind] || "•"), h("span", {}, n.text, h("small", {}, frDate(n.at))))))
      : h("div", { class: "empty" }, "Rien de nouveau pour le moment."),
    data.my_requests.length ? [h("h2", {}, "Mes demandes"), h("div", { class: "card" }, data.my_requests.map((r) => h("a", { class: "notif", href: `#/document/${r.doc_id}` },
      h("span", { class: "nic" }, r.status === "accepted" ? "✅" : r.status === "refused" ? "⛔" : "⏳"),
      h("span", {}, `${r.doc_title} · ${stLabel[r.status]}`, h("small", {}, r.status === "accepted" ? (r.until ? `jusqu'au ${frDate(r.until)}` : "sans limite") : r.answer ? `« ${r.answer} »` : frDate(r.at))))))] : null,
  ];
}

export async function refreshBadges() {
  try {
    const b = await api.get("/api/badges");
    if (!state.members.length && state.me) await loadMembers().catch(() => {});
    b.notifs = (b.notifs || 0) + birthdaysToday();
    document.querySelectorAll("[data-badge]").forEach((el) => { const n = b[el.dataset.badge] || 0; el.textContent = n > 9 ? "9+" : n; el.hidden = !n; });
  } catch {}
}

// ================================================================ Naissance

export function birthSheet() {
  const me = M(state.me.member.id);
  const kids = state.members.filter((x) => x.father_id === me.id || x.mother_id === me.id);
  const spouse = (me.spouses || []).map(M).find(Boolean);
  const f = {};
  const fatherDef = me.sex === "F" ? spouse?.id : me.id, motherDef = me.sex === "F" ? me.id : spouse?.id;
  const peopleSelect = (k, sex, def) => (f[k] = h("select", { class: "field", id: "b-" + k }, h("option", { value: "" }, "—"),
    state.members.filter((x) => !x.sex || x.sex === sex).sort((a, b) => a.first_name.localeCompare(b.first_name)).map((x) => h("option", { value: x.id, selected: x.id === def }, fullName(x)))));
  const today = new Date().toISOString().slice(0, 10);
  const photo = h("input", { type: "file", accept: "image/*", id: "b-photo" });
  const err = h("div");
  const btn = h("button", { class: "btn", type: "submit" }, "Annoncer la naissance");
  const close = sheet(h("form", { onsubmit: async (e) => {
    e.preventDefault(); err.replaceChildren(); btn.disabled = true;
    const fd = new FormData();
    for (const k of ["first_name", "last_name", "sex", "birth_date", "birth_place", "father_id", "mother_id", "message"]) fd.append(k, f[k].value);
    if (photo.files[0]) fd.append("photo", photo.files[0]);
    try { const r = await api.form("/api/births", fd); close(); toast("Naissance annoncée à toute la famille"); state.tree = null; location.hash = `#/personne/${r.id}`; }
    catch (x) { err.replaceChildren(errBox(x)); btn.disabled = false; }
  } },
    h("h2", {}, "Annoncer une naissance"),
    h("p", { class: "muted small", style: "margin-top:0" }, "Le bébé sera ajouté à l'arbre et toute la famille sera prévenue dans le chat."),
    h("label", { class: "lbl", for: "b-first_name" }, "Prénom du bébé"), (f.first_name = h("input", { class: "field", id: "b-first_name", required: true })),
    h("label", { class: "lbl", for: "b-sex" }, "C'est"), (f.sex = h("select", { class: "field", id: "b-sex" }, h("option", { value: "F" }, "Une fille"), h("option", { value: "M" }, "Un garçon"))),
    h("label", { class: "lbl", for: "b-birth_date" }, "Date de naissance"), (f.birth_date = h("input", { class: "field", id: "b-birth_date", type: "date", value: today, max: today })),
    h("label", { class: "lbl", for: "b-birth_place" }, "Lieu de naissance"), (f.birth_place = h("input", { class: "field", id: "b-birth_place", placeholder: "ex. Mamoudzou" })),
    h("label", { class: "lbl", for: "b-father_id" }, "Père"), peopleSelect("father_id", "M", fatherDef),
    h("label", { class: "lbl", for: "b-mother_id" }, "Mère"), peopleSelect("mother_id", "F", motherDef),
    h("label", { class: "lbl", for: "b-last_name" }, "Nom de famille"), (f.last_name = h("input", { class: "field", id: "b-last_name", value: (me.sex === "F" ? spouse?.last_name : me.last_name) || me.last_name || "" })),
    h("label", { class: "lbl", for: "b-photo" }, "Une photo (facultatif)"), photo,
    h("label", { class: "lbl", for: "b-message" }, "Un mot pour la famille (facultatif)"), (f.message = h("textarea", { class: "field", id: "b-message", placeholder: kids.length ? "" : "ex. La maman et le bébé vont bien !" })),
    err, btn, h("button", { class: "btn ghost", type: "button", onclick: () => close() }, "Annuler")));
}

// ================================================================ Chat

export const dmKey = (a, b) => `dm:${Math.min(a, b)}-${Math.max(a, b)}`;

function timeShort(at) {
  if (!at) return "";
  const d = new Date(at.replace(" ", "T") + "Z"), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export async function viewChats() {
  await loadMembers();
  const list = await api.get("/api/chats");
  const meId = state.me.member.id;
  const fam = list.find((c) => c.kind === "family");
  const dms = list.filter((c) => c.kind !== "family");
  const people = state.members.filter((x) => x.id !== meId && x.has_account).sort((a, b) => a.first_name.localeCompare(b.first_name));
  const box = h("div");
  const row = (c) => h("a", { class: `chatrow ${c.unread ? "unread" : ""}`, href: `#/chat/${c.key}` },
    c.kind === "dm" ? av(M(c.other)) : h("span", { class: "av grp" }, "💬"),
    h("span", { class: "cbody" }, h("span", { class: "ctop" }, h("b", {}, c.name), h("small", {}, timeShort(c.last_at))),
      h("span", { class: "cbot" }, h("small", {}, c.last_text || "Pas encore de message"), c.unread ? h("em", {}, c.unread) : null)));
  const render = (q = "") => {
    const nq = norm(q);
    const match = (c) => !nq || norm(c.name + " " + c.last_text).includes(nq);
    const shown = dms.filter(match);
    const extra = nq ? people.filter((x) => norm(x.first_name).includes(nq) && !dms.some((c) => c.other === x.id)) : [];
    box.replaceChildren(...[
      fam && match(fam) ? h("a", { class: "famcard", href: `#/chat/${fam.key}` },
        h("span", { class: "famic" }, "🏠"),
        h("span", { class: "cbody" }, h("span", { class: "ctop" }, h("b", {}, "Toute la famille"), h("small", {}, timeShort(fam.last_at))),
          h("span", { class: "cbot" }, h("small", {}, fam.last_text || `${fam.member_count} personnes`), fam.unread ? h("em", {}, fam.unread) : null))) : null,
      !nq && people.length ? [h("div", { class: "sectit" }, "Écrire à"), h("div", { class: "avrow" }, people.map((x) =>
        h("a", { href: `#/chat/${dmKey(meId, x.id)}` }, av(x), h("span", {}, x.first_name))))] : null,
      h("div", { class: "sectit" }, "Messages"),
      shown.length || extra.length ? h("div", { class: "chatlist" }, shown.map(row), extra.map((x) => h("a", { class: "chatrow", href: `#/chat/${dmKey(meId, x.id)}` }, av(x),
        h("span", { class: "cbody" }, h("span", { class: "ctop" }, h("b", {}, x.first_name)), h("span", { class: "cbot" }, h("small", {}, "Nouvelle conversation"))))))
        : h("div", { class: "empty" }, nq ? "Aucune conversation trouvée." : "Pas encore de conversation. Touchez un prénom ci-dessus pour écrire."),
    ].flat().filter(Boolean));
  };
  render();
  return [
    h("label", { class: "searchbar" }, icon("search"), h("input", { type: "search", placeholder: "Rechercher", "aria-label": "Rechercher une conversation", oninput: (e) => render(e.target.value) })),
    box,
    h("button", { class: "fab", "aria-label": "Nouveau message", onclick: () => newDmSheet() }, icon("edit")),
  ];
}

function newDmSheet() {
  const me = state.me.member.id;
  const close = sheet(h("h2", {}, "Nouveau message"), h("div", { class: "people" },
    state.members.filter((x) => x.id !== me && x.has_account).sort((a, b) => a.first_name.localeCompare(b.first_name)).map((x) =>
      h("a", { class: "person", href: `#/chat/${dmKey(me, x.id)}`, onclick: () => close() }, av(x), x.first_name))),
    h("p", { class: "small muted" }, "Seules les personnes qui ont un compte Miff apparaissent ici."),
    h("button", { class: "btn ghost", onclick: () => close() }, "Annuler"));
}

let chatTimer = null;
export async function viewChat(key) {
  await loadMembers();
  let data;
  try { data = await api.get(`/api/chats/${encodeURIComponent(key)}`); } catch (e) { return errBox(e); }
  refreshBadges();
  const list = h("div", { class: "msgs" });
  let lastId = 0;
  const bubble = (m) => {
    if ((m.kind === "request" || m.kind === "answer") && m.request) {
      const r = m.request;
      const st = { pending: ["En attente", "wait"], accepted: ["Accepté", "ok"], refused: ["Refusé", "no"] }[r.status];
      if (m.kind === "answer") return h("div", { class: `msg sys ${m.mine ? "mine" : ""}` },
        h("span", { class: "txt" }, r.status === "accepted" ? `✅ ${m.from_name} a accepté de montrer « ${r.doc_title} »${r.until ? ` jusqu'au ${frDate(r.until)}` : ""}.` : `⛔ ${m.from_name} a refusé de montrer « ${r.doc_title} ».`),
        m.text ? h("span", { class: "txt" }, `« ${m.text} »`) : null,
        r.status === "accepted" && !m.mine ? h("a", { class: "linkbtn", href: `#/document/${r.doc_id}` }, "Ouvrir le document") : null,
        h("small", { class: "time" }, timeShort(m.at)));
      return h("div", { class: `reqmsg ${m.mine ? "mine" : ""}` },
        h("div", { class: "rqtop" }, h("span", {}, "🔑 Demande d'accès"), h("span", { class: `pillst ${st[1]}` }, st[0])),
        h("a", { class: "rqdoc", href: `#/document/${r.doc_id}` }, r.doc_title),
        h("blockquote", {}, r.reason),
        h("small", { class: "muted" }, `Durée demandée : ${durLabel(r.duration)} · ${timeShort(m.at)}`),
        r.can_answer ? h("div", { class: "row" },
          h("button", { class: "btn", onclick: () => answerSheet(r, true, reload) }, "Accepter"),
          h("button", { class: "btn ghost", onclick: () => answerSheet(r, false, reload) }, "Refuser")) : null);
    }
    if (m.kind === "birth" && m.baby) {
      return h("div", { class: "birthcard" },
        m.has_image ? apiImg(`/api/chats/${encodeURIComponent(key)}/image/${m.id}`, { alt: `Photo de ${m.baby.first_name}`, class: "bphoto" }) : h("div", { class: "bemoji" }, "👶"),
        h("div", { class: "bbody" }, h("small", {}, "Naissance"), h("b", {}, m.baby.first_name), h("span", {}, `${m.baby.sex === "F" ? "Fille" : m.baby.sex === "M" ? "Fils" : "Enfant"} de ${m.baby.parents.filter(Boolean).join(" et ")}`),
          m.text ? h("p", {}, m.text) : null,
          h("a", { href: `#/personne/${m.baby.id}`, class: "linkbtn" }, "Voir dans l'arbre")),
        h("div", { class: "bmeta" }, `Annoncé par ${m.from_name} · ${timeShort(m.at)}`));
    }
    return h("div", { class: `msg ${m.mine ? "mine" : ""}` },
      !m.mine && data.kind !== "dm" ? h("small", { class: "who" }, m.from_name) : null,
      m.has_image ? apiImg(`/api/chats/${encodeURIComponent(key)}/image/${m.id}`, { alt: "Photo", class: "mphoto" }) : null,
      m.doc ? h("a", { class: "mdoc", href: `#/document/${m.doc.id}` }, h("span", { class: `ic ${m.doc.locked ? "lock" : ""}` }, m.doc.locked ? icon("lock") : "PDF"), h("span", {}, m.doc.title, h("small", {}, m.doc.locked ? "Privé, touchez pour demander l'accès" : "Ouvrir le document"))) : null,
      m.text ? h("span", { class: "txt" }, m.text) : null,
      h("small", { class: "time" }, timeShort(m.at)));
  };
  const paint = (msgs) => {
    const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 80;
    for (const m of msgs) if (m.id > lastId) { list.append(bubble(m)); lastId = m.id; }
    if (atBottom || !paint.done) requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight));
    paint.done = true;
  };
  const reload = async () => { const d = await api.get(`/api/chats/${encodeURIComponent(key)}`); list.replaceChildren(); lastId = 0; paint(d.messages); refreshBadges(); };
  if (!data.messages.length) list.append(h("div", { class: "empty" }, "Pas encore de message. Dites bonjour !"));
  paint(data.messages);
  clearInterval(chatTimer);
  chatTimer = setInterval(async () => {
    if (!location.hash.startsWith(`#/chat/${key}`)) { clearInterval(chatTimer); return; }
    try { const d = await api.get(`/api/chats/${encodeURIComponent(key)}`); if (d.messages.some((m) => m.id > lastId)) { list.querySelector(".empty")?.remove(); paint(d.messages); } } catch {}
  }, 4000);

  const text = h("textarea", { class: "field", rows: 1, placeholder: "Message", "aria-label": "Votre message", onkeydown: (e) => { if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 700) { e.preventDefault(); send(); } } });
  if (state.draft && state.draft.key === key) { text.value = state.draft.text; state.draft = null; setTimeout(() => text.focus(), 300); }
  const img = h("input", { type: "file", accept: "image/*", hidden: true, onchange: () => { if (img.files[0]) send(img.files[0]); } });
  async function send(file, docId) {
    if (!file && !docId && !text.value.trim()) return;
    const fd = new FormData();
    fd.append("text", file || docId ? "" : text.value);
    if (file) fd.append("image", file);
    if (docId) fd.append("doc_id", docId);
    try {
      await api.form(`/api/chats/${encodeURIComponent(key)}`, fd);
      if (!file && !docId) text.value = "";
      img.value = "";
      const d = await api.get(`/api/chats/${encodeURIComponent(key)}`); list.querySelector(".empty")?.remove(); paint(d.messages);
      window.scrollTo(0, document.body.scrollHeight);
    } catch (x) { toast(x.message); }
  }
  async function shareDoc() {
    const docs = await api.get("/api/documents?scope=mine");
    const close = sheet(h("h2", {}, "Partager un document"),
      h("p", { class: "small muted", style: "margin-top:0" }, "Le document reste protégé : seuls ceux qui ont déjà le droit de le voir pourront l'ouvrir. Les autres pourront demander l'accès."),
      docs.length ? h("div", { class: "card" }, docs.map((d) => h("button", { class: "doc", style: "width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left", onclick: () => { close(); send(null, d.id); } },
        h("span", { class: "ic" }, "PDF"), h("span", {}, h("b", {}, d.title), h("span", { class: "m" }, d.folder_name))))) : h("div", { class: "empty" }, "Vous n'avez encore ajouté aucun document."),
      h("button", { class: "btn ghost", onclick: () => close() }, "Annuler"));
  }
  const names = data.members.map((i) => M(i)?.first_name).filter(Boolean);
  return [
    h("div", { class: "chathead" }, data.kind === "dm" ? av(M(data.members.find((i) => i !== state.me.member.id))) : h("span", { class: "av grp" }, data.kind === "family" ? "🏠" : "💬"),
      h("div", {}, h("h2", {}, data.name), h("div", { class: "small muted" }, data.kind === "dm" ? "Conversation privée" : `${names.length} personnes`))),
    list,
    h("div", { class: "composer" },
      h("button", { class: "cbtn", "aria-label": "Envoyer une photo", onclick: () => img.click() }, "📷"),
      h("button", { class: "cbtn", "aria-label": "Partager un document", onclick: shareDoc }, "📄"),
      text, img,
      h("button", { class: "cbtn send", "aria-label": "Envoyer", onclick: () => send() }, "➤")),
  ];
}
