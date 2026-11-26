// Miff : démarrage et navigation.
import { api, ApiError } from "./api.js?v=1795725424";
import { errBox, h, icon, initials } from "./ui.js?v=1795725424";
import * as V from "./views.js?v=1795725424";

const app = document.getElementById("app");

if ("serviceWorker" in navigator && window.isSecureContext) {
  try { navigator.serviceWorker.register("sw.js").catch(() => {}); } catch {}
}

const ROUTES = [
  [/^#\/arbre$/, "Notre famille", "arbre", () => V.viewTree()],
  [/^#\/personne\/(\d+)$/, "Fiche", "arbre", (m) => V.viewPerson(Number(m[1])), "#/arbre"],
  [/^#\/documents$/, "Documents", "documents", () => V.viewDocuments()],
  [/^#\/dossier\/(\d+)$/, "Documents", "documents", (m) => V.viewFolder(Number(m[1])), "#/documents"],
  [/^#\/document\/(\d+)$/, "Document", "documents", (m) => V.viewDocument(Number(m[1])), "back"],
  [/^#\/modifier\/(\d+)$/, "Modifier", "documents", (m) => V.viewEditDoc(Number(m[1])), "back"],
  [/^#\/ajouter$/, "Ajouter", "ajouter", () => V.viewAdd()],
  [/^#\/verifier$/, "Vérifier", "ajouter", () => V.viewVerify(), "#/ajouter"],
  [/^#\/reglages$/, "Réglages", "reglages", () => V.viewSettings()],
  [/^#\/chat$/, "Discussions", "chat", () => V.viewChats()],
  [/^#\/chat\/([\w:-]+)$/, "Discussion", "chat", (m) => V.viewChat(m[1]), "#/chat"],
  [/^#\/notifications$/, "Notifications", "", () => V.viewNotifications(), "back"],
];

function tabs(active) {
  const t = (key, label, ic) => h("a", { href: `#/${key}`, class: active === key ? "on" : "", "aria-current": active === key ? "page" : null }, ic, label);
  return h("nav", { class: "tabs", "aria-label": "Navigation" },
    t("arbre", "Arbre", icon("tree")), t("documents", "Documents", icon("doc")),
    t("ajouter", "Ajouter", h("span", { class: "plus" }, icon("plus"))),
    t("chat", "Chat", h("span", { class: "tabic" }, icon("chat"), h("i", { class: "dot", "data-badge": "chats", hidden: true }))),
    t("reglages", "Réglages", icon("gear")));
}

let renderId = 0;
async function route() {
  const id = ++renderId;
  document.querySelectorAll(".sheet").forEach((x) => x.remove()); // une feuille ouverte se ferme quand on change d'écran
  const hash = location.hash || "#/arbre";
  const inv = hash.match(/^#\/invitation\/([\w-]+)$/);
  if (inv) { app.replaceChildren(await V.viewInvite(inv[1])); return; }

  if (!V.state.me) {
    try { V.state.me = await api.get("/api/me"); }
    catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        const st = await api.get("/api/setup").catch(() => ({ needs_setup: false }));
        app.replaceChildren(st.needs_setup ? V.viewSetup() : V.viewLogin());
      } else app.replaceChildren(h("div", { class: "login" }, h("h1", {}, "Miff"), errBox(e), h("button", { class: "btn", onclick: () => location.reload() }, "Réessayer")));
      return;
    }
  }
  if (hash === "#/connexion") { location.hash = "#/arbre"; return; }
  const r = ROUTES.find(([re]) => re.test(hash)) || ROUTES[0];
  const [re, title, tab, fn, back] = r;
  const m = hash.match(re);
  const me = V.state.me;
  const main = h("main", {}, h("div", { class: "spinner" }));
  const backBtn = back ? h("button", { class: "back", onclick: () => (back === "back" ? history.back() : (location.hash = back)) }, icon("back"), "Retour") : null;
  const header = h("header", { class: "top" }, backBtn || h("h1", {}, title),
    h("div", { class: "topr" },
      h("a", { class: "bell", href: "#/notifications", "aria-label": "Notifications" }, icon("bell"), h("i", { class: "dot", "data-badge": "notifs", hidden: true })),
      h("a", { class: "me", href: "#/reglages", "aria-label": "Mes réglages" }, me.member.first_name, me.member.photo ? h("span", { class: "av self pic", style: `background-image:url("${me.member.photo}")` }) : h("span", { class: "av self" }, initials(me.member)))));
  app.replaceChildren(header, ...(window.MIFF_DEMO ? [h("div", { class: "demobar" }, "Démo : oncles, cousins et documents inventés. Données gardées sur cet appareil.")] : []), main, tabs(tab));
  try {
    const content = await fn(m);
    if (id !== renderId) return;
    main.replaceChildren(...[content].flat(Infinity).filter(Boolean));
  } catch (e) {
    if (id !== renderId) return;
    main.replaceChildren(errBox(e));
  }
  if (!hash.startsWith("#/chat/")) window.scrollTo(0, 0);
  document.body.classList.toggle("inchat", hash.startsWith("#/chat/"));
  V.refreshBadges();
}
setInterval(() => { if (V.state.me && document.visibilityState === "visible") V.refreshBadges(); }, 15000);

window.addEventListener("hashchange", route);
route();
