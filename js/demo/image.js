// Version navigateur du scanner : détection de la feuille, redressement, amélioration.

export async function loadBitmap(blob) {
  return createImageBitmap(blob, { imageOrientation: "from-image" }).catch(() => createImageBitmap(blob));
}

function toCanvas(src, maxSide) {
  const k = Math.min(1, maxSide / Math.max(src.width, src.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return [c, ctx];
}

function otsu(gray) {
  const hist = new Array(256).fill(0);
  for (const v of gray) hist[v]++;
  const total = gray.length;
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, th = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; th = t; }
  }
  return th;
}

// Renvoie les 4 coins [[x,y]…] en fractions (haut-gauche, haut-droit, bas-droit, bas-gauche), ou null.
export function detectQuad(src) {
  const [c, ctx] = toCanvas(src, 220);
  const { width: w, height: h } = c;
  const d = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0;
  const th = otsu(gray);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = gray[i] > th ? 1 : 0;
  // Plus grande zone claire d'un seul tenant.
  const label = new Int32Array(w * h).fill(-1);
  let bestId = -1, bestSize = 0;
  const stack = new Int32Array(w * h);
  let id = 0;
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || label[i] !== -1) continue;
    let sp = 0, size = 0; stack[sp++] = i; label[i] = id;
    while (sp) {
      const p = stack[--sp]; size++;
      const x = p % w, y = (p / w) | 0;
      if (x > 0 && mask[p - 1] && label[p - 1] === -1) { label[p - 1] = id; stack[sp++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && label[p + 1] === -1) { label[p + 1] = id; stack[sp++] = p + 1; }
      if (y > 0 && mask[p - w] && label[p - w] === -1) { label[p - w] = id; stack[sp++] = p - w; }
      if (y < h - 1 && mask[p + w] && label[p + w] === -1) { label[p + w] = id; stack[sp++] = p + w; }
    }
    if (size > bestSize) { bestSize = size; bestId = id; }
    id++;
  }
  const frac = bestSize / (w * h);
  if (bestId < 0 || frac < 0.12 || frac > 0.97) return null;
  let tl = [0, 0, 1e9], tr = [0, 0, -1e9], br = [0, 0, -1e9], bl = [0, 0, 1e9];
  for (let p = 0; p < w * h; p++) {
    if (label[p] !== bestId) continue;
    const x = p % w, y = (p / w) | 0;
    if (x + y < tl[2]) tl = [x, y, x + y];
    if (x + y > br[2]) br = [x, y, x + y];
    if (x - y > tr[2]) tr = [x, y, x - y];
    if (x - y < bl[2]) bl = [x, y, x - y];
  }
  const q = [tl, tr, br, bl].map(([x, y]) => [x / (w - 1), y / (h - 1)]);
  // Le quadrilatère doit couvrir une bonne partie de la zone (sinon ce n'est pas une feuille).
  const area = Math.abs(q.reduce((a, p, i) => { const n = q[(i + 1) % 4]; return a + p[0] * n[1] - n[0] * p[1]; }, 0)) / 2;
  if (area < 0.1 || bestSize / (area * w * h) < 0.8) return null;
  return q;
}

function solve(A, b) {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let m = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
    [A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]];
    for (let r = i + 1; r < n; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
  }
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; }
  return x;
}

// Homographie qui envoie dst -> src.
function homography(dst, src) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = dst[i], [u, v] = src[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  return [...solve(A, b), 1];
}

export async function processImage(blob, quad, mode = "color") {
  const bmp = await loadBitmap(blob);
  const [sc, sctx] = toCanvas(bmp, 2600);
  const W = sc.width, H = sc.height;
  const q = quad || detectQuad(sc) || [[0, 0], [1, 0], [1, 1], [0, 1]];
  const pts = q.map(([x, y]) => [x * (W - 1), y * (H - 1)]);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  let ow = Math.max(dist(pts[0], pts[1]), dist(pts[3], pts[2])), oh = Math.max(dist(pts[0], pts[3]), dist(pts[1], pts[2]));
  const k = Math.min(1, 2000 / Math.max(ow, oh));
  ow = Math.max(50, Math.round(ow * k)); oh = Math.max(50, Math.round(oh * k));
  const Hm = homography([[0, 0], [ow - 1, 0], [ow - 1, oh - 1], [0, oh - 1]], pts);
  const s = sctx.getImageData(0, 0, W, H).data;
  const out = new ImageData(ow, oh);
  const o = out.data;
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const z = Hm[6] * x + Hm[7] * y + 1;
      const u = (Hm[0] * x + Hm[1] * y + Hm[2]) / z, v = (Hm[3] * x + Hm[4] * y + Hm[5]) / z;
      const x0 = Math.min(W - 2, Math.max(0, u | 0)), y0 = Math.min(H - 2, Math.max(0, v | 0));
      const fx = Math.min(1, Math.max(0, u - x0)), fy = Math.min(1, Math.max(0, v - y0));
      const i00 = (y0 * W + x0) * 4, i10 = i00 + 4, i01 = i00 + W * 4, i11 = i01 + 4;
      const di = (y * ow + x) * 4;
      for (let c = 0; c < 3; c++) {
        o[di + c] = (s[i00 + c] * (1 - fx) + s[i10 + c] * fx) * (1 - fy) + (s[i01 + c] * (1 - fx) + s[i11 + c] * fx) * fy;
      }
      o[di + 3] = 255;
    }
  }
  enhance(out, mode);
  const c = document.createElement("canvas"); c.width = ow; c.height = oh;
  c.getContext("2d").putImageData(out, 0, 0);
  return new Promise((r) => c.toBlob(r, "image/jpeg", 0.86));
}

function enhance(img, mode) {
  const d = img.data, n = img.width * img.height;
  const lum = new Uint8Array(n);
  for (let i = 0; i < n; i++) lum[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0;
  // Étirement du contraste (2 % - 98 %).
  const hist = new Array(256).fill(0); for (const v of lum) hist[v]++;
  let lo = 0, hi = 255, acc = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > n * 0.02) { lo = i; break; } }
  acc = 0; for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > n * 0.02) { hi = i; break; } }
  const sc = 255 / Math.max(1, hi - lo);
  const st = (v) => Math.max(0, Math.min(255, (v - lo) * sc));
  if (mode === "color") { for (let i = 0; i < n * 4; i += 4) { d[i] = st(d[i]); d[i + 1] = st(d[i + 1]); d[i + 2] = st(d[i + 2]); } return; }
  if (mode === "gray") { for (let i = 0; i < n; i++) { const v = st(lum[i]); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; } return; }
  // Noir et blanc : seuil local (moyenne sur un voisinage) via une image intégrale.
  const w = img.width, h = img.height, r = Math.max(8, Math.round(Math.min(w, h) / 40));
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += lum[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; } }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x1 = Math.max(0, x - r), y1 = Math.max(0, y - r), x2 = Math.min(w, x + r + 1), y2 = Math.min(h, y + r + 1);
    const sum = I[y2 * (w + 1) + x2] - I[y1 * (w + 1) + x2] - I[y2 * (w + 1) + x1] + I[y1 * (w + 1) + x1];
    const mean = sum / ((x2 - x1) * (y2 - y1));
    const v = lum[y * w + x] < mean - 12 ? 0 : 255;
    const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = v;
  }
}
