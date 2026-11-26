// Petit client pour parler au serveur Miff (sur le NAS).
export class ApiError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

export const DEMO = !!window.MIFF_DEMO;
let demoBackend = null;

async function callDemo(method, url, body) {
  if (!demoBackend) demoBackend = await import("./demo/backend.js?v=1795728291");
  try { return await demoBackend.handle(method, url, body); }
  catch (e) {
    if (e.status === 401 && !url.startsWith("/api/login") && !url.startsWith("/api/me")) location.hash = "#/connexion";
    throw new ApiError(e.status || 500, e.message || "Erreur");
  }
}

async function call(method, url, body, isForm = false) {
  if (DEMO) return callDemo(method, url, body);
  const opt = { method, headers: { "X-Miff": "1" }, credentials: "same-origin" };
  if (body !== undefined) {
    if (isForm) opt.body = body;
    else { opt.body = JSON.stringify(body); opt.headers["Content-Type"] = "application/json"; }
  }
  let r;
  try { r = await fetch(url, opt); }
  catch { throw new ApiError(0, "Impossible de joindre le serveur Miff. Êtes-vous connecté au réseau ?"); }
  if (r.status === 401 && !url.startsWith("/api/login") && !url.startsWith("/api/me")) {
    location.hash = "#/connexion";
  }
  const ct = r.headers.get("content-type") || "";
  if (!r.ok) {
    let msg = "Une erreur est survenue.";
    if (ct.includes("json")) {
      const j = await r.json();
      if (typeof j.detail === "string") msg = j.detail;
      else if (Array.isArray(j.detail)) msg = j.detail.map((d) => d.msg).join(" ");
    }
    throw new ApiError(r.status, msg);
  }
  if (ct.includes("json")) return r.json();
  return r.blob();
}

export const api = {
  get: (u) => call("GET", u),
  post: (u, b) => call("POST", u, b),
  put: (u, b) => call("PUT", u, b),
  patch: (u, b) => call("PATCH", u, b),
  del: (u) => call("DELETE", u),
  form: (u, fd) => call("POST", u, fd, true),
};
