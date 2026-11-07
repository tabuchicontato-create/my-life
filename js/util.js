// Funções pequenas usadas em todo o app.
export const $ = (s, r = document) => r.querySelector(s);
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export const brl = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export const DIAS_N = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
export const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

export function hoje(){ const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
export function dia(n, h = 0, m = 0){ const d = hoje(); d.setDate(d.getDate() + n); d.setHours(h, m, 0, 0); return d; }
export const fData = d => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
export const fHora = d => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const mesmoDia = (a, b) => { a = new Date(a); b = new Date(b); return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };
export const iso = d => { d = new Date(d); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const deIso = (s, h = "00:00") => { const [y, mo, d] = String(s).split("-").map(Number); const [hh, mm] = String(h || "00:00").split(":").map(Number); return new Date(y, mo - 1, d, hh || 0, mm || 0); };
export const diasAte = d => Math.round((new Date(d).setHours(0, 0, 0, 0) - hoje()) / 86400000);
export function rotuloDia(d){ const n = diasAte(d); if (n === 0) return "Hoje"; if (n === 1) return "Amanhã"; if (n === -1) return "Ontem"; return cap(DIAS[new Date(d).getDay()]); }
export const mesmoMes = (d, ref = hoje()) => { d = new Date(d); return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear(); };
export function valorBR(s){ s = String(s ?? "").trim().replace(/[R$\s]/g, ""); if (s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); const v = Number(s); return isFinite(v) ? v : NaN; }
export const fDuracao = ms => ms >= 60000 ? Math.round(ms / 60000) + " min" : Math.round(ms / 1000) + " s";
export const fTempo = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); };
export const msgHtml = m => m ? `<div class="msg ${m.tipo}" role="${m.tipo === "erro" ? "alert" : "status"}">${m.html || esc(m.texto)}</div>` : "";
export function erroForm(form, texto, tipo = "erro"){ const el = form?.querySelector(".form-msg"); if (el) el.innerHTML = msgHtml({ tipo, texto }); else alertaGlobal(tipo, texto); }
let globalCb = null;
export const definirAlertaGlobal = cb => { globalCb = cb; };
export const alertaGlobal = (tipo, texto) => globalCb && globalCb(tipo, texto);
