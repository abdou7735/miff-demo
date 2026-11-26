// Dessin de l'arbre familial en SVG (génération par génération).
import { s, initials, years } from "./ui.js";

const NODE_W = 96, ROW_H = 132, R = 30, TOP = 46;

export function drawTree(members, meId, onPick, scale = 1) {
  const by = new Map(members.map((m) => [m.id, m]));
  const kidsOf = new Map();
  for (const m of members) for (const p of [m.father_id, m.mother_id]) if (p && by.has(p)) {
    if (!kidsOf.has(p)) kidsOf.set(p, []);
    kidsOf.get(p).push(m.id);
  }
  const hasParents = (id) => { const m = by.get(id); return !!(m && ((m.father_id && by.has(m.father_id)) || (m.mother_id && by.has(m.mother_id)))); };
  const placed = new Set();
  const sortKids = (ids) => ids.sort((a, b) => (by.get(a).birth_date || "9999").localeCompare(by.get(b).birth_date || "9999") || a - b);

  function build(id) {
    placed.add(id);
    const unit = [id];
    for (const sp of by.get(id).spouses || []) {
      if (!placed.has(sp) && by.has(sp) && !hasParents(sp)) { placed.add(sp); unit.push(sp); }
    }
    const kidSet = new Set();
    for (const u of unit) for (const k of kidsOf.get(u) || []) if (!placed.has(k)) kidSet.add(k);
    const kids = [];
    for (const k of sortKids([...kidSet])) if (!placed.has(k)) kids.push(build(k));
    const unitW = unit.length * NODE_W;
    const kidsW = kids.reduce((a, k) => a + k.w, 0);
    return { unit, kids, w: Math.max(unitW, kidsW) };
  }

  const roots = [];
  const parentless = members.filter((m) => !hasParents(m.id));
  const goodRoot = (m) => !(m.spouses || []).some((sp) => hasParents(sp));
  const desc = (id, seen = new Set()) => { if (seen.has(id)) return 0; seen.add(id); return 1 + (kidsOf.get(id) || []).reduce((a, k) => a + desc(k, seen), 0); };
  for (const m of parentless.filter(goodRoot).sort((a, b) => desc(b.id) - desc(a.id) || a.id - b.id)) {
    if (!placed.has(m.id)) roots.push(build(m.id));
  }
  for (const m of members) if (!placed.has(m.id)) roots.push(build(m.id));

  const pos = new Map();
  const units = [];
  let maxGen = 0;
  function place(node, x0) {
    const gen = by.get(node.unit[0]).generation || 0;
    maxGen = Math.max(maxGen, gen);
    const y = TOP + gen * ROW_H;
    let kx = x0 + (node.w - node.kids.reduce((a, k) => a + k.w, 0)) / 2;
    for (const k of node.kids) { place(k, kx); kx += k.w; }
    let cx;
    if (node.kids.length) {
      const first = pos.get(node.kids[0].unit[0]).x, last = pos.get(node.kids[node.kids.length - 1].unit[0]).x;
      cx = (first + last) / 2;
    } else cx = x0 + node.w / 2;
    const uw = node.unit.length * NODE_W;
    node.unit.forEach((id, i) => pos.set(id, { x: cx - uw / 2 + NODE_W / 2 + i * NODE_W, y }));
    units.push(node);
  }
  let x = 10;
  for (const r of roots) { place(r, x); x += r.w + 20; }
  const W = Math.max(x, 320), H = TOP + maxGen * ROW_H + 80;

  const me = by.get(meId);
  const sib = new Set();
  if (me) for (const m of members) if (m.id !== meId && ((me.father_id && m.father_id === me.father_id) || (me.mother_id && m.mother_id === me.mother_id))) sib.add(m.id);

  const lines = s("g", { stroke: "#cfd9d3", "stroke-width": "2", fill: "none" });
  for (const u of units) {
    const ps = u.unit.map((id) => pos.get(id));
    if (ps.length > 1) lines.append(s("path", { d: `M${ps[0].x + R} ${ps[0].y}H${ps[ps.length - 1].x - R}` }));
    if (!u.kids.length) continue;
    const px = ps.length > 1 ? (ps[0].x + ps[1].x) / 2 : ps[0].x;
    const busY = ps[0].y + ROW_H / 2 + 6;
    const kx = u.kids.map((k) => pos.get(k.unit[0]));
    lines.append(s("path", { d: `M${px} ${ps[0].y + (ps.length > 1 ? 0 : R)}V${busY}` }));
    const minX = Math.min(px, ...kx.map((k) => k.x)), maxX = Math.max(px, ...kx.map((k) => k.x));
    lines.append(s("path", { d: `M${minX} ${busY}H${maxX}` }));
    for (const k of kx) lines.append(s("path", { d: `M${k.x} ${busY}V${k.y - R}` }));
  }

  const nodes = s("g", {});
  for (const m of members) {
    const p = pos.get(m.id); if (!p) continue;
    const isMe = m.id === meId, dead = m.deceased || m.death_date;
    const fill = isMe ? "#1f6a4b" : dead ? "#eceff2" : sib.has(m.id) ? "#c4e5d3" : "#e3f2ea";
    const ink = isMe ? "#fff" : dead ? "#55606a" : "#1f6a4b";
    const g = s("g", { class: "node", tabindex: "0", role: "button", "aria-label": `${m.first_name}, ouvrir la fiche`,
      onclick: () => onPick(m.id), onkeydown: (e) => { if (e.key === "Enter") onPick(m.id); } },
      s("circle", { cx: p.x, cy: p.y, r: R, fill, stroke: isMe ? "#18402f" : "#fff", "stroke-width": "2" }),
      s("text", { x: p.x, y: p.y + 5, "text-anchor": "middle", "font-size": "15", "font-weight": "700", fill: ink }, initials(m)),
      s("text", { x: p.x, y: p.y + R + 20, "text-anchor": "middle", "font-size": "15", "font-weight": "600", fill: "#14201a" }, trunc(m.first_name, 11)),
      s("text", { x: p.x, y: p.y + R + 38, "text-anchor": "middle", "font-size": "12.5", fill: "#5b6b63" }, years(m)));
    nodes.append(g);
  }
  return s("svg", { viewBox: `0 0 ${W} ${H}`, width: W * scale, height: H * scale, role: "img", "aria-label": "Arbre familial" }, lines, nodes);
}

function trunc(t, n) { return t.length > n ? t.slice(0, n - 1) + "…" : t; }
