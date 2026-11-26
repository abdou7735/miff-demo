// Version navigateur des règles de lecture automatique (copie de server/app/recognize.py).
const MONTHS = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 };

export const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const title = (s) => s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

export const TYPES = [
  ["bulletin", "Bulletin scolaire", null, ["bulletin", "trimestre", "semestre", "moyenne generale", "appreciation", "conseil de classe", "professeur principal", "moy. gen", "moyenne de la classe", "vie scolaire"]],
  ["acte_naissance", "Acte de naissance", "actes-naissance", ["acte de naissance", "extrait d'acte de naissance", "copie integrale", "ne le", "nee le", "est ne", "est nee"]],
  ["acte_mariage", "Acte de mariage", "actes-mariage", ["acte de mariage", "se sont maries", "mariage", "epoux", "epouse"]],
  ["acte_deces", "Acte de décès", "actes-deces", ["acte de deces", "est decede", "est decedee", "deces"]],
  ["livret_famille", "Livret de famille", "livret-famille", ["livret de famille"]],
  ["diplome", "Diplôme", "diplomes", ["diplome", "baccalaureat", "brevet des colleges", "diplome national du brevet", "licence", "master", "certificat d'aptitude", "releve de notes", "admis"]],
  ["cni", "Carte d'identité", "cni", ["carte nationale d'identite", "identity card", "carte d'identite"]],
  ["passeport", "Passeport", "passeports", ["passeport", "passport"]],
  ["titre_sejour", "Titre de séjour", "titres-sejour", ["titre de sejour", "residence permit"]],
  ["bail", "Bail", "baux", ["contrat de location", "bail", "bailleur", "locataire", "depot de garantie"]],
  ["quittance", "Quittance de loyer", "quittances", ["quittance", "quittance de loyer", "loyer"]],
  ["facture", "Facture", "factures", ["facture", "montant ttc", "total ttc", "echeance"]],
  ["vaccination", "Carnet de vaccination", "vaccination", ["vaccination", "vaccin", "rappel"]],
  ["ordonnance", "Ordonnance", "ordonnances", ["ordonnance", "posologie", "comprimes", "mg"]],
  ["certificat", "Certificat médical", "certificats", ["certificat medical", "certifie avoir examine"]],
  ["secu", "Sécurité sociale / mutuelle", "secu-mutuelle", ["carte vitale", "assurance maladie", "mutuelle", "attestation de droits", "cpam", "cssm"]],
  ["succession", "Succession", "succession", ["succession", "heritier", "acte de notoriete", "defunt"]],
  ["propriete", "Acte de propriété", "propriete", ["acte de vente", "titre de propriete", "acquereur", "vendeur", "cadastre"]],
  ["testament", "Testament", "testaments", ["testament", "legs", "legataire"]],
];
export const TYPE_LABELS = Object.fromEntries(TYPES.map((t) => [t[0], t[1]]));
const TYPE_FOLDERS = Object.fromEntries(TYPES.map((t) => [t[0], t[2]]));

const CLASSES = [
  [/\b(cp|cours preparatoire)\b/, "CP", "primaire"], [/\b(ce1|ce 1)\b/, "CE1", "primaire"], [/\b(ce2|ce 2)\b/, "CE2", "primaire"],
  [/\b(cm1|cm 1)\b/, "CM1", "primaire"], [/\b(cm2|cm 2)\b/, "CM2", "primaire"],
  [/\b(6\s?(e|eme)|sixieme)\b/, "6e", "college"], [/\b(5\s?(e|eme)|cinquieme)\b/, "5e", "college"],
  [/\b(4\s?(e|eme)|quatrieme)\b/, "4e", "college"], [/\b(3\s?(e|eme)|troisieme)\b(?!\s*trimestre)/, "3e", "college"],
  [/\b(seconde|2\s?(nde|de))\b/, "Seconde", "lycee"], [/\b(premiere|1\s?(ere|re))\b(?!\s*(trimestre|semestre|annee))/, "Première", "lycee"],
  [/\b(terminale|tle|term\.)/, "Terminale", "lycee"], [/\b(bts|but|dut|licence|l1|l2|l3|master|m1|m2|cpge|classe preparatoire)\b/, "Supérieur", "superieur"],
];

function count(t, w) { let n = 0, i = 0; while ((i = t.indexOf(w, i)) !== -1) { n++; i += w.length; } return n; }

function classify(text) {
  const t = norm(text);
  const scores = TYPES.map(([key, , , words]) => {
    let s = 0;
    for (const w of words) { const n = count(t, w); if (n) s += (w.length > 12 ? 3 : 1) * Math.min(n, 3); }
    if (["acte_naissance", "acte_mariage", "acte_deces", "livret_famille", "cni", "passeport", "bulletin"].includes(key) && t.includes(words[0])) s += 6;
    return [s, key];
  }).sort((a, b) => b[0] - a[0]);
  const [best, key] = scores[0];
  if (best < 2) return [null, 0];
  const second = scores[1][0];
  const conf = Math.min(1, 0.45 + 0.1 * best) * (second && second >= best * 0.8 ? 0.75 : 1);
  return [key, Math.round(conf * 100) / 100];
}

function schoolYear(t) {
  const m = t.match(/(20\d{2}|19\d{2})\s*[-/–]\s*(20\d{2}|19\d{2})/);
  return m && Number(m[2]) - Number(m[1]) === 1 ? `${m[1]}-${m[2]}` : "";
}
function trimester(t) {
  let n, kind;
  const m = t.match(/\b(1|2|3|premier|deuxieme|second|troisieme)\s*(er|e|eme|nd)?\s*(trimestre|semestre)/);
  if (m) { n = { premier: "1", deuxieme: "2", second: "2", troisieme: "3" }[m[1]] || m[1]; kind = m[3]; }
  else { const m2 = t.match(/(trimestre|semestre)\s*(n[°o]\s*)?(1|2|3)\b/); if (!m2) return ""; n = m2[3]; kind = m2[1]; }
  return `${n}${n === "1" ? "er" : "e"} ${kind}`;
}
function findClass(t) {
  const mz = t.match(/classe\s*:?\s*([^\n]{0,30})/);
  const zone = mz ? mz[1] : "";
  for (const scope of [zone, t]) {
    if (!scope) continue;
    for (const [re, label, folder] of CLASSES) {
      const mm = scope.match(re);
      if (mm) {
        let extra = "";
        if (scope === zone) {
          const e = scope.slice(mm.index + mm[0].length, mm.index + mm[0].length + 12).match(/^\s*([a-z0-9]{1,4})\b/);
          if (e && !["annee", "de", "du", "la", "le"].includes(e[1])) extra = " " + e[1].toUpperCase();
        }
        return [label + extra, folder];
      }
    }
  }
  return ["", null];
}
function school(text) {
  const m = text.match(/((?:lyc[ée]e|coll[èe]ge|[ée]cole|universit[ée]|institut)[^\n,]{2,60})/i);
  return m ? m[1].trim().replace(/^[ :-]+|[ :-]+$/g, "") : "";
}
function average(t) {
  const m = t.match(/moyenne\s+g[ea]n[ea]rale[^\d\n]{0,25}(\d{1,2}[.,]\d{1,2})/);
  return m ? m[1].replace(".", ",") : "";
}
function parseDate(s) {
  s = norm(s);
  let m = s.match(/\b(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})\b/);
  if (m) { const [d, mo, y] = [+m[1], +m[2], +m[3]]; if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }
  m = s.match(new RegExp(`\\b(\\d{1,2})\\s*(?:er)?\\s+(${Object.keys(MONTHS).join("|")})\\s+(\\d{4})\\b`));
  if (m) return `${m[3]}-${String(MONTHS[m[2]]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}
const fr = (iso) => { const m = (iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || ""; };

function birth(text) {
  const t = norm(text), out = {};
  const m = t.match(/\bnee?\s+le\s+(.{0,40}?\d{4})/);
  if (m) {
    out.date = parseDate(m[1]);
    const rest = t.slice(m.index + m[0].length, m.index + m[0].length + 80);
    const p = rest.match(/^\s*,?\s*(?:a|en)\s+([a-z' -]{2,40}?)(?=\s*[(,.\n]|\s+(?:fils|fille|de|du)\b|$)/);
    if (p) out.place = title(p[1].trim());
  }
  const pm = t.match(/\b(?:fils|fille|enfant)\s+de\s+([^\n]{2,80})/);
  if (pm) out.parents = pm[1].trim().replace(/^[ ,.]+|[ ,.]+$/g, "");
  return out;
}

function matchPerson(text, members) {
  const t = norm(text).replace(/\b(fils|fille|enfant)\s+de\s+[^\n]*/g, " ");
  let best = null, bs = 0, bp = 1e9;
  for (const mb of members) {
    const fn = norm(mb.first_name), ln = norm(mb.last_name || "");
    if (fn.length < 2) continue;
    let s = 0;
    if (new RegExp(`\\b${esc(fn)}\\b`).test(t)) s += 2;
    if (ln && new RegExp(`\\b${esc(ln)}\\b`).test(t)) s += 1;
    if (ln && new RegExp(`${esc(ln)}\\s+${esc(fn)}|${esc(fn)}\\s+${esc(ln)}`).test(t)) s += 3;
    const pos = s ? t.indexOf(fn) : 1e9;
    if (s > bs || (s === bs && s && pos < bp)) { best = mb; bs = s; bp = pos; }
  }
  return best && bs >= 2 ? [best.id, bs >= 5 ? 0.9 : 0.6] : [null, 0];
}

export function analyze(text, members, filename = "") {
  const t = norm(text);
  const fields = {};
  const put = (k, label, value, confidence) => { if (value) fields[k] = { label, value, confidence }; };
  let [docType, conf] = classify(text);
  if (!docType && filename) { [docType, conf] = classify(filename.replace(/[_-]/g, " ")); conf = Math.min(conf, 0.5); }
  let folder = docType ? TYPE_FOLDERS[docType] : null;
  const [personId, pconf] = matchPerson(text, members);
  let year = "", ttl = "";
  if (docType === "bulletin") {
    const sy = schoolYear(t), tri = trimester(t), [cls, cf] = findClass(t);
    folder = cf || "lycee";
    put("etablissement", "Établissement", school(text), 0.7);
    put("classe", "Classe", cls, 0.8);
    put("annee_scolaire", "Année scolaire", sy, 0.9);
    put("trimestre", "Trimestre", tri, 0.75);
    put("moyenne", "Moyenne générale", average(t), 0.6);
    year = sy.slice(0, 4);
    ttl = "Bulletin" + (cls ? ` ${cls}` : "") + (tri ? ` – ${tri}` : "") + (sy ? ` ${sy}` : "");
  } else if (docType === "diplome") {
    const m = text.match(/(baccalaur[ée]at[^\n]{0,50}|dipl[ôo]me national du brevet|brevet des coll[èe]ges|licence[^\n]{0,40}|master[^\n]{0,40}|bts[^\n]{0,40})/i);
    put("diplome", "Diplôme", m ? m[1].trim() : "", 0.7);
    const y = t.match(/session\s*(?:de\s*)?(\d{4})/) || t.match(/\b(19\d{2}|20\d{2})\b/);
    year = y ? y[1] : "";
    put("session", "Session", year, 0.7);
    const mm = t.match(/mention\s*:?\s*(tres bien|assez bien|bien|passable)/);
    put("mention", "Mention", mm ? mm[1][0].toUpperCase() + mm[1].slice(1) : "", 0.7);
    ttl = (fields.diplome?.value || "Diplôme") + (year ? ` ${year}` : "");
  } else if (docType === "acte_naissance") {
    const b = birth(text);
    put("date_naissance", "Date de naissance", fr(b.date || ""), 0.8);
    put("lieu_naissance", "Lieu de naissance", b.place || "", 0.6);
    if (b.parents) put("parents", "Parents", b.parents.split(/\s+et\s+(?:de\s+)?/).map((x) => title(x.trim())).filter(Boolean).join(" et "), 0.5);
    year = (b.date || "").slice(0, 4);
    ttl = "Acte de naissance";
  } else if (["cni", "passeport", "titre_sejour"].includes(docType)) {
    const m = t.match(/(?:expir\w*|valable jusqu'au|date d'expiration|date of expiry)[^\d]{0,20}(\d{1,2}[ ./-]\d{1,2}[ ./-]\d{4})/);
    put("expiration", "Date d'expiration", m ? fr(parseDate(m[1])) : "", 0.6);
    ttl = TYPE_LABELS[docType];
  } else {
    ttl = docType ? TYPE_LABELS[docType] : "";
    const m = t.match(/\b(19\d{2}|20\d{2})\b/);
    year = m ? m[1] : "";
  }
  if (personId && ttl && ["acte_naissance", "cni", "passeport", "titre_sejour", "diplome", "bulletin"].includes(docType)) {
    const mb = members.find((x) => x.id === personId);
    if (mb) ttl = `${ttl} – ${mb.first_name}`;
  }
  if (!ttl) ttl = filename ? filename.replace(/\.[^.]+$/, "").replace(/_/g, " ").slice(0, 60) : "Document";
  return {
    doc_type: docType || "", doc_type_label: docType ? TYPE_LABELS[docType] : "Document", type_confidence: conf,
    folder_slug: folder || "divers", person_id: personId, person_confidence: pconf, title: ttl.trim(), year, fields, recognized: !!docType,
  };
}
