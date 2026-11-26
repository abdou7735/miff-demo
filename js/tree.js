// Dessin de l'arbre familial en SVG.
// Deux vues : « toute la famille » (centrée sur moi, les foyers de ma génération repliés)
// et « le foyer d'une personne » (elle, son conjoint et leurs descendants).
import { s, initials, years } from "./ui.js?v=1795724117";

const NODE_W = 104, ROW_H = 140, R = 30, TOP = 64, GAP = 24, GRID_ROW = 132, PAD = 10;

// Qui montrer selon le niveau : 1 = proche, 2 = famille, 3 = tout.
export function circle(members, centerId, level) {
  const by = new Map(members.map((m) => [m.id, m]));
  if (level >= 3 || !by.has(centerId)) return new Set(by.keys());
  const T = relations(members);
  const out = new Set([centerId]);
  const add = (ids) => ids.forEach((i) => by.has(i) && out.add(i));
  const parents = T.parents(centerId), sibs = T.siblings(centerId), kids = T.children(centerId);
  add(parents); add(sibs); add(T.spouses(centerId)); add(kids);
  if (level >= 2) {
    for (const p of parents) {
      add(T.parents(p));
      for (const u of T.siblings(p)) { out.add(u); add(T.spouses(u)); add(T.children(u)); }
    }
    for (const x of sibs) { add(T.spouses(x)); add(T.children(x)); }
    for (const k of kids) { add(T.spouses(k)); add(T.children(k)); }
  }
  return out;
}

export function relations(members) {
  const by = new Map(members.map((m) => [m.id, m]));
  const kids = new Map();
  for (const m of members) for (const p of [m.father_id, m.mother_id]) if (p && by.has(p)) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(m.id); }
  const T = {
    by,
    parents: (i) => { const m = by.get(i); return m ? [m.father_id, m.mother_id].filter((p) => p && by.has(p)) : []; },
    children: (i) => kids.get(i) || [],
    spouses: (i) => (by.get(i)?.spouses || []).filter((x) => by.has(x)),
    siblings: (i) => { const s = new Set(); for (const p of T.parents(i)) for (const k of T.children(p)) s.add(k); s.delete(i); return [...s]; },
  };
  return T;
}

// Nombre de proches cachés autour de chaque personne affichée.
export function hiddenCounts(members, shown) {
  const T = relations(members);
  const out = new Map();
  for (const id of shown) {
    const around = new Set([...T.parents(id), ...T.children(id), ...T.spouses(id)]);
    let n = 0; for (const x of around) if (!shown.has(x)) n++;
    if (n) out.set(id, n);
  }
  return out;
}

// Une couleur claire par famille (un couple et ses enfants).
const PALETTE = [
  ["#d6f0e0", "#1f6a4b"], // vert
  ["#d6e7fa", "#1f4f86"], // bleu
  ["#fadbe5", "#8a2c4b"], // rose
  ["#fbefc6", "#7a5a0c"], // jaune
  ["#e5dcfa", "#4e3a8a"], // violet
  ["#fde1c9", "#8a4614"], // orange
  ["#d2f0ee", "#16645e"], // turquoise
  ["#e5f2cc", "#4b6418"], // vert pomme
];

export function familyColors(members, meId) {
  const by = new Map(members.map((m) => [m.id, m]));
  const pkey = (m) => (m && (by.has(m.father_id) || by.has(m.mother_id)) ? `${m.father_id || 0}-${m.mother_id || 0}` : null);
  const kidsOf = new Map();
  for (const m of members) for (const p of [m.father_id, m.mother_id]) if (by.has(p)) { if (!kidsOf.has(p)) kidsOf.set(p, []); kidsOf.get(p).push(m); }
  const keyOf = new Map();
  for (const m of members) {
    // Sa famille de naissance ; sinon la famille qu'il ou elle a fondée.
    let k = pkey(m);
    if (!k && kidsOf.has(m.id)) k = pkey(kidsOf.get(m.id)[0]);
    if (!k) for (const sp of m.spouses || []) { const o = by.get(sp); if (o && kidsOf.has(o.id)) { k = pkey(kidsOf.get(o.id)[0]); break; } }
    if (!k) for (const sp of m.spouses || []) { k = pkey(by.get(sp)); if (k) break; }
    keyOf.set(m.id, k || `solo-${m.id}`);
  }
  // Ma famille en vert, les autres dans l'ordre d'arrivée dans l'arbre.
  const order = [], seen = new Set();
  const push = (k) => { if (!seen.has(k)) { seen.add(k); order.push(k); } };
  if (keyOf.has(meId)) push(keyOf.get(meId));
  for (const m of [...members].sort((a, b) => a.id - b.id)) push(keyOf.get(m.id));
  const col = new Map(order.map((k, i) => [k, PALETTE[i % PALETTE.length]]));
  return (id) => col.get(keyOf.get(id)) || PALETTE[0];
}

// Qui afficher, et quels foyers replier (conjoint en petit à côté, enfants cachés).
export function familyView(allMembers, meId, focus) {
  const A = relations(allMembers);
  const gen = (id) => A.by.get(id)?.generation || 0;
  const inLaw = (id) => !A.parents(id).length && A.spouses(id).some((sp) => A.parents(sp).length);
  let shown, cut;
  if (focus && A.by.has(focus)) {
    shown = new Set([focus, ...A.spouses(focus)]);
    const todo = [...shown];
    while (todo.length) { const x = todo.pop(); for (const k of A.children(x)) if (!shown.has(k)) { shown.add(k); todo.push(k); } }
    cut = gen(focus) + 1;
  } else { shown = new Set(A.by.keys()); cut = gen(meId); }
  const removed = new Set(), folds = new Map();
  for (const id of [...shown].sort((a, b) => gen(a) - gen(b) || a - b)) {
    if (removed.has(id) || gen(id) < cut || inLaw(id)) continue;
    const sps = A.spouses(id).filter((sp) => shown.has(sp) && !A.parents(sp).length);
    const kids = A.children(id).filter((k) => shown.has(k));
    if (!sps.length && !kids.length) continue;
    sps.forEach((sp) => removed.add(sp));
    const todo = [...kids];
    while (todo.length) {
      const x = todo.pop(); if (removed.has(x)) continue; removed.add(x);
      todo.push(...A.children(x)); A.spouses(x).forEach((sp) => { if (!A.parents(sp).length) removed.add(sp); });
    }
    folds.set(id, { spouse: sps[0] ?? A.spouses(id)[0] ?? null, kids: A.children(id).length });
  }
  for (const r of removed) shown.delete(r);
  return { shown, folds };
}

export function drawTree(allMembers, meId, onPick, opts = {}) {
  const { scale = 1, focus = null, onFamily = null } = opts;
  const centerId = meId, level = focus ? 3 : 1;
  const { shown, folds } = familyView(allMembers, meId, focus);
  const allBy = new Map(allMembers.map((m) => [m.id, m]));
  const members = allMembers.filter((m) => shown.has(m.id));
  const T = relations(members);
  const by = T.by;
  const sortKids = (ids) => ids.slice().sort((a, b) => (by.get(a).birth_date || "9999").localeCompare(by.get(b).birth_date || "9999") || a - b);
  const placed = new Set();

  // Un bloc = un couple et, en dessous, les blocs de leurs enfants.
  function build(id, depth, spouseOk = () => true) {
    placed.add(id);
    const unit = [id];
    for (const sp of T.spouses(id)) if (!placed.has(sp) && spouseOk(sp)) { placed.add(sp); unit.push(sp); }
    const kidSet = new Set();
    for (const u of unit) for (const k of T.children(u)) if (!placed.has(k)) kidSet.add(k);
    const order = sortKids([...kidSet]);
    // Une grande fratrie sans enfants ni conjoints affichés : rangée en grille, dans un cadre.
    const isLeaf = (k) => !T.children(k).length && !T.spouses(k).some((s) => !placed.has(s));
    const leaves = order.filter(isLeaf);
    const kids = [];
    if (leaves.length > 4) {
      leaves.forEach((k) => placed.add(k));
      const cols = 4; // nombre pair : le trait central passe entre deux personnes
      const grid = { grid: leaves, cols, rows: Math.ceil(leaves.length / cols), w: cols * NODE_W + 2 * PAD + GAP };
      for (const k of order) if (!placed.has(k)) kids.push(build(k, depth + 1, spouseOk));
      kids.splice(Math.floor(kids.length / 2), 0, grid);
    } else {
      for (const k of order) if (!placed.has(k)) kids.push(build(k, depth + 1, spouseOk));
    }
    const kidsW = kids.reduce((a, k) => a + k.w, 0);
    return { unit, kids, depth, w: Math.max(unit.length * NODE_W, kidsW) };
  }

  const roots = [];
  let extra = []; // grands-parents placés après coup, au-dessus de leurs enfants
  if (level < 3 && by.has(centerId)) {
    // Vue centrée : côté du père à gauche, côté de la mère à droite.
    const c = by.get(centerId);
    const father = c.father_id && by.has(c.father_id) ? c.father_id : null;
    const mother = c.mother_id && by.has(c.mother_id) ? c.mother_id : null;
    const left = [], right = [];
    if (father || mother) {
      const first = father || mother;
      for (const side of [[father, left], [mother, right]]) {
        const [p, list] = side; if (!p) continue;
        for (const u of sortKids(T.siblings(p))) if (!placed.has(u) && u !== father && u !== mother) { placed.add(u); list.push(u); }
      }
      left.forEach((u) => placed.delete(u)); right.forEach((u) => placed.delete(u));
      // Les grands-parents ne sont pas dans les blocs : on les réserve.
      for (const p of [father, mother]) if (p) T.parents(p).forEach((g) => placed.add(g));
      const lb = left.map((u) => build(u, 1));
      const center = build(first, 1);
      const rb = right.map((u) => build(u, 1));
      roots.push(...lb, center, ...rb);
      for (const p of [father, mother]) if (p) { const gp = T.parents(p); if (gp.length) extra.push({ unit: orderCouple(gp, by), kidsOf: p }); }
    } else {
      roots.push(build(centerId, 1));
    }
    for (const m of members) if (!placed.has(m.id)) roots.push(build(m.id, 1));
  } else {
    // Tout l'arbre : on part des ancêtres qui ont le plus de descendants.
    const hasParents = (id) => T.parents(id).length > 0;
    const desc = (id, seen = new Set()) => { if (seen.has(id)) return 0; seen.add(id); return 1 + T.children(id).reduce((a, k) => a + desc(k, seen), 0); };
    const spouseOk = (sp) => !hasParents(sp);
    const starts = members.filter((m) => !hasParents(m.id) && !T.spouses(m.id).some(hasParents)).sort((a, b) => desc(b.id) - desc(a.id) || a.id - b.id);
    for (const m of starts) if (!placed.has(m.id)) roots.push(build(m.id, 0, spouseOk));
    for (const m of members) if (!placed.has(m.id)) roots.push(build(m.id, 0, spouseOk));
  }

  // Placement horizontal.
  const pos = new Map();
  const units = [];
  const grids = [];
  const gridOf = new Map();
  const genOf = (id) => by.get(id).generation || 0;
  function place(node, x0) {
    if (node.grid) {
      const g = genOf(node.grid[0]);
      const gx = x0 + GAP / 2 + PAD;
      node.grid.forEach((id, i) => { pos.set(id, { x: gx + NODE_W / 2 + (i % node.cols) * NODE_W, g, off: Math.floor(i / node.cols) }); gridOf.set(id, node); });
      // Dernière ligne incomplète : centrée.
      const lastN = node.grid.length % node.cols;
      if (lastN) node.grid.slice(-lastN).forEach((id) => { pos.get(id).x += (node.cols - lastN) * NODE_W / 2; });
      node.cx = gx + node.cols * NODE_W / 2; node.x0 = gx - PAD; node.g = g;
      grids.push(node);
      return;
    }
    const y = genOf(node.unit[0]);
    let kx = x0 + (node.w - node.kids.reduce((a, k) => a + k.w, 0)) / 2;
    for (const k of node.kids) { place(k, kx); kx += k.w; }
    let cx;
    if (node.kids.length) cx = (node.kids[0].cx + node.kids[node.kids.length - 1].cx) / 2;
    else cx = x0 + node.w / 2;
    const uw = node.unit.length * NODE_W;
    node.unit.forEach((id, i) => pos.set(id, { x: cx - uw / 2 + NODE_W / 2 + i * NODE_W, g: y, off: 0 }));
    node.cx = cx;
    units.push(node.unit);
  }
  let x = 0;
  for (const r of roots) { place(r, x); x += r.w + GAP; }

  // Grands-parents : au-dessus de leurs enfants, sans se chevaucher.
  const gpUnits = [];
  for (const e of extra) {
    const kidsX = T.children(e.unit[0]).concat(T.children(e.unit[1] || e.unit[0])).filter((k) => pos.has(k)).map((k) => pos.get(k).x);
    const mid = kidsX.length ? (Math.min(...kidsX) + Math.max(...kidsX)) / 2 : pos.get(e.kidsOf).x;
    gpUnits.push({ unit: e.unit, cx: mid });
  }
  gpUnits.sort((a, b) => a.cx - b.cx);
  for (let i = 1; i < gpUnits.length; i++) {
    const a = gpUnits[i - 1], b = gpUnits[i];
    const need = (a.unit.length + b.unit.length) * NODE_W / 2 + GAP - (b.cx - a.cx);
    if (need > 0) { a.cx -= need / 2; b.cx += need / 2; }
  }
  for (const g of gpUnits) {
    const uw = g.unit.length * NODE_W;
    g.unit.forEach((id, i) => pos.set(id, { x: g.cx - uw / 2 + NODE_W / 2 + i * NODE_W, g: genOf(id), off: 0 }));
    units.push(g.unit);
  }

  // Cadrage.
  const xs = [...pos.values()].map((p) => p.x), gs = [...pos.values()].map((p) => p.g);
  const minX = Math.min(...xs) - NODE_W / 2 - 10, maxX = Math.max(...xs) + NODE_W / 2 + 10;
  const minG = Math.min(...gs), maxG = Math.max(...gs);
  // Hauteur de chaque génération : plus grande quand une grille y prend plusieurs lignes.
  const gridExtra = new Map();
  for (const gr of grids) gridExtra.set(gr.g, Math.max(gridExtra.get(gr.g) || 0, gr.rows - 1));
  const rowY = new Map(); let yAcc = TOP;
  for (let g = minG; g <= maxG; g++) { rowY.set(g, yAcc); yAcc += ROW_H + (gridExtra.get(g) || 0) * GRID_ROW; }
  for (const p of pos.values()) { p.x -= minX; p.y = rowY.get(p.g) + p.off * GRID_ROW; }
  for (const gr of grids) { gr.x0 -= minX; gr.cx -= minX; gr.top = rowY.get(gr.g) - R - PAD; }
  const W = Math.max(maxX - minX, 320), H = yAcc - ROW_H + 80;

  const colorOf = familyColors(allMembers, meId);

  // Traits : couple (horizontal) et lien parents → enfants.
  const lines = s("g", { stroke: "#cfd9d3", "stroke-width": "2", fill: "none" });
  const linked = new Set();
  for (const u of units) {
    const ps = u.map((id) => pos.get(id));
    for (let i = 1; i < ps.length; i++) lines.append(s("path", { d: `M${ps[i - 1].x + R} ${ps[i - 1].y}H${ps[i].x - R}` }));
    const kids = [...new Set(u.flatMap((id) => T.children(id)))].filter((k) => pos.has(k) && !linked.has(k) && pos.get(k).g > ps[0].g);
    if (!kids.length) continue;
    kids.forEach((k) => linked.add(k));
    // Enfants d'un couple : départ entre les deux ; sinon sous le parent.
    const parentsOf = (k) => T.parents(k).filter((p) => u.includes(p)).map((p) => pos.get(p).x);
    const px0 = parentsOf(kids[0]);
    const px = px0.length > 1 ? (px0[0] + px0[1]) / 2 : px0[0];
    const pair = px0.length > 1;
    const busY = ps[0].y + ROW_H - R - 24;
    const seenGrid = new Set();
    const kx = [];
    for (const k of kids) {
      const gr = gridOf.get(k);
      const q = pos.get(k);
      if (!gr || q.off === 0) kx.push({ x: q.x, top: q.y - R });
      if (gr && !seenGrid.has(gr)) {
        seenGrid.add(gr);
        // Grande fratrie sur plusieurs lignes : un trait central descend, puis chaque ligne a son propre trait.
        let lastBus = busY;
        for (let r = 1; r < gr.rows; r++) {
          const row = gr.grid.map((id) => pos.get(id)).filter((p) => p.off === r);
          const rb = row[0].y - R - 18;
          lastBus = rb;
          const ra = Math.min(gr.cx, ...row.map((p) => p.x)), rbx = Math.max(gr.cx, ...row.map((p) => p.x));
          lines.append(s("path", { d: `M${ra} ${rb}H${rbx}` }));
          for (const p of row) lines.append(s("path", { d: `M${p.x} ${rb}V${p.y - R}` }));
        }
        if (gr.rows > 1) { kx.push({ x: gr.cx, top: busY }); lines.append(s("path", { d: `M${gr.cx} ${busY}V${lastBus}` })); }
      }
    }
    lines.append(s("path", { d: `M${px} ${ps[0].y + (pair ? 0 : R)}V${busY}` }));
    const a = Math.min(px, ...kx.map((k) => k.x)), b = Math.max(px, ...kx.map((k) => k.x));
    if (b > a) lines.append(s("path", { d: `M${a} ${busY}H${b}` }));
    for (const k of kx) if (k.top > busY) lines.append(s("path", { d: `M${k.x} ${busY}V${k.top}` }));
  }

  // Conjoints placés loin l'un de l'autre (familles différentes) : trait pointillé.
  const unitOf = new Map(); units.forEach((u, i) => u.forEach((id) => unitOf.set(id, i)));
  for (const m of members) for (const sp of T.spouses(m.id)) {
    if (m.id > sp || !pos.has(sp) || unitOf.get(m.id) === unitOf.get(sp)) continue;
    const a = pos.get(m.id), b = pos.get(sp), lift = 46;
    lines.append(s("path", { d: `M${a.x} ${a.y - R}C${a.x} ${a.y - R - lift},${b.x} ${b.y - R - lift},${b.x} ${b.y - R}`, "stroke-dasharray": "6 5" }));
  }

  const nodes = s("g", {});
  for (const m of members) {
    const p = pos.get(m.id); if (!p) continue;
    const isMe = m.id === meId, dead = m.deceased || m.death_date;
    const [fill, ink] = colorOf(m.id);
    const sub = m.relation && m.relation !== "Moi" ? m.relation : years(m);
    const g = s("g", { class: "node", "data-id": m.id, tabindex: "0", role: "button", "aria-label": `${m.first_name}${m.relation ? ", " + m.relation : ""}, ouvrir la fiche`,
      onclick: () => onPick(m.id), onkeydown: (e) => { if (e.key === "Enter") onPick(m.id); } },
      s("circle", { cx: p.x, cy: p.y, r: R, fill, stroke: isMe ? ink : dead ? "#9aa5ae" : "#fff", "stroke-width": isMe ? "4" : "2", "stroke-dasharray": dead && !isMe ? "3 3" : null }),
      s("text", { x: p.x, y: p.y + 5, "text-anchor": "middle", "font-size": "15", "font-weight": "700", fill: ink }, initials(m)),
      s("text", { x: p.x, y: p.y + R + 20, "text-anchor": "middle", "font-size": m.first_name.length > 10 ? "13" : "15", "font-weight": "600", fill: "#14201a" }, trunc(m.first_name, 14)),
      sub ? s("text", { x: p.x, y: p.y + R + 37, "text-anchor": "middle", "font-size": "12.5", fill: m.relation && m.relation !== "Moi" ? "#1f6a4b" : "#5b6b63" }, trunc(sub, 14)) : null);
    nodes.append(g);
    // Foyer replié : le conjoint en petit à côté, et le nombre d'enfants. Un toucher ouvre son arbre.
    const f = folds.get(m.id);
    if (f && onFamily) {
      const sp = f.spouse && allBy.get(f.spouse);
      const [sf, si] = sp ? colorOf(sp.id) : [fill, ink];
      const bx = p.x + R + 2, by2 = p.y - R + 8, br = 15;
      const who = (sp ? `${m.first_name} et ${sp.first_name}` : m.first_name) + (f.kids ? `, ${f.kids} enfant${f.kids > 1 ? "s" : ""}` : "");
      nodes.append(s("g", { class: "fold", tabindex: "0", role: "button", "aria-label": `Voir la famille de ${who}`,
        onclick: (e) => { e.stopPropagation(); onFamily(m.id); }, onkeydown: (e) => { if (e.key === "Enter") onFamily(m.id); } },
        s("circle", { cx: bx, cy: by2, r: br + 3, fill: "#fff" }),
        s("circle", { cx: bx, cy: by2, r: br, fill: sf, stroke: si, "stroke-width": "1.5" }),
        s("text", { x: bx, y: by2 + 4, "text-anchor": "middle", "font-size": "10.5", "font-weight": "700", fill: si }, sp ? initials(sp) : "♥"),
        f.kids ? s("g", {},
          s("circle", { cx: bx + 13, cy: by2 + 12, r: 9, fill: si, stroke: "#fff", "stroke-width": "1.5" }),
          s("text", { x: bx + 13, y: by2 + 15.5, "text-anchor": "middle", "font-size": "10", "font-weight": "700", fill: "#fff" }, String(f.kids))) : null));
    }
  }
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W * scale, height: H * scale, role: "img", "aria-label": "Arbre familial" }, lines, nodes);
  svg._pos = (id) => { const p = pos.get(id); return p ? { x: p.x * scale, y: p.y * scale } : null; };
  return svg;
}

function orderCouple(ids, by) {
  return ids.slice().sort((a, b) => (by.get(a).sex === "F") - (by.get(b).sex === "F"));
}

function trunc(t, n) { return t.length > n ? t.slice(0, n - 1) + "…" : t; }
