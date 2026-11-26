// Version de démonstration : le « serveur » Miff tourne dans le navigateur.
// Les données restent dans ce navigateur (localStorage + IndexedDB). Aucun envoi sur Internet.
import { analyze, norm, TYPE_LABELS } from "./recognize.js?v=1795724226";
import { detectQuad, loadBitmap, processImage } from "./image.js?v=1795724226";
import { makeSeedPages, SEED } from "./seed.js?v=1795724226";

const KEY = "miff-demo-db-v6", SESSION = "miff-demo-user";

const RELATION_GROUPS = {
  parents: "Mes parents", siblings: "Mes frères et sœurs", spouse: "Mon conjoint", children: "Mes enfants",
  grandparents: "Mes grands-parents", grandchildren: "Mes petits-enfants", uncles: "Oncles et tantes",
  cousins: "Mes cousins", nephews: "Mes neveux et nièces",
};

const FOLDERS = [
  ["etat-civil", "État civil", [["actes-naissance", "Actes de naissance", "family"], ["actes-mariage", "Actes de mariage", "family"], ["actes-deces", "Actes de décès", "family"], ["livret-famille", "Livret de famille", "family"]]],
  ["scolarite", "Scolarité", [["primaire", "École primaire", "custom:rel:parents"], ["college", "Collège", "custom:rel:parents"], ["lycee", "Lycée", "custom:rel:parents"], ["superieur", "Études supérieures", "custom:rel:parents"], ["diplomes", "Diplômes", "family"]]],
  ["identite", "Identité", [["cni", "Cartes d'identité", "private"], ["passeports", "Passeports", "private"], ["titres-sejour", "Titres de séjour", "private"]]],
  ["logement", "Logement", [["baux", "Baux", "private"], ["quittances", "Quittances de loyer", "private"], ["factures", "Factures", "private"]]],
  ["sante", "Santé", [["vaccination", "Carnets de vaccination", "private"], ["ordonnances", "Ordonnances", "private"], ["certificats", "Certificats médicaux", "private"], ["secu-mutuelle", "Sécurité sociale et mutuelle", "private"]]],
  ["notaire", "Notaire et succession", [["succession", "Succession", "custom:rel:siblings"], ["propriete", "Actes de propriété", "family"], ["testaments", "Testaments", "private"]]],
  ["autres", "Autres", [["divers", "Divers", "private"]]],
];

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (s, m) => { throw new HttpError(s, m); };

// ------------------------------------------------------------ Stockage
let db = null;
function save() { localStorage.setItem(KEY, JSON.stringify(db)); }
const nextId = (table) => (db[table].reduce((m, r) => Math.max(m, r.id || 0), 0) + 1);

let idbP = null;
function idb() {
  if (!idbP) idbP = new Promise((res, rej) => {
    const r = indexedDB.open("miff-demo", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return idbP;
}
async function putFile(key, blob) {
  const d = await idb();
  return new Promise((res, rej) => { const t = d.transaction("files", "readwrite"); t.objectStore("files").put(blob, key); t.oncomplete = res; t.onerror = () => rej(t.error); });
}
async function getFile(key) {
  const d = await idb();
  return new Promise((res, rej) => { const r = d.transaction("files").objectStore("files").get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function clearFiles() {
  const d = await idb();
  return new Promise((res) => { const t = d.transaction("files", "readwrite"); t.objectStore("files").clear(); t.oncomplete = res; });
}

async function init() {
  if (db) return;
  const raw = localStorage.getItem(KEY);
  if (raw) { db = { ...EMPTY_EXTRA(), ...JSON.parse(raw) }; return; }
  await seed();
}

async function seed() {
  await clearFiles();
  db = { members: [], unions: [], users: [], folders: [], user_defaults: [], groups: [], docs: [], invites: [], uploads: {}, ...EMPTY_EXTRA() };
  let fid = 0;
  FOLDERS.forEach(([slug, name, subs], i) => {
    const pid = ++fid;
    db.folders.push({ id: pid, parent_id: null, slug, name, sort: i, default_visibility: "private" });
    subs.forEach(([s, n, v], j) => db.folders.push({ id: ++fid, parent_id: pid, slug: s, name: n, sort: j, default_visibility: v }));
  });
  for (const m of SEED.members) db.members.push({ birth_name: "", birth_place: "", death_date: "", deceased: false, notes: "", father_id: null, mother_id: null, sex: "", birth_date: "", last_name: "", ...m });
  db.unions = SEED.unions.map(([a, b], i) => ({ id: i + 1, a_id: a, b_id: b }));
  db.users = SEED.users.map((u, i) => ({ id: i + 1, default_visibility: "", ...u }));
  const pages = await makeSeedPages();
  let did = 0;
  for (const d of SEED.docs) {
    const id = ++did;
    const folder = db.folders.find((f) => f.slug === d.folder);
    const imgs = pages[d.page];
    for (let i = 0; i < imgs.length; i++) await putFile(`doc-${id}-${i + 1}`, imgs[i]);
    db.docs.push({ id, owner_user_id: d.owner, person_id: d.person, folder_id: folder.id, title: d.title, doc_type: d.type, fields: d.fields || {}, year: d.year || "",
      mime: "image/jpeg", pages: imgs.length, size: imgs.reduce((a, b) => a + b.size, 0), ocr_text: d.text || "", visibility: d.visibility, targets: d.targets || [],
      created_at: d.created });
  }
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString().slice(0, 19).replace("T", " ");
  for (const x of SEED.messages || []) db.messages.push({ id: db.messages.length + 1, chat: x.chat, from_member: x.from, text: x.text, kind: x.kind || "text", member_id: x.member || null, at: ago(x.ago) });
  for (const r of SEED.requests || []) {
    const rid = db.requests.length + 1;
    db.requests.push({ id: rid, doc_id: r.doc, from_member: r.from, reason: r.reason, duration: r.duration, status: "pending", at: ago(r.ago) });
    const d = db.docs.find((x) => x.id === r.doc); const owner = db.users.find((u) => u.id === d.owner_user_id);
    const who = db.members.find((x) => x.id === r.from);
    const dk = dmOf(r.from, owner.member_id);
    db.messages.push({ id: db.messages.length + 1, chat: dk, from_member: r.from, kind: "request", request_id: rid, text: r.reason, at: ago(r.ago) });
    db.notifs.push({ id: db.notifs.length + 1, member_id: owner.member_id, kind: "request", ref: rid, text: `${who.first_name} demande à voir « ${d.title} »`, link: `#/chat/${dk}`, at: ago(r.ago), read: false });
  }
  db.notifs.push({ id: db.notifs.length + 1, member_id: 9, kind: "birth", text: "Naissance : Aya, fille d'Inès et Thomas", link: "#/personne/31", at: ago(3000), read: true });
  save();
  localStorage.setItem(SESSION, "1");
}
const EMPTY_EXTRA = () => ({ messages: [], reads: [], chatgroups: [], requests: [], grants: [], notifs: [] });

// ------------------------------------------------------------ Arbre
class Tree {
  constructor() {
    this.m = new Map(db.members.map((x) => [x.id, x]));
    this.kids = new Map(); this.sp = new Map();
    const add = (map, k, v) => { if (!map.has(k)) map.set(k, new Set()); map.get(k).add(v); };
    for (const x of db.members) for (const p of [x.father_id, x.mother_id]) if (p) add(this.kids, p, x.id);
    for (const u of db.unions) { add(this.sp, u.a_id, u.b_id); add(this.sp, u.b_id, u.a_id); }
    for (const x of db.members) if (x.father_id && x.mother_id) { add(this.sp, x.father_id, x.mother_id); add(this.sp, x.mother_id, x.father_id); }
  }
  parents(i) { const x = this.m.get(i); return new Set(x ? [x.father_id, x.mother_id].filter(Boolean) : []); }
  children(i) { return new Set(this.kids.get(i) || []); }
  spouses(i) { return new Set(this.sp.get(i) || []); }
  siblings(i) { const s = new Set(); for (const p of this.parents(i)) for (const k of this.kids.get(p) || []) s.add(k); s.delete(i); return s; }
  grandparents(i) { const s = new Set(); for (const p of this.parents(i)) for (const g of this.parents(p)) s.add(g); return s; }
  grandchildren(i) { const s = new Set(); for (const c of this.children(i)) for (const g of this.children(c)) s.add(g); return s; }
  uncles(i) { const s = new Set(); const ps = this.parents(i); for (const p of ps) for (const x of this.siblings(p)) { s.add(x); for (const y of this.spouses(x)) s.add(y); } for (const p of ps) s.delete(p); return s; }
  cousins(i) { const s = new Set(); for (const p of this.parents(i)) for (const x of this.siblings(p)) for (const c of this.children(x)) s.add(c); s.delete(i); for (const x of this.siblings(i)) s.delete(x); return s; }
  nephews(i) { const s = new Set(); for (const x of this.siblings(i)) for (const c of this.children(x)) s.add(c); return s; }
  group(k, i) { const f = { parents: "parents", siblings: "siblings", spouse: "spouses", children: "children", grandparents: "grandparents", grandchildren: "grandchildren", uncles: "uncles", cousins: "cousins", nephews: "nephews" }[k]; return f ? this[f](i) : new Set(); }
  generations() {
    const gen = new Map();
    for (let it = 0; it < this.m.size + 2; it++) {
      let changed = false;
      for (const i of this.m.keys()) {
        const ps = [...this.parents(i)].filter((p) => gen.has(p)).map((p) => gen.get(p));
        let g;
        if (ps.length) g = Math.max(...ps) + 1;
        else if (!this.parents(i).size) {
          const c = [...this.spouses(i)].filter((s) => gen.has(s) && this.parents(s).size).map((s) => gen.get(s))
            .concat([...this.children(i)].filter((k) => gen.has(k)).map((k) => gen.get(k) - 1));
          g = c.length ? Math.max(...c) : 0;
        } else continue;
        if (gen.get(i) !== g) { gen.set(i, g); changed = true; }
      }
      if (!changed) break;
    }
    const mn = Math.min(...gen.values());
    for (const [k, v] of gen) gen.set(k, v - mn);
    return gen;
  }
  relation(me, o) {
    if (me === o) return "Moi";
    const f = this.m.get(o)?.sex === "F";
    for (const [fn, fem, masc] of [["parents", "Mère", "Père"], ["siblings", "Sœur", "Frère"], ["spouses", "Conjointe", "Conjoint"], ["children", "Fille", "Fils"],
      ["grandparents", "Grand-mère", "Grand-père"], ["grandchildren", "Petite-fille", "Petit-fils"], ["uncles", "Tante", "Oncle"], ["nephews", "Nièce", "Neveu"], ["cousins", "Cousine", "Cousin"]]) {
      if (this[fn](me).has(o)) return f ? fem : masc;
    }
    return "";
  }
}
function genLabel(g, my) {
  return { [-3]: "Arrière-grands-parents", [-2]: "Grands-parents", [-1]: "Parents", 0: "Ma génération", 1: "Enfants", 2: "Petits-enfants" }[g - my] || `Génération ${g + 1}`;
}

// ------------------------------------------------------------ Droits
function allowed(ownerMember, targets, tree) {
  const out = new Set();
  for (const t of targets) {
    const [k, v] = t.split(":");
    if (k === "rel") tree.group(v, ownerMember).forEach((x) => out.add(x));
    else if (k === "mem") out.add(Number(v));
    else if (k === "grp") (db.groups.find((g) => g.id === Number(v))?.member_ids || []).forEach((x) => out.add(x));
  }
  return out;
}
const nowS = () => new Date().toISOString().slice(0, 19).replace("T", " ");
function isMinor(m) { if (!m?.birth_date) return false; const b = new Date(m.birth_date); const t = new Date(); t.setFullYear(t.getFullYear() - 18); return b > t; }
function grantFor(user, d) { const n = nowS(); return db.grants.find((g) => g.doc_id === d.id && g.member_id === user.member_id && (!g.until || g.until > n)); }
function canView(user, d, tree) {
  if (d.owner_user_id === user.id) return true;
  if (d.person_id && d.person_id === user.member_id) return true;
  if (d.person_id && tree.parents(d.person_id).has(user.member_id) && isMinor(tree.m.get(d.person_id))) return true;
  if (grantFor(user, d)) return true;
  if (d.visibility === "family") return true;
  if (d.visibility === "custom") {
    const owner = db.users.find((u) => u.id === d.owner_user_id);
    return allowed(owner?.member_id, d.targets, tree).has(user.member_id);
  }
  return false;
}

const INFO_FIELDS = ["birth_date", "birth_place", "city", "job", "phone", "email", "notes"];
const privOf = (m) => (m.private_fields ?? ["phone", "email"]).filter((f) => INFO_FIELDS.includes(f));
function memberPublic(m, tree, me, gens, accs, viewer) {
  const d = { phone: "", email: "", city: "", job: "", ...m, private_fields: privOf(m), spouses: [...tree.spouses(m.id)].sort((a, b) => a - b), generation: gens.get(m.id) || 0, relation: tree.relation(me, m.id), has_account: accs.has(m.id) };
  if (viewer && !(viewer.is_admin || m.id === viewer.member_id || !accs.has(m.id))) {
    d.hidden_count = d.private_fields.filter((f) => m[f]).length;
    for (const f of d.private_fields) d[f] = "";
    d.private_fields = [];
  }
  return d;
}
function docPublic(d, user) {
  const f = db.folders.find((x) => x.id === d.folder_id) || {};
  const parent = db.folders.find((x) => x.id === f.parent_id);
  const p = db.members.find((x) => x.id === d.person_id);
  const owner = db.users.find((u) => u.id === d.owner_user_id);
  const om = db.members.find((x) => x.id === owner?.member_id);
  return { ...d, ocr_text: undefined, doc_type_label: TYPE_LABELS[d.doc_type] || "Document", folder_name: f.name || "", parent_folder_name: parent?.name || "",
    person_name: p ? `${p.first_name} ${p.last_name}`.trim() : "", mine: d.owner_user_id === user.id, owner_name: om?.first_name || "" };
}

function lockedPublic(d, user) {
  const base = docPublic(d, user);
  const label = base.doc_type_label || "Document";
  const mine = db.requests.filter((r) => r.doc_id === d.id && r.from_member === user.member_id).sort((a, b) => b.id - a.id)[0];
  return { id: d.id, locked: true, title: `${label}${d.year ? " " + d.year : ""}`, doc_type_label: label, folder_id: d.folder_id, folder_name: base.folder_name, parent_folder_name: base.parent_folder_name,
    person_id: d.person_id, person_name: base.person_name, year: d.year, owner_name: base.owner_name, visibility: d.visibility, targets: [], created_at: d.created_at, pages: 0, mine: false,
    request: mine ? { status: mine.status, at: mine.at, answer: mine.answer || "" } : null };
}
function parseVis(v) { v = v || "private"; if (v.startsWith("custom:")) return ["custom", v.slice(7).split(",").filter(Boolean)]; return [["private", "family"].includes(v) ? v : "private", []]; }
const fmtVis = (vis, t) => (vis === "custom" ? "custom:" + t.join(",") : vis);
const cleanTargets = (ts) => (ts || []).filter((t) => { const [k, v] = t.split(":"); return (k === "rel" && RELATION_GROUPS[v]) || (["mem", "grp"].includes(k) && /^\d+$/.test(v)); });
function defaultVis(user, folder) {
  const row = db.user_defaults.find((r) => r.user_id === user.id && r.folder_id === folder.id);
  const [visibility, targets] = parseVis(row ? row.visibility : user.default_visibility || folder.default_visibility);
  return { visibility, targets };
}
function cleanFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) { const val = typeof v === "object" ? v.value : v; if (val && String(val).trim()) out[k] = { label: v.label || k, value: String(val).slice(0, 200) }; }
  return out;
}

// ------------------------------------------------------------ OCR (Tesseract dans le navigateur)
let workerP = null;
async function ocr(blob) {
  try {
    if (!workerP) {
      workerP = (async () => {
        const base = (p) => new URL(p, document.baseURI).href;
        if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement("script"); s.src = base("vendor/tesseract/tesseract.min.js"); s.onload = res; s.onerror = rej; document.head.append(s); });
        // Les données de langue sont livrées dans un script : le « worker » les sert lui-même.
        const fra = (await import(base("vendor/tesseract/lang/fra-traineddata.js"))).default;
        const code = `const B=${JSON.stringify(fra)};const of=self.fetch.bind(self);` +
          `self.fetch=(u,o)=>String(u).endsWith("fra.traineddata")?Promise.resolve(new Response(Uint8Array.from(atob(B),c=>c.charCodeAt(0)))):of(u,o);` +
          `importScripts(${JSON.stringify(base("vendor/tesseract/worker.min.js"))});`;
        const workerPath = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
        return window.Tesseract.createWorker("fra", 1, { workerPath, corePath: base("vendor/tesseract/"), langPath: base("vendor/tesseract/lang"), gzip: false, cacheMethod: "none", workerBlobURL: false });
      })();
    }
    const w = await workerP;
    const r = await w.recognize(blob);
    return r.data.text || "";
  } catch (e) { console.warn("OCR indisponible", e); workerP = null; return ""; }
}

async function toJpeg(blob, max = 2400) {
  const bmp = await loadBitmap(blob);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
}


// ------------------------------------------------------------ Chat, demandes, notifications
function frShort(s) { const d = new Date(String(s).length === 10 ? s + "T12:00:00" : String(s).replace(" ", "T") + "Z"); return isNaN(d) ? s : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" }); }
function notify(memberId, kind, text, link, ref = null) {
  if (!db.users.some((u) => u.member_id === memberId)) return;
  db.notifs.push({ id: nextId("notifs"), member_id: memberId, kind, text, link, ref, at: nowS(), read: false });
}
function requestPublic(r, tree) {
  const d = db.docs.find((x) => x.id === r.doc_id);
  return { id: r.id, doc_id: r.doc_id, doc_title: d?.title || "Document", from_member: r.from_member, from_name: tree.m.get(r.from_member)?.first_name || "?",
    reason: r.reason, duration: r.duration, status: r.status, answer: r.answer || "", until: r.until || null, at: r.at };
}
const pairKey = (a, b) => [a || 0, b || 0].join("-");
// Une seule discussion de groupe : toute la famille. Le reste, ce sont des conversations à deux.
function autoChats() {
  return [{ key: "fam", name: "Toute la famille", kind: "family", members: new Set(db.members.map((x) => x.id)) }];
}
const dmOf = (a, b) => `dm:${Math.min(a, b)}-${Math.max(a, b)}`;
function postSystem(chat, from, kind, extra) {
  db.messages.push({ id: nextId("messages"), chat, from_member: from, kind, text: "", at: nowS(), ...extra });
}
function chatInfo(key, user, tree) {
  const mid = user.member_id;
  let c = autoChats().find((x) => x.key === key);
  if (!c && key.startsWith("dm:")) {
    const [a, b] = key.slice(3).split("-").map(Number);
    if ((a === mid || b === mid) && tree.m.has(a) && tree.m.has(b) && a < b) { const o = a === mid ? b : a; c = { key, name: tree.m.get(o).first_name, kind: "dm", other: o, members: new Set([a, b]) }; }
  }
  if (!c && key.startsWith("grp:")) {
    const g = db.chatgroups.find((x) => x.id === Number(key.slice(4)));
    if (g && g.member_ids.includes(mid)) c = { key, name: g.name, kind: "group", members: new Set(g.member_ids) };
  }
  return c || null;
}
function chatList(user, tree) {
  const mid = user.member_id;
  const list = autoChats();
  const keys = new Set(list.map((c) => c.key));
  for (const x of db.messages) if (!keys.has(x.chat) && (x.chat.startsWith("dm:") || x.chat.startsWith("grp:"))) { const c = chatInfo(x.chat, user, tree); if (c) { list.push(c); keys.add(c.key); } }
  for (const g of db.chatgroups) if (g.member_ids.includes(mid) && !keys.has(`grp:${g.id}`)) { list.push(chatInfo(`grp:${g.id}`, user, tree)); keys.add(`grp:${g.id}`); }
  return list.map((c) => {
    const msgs = db.messages.filter((x) => x.chat === c.key);
    const last = msgs.reduce((a, x) => (!a || x.id > a.id ? x : a), null);
    const rd = db.reads.find((r) => r.member_id === mid && r.chat === c.key)?.last || 0;
    const unread = msgs.filter((x) => x.id > rd && x.from_member !== mid).length;
    const who = last ? tree.m.get(last.from_member)?.first_name : "";
    const preview = last ? (last.kind === "request" ? "🔑 Demande d'accès à un document" : last.kind === "answer" ? "🔑 Réponse à la demande" : last.kind === "birth" ? `👶 Naissance de ${tree.m.get(last.member_id)?.first_name || ""}` : last.doc_id ? "📄 Document partagé" : last.has_image && !last.text ? "📷 Photo" : last.text) : "";
    return { key: c.key, name: c.name, kind: c.kind, other: c.other || null, member_count: c.members.size, member_names: [...c.members].map((i) => tree.m.get(i)?.first_name).filter(Boolean).slice(0, 8),
      last_at: last?.at || "", last_text: last ? (last.from_member === mid ? "Vous : " : who + " : ") + preview : "", unread };
  }).sort((a, b) => (b.last_at || "").localeCompare(a.last_at || "") || (a.kind === "auto" ? -1 : 1));
}
function messagePublic(x, user, tree) {
  const out = { id: x.id, from_member: x.from_member, from_name: tree.m.get(x.from_member)?.first_name || "?", mine: x.from_member === user.member_id, text: x.text, kind: x.kind, has_image: !!x.has_image, at: x.at };
  if (x.kind === "birth") { const b = tree.m.get(x.member_id); if (b) out.baby = { id: b.id, first_name: b.first_name, birth_date: b.birth_date, sex: b.sex, parents: [...tree.parents(b.id)].map((i) => tree.m.get(i)?.first_name) }; }
  if (x.kind === "request" || x.kind === "answer") {
    const r = db.requests.find((y) => y.id === x.request_id);
    if (r) { out.request = requestPublic(r, tree); out.request.can_answer = r.status === "pending" && db.docs.find((d) => d.id === r.doc_id)?.owner_user_id === user.id; }
    return out;
  }
  if (x.doc_id) { const d = db.docs.find((y) => y.id === x.doc_id); if (d) out.doc = canView(user, d, tree) ? { id: d.id, title: d.title, locked: false } : d.hidden ? null : { id: d.id, title: lockedPublic(d, user).title, locked: true }; }
  return out;
}

// ------------------------------------------------------------ Routes
function me() {
  const id = Number(localStorage.getItem(SESSION));
  const u = db.users.find((x) => x.id === id);
  if (!u) fail(401, "Non connecté");
  return u;
}

export async function handle(method, url, body) {
  await init();
  const u = new URL(url, location.origin);
  const path = decodeURIComponent(u.pathname), q = u.searchParams;
  let m;
  const R = (re) => (m = path.match(re));

  if (path === "/api/setup") return { needs_setup: false };
  if (path === "/api/health") return { ok: true, version: "démo", ocr: true };
  if (path === "/api/login" && method === "POST") {
    const usr = db.users.find((x) => x.username.toLowerCase() === (body.username || "").trim().toLowerCase());
    if (!usr || usr.password !== body.password) fail(401, "Identifiant ou mot de passe incorrect.");
    localStorage.setItem(SESSION, String(usr.id)); return { ok: true };
  }
  if (path === "/api/logout") { localStorage.removeItem(SESSION); return { ok: true }; }
  if (path === "/api/demo/reset") { localStorage.removeItem(KEY); db = null; await seed(); return { ok: true }; }
  if (R(/^\/api\/invites\/([\w-]+)$/) && method === "GET") {
    const inv = db.invites.find((i) => i.token === m[1]); if (!inv) fail(404, "Invitation expirée ou inconnue.");
    const p = db.members.find((x) => x.id === inv.member_id); return { first_name: p.first_name, last_name: p.last_name };
  }
  if (R(/^\/api\/invites\/([\w-]+)\/accept$/)) {
    const inv = db.invites.find((i) => i.token === m[1]); if (!inv) fail(404, "Invitation expirée ou inconnue.");
    if (!/^[A-Za-z0-9._-]{3,32}$/.test((body.username || "").trim())) fail(400, "Identifiant : 3 à 32 lettres, chiffres, points ou tirets, sans espace.");
    if (db.users.some((x) => x.username.toLowerCase() === body.username.trim().toLowerCase())) fail(400, "Cet identifiant est déjà pris.");
    if ((body.password || "").length < 8) fail(400, "Mot de passe : 8 caractères minimum.");
    const id = nextId("users");
    db.users.push({ id, member_id: inv.member_id, username: body.username.trim(), password: body.password, is_admin: false, default_visibility: "" });
    db.invites = db.invites.filter((i) => i !== inv); save();
    localStorage.setItem(SESSION, String(id)); return { ok: true };
  }

  const user = me();
  const tree = new Tree();
  const accs = new Set(db.users.map((x) => x.member_id));

  if (path === "/api/demo/switch") { const t = db.users.find((x) => x.id === body.user_id); if (t) localStorage.setItem(SESSION, String(t.id)); return { ok: true }; }
  if (path === "/api/demo/users") return db.users.map((x) => ({ id: x.id, username: x.username, first_name: db.members.find((mm) => mm.id === x.member_id)?.first_name, is_me: x.id === user.id }));

  if (path === "/api/me") {
    const gens = tree.generations();
    const mem = db.members.find((x) => x.id === user.member_id);
    return { user_id: user.id, username: user.username, is_admin: !!user.is_admin, member: memberPublic(mem, tree, user.member_id, gens, accs),
      default_visibility: user.default_visibility, relation_groups: RELATION_GROUPS, ocr: true, demo: true };
  }
  if (path === "/api/me/password") {
    if (user.password !== body.old) fail(400, "Ancien mot de passe incorrect.");
    user.password = body.new; save(); return { ok: true };
  }
  if (path === "/api/invites" && method === "POST") {
    if (!user.is_admin) fail(403, "Réservé à l'administrateur");
    if (accs.has(body.member_id)) fail(400, "Cette personne a déjà un compte.");
    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    db.invites = db.invites.filter((i) => i.member_id !== body.member_id);
    db.invites.push({ token, member_id: body.member_id }); save(); return { token };
  }
  if (path === "/api/accounts") return db.users.map((x) => { const mm = db.members.find((y) => y.id === x.member_id); return { id: x.id, username: x.username, is_admin: x.is_admin, member_id: x.member_id, first_name: mm.first_name, last_name: mm.last_name }; });
  if (R(/^\/api\/accounts\/(\d+)\/reset$/)) { const t = db.users.find((x) => x.id === Number(m[1])); const pw = Math.random().toString(36).slice(2, 10); t.password = pw; save(); return { temporary_password: pw }; }

  // Arbre
  if (path === "/api/members" && method === "GET") { const gens = tree.generations(); return db.members.map((x) => memberPublic(x, tree, user.member_id, gens, accs, user)); }
  if (path === "/api/members" && method === "POST") {
    if (!(body.first_name || "").trim()) fail(400, "Le prénom est obligatoire.");
    let { father_id = null, mother_id = null } = body;
    if (body.sibling_of) { const s = tree.m.get(body.sibling_of); father_id = s.father_id; mother_id = s.mother_id; }
    if (body.parent_of) {
      const c = tree.m.get(body.parent_of); const col = body.sex === "F" ? "mother_id" : "father_id";
      if (c[col]) fail(400, `Cette personne a déjà un${body.sex === "F" ? "e mère" : " père"} dans l'arbre.`);
    }
    const id = nextId("members");
    db.members.push({ id, first_name: body.first_name.trim(), last_name: (body.last_name || "").trim(), birth_name: body.birth_name || "", sex: body.sex || "", birth_date: body.birth_date || "",
      birth_place: body.birth_place || "", death_date: body.death_date || "", deceased: !!(body.deceased || body.death_date), notes: body.notes || "", father_id, mother_id,
      phone: (body.phone || "").trim(), email: (body.email || "").trim(), city: (body.city || "").trim(), job: (body.job || "").trim(), private_fields: body.private_fields || ["phone", "email"] });
    if (body.spouse_of) db.unions.push({ id: nextId("unions"), a_id: body.spouse_of, b_id: id });
    if (body.parent_of) {
      const c = db.members.find((x) => x.id === body.parent_of); const col = body.sex === "F" ? "mother_id" : "father_id";
      c[col] = id; const other = c[col === "mother_id" ? "father_id" : "mother_id"];
      if (other) db.unions.push({ id: nextId("unions"), a_id: other, b_id: id });
    }
    save(); return { id };
  }
  if (R(/^\/api\/members\/(\d+)$/)) {
    const id = Number(m[1]); const x = db.members.find((y) => y.id === id); if (!x) fail(404, "Personne introuvable");
    if (method === "GET") {
      const gens = tree.generations();
      const docs = db.docs.filter((d) => d.person_id === id && (canView(user, d, tree) || !d.hidden)).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((d) => canView(user, d, tree) ? docPublic(d, user) : lockedPublic(d, user));
      return { ...memberPublic(x, tree, user.member_id, gens, accs, user), parents: [...tree.parents(id)], children: [...tree.children(id)], siblings: [...tree.siblings(id)], documents: docs,
        can_edit: user.is_admin || id === user.member_id || !accs.has(id) };
    }
    if (method === "PATCH") {
      if (!(user.is_admin || id === user.member_id || !accs.has(id))) fail(403, "Seule cette personne ou l'administrateur peut modifier sa fiche.");
      Object.assign(x, { first_name: body.first_name, last_name: body.last_name, birth_name: body.birth_name, sex: body.sex, birth_date: body.birth_date, birth_place: body.birth_place,
        death_date: body.death_date, deceased: !!(body.deceased || body.death_date), notes: body.notes, father_id: body.father_id, mother_id: body.mother_id,
        phone: (body.phone || "").trim(), email: (body.email || "").trim(), city: (body.city || "").trim(), job: (body.job || "").trim(),
        private_fields: body.private_fields ? INFO_FIELDS.filter((f) => body.private_fields.includes(f)) : privOf(x) });
      save(); return { ok: true };
    }
    if (method === "DELETE") {
      if (!user.is_admin) fail(403, "Réservé à l'administrateur");
      if (accs.has(id)) fail(400, "Cette personne a un compte : on ne peut pas la retirer de l'arbre.");
      db.members = db.members.filter((y) => y.id !== id);
      for (const y of db.members) { if (y.father_id === id) y.father_id = null; if (y.mother_id === id) y.mother_id = null; }
      db.unions = db.unions.filter((un) => un.a_id !== id && un.b_id !== id); save(); return { ok: true };
    }
  }

  // Dossiers et documents
  const visible = () => db.docs.filter((d) => canView(user, d, tree));
  const lockedDocs = () => db.docs.filter((d) => !d.hidden && !canView(user, d, tree));
  if (path === "/api/folders") {
    const gens = tree.generations();
    let docs = visible();
    let all = docs.concat(lockedDocs());
    if (q.get("person")) all = all.filter((d) => d.person_id === Number(q.get("person")));
    else if (q.get("generation") !== null && q.get("generation") !== "") all = all.filter((d) => d.person_id && gens.get(d.person_id) === Number(q.get("generation")));
    if (q.get("person")) docs = docs.filter((d) => d.person_id === Number(q.get("person")));
    else if (q.get("generation") !== null && q.get("generation") !== "") docs = docs.filter((d) => d.person_id && gens.get(d.person_id) === Number(q.get("generation")));
    const counts = {}; for (const d of all) counts[d.folder_id] = (counts[d.folder_id] || 0) + 1;
    const tops = db.folders.filter((f) => !f.parent_id).map((f) => { const ch = db.folders.filter((s) => s.parent_id === f.id).map((s) => ({ ...s, count: counts[s.id] || 0 })); return { ...f, children: ch, count: ch.reduce((a, s) => a + s.count, 0) }; });
    const my = gens.get(user.member_id) || 0;
    return { folders: tops, generations: [...new Set(gens.values())].sort((a, b) => a - b).map((g) => ({ value: g, label: genLabel(g, my) })), my_generation: my,
      mine_count: docs.filter((d) => d.owner_user_id === user.id).length, shared_count: docs.filter((d) => d.owner_user_id !== user.id).length };
  }
  if (path === "/api/documents" && method === "GET") {
    let docs = visible();
    const folder = Number(q.get("folder"));
    if (folder) { const subs = db.folders.filter((f) => f.parent_id === folder).map((f) => f.id); docs = docs.filter((d) => d.folder_id === folder || subs.includes(d.folder_id)); }
    if (q.get("person")) docs = docs.filter((d) => d.person_id === Number(q.get("person")));
    if (q.get("scope") === "mine") docs = docs.filter((d) => d.owner_user_id === user.id);
    if (q.get("scope") === "shared") docs = docs.filter((d) => d.owner_user_id !== user.id);
    if (q.get("generation") !== null && q.get("generation") !== "" && !q.get("person")) { const gens = tree.generations(); docs = docs.filter((d) => d.person_id && gens.get(d.person_id) === Number(q.get("generation"))); }
    if ((q.get("q") || "").trim()) { const nq = norm(q.get("q").trim()); docs = docs.filter((d) => norm(d.title + " " + d.ocr_text + " " + JSON.stringify(d.fields)).includes(nq)); }
    let out = docs.map((d) => docPublic(d, user));
    if ((folder || q.get("person")) && !q.get("scope") && !(q.get("q") || "").trim()) {
      let lk = lockedDocs();
      if (folder) { const subs = db.folders.filter((f) => f.parent_id === folder).map((f) => f.id); lk = lk.filter((d) => d.folder_id === folder || subs.includes(d.folder_id)); }
      if (q.get("person")) lk = lk.filter((d) => d.person_id === Number(q.get("person")));
      if (q.get("generation") !== null && q.get("generation") !== "" && !q.get("person")) { const gens = tree.generations(); lk = lk.filter((d) => d.person_id && gens.get(d.person_id) === Number(q.get("generation"))); }
      out = out.concat(lk.map((d) => lockedPublic(d, user)));
    }
    return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const getDoc = (id, own) => {
    const d = db.docs.find((x) => x.id === id);
    if (!d || !canView(user, d, tree)) fail(404, "Document introuvable");
    if (own && d.owner_user_id !== user.id) fail(403, "Seule la personne qui a ajouté ce document peut le modifier.");
    return d;
  };
  if (R(/^\/api\/documents\/(\d+)\/page\/(\d+)$/)) { getDoc(Number(m[1])); return (await getFile(`doc-${m[1]}-${m[2]}`)) || fail(404, "Page introuvable"); }
  if (R(/^\/api\/documents\/(\d+)\/file$/)) {
    const d = getDoc(Number(m[1]));
    if (d.mime === "application/pdf") return getFile(`doc-${d.id}-pdf`);
    return getFile(`doc-${d.id}-1`);
  }
  if (R(/^\/api\/documents\/(\d+)$/)) {
    const id = Number(m[1]);
    if (method === "GET") {
      const raw = db.docs.find((x) => x.id === id);
      if (raw && !raw.hidden && !canView(user, raw, tree)) return lockedPublic(raw, user);
      const d = getDoc(id); const out = docPublic(d, user);
      if (out.mine) {
        const n = nowS();
        out.grants = db.grants.filter((g) => g.doc_id === id && (!g.until || g.until > n)).map((g) => ({ member_id: g.member_id, name: tree.m.get(g.member_id)?.first_name || "?", until: g.until }));
        out.pending_requests = db.requests.filter((r) => r.doc_id === id && r.status === "pending").map((r) => requestPublic(r, tree));
      }
      const g = grantFor(user, d); if (g && !out.mine) out.granted_until = g.until;
      if (d.visibility === "custom") { const owner = db.users.find((x) => x.id === d.owner_user_id); out.seen_by = [...allowed(owner.member_id, d.targets, tree)].map((i) => tree.m.get(i)?.first_name).filter(Boolean).sort(); }
      return out;
    }
    if (method === "PATCH") {
      const d = getDoc(id, true);
      for (const k of ["title", "folder_id", "year"]) if (body[k] != null) d[k] = body[k];
      if ("person_id" in body) d.person_id = body.person_id;
      if (body.fields) d.fields = cleanFields(body.fields);
      if (body.visibility) { d.visibility = ["private", "family", "custom"].includes(body.visibility) ? body.visibility : "private"; d.targets = d.visibility === "custom" ? cleanTargets(body.targets) : []; }
      if ("hidden" in body) d.hidden = !!body.hidden && d.visibility !== "family";
      save(); return { ok: true };
    }
    if (method === "DELETE") { getDoc(id, true); db.docs = db.docs.filter((x) => x.id !== id); save(); return { ok: true }; }
  }
  if (path === "/api/documents" && method === "POST") {
    const up = db.uploads[body.upload_id]; if (!up || up.user_id !== user.id) fail(400, "L'envoi a expiré, recommencez.");
    const id = nextId("docs");
    const vis = ["private", "family", "custom"].includes(body.visibility) ? body.visibility : "private";
    for (let i = 0; i < up.pages; i++) { const b = await getFile(`up-${body.upload_id}-${i + 1}`); if (b) await putFile(`doc-${id}-${i + 1}`, b); }
    if (up.mime === "application/pdf") await putFile(`doc-${id}-pdf`, await getFile(`up-${body.upload_id}-pdf`));
    db.docs.push({ id, owner_user_id: user.id, person_id: body.person_id, folder_id: body.folder_id, title: (body.title || "Document").slice(0, 150), doc_type: body.doc_type || "",
      fields: cleanFields(body.fields), year: body.year || "", mime: up.mime, pages: up.pages, size: up.size, ocr_text: up.text, visibility: vis,
      targets: vis === "custom" ? cleanTargets(body.targets) : [], hidden: !!body.hidden && vis !== "family", created_at: new Date().toISOString().slice(0, 19).replace("T", " ") });
    delete db.uploads[body.upload_id]; save(); return { id };
  }

  // Notifications
  if (path === "/api/badges") {
    const notifs = db.notifs.filter((n) => n.member_id === user.member_id && !n.read).length;
    const chats = chatList(user, tree).reduce((a, c) => a + c.unread, 0);
    return { notifs, chats };
  }
  if (path === "/api/notifications" && method === "GET") {
    const reqs = db.requests.filter((r) => r.status === "pending" && db.docs.find((d) => d.id === r.doc_id)?.owner_user_id === user.id).map((r) => requestPublic(r, tree));
    const mine = db.requests.filter((r) => r.from_member === user.member_id).sort((a, b) => b.id - a.id).slice(0, 10).map((r) => requestPublic(r, tree));
    const list = db.notifs.filter((n) => n.member_id === user.member_id).sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id).slice(0, 50);
    return { requests: reqs, my_requests: mine, notifications: list };
  }
  if (path === "/api/notifications/read") { db.notifs.forEach((n) => { if (n.member_id === user.member_id) n.read = true; }); save(); return { ok: true }; }

  // Demandes d'accès
  if (R(/^\/api\/documents\/(\d+)\/request$/) && method === "POST") {
    const d = db.docs.find((x) => x.id === Number(m[1]));
    if (!d || d.hidden) fail(404, "Document introuvable");
    if (canView(user, d, tree)) fail(400, "Vous voyez déjà ce document.");
    const reason = (body.reason || "").trim();
    if (reason.length < 3) fail(400, "Expliquez en quelques mots pourquoi vous en avez besoin.");
    if (db.requests.some((r) => r.doc_id === d.id && r.from_member === user.member_id && r.status === "pending")) fail(400, "Vous avez déjà une demande en attente pour ce document.");
    const duration = ["once", "7d", "always"].includes(body.duration) ? body.duration : "7d";
    const id = nextId("requests");
    db.requests.push({ id, doc_id: d.id, from_member: user.member_id, reason: reason.slice(0, 500), duration, status: "pending", at: nowS() });
    const owner = db.users.find((x) => x.id === d.owner_user_id);
    postSystem(dmOf(user.member_id, owner.member_id), user.member_id, "request", { request_id: id, text: reason.slice(0, 500) });
    notify(owner.member_id, "request", `${tree.m.get(user.member_id).first_name} demande à voir « ${d.title} »`, `#/chat/${dmOf(user.member_id, owner.member_id)}`, id);
    save(); return { id };
  }
  if (R(/^\/api\/requests\/(\d+)\/answer$/) && method === "POST") {
    const r = db.requests.find((x) => x.id === Number(m[1])); if (!r) fail(404, "Demande introuvable");
    const d = db.docs.find((x) => x.id === r.doc_id);
    if (!d || d.owner_user_id !== user.id) fail(403, "Seule la personne qui a ajouté le document peut répondre.");
    if (r.status !== "pending") fail(400, "Cette demande a déjà reçu une réponse.");
    r.answer = (body.message || "").trim().slice(0, 300); r.answered_at = nowS();
    if (body.accept) {
      const duration = ["once", "7d", "always"].includes(body.duration) ? body.duration : r.duration;
      const until = duration === "always" ? null : new Date(Date.now() + (duration === "once" ? 1 : 7) * 864e5).toISOString().slice(0, 19).replace("T", " ");
      db.grants = db.grants.filter((g) => !(g.doc_id === d.id && g.member_id === r.from_member));
      db.grants.push({ doc_id: d.id, member_id: r.from_member, until });
      r.status = "accepted"; r.until = until;
      notify(r.from_member, "answer", `${tree.m.get(user.member_id).first_name} a accepté : vous pouvez voir « ${d.title} »${until ? " jusqu'au " + frShort(until) : ""}`, `#/document/${d.id}`);
    } else {
      r.status = "refused";
      notify(r.from_member, "answer", `${tree.m.get(user.member_id).first_name} a refusé votre demande pour « ${d.title} »${r.answer ? " : « " + r.answer + " »" : ""}`, `#/document/${d.id}`);
    }
    postSystem(dmOf(user.member_id, r.from_member), user.member_id, "answer", { request_id: r.id, text: r.answer || "" });
    db.notifs.forEach((n) => { if (n.kind === "request" && n.ref === r.id) n.read = true; });
    save(); return { ok: true };
  }
  if (R(/^\/api\/documents\/(\d+)\/grants\/(\d+)$/) && method === "DELETE") {
    getDoc(Number(m[1]), true);
    db.grants = db.grants.filter((g) => !(g.doc_id === Number(m[1]) && g.member_id === Number(m[2]))); save(); return { ok: true };
  }

  // Naissance
  if (path === "/api/births" && method === "POST") {
    const g = (k) => (body instanceof FormData ? body.get(k) : body[k]);
    const first = (g("first_name") || "").trim(); if (!first) fail(400, "Le prénom du bébé est obligatoire.");
    const father_id = Number(g("father_id")) || null, mother_id = Number(g("mother_id")) || null;
    if (!father_id && !mother_id) fail(400, "Choisissez au moins un parent.");
    const id = nextId("members");
    const fa = tree.m.get(father_id), mo = tree.m.get(mother_id);
    db.members.push({ id, first_name: first, last_name: (g("last_name") || fa?.last_name || mo?.last_name || "").trim(), birth_name: "", sex: g("sex") || "", birth_date: g("birth_date") || "",
      birth_place: (g("birth_place") || "").trim(), death_date: "", deceased: false, notes: "", father_id, mother_id });
    if (fa && mo && !tree.spouses(father_id).has(mother_id)) db.unions.push({ id: nextId("unions"), a_id: father_id, b_id: mother_id });
    const names = [fa, mo].filter(Boolean).map((x) => x.first_name).join(" et ");
    const word = g("sex") === "F" ? "fille" : g("sex") === "M" ? "fils" : "enfant";
    const mid = nextId("messages");
    const photo = body instanceof FormData ? body.get("photo") : null;
    if (photo && photo.size) await putFile(`msg-${mid}`, await toJpeg(photo, 1600));
    const when = g("birth_date") ? ` le ${frShort(g("birth_date"))}` : "";
    db.messages.push({ id: mid, chat: "fam", from_member: user.member_id, kind: "birth", member_id: id, has_image: !!(photo && photo.size),
      text: (g("message") || "").trim() || `${first} est né${g("sex") === "F" ? "e" : ""}${when}${g("birth_place") ? " à " + g("birth_place").trim() : ""}.`, at: nowS() });
    for (const u of db.users) {
      if (u.member_id === user.member_id) continue;
      const isParent = u.member_id === father_id || u.member_id === mother_id;
      notify(u.member_id, "birth", isParent ? `${tree.m.get(user.member_id).first_name} a ajouté la naissance de ${first}. Vérifiez sa fiche.` : `Naissance : ${first}, ${word} de ${names}`, `#/personne/${id}`);
    }
    save(); return { id };
  }

  // Chat
  if (path === "/api/chats" && method === "GET") return chatList(user, tree);
  if (path === "/api/chats" && method === "POST") {
    const name = (body.name || "").trim(); if (!name) fail(400, "Donnez un nom au groupe.");
    const ids = [...new Set([user.member_id, ...(body.member_ids || []).map(Number)])].filter((i) => tree.m.has(i));
    if (ids.length < 2) fail(400, "Choisissez au moins une personne.");
    const id = nextId("chatgroups"); db.chatgroups.push({ id, name: name.slice(0, 60), member_ids: ids, created_by: user.member_id }); save();
    return { key: `grp:${id}` };
  }
  if (R(/^\/api\/chats\/([\w:-]+)\/image\/(\d+)$/)) {
    const c = chatInfo(m[1], user, tree); if (!c) fail(404, "Discussion introuvable");
    const msg = db.messages.find((x) => x.id === Number(m[2]) && x.chat === m[1]); if (!msg) fail(404, "Image introuvable");
    return (await getFile(`msg-${msg.id}`)) || fail(404, "Image introuvable");
  }
  if (R(/^\/api\/chats\/([\w:-]+)$/)) {
    const key = m[1]; const c = chatInfo(key, user, tree); if (!c) fail(404, "Discussion introuvable");
    if (method === "GET") {
      const msgs = db.messages.filter((x) => x.chat === key).sort((a, b) => a.id - b.id).slice(-200);
      const last = msgs.length ? msgs[msgs.length - 1].id : 0;
      const rd = db.reads.find((r) => r.member_id === user.member_id && r.chat === key);
      if (rd) rd.last = last; else db.reads.push({ member_id: user.member_id, chat: key, last });
      save();
      return { key, name: c.name, kind: c.kind, members: [...c.members], messages: msgs.map((x) => messagePublic(x, user, tree)) };
    }
    if (method === "POST") {
      const g = (k) => (body instanceof FormData ? body.get(k) : body[k]);
      const text = (g("text") || "").trim().slice(0, 4000);
      const docId = Number(g("doc_id")) || null;
      const img = body instanceof FormData ? body.get("image") : null;
      if (!text && !docId && !(img && img.size)) fail(400, "Message vide.");
      if (docId) { const d = db.docs.find((x) => x.id === docId); if (!d || !canView(user, d, tree)) fail(404, "Document introuvable"); }
      const id = nextId("messages");
      if (img && img.size) await putFile(`msg-${id}`, await toJpeg(img, 1600));
      db.messages.push({ id, chat: key, from_member: user.member_id, text, kind: "text", doc_id: docId, has_image: !!(img && img.size), at: nowS() });
      const rd = db.reads.find((r) => r.member_id === user.member_id && r.chat === key);
      if (rd) rd.last = id; else db.reads.push({ member_id: user.member_id, chat: key, last: id });
      save(); return { id };
    }
  }

  // Scanner et envoi
  if (path === "/api/scan/detect") { const bmp = await loadBitmap(body.get("image")); return { quad: detectQuad(bmp) }; }
  if (path === "/api/scan/process") {
    const qd = body.get("quad") ? JSON.parse(body.get("quad")) : null;
    return processImage(body.get("image"), qd, body.get("mode") || "color");
  }
  if (path === "/api/uploads") {
    const files = body.getAll("files");
    const uid = Math.random().toString(16).slice(2) + Date.now().toString(16);
    const first = files[0]?.name || "fichier";
    let pages = 0, size = 0, text = "", mime = "image/jpeg";
    if (files.length === 1 && (files[0].type === "application/pdf" || /\.pdf$/i.test(first))) {
      mime = "application/pdf"; pages = 1; size = files[0].size;
      await putFile(`up-${uid}-pdf`, files[0]);
    } else {
      for (const f of files.slice(0, 30)) {
        let j;
        try {
          j = await toJpeg(f);
          if (!/^scan-page-/.test(f.name || "")) {
            // Photo importée : on recadre la feuille si on la trouve.
            const q = detectQuad(await loadBitmap(j));
            if (q) j = await processImage(j, q, "color");
          }
        } catch { fail(400, `« ${f.name} » n'est ni une image ni un PDF lisible.`); }
        pages++; size += j.size; await putFile(`up-${uid}-${pages}`, j);
        if (pages <= 2) text += "\n" + (await ocr(j));
      }
    }
    const s = analyze(text, db.members, first);
    const f = db.folders.find((x) => x.slug === s.folder_slug) || db.folders.find((x) => x.slug === "divers");
    s.folder_id = f.id;
    if (!s.person_id) { s.person_id = user.member_id; s.person_confidence = 0.3; }
    s.visibility = defaultVis(user, f);
    db.uploads[uid] = { user_id: user.id, pages, size, mime, text }; save();
    return { upload_id: uid, pages, filename: first, text_found: !!text.trim(), suggestion: s };
  }
  if (R(/^\/api\/uploads\/(\w+)\/preview$/)) return (await getFile(`up-${m[1]}-1`)) || fail(404, "Aperçu indisponible pour un PDF dans la démo.");

  // Réglages
  if (path === "/api/settings/defaults" && method === "GET") {
    return db.folders.filter((f) => !f.parent_id).map((t) => ({ id: t.id, name: t.name, children: db.folders.filter((s) => s.parent_id === t.id).map((s) => { const dv = defaultVis(user, s); return { id: s.id, name: s.name, value: fmtVis(dv.visibility, dv.targets) }; }) }));
  }
  if (path === "/api/settings/defaults" && method === "PUT") {
    for (const [fid, v] of Object.entries(body.values)) {
      const [vis, t] = parseVis(String(v));
      db.user_defaults = db.user_defaults.filter((r) => !(r.user_id === user.id && r.folder_id === Number(fid)));
      db.user_defaults.push({ user_id: user.id, folder_id: Number(fid), visibility: fmtVis(vis, cleanTargets(t)) });
    }
    save(); return { ok: true };
  }
  if (path === "/api/groups" && method === "GET") {
    const rel = Object.entries(RELATION_GROUPS).map(([k, name]) => ({ key: k, name, member_ids: [...tree.group(k, user.member_id)].sort((a, b) => a - b) })).filter((g) => g.member_ids.length);
    return { relations: rel, custom: db.groups.filter((g) => g.owner_user_id === user.id) };
  }
  if (path === "/api/groups" && method === "POST") { const id = nextId("groups"); db.groups.push({ id, owner_user_id: user.id, name: body.name.slice(0, 60), member_ids: [...new Set(body.member_ids)] }); save(); return { id }; }
  if (R(/^\/api\/groups\/(\d+)$/) && method === "DELETE") { db.groups = db.groups.filter((g) => !(g.id === Number(m[1]) && g.owner_user_id === user.id)); save(); return { ok: true }; }

  fail(404, "Introuvable");
}
