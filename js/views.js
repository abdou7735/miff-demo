// Les écrans de l'appli.
import { api } from "./api.js";
import { openScanner } from "./scanner.js";
import { drawTree } from "./tree.js";
import { api as _a, DEMO } from "./api.js";
import { apiImg, apiLink, ask, errBox, folderIcon, frDate, fullName, h, icon, initials, sheet, toast, VIS_LABEL, years } from "./ui.js";

export const state = { me: null, members: [], groups: null, treeScale: null, docTab: "dossiers", generation: null, pending: null };

export async function loadMembers() {
  state.members = await api.get("/api/members");
  return state.members;
}
const M = (id) => state.members.find((m) => m.id === id);

function av(m, cls = "") {
  const dead = m && (m.deceased || m.death_date);
  return h("span", { class: `av ${m && state.me && m.id === state.me.member.id ? "self" : dead ? "dead" : ""} ${cls}` }, initials(m));
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
    DEMO ? h("div", { class: "hint" }, "Démonstration : identifiant ", h("b", {}, "yanis"), " (ou lina, ines, karim), mot de passe ", h("b", {}, "demo1234"), ".")
      : h("p", { class: "small", style: "margin-top:18px" }, "Pas encore de compte ? Demandez votre lien d'invitation à l'administrateur de la famille."));
}

export function viewSetup() {
  const known = ["Dino", "Malik", "Ibra", "Bébé", "Yusrin", "Yusra", "Yumna", "Yankoub", "Dja", "Saïd", ""];
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
  const box = h("div", { class: "treebox" });
  const pick = (id) => (location.hash = `#/personne/${id}`);
  const render = () => box.replaceChildren(drawTree(state.members, state.me.member.id, pick, state.treeScale || 1));
  if (!state.treeScale) {
    // Première ouverture : l'arbre entier tient dans l'écran (sans devenir illisible).
    const W = Number(drawTree(state.members, state.me.member.id, pick, 1).getAttribute("width"));
    state.treeScale = Math.max(0.45, Math.min(1, (Math.min(window.innerWidth, 560) - 8) / W));
  }
  render();
  setTimeout(() => { box.scrollLeft = (box.scrollWidth - box.clientWidth) / 2; }, 0);
  const zoom = (d) => { state.treeScale = Math.min(1.6, Math.max(0.4, state.treeScale + d)); render(); };
  const me = M(state.me.member.id);
  const nb = state.members.length;
  return [
    h("div", { class: "zoom" }, h("button", { "aria-label": "Dézoomer", onclick: () => zoom(-0.15) }, "−"), h("button", { "aria-label": "Zoomer", onclick: () => zoom(0.15) }, "+")),
    box,
    h("div", { class: "legend" }, h("span", {}, h("i", { style: "background:#1f6a4b" }), "Moi"), h("span", {}, h("i", { style: "background:#c4e5d3" }), "Frères et sœurs"), h("span", {}, h("i", { style: "background:#9097a1" }), "Décédé")),
    h("div", { class: "hint" }, `Touchez une personne pour ouvrir sa fiche. L'arbre compte ${nb} personne${nb > 1 ? "s" : ""}. Faites glisser pour voir toute la famille.`),
    h("button", { class: "btn sec", onclick: () => editPerson(null, { sibling_of: me?.id }) }, "+ Ajouter un frère ou une sœur"),
  ];
}

export async function viewPerson(id) {
  await loadMembers();
  let p;
  try { p = await api.get(`/api/members/${id}`); } catch (e) { return errBox(e); }
  const isMe = p.id === state.me.member.id;
  const rel = (label, ids) => ids.length ? [h("dt", {}, label), h("dd", {}, h("div", { class: "people" }, ids.map(personChip)))] : [];
  const infos = [];
  if (p.birth_date || p.birth_place) infos.push(h("dt", {}, "Naissance"), h("dd", {}, [frDate(p.birth_date), p.birth_place && `à ${p.birth_place}`].filter(Boolean).join(" ")));
  if (p.death_date || p.deceased) infos.push(h("dt", {}, "Décès"), h("dd", {}, frDate(p.death_date) || "Oui"));
  if (p.birth_name) infos.push(h("dt", {}, "Nom de naissance"), h("dd", {}, p.birth_name));
  const actions = [];
  if (p.can_edit) actions.push(h("button", { class: "btn ghost", onclick: () => editPerson(p) }, "Modifier la fiche"));
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
    h("div", { class: "prof" }, av(p, "big"), h("div", {}, h("h2", {}, fullName(p)),
      h("div", { class: "muted" }, [p.relation, years(p), p.has_account ? "a un compte" : "pas encore de compte"].filter(Boolean).join(" · ")))),
    h("div", { class: "card" }, h("dl", { class: "rel", style: "margin:0" }, infos,
      rel("Parents", p.parents), rel(p.spouses.length > 1 ? "Conjoints" : "Conjoint", p.spouses), rel("Frères et sœurs", p.siblings), rel("Enfants", p.children)),
      !infos.length && !p.parents.length && !p.spouses.length && !p.siblings.length && !p.children.length ? h("p", { class: "muted", style: "margin:0" }, "Pas encore d'informations.") : null),
    p.notes ? h("div", { class: "hint" }, p.notes) : null,
    h("h2", {}, isMe ? "Mes documents" : `Documents de ${p.first_name}`),
    p.documents.length ? h("div", { class: "card" }, p.documents.map(docRow)) : h("div", { class: "hint" }, "Aucun document visible pour vous."),
    ...actions,
  ];
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
  p = p || { first_name: "", last_name: "", birth_name: "", sex: "", birth_date: "", birth_place: "", death_date: "", deceased: false, notes: "", father_id: null, mother_id: null, ...preset };
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
      notes: f.notes.value,
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

function docRow(d) {
  const meta = [d.person_name, d.year, !d.mine && d.owner_name ? `ajouté par ${d.owner_name}` : ""].filter(Boolean).join(" · ");
  return h("a", { class: "doc", href: `#/document/${d.id}` },
    h("span", { class: "ic" }, "PDF"),
    h("span", {}, h("b", {}, d.title), h("span", { class: "m" }, [d.folder_name, meta].filter(Boolean).join(" · ")), h("br"), visBadge(d)));
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
  const fileUrl = `/api/documents/${id}/file`;
  const fields = Object.values(d.fields || {});
  const out = [
    h("div", { class: "crumb" }, h("a", { href: "#/documents" }, "Documents"), "›", d.parent_folder_name, "›", h("a", { href: `#/dossier/${d.folder_id}` }, d.folder_name)),
    h("h2", { style: "margin-top:4px" }, d.title),
    h("div", { class: "muted small" }, [d.doc_type_label, d.person_name, `${d.pages} page${d.pages > 1 ? "s" : ""}`, `ajouté le ${frDate(d.created_at)}`, !d.mine ? `par ${d.owner_name}` : ""].filter(Boolean).join(" · ")),
    visBadge(d),
    d.seen_by ? h("div", { class: "seen" }, `Visible par : ${d.seen_by.join(", ") || "personne d'autre"}`) : null,
    h("div", { class: "pageimgs" }, Array.from({ length: Math.min(d.pages, 20) }, (_, i) =>
      apiImg(`/api/documents/${id}/page/${i + 1}`, { alt: `Page ${i + 1}`, loading: "lazy" }))),
    h("div", { class: "row" }, apiLink(fileUrl, { class: "btn" }, "Ouvrir"), apiLink(fileUrl + "?download=1", { class: "btn sec" }, "Télécharger", d.title + (d.mime === "application/pdf" ? ".pdf" : ".jpg"))),
    fields.length ? h("div", { class: "card" }, h("h3", {}, "Informations"), h("dl", { class: "rel", style: "margin:0" }, fields.map((f) => [h("dt", {}, f.label), h("dd", {}, f.value)]))) : null,
  ];
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
    values: { title: d.title, folder_id: d.folder_id, person_id: d.person_id, year: d.year, fields: d.fields, visibility: d.visibility, targets: d.targets },
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
  const renderVis = () => {
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
    btn.disabled = true;
    try {
      await onSubmit({ title: title.value, folder_id: Number(folder.value), person_id: Number(person.value) || null, year: year.value, fields, visibility: vis, targets: [...targets] });
    } catch (x) { err.replaceChildren(errBox(x)); btn.disabled = false; }
  } },
    header,
    preview ? h("details", { style: "margin-top:12px", open: true }, h("summary", { class: "muted" }, "Voir le document"), h("div", { class: "pageimgs" }, apiImg(preview, { alt: "Première page" }))) : null,
    fieldsBox.length ? [h("div", { class: "lbl", style: "margin-top:18px" }, "Informations lues sur le document"), h("div", { class: "card", style: "margin-top:0" }, fieldsBox)] : null,
    h("label", { class: "lbl", for: "d-title" }, "Titre", tag(warn.title)), title,
    h("label", { class: "lbl", for: "d-folder" }, "Dossier", tag(warn.folder_id)), folder,
    h("label", { class: "lbl", for: "d-person" }, "Ce document concerne", tag(warn.person_id)), person,
    h("label", { class: "lbl", for: "d-year" }, "Année"), year,
    h("div", { class: "lbl", style: "margin-top:22px" }, "Qui peut voir ce document ?"), optsBox, customBox,
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
      h("p", { class: "small muted", style: "margin:0 0 8px" }, "Changez de personne pour voir que chacun ne voit que les documents qui lui sont partagés. Par exemple, Inès (une cousine) ne voit pas l'acte de naissance que Lina partage avec ses frères, sœur et parents."),
      h("div", { class: "wrapchips" }, users.map((u) => h("button", { class: `chip ${u.is_me ? "on" : ""}`, onclick: async () => { await _a.post("/api/demo/switch", { user_id: u.id }); location.hash = "#/arbre"; location.reload(); } }, u.first_name))),
      h("button", { class: "btn ghost", onclick: async () => { if (!await ask("Effacer vos essais et remettre la démo à zéro ?")) return; await _a.post("/api/demo/reset"); location.hash = "#/arbre"; location.reload(); } }, "Remettre la démo à zéro")));
  }
  const out = [
    ...demoBlock,
    h("div", { class: "prof" }, av(me.member, "big"), h("div", {}, h("h2", {}, fullName(me.member)), h("div", { class: "muted" }, `Identifiant : ${me.username}${me.is_admin ? " · administrateur" : ""}`))),
    h("a", { class: "btn sec", href: `#/personne/${me.member.id}` }, "Voir ma fiche"),
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
