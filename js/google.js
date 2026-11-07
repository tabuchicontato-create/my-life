// Google Agenda em modo somente leitura. O acesso fica só na memória do navegador
// (vale cerca de 1 hora). Nada do Google é gravado no banco do MY LIFE.
import { GOOGLE_CLIENT_ID, GOOGLE_ESCOPOS } from "./config.js";

const API = "https://www.googleapis.com/calendar/v3";
let tokenClient = null, aoReceber = null, aoFalhar = null;

function carregarGIS(){
  return new Promise((ok, falha) => {
    if (window.google?.accounts?.oauth2) return ok();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true;
    s.onload = () => ok(); s.onerror = () => falha(new Error("Não foi possível carregar o login do Google. Verifique a internet."));
    document.head.appendChild(s);
  });
}

// Precisa ser chamado a partir de um clique (o Google abre uma janela).
export async function pedirAcesso(primeiraVez){
  await carregarGIS();
  return new Promise((ok, falha) => {
    aoReceber = ok; aoFalhar = falha;
    if (!tokenClient){
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID, scope: GOOGLE_ESCOPOS,
        callback: r => r.error ? aoFalhar(new Error("O Google recusou a conexão (" + r.error + ").")) : aoReceber({ token: r.access_token, expira: Date.now() + (Number(r.expires_in || 3600) - 60) * 1000 }),
        error_callback: e => aoFalhar(new Error(e.type === "popup_closed" ? "A janela do Google foi fechada antes de terminar." : e.type === "popup_failed_to_open" ? "O navegador bloqueou a janela do Google. Permita pop-ups para este site." : "Não foi possível falar com o Google (" + e.type + ")."))
      });
    }
    tokenClient.requestAccessToken({ prompt: primeiraVez ? "consent" : "" });
  });
}

export function revogar(token){ try { if (token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(token, () => {}); } catch {} }

async function api(token, caminho){
  const r = await fetch(API + caminho, { headers: { Authorization: "Bearer " + token } });
  if (r.status === 401) throw Object.assign(new Error("A autorização do Google expirou. Clique em Sincronizar de novo."), { expirou: true });
  if (!r.ok) throw new Error("Erro do Google (" + r.status + "). Tente de novo em instantes.");
  return r.json();
}

export async function buscar(token){
  const lista = await api(token, "/users/me/calendarList?minAccessRole=reader&maxResults=250");
  const agendas = (lista.items || []).map(c => ({ id: c.id, nome: c.summaryOverride || c.summary, cor: c.backgroundColor || "#2f6fb5", principal: !!c.primary }));
  const ini = new Date(); ini.setHours(0, 0, 0, 0); ini.setDate(ini.getDate() - ini.getDay() - 7);
  const fim = new Date(ini); fim.setDate(fim.getDate() + 7 * 10);
  const eventos = [];
  for (const a of agendas){
    let pageToken = "";
    do {
      const q = new URLSearchParams({ timeMin: ini.toISOString(), timeMax: fim.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250" });
      if (pageToken) q.set("pageToken", pageToken);
      const r = await api(token, "/calendars/" + encodeURIComponent(a.id) + "/events?" + q);
      for (const e of r.items || []){
        if (e.status === "cancelled") continue;
        const diaTodo = !!e.start?.date;
        eventos.push({
          id: a.id + "|" + e.id, titulo: e.summary || "(sem título)", local: e.location || "",
          ini: diaTodo ? new Date(e.start.date + "T00:00:00") : new Date(e.start.dateTime),
          fim: diaTodo ? new Date(e.end.date + "T00:00:00") : new Date(e.end.dateTime),
          diaTodo, agendaId: a.id, agendaNome: a.nome, cor: a.cor
        });
      }
      pageToken = r.nextPageToken || "";
    } while (pageToken);
  }
  return { agendas, eventos, periodo: { ini, fim } };
}
