// Telas dos módulos (depois do login): Início, Finanças, Faculdade, Agenda, Saúde, Assistente, Perfil.
import { $, esc, norm, brl, DIAS, cap, hoje, dia, fData, fHora, mesmoDia, iso, deIso, diasAte, rotuloDia, mesmoMes, valorBR, msgHtml, erroForm } from "./util.js";
import { S, lista, config, salvar, apagar, salvarConfig } from "./dados.js";
import * as G from "./google.js";
import { interpretar, interpretarVarias, SUGESTOES, descDias } from "./assistente.js";
import { cfgOllama, salvarOllama, testarOllama, traduzir, ehSaude } from "./ollama.js";

let render = () => {};
export const definirRender = fn => { render = fn; };
const aviso = (tipo, texto) => { S.ui.msg = { tipo, texto }; render(); };

/* ---------- Cálculos ---------- */
const PROVA_RE = /prova|substitutiva/i;
function discDe(t){
  const n = norm(t);
  for (const d of config().disciplinas) if (n.includes(norm(d))) return d;
  for (const [r, d] of [[/\bhc\b/, "Habilidades Clínicas"], [/concepcao/, "Módulo de Concepção"]]) if (r.test(n)) return d;
  return "Faculdade";
}
function provasGoogle(){
  return S.google.eventos.filter(e => PROVA_RE.test(e.titulo)).map(e => ({ id: e.id, tipo: /substitutiva/i.test(e.titulo) ? "Substitutiva" : "Prova", disc: discDe(e.titulo), titulo: e.titulo, data: e.ini, origem: "google", local: e.local }));
}
export function proximas(){
  const h = hoje();
  return [...lista("aval").filter(a => !a.feita && new Date(a.data) >= h).map(a => ({ ...a, data: new Date(a.data) })), ...provasGoogle().filter(a => a.data >= h)].sort((a, b) => a.data - b.data);
}
const doMes = () => lista("fin").filter(f => mesmoMes(f.data));
const somar = (arr, tipo) => arr.filter(f => f.tipo === tipo).reduce((s, f) => s + Number(f.valor), 0);
export function gastoPorCat(){ const r = {}; for (const c in config().orcamento) r[c] = 0; for (const f of doMes()) if (f.tipo === "despesa") r[f.cat] = (r[f.cat] || 0) + Number(f.valor); return r; }
export const saldoMes = () => { const m = doMes(); return somar(m, "receita") - somar(m, "despesa"); };

export function eventosDoDia(d){
  const ini = new Date(d); ini.setHours(0, 0, 0, 0); const fim = new Date(ini); fim.setDate(fim.getDate() + 1);
  const ocultas = new Set(config().agendasOcultas);
  const ev = [];
  for (const e of S.google.eventos){
    if (ocultas.has(e.agendaId)) continue;
    if (e.diaTodo ? (e.ini <= ini && e.fim > ini) : (e.ini < fim && e.fim > ini)) ev.push({ ...e, origem: "google", prova: PROVA_RE.test(e.titulo) });
  }
  for (const a of lista("aval")) if (!a.feita && mesmoDia(a.data, ini)){ const i = new Date(a.data); ev.push({ titulo: `${a.tipo} de ${a.disc}`, ini: i, fim: new Date(i.getTime() + (a.tipo === "Trabalho" ? 0 : 7200000)), origem: "app", tipo: "Faculdade", prova: a.tipo !== "Trabalho" }); }
  for (const c of lista("consulta")) if (mesmoDia(c.data, ini)){ const i = new Date(c.data); ev.push({ titulo: c.titulo, ini: i, fim: new Date(i.getTime() + 3600000), origem: "app", tipo: "Saúde" }); }
  for (const x of lista("exame")) if (x.status === "Agendado" && mesmoDia(x.data, ini)){ const i = new Date(x.data); ev.push({ titulo: x.titulo, ini: i, fim: new Date(i.getTime() + 3600000), origem: "app", tipo: "Saúde" }); }
  for (const r of lista("rotina")) if (r.dias.includes(ini.getDay())){ const a = deIso(iso(ini), r.ini), b = deIso(iso(ini), r.fim); ev.push({ titulo: r.titulo, ini: a, fim: b, origem: "rotina" }); }
  ev.sort((a, b) => (b.diaTodo ? 1 : 0) - (a.diaTodo ? 1 : 0) || a.ini - b.ini);
  ev.forEach((e, i) => { e.conflito = !e.diaTodo && e.fim > e.ini && ev.some((o, j) => j !== i && !o.diaTodo && o.fim > o.ini && o.ini < e.fim && e.ini < o.fim); });
  return ev;
}
const ctxAssistente = { proximas, eventosDoDia, gastoPorCat, saldoMes };
const horaEv = e => e.diaTodo ? "Dia todo" : fHora(e.ini);
function tagEvento(e){
  if (e.origem === "google") return `<span class="pill google" title="Google Agenda · não editável"><i style="background:${esc(e.cor)}"></i>${esc(e.agendaNome)}</span>`;
  if (e.origem === "rotina") return `<span class="pill rotina">Rotina</span>`;
  return `<span class="pill app">${esc(e.tipo)}</span>`;
}
const googleAtivo = () => !!S.google.token && Date.now() < S.google.expira;

/* ---------- Telas ---------- */
const T = {};
const cab = (titulo, sub, extra = "") => `<div class="cab"><div><h1>${titulo}</h1>${sub ? `<p>${sub}</p>` : ""}</div>${extra}</div>${msgHtml(S.ui.msg)}`;

T.inicio = () => {
  const m = doMes(), rec = somar(m, "receita"), desp = somar(m, "despesa"), saldo = rec - desp;
  const prox = proximas().slice(0, 4), evHoje = eventosDoDia(hoje());
  const hs = lista("estudo").filter(e => new Date(e.data) >= dia(-6)).reduce((s, e) => s + Number(e.horas), 0);
  const cfg = config();
  const backupAtrasado = cfg.lembreteMensal && (!cfg.ultimoBackup || Date.now() - new Date(cfg.ultimoBackup) > 30 * 86400000);
  const meds = lista("med"), doses = lista("dose").filter(d => d.data === iso(hoje()));
  const medsPend = meds.filter(x => !doses.some(d => d.medId === x.id));
  const agua = lista("agua").find(a => a.data === iso(hoje()))?.copos || 0;
  const treino = lista("treino").sort((a, b) => new Date(b.data) - new Date(a.data))[0];
  const h = new Date().getHours();
  return `${cab((h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"), cap(DIAS[hoje().getDay()]) + ", " + hoje().toLocaleDateString("pt-BR", { day: "numeric", month: "long" }), `<button class="btn" data-acao="aba" data-aba="assistente">Falar com o assistente</button>`)}
  ${backupAtrasado ? `<div class="msg aviso" style="margin-bottom:14px">${cfg.ultimoBackup ? "Faz mais de 30 dias desde o último backup." : "Você ainda não fez nenhum backup."} <button class="btn link" data-acao="aba" data-aba="perfil">Exportar agora</button></div>` : ""}
  ${S.bloqueados.length ? `<div class="msg aviso" style="margin-bottom:14px">Você tem ${S.bloqueados.length} registro(s) bloqueado(s) de antes da troca de senha. <button class="btn link" data-acao="aba" data-aba="perfil">Desbloquear com a chave antiga</button></div>` : ""}
  <div class="grade">
    <section class="cartao"><header><h2>Saldo do mês</h2><small>${hoje().toLocaleDateString("pt-BR", { month: "long" })}</small></header>
      <div class="numero ${saldo >= 0 ? "pos" : "neg"}">${brl(saldo)}</div>
      <div class="mini"><div><small>Entrou</small><b>${brl(rec)}</b></div><div><small>Saiu</small><b>${brl(desp)}</b></div><div><small>Lançamentos</small><b>${m.length}</b></div></div>
      <button class="btn sec peq" data-acao="aba" data-aba="financas">Ver finanças</button></section>
    <section class="cartao"><header><h2>Hoje na agenda</h2><small>${evHoje.length} compromisso(s)</small></header>
      ${!S.google.ultimaSync ? `<p class="nota">Google Agenda ainda não sincronizado nesta sessão.</p>` : ""}
      <div class="lista">${evHoje.length ? evHoje.map(e => `<div class="item"><span><b>${horaEv(e)}</b> ${esc(e.titulo)}</span>${tagEvento(e)}</div>`).join("") : `<p class="nota">Nada marcado para hoje.</p>`}</div>
      <button class="btn sec peq" data-acao="aba" data-aba="agenda">Ver semana</button></section>
    <section class="cartao"><header><h2>Próximas avaliações</h2></header>
      <div class="lista">${prox.length ? prox.map(a => `<div class="item"><span>${esc(a.tipo)} · <b>${esc(a.disc)}</b><div class="sub">${rotuloDia(a.data)}, ${fData(a.data)} às ${fHora(a.data)}</div></span><span class="pill ${diasAte(a.data) <= 3 ? "warn" : "neutro"}">em ${diasAte(a.data)} dia(s)</span></div>`).join("") : `<p class="nota">Nenhuma prova pendente.${S.google.ultimaSync ? "" : " Sincronize o Google Agenda para trazer as provas de lá."}</p>`}</div>
      <div class="nota">${hs.toLocaleString("pt-BR")} h de estudo nos últimos 7 dias</div></section>
    <section class="cartao"><header><h2>Saúde hoje</h2><small>cifrado</small></header>
      <div class="item"><span>Medicamentos</span><span class="pill ${medsPend.length ? "warn" : "ok"}">${meds.length ? (medsPend.length ? medsPend.length + " a marcar" : "todos marcados") : "nenhum cadastrado"}</span></div>
      <div class="item"><span>Água</span><b>${agua} copo(s) · ${(agua * 0.25).toLocaleString("pt-BR")} L</b></div>
      <div class="item"><span>Último treino</span><span class="sub">${treino ? `${esc(treino.tipo)} · ${treino.min} min · ${rotuloDia(treino.data)}` : "nenhum"}</span></div>
      <button class="btn sec peq" data-acao="aba" data-aba="saude">Abrir saúde</button></section>
  </div>`;
};

T.financas = () => {
  const m = doMes(), rec = somar(m, "receita"), desp = somar(m, "despesa"), g = gastoPorCat(), orc = config().orcamento;
  const lanc = [...m].sort((a, b) => new Date(b.data) - new Date(a.data));
  return `${cab("Finanças", hoje().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }))}
  <div class="grade dupla">
    <section class="cartao"><header><h2>Resumo do mês</h2></header>
      <div class="mini"><div><small>Receitas</small><b class="valor pos">${brl(rec)}</b></div><div><small>Despesas</small><b class="valor neg">${brl(desp)}</b></div><div><small>Saldo</small><b>${brl(rec - desp)}</b></div></div>
      <h3>Orçamento por categoria</h3>
      ${Object.entries(orc).map(([c, lim]) => { const v = g[c] || 0, p = lim ? Math.min(100, v / lim * 100) : (v ? 100 : 0); const cls = v > lim ? "estouro" : p >= 80 ? "perto" : ""; return `<div class="orc"><div class="lin"><span>${esc(c)}${v > lim ? ` <span class="pill bad">passou ${brl(v - lim)}</span>` : ""}</span><span>${brl(v)} de ${brl(lim)}</span></div><div class="barra"><i class="${cls}" style="width:${p}%"></i></div></div>`; }).join("")}
      <details><summary>Editar limites do orçamento</summary>
        <form data-form="orcamento" class="campos" style="margin-top:8px">${Object.entries(orc).map(([c, lim]) => `<label>${esc(c)}<input name="${esc(c)}" inputmode="decimal" value="${lim}"></label>`).join("")}<button class="btn" type="submit">Salvar limites</button></form>
      </details>
    </section>
    <section class="cartao"><header><h2>Novo lançamento</h2><small>ou diga ao assistente</small></header>
      <form data-form="lancamento">
        <div class="form-msg"></div>
        <div class="campos">
          <label for="f-tipo">Tipo<select id="f-tipo" name="tipo"><option value="despesa">Despesa</option><option value="receita">Receita</option></select></label>
          <label for="f-valor">Valor (R$)<input id="f-valor" name="valor" inputmode="decimal" placeholder="35,00" required></label>
        </div>
        <label for="f-desc">Descrição<input id="f-desc" name="desc" placeholder="Ex.: ração" required></label>
        <div class="campos">
          <label for="f-cat">Categoria<select id="f-cat" name="cat">${Object.keys(orc).map(c => `<option>${esc(c)}</option>`).join("")}</select></label>
          <label for="f-data">Data<input id="f-data" name="data" type="date" value="${iso(hoje())}"></label>
        </div>
        <button class="btn" type="submit">Adicionar</button>
      </form>
      <h3>Lançamentos do mês</h3>
      <div class="lista">${lanc.length ? lanc.map(f => `<div class="item"><span>${esc(f.desc)}<div class="sub">${fData(f.data)} · ${esc(f.cat)}</div></span><span class="linha"><span class="valor ${f.tipo === "receita" ? "pos" : "neg"}">${f.tipo === "receita" ? "+" : "−"} ${brl(f.valor)}</span><button class="btn x" data-acao="apagar" data-id="${f.id}" aria-label="Apagar lançamento">×</button></span></div>`).join("") : `<p class="nota">Nenhum lançamento neste mês.</p>`}</div>
    </section>
  </div>`;
};

T.faculdade = () => {
  const discs = config().disciplinas;
  const hs = {}; discs.forEach(d => hs[d] = 0);
  lista("estudo").filter(e => new Date(e.data) >= dia(-6)).forEach(e => hs[e.disc] = (hs[e.disc] || 0) + Number(e.horas));
  const maxH = Math.max(1, ...Object.values(hs));
  const proprias = lista("aval").map(a => ({ ...a, data: new Date(a.data) }));
  const todas = [...proprias, ...provasGoogle()].filter(a => a.data >= dia(-14)).sort((a, b) => a.data - b.data);
  return `${cab("Faculdade", "Provas, trabalhos e horas de estudo")}
  <div class="grade dupla">
    <section class="cartao"><header><h2>Provas e trabalhos</h2><small>${proximas().length} pendente(s)</small></header>
      ${!S.google.ultimaSync ? `<p class="nota">As provas do Google Agenda aparecem aqui depois de sincronizar na aba Agenda.</p>` : ""}
      <div class="lista">${todas.length ? todas.map(a => `<div class="item"><span>${esc(a.tipo)} · <b>${esc(a.disc)}</b><div class="sub">${esc(a.titulo)} · ${fData(a.data)} ${fHora(a.data)}</div></span>${a.origem === "google" ? `<span class="linha"><span class="pill ${a.data < hoje() ? "neutro" : diasAte(a.data) <= 3 ? "warn" : "neutro"}">${a.data < hoje() ? "passou" : "em " + diasAte(a.data) + " dia(s)"}</span><span class="pill google">Google</span></span>` : a.feita ? `<span class="linha"><span class="pill ok">feita</span><button class="btn x" data-acao="apagar" data-id="${a.id}" aria-label="Apagar">×</button></span>` : `<span class="linha"><span class="pill ${diasAte(a.data) <= 3 ? "warn" : "neutro"}">em ${diasAte(a.data)} dia(s)</span><button class="btn sec peq" data-acao="feita" data-id="${a.id}">Marcar feita</button><button class="btn x" data-acao="apagar" data-id="${a.id}" aria-label="Apagar">×</button></span>`}</div>`).join("") : `<p class="nota">Nada por aqui ainda.</p>`}</div>
      <form data-form="avaliacao">
        <h3>Adicionar</h3><div class="form-msg"></div>
        <div class="campos">
          <label for="a-tipo">Tipo<select id="a-tipo" name="tipo"><option>Prova</option><option>Trabalho</option><option>Seminário</option><option>Substitutiva</option></select></label>
          <label for="a-disc">Disciplina<select id="a-disc" name="disc">${discs.map(d => `<option>${esc(d)}</option>`).join("")}</select></label>
        </div>
        <label for="a-tit">Título<input id="a-tit" name="titulo" placeholder="Ex.: Prova 3" required></label>
        <div class="campos"><label for="a-data">Data<input id="a-data" type="date" name="data" value="${iso(dia(7))}" required></label><label for="a-hora">Hora<input id="a-hora" type="time" name="hora" value="14:00"></label></div>
        <button class="btn" type="submit">Adicionar</button>
      </form>
    </section>
    <section class="cartao"><header><h2>Horas de estudo</h2><small>últimos 7 dias</small></header>
      ${discs.map(d => `<div class="orc"><div class="lin"><span>${esc(d)}</span><span>${(hs[d] || 0).toLocaleString("pt-BR")} h</span></div><div class="barra"><i style="width:${(hs[d] || 0) / maxH * 100}%"></i></div></div>`).join("")}
      <form data-form="estudo">
        <h3>Registrar estudo</h3><div class="form-msg"></div>
        <div class="campos">
          <label for="e-disc">Disciplina<select id="e-disc" name="disc">${discs.map(d => `<option>${esc(d)}</option>`).join("")}</select></label>
          <label for="e-h">Horas<input id="e-h" name="horas" inputmode="decimal" value="1" required></label>
        </div>
        <button class="btn" type="submit">Registrar</button>
      </form>
      <h3>Disciplinas</h3>
      <div class="chips">${discs.map(d => `<span class="pill app">${esc(d)} <button class="btn x mini-x" data-acao="tirar-disc" data-d="${esc(d)}" aria-label="Remover ${esc(d)}">×</button></span>`).join("")}</div>
      <form data-form="disciplina" class="entrada"><label for="nova-disc" class="so-leitor">Nova disciplina</label><input id="nova-disc" name="nome" placeholder="Nova disciplina" required><button class="btn sec" type="submit">Adicionar</button></form>
    </section>
  </div>`;
};

T.agenda = () => {
  const base = hoje(); base.setDate(base.getDate() - base.getDay() + 7 * S.ui.semana);
  const semana = Array.from({ length: 7 }, (_, i) => { const d = new Date(base); d.setDate(d.getDate() + i); return d; });
  const conflitos = semana.reduce((n, d) => n + eventosDoDia(d).filter(e => e.conflito).length, 0);
  const g = S.google, ocultas = new Set(config().agendasOcultas);
  const botaoG = g.carregando ? `<button class="btn sec" disabled>Sincronizando…</button>`
    : g.ultimaSync ? `<span class="nota">Sincronizado às ${fHora(g.ultimaSync)}</span><button class="btn sec" data-acao="google-sync">Sincronizar agora</button><button class="btn sec" data-acao="google-sair">Desconectar</button>`
    : `<button class="btn" data-acao="google-conectar">Conectar Google Agenda</button>`;
  return `${cab("Agenda", `${cap(DIAS[semana[0].getDay()])} ${fData(semana[0])} a ${DIAS[semana[6].getDay()]} ${fData(semana[6])}`, `<div class="linha">${botaoG}</div>`)}
  ${g.erro ? `<div class="msg erro" style="margin-bottom:12px">${esc(g.erro)}</div>` : ""}
  ${!g.ultimaSync ? `<div class="msg info" style="margin-bottom:12px">O Google Agenda é só leitura e precisa ser conectado a cada vez que você entra (o acesso dura cerca de 1 hora e não fica salvo). Na primeira vez o Google avisa que o app não é verificado: clique em Avançado → Acessar MY LIFE.</div>` : ""}
  <div class="linha" style="margin-bottom:10px"><button class="btn sec peq" data-acao="semana" data-d="-1">← Semana anterior</button><button class="btn sec peq" data-acao="semana" data-d="0" ${S.ui.semana === 0 ? "disabled" : ""}>Esta semana</button><button class="btn sec peq" data-acao="semana" data-d="1">Próxima semana →</button></div>
  ${g.agendas.length ? `<div class="chips" style="margin-bottom:10px">${g.agendas.map(a => `<label class="chk-pill"><input type="checkbox" data-acao-change="agenda-visivel" data-id="${esc(a.id)}" ${ocultas.has(a.id) ? "" : "checked"}><i style="background:${esc(a.cor)}"></i>${esc(a.nome)}</label>`).join("")}</div>` : ""}
  <div class="linha" style="margin-bottom:12px"><span class="pill app">MY LIFE</span><span class="pill rotina">Rotina</span><span class="pill bad">prova</span>${conflitos ? `<span class="pill bad">${Math.ceil(conflitos / 2)} conflito(s) de horário</span>` : ""}</div>
  <div class="grade semana">${semana.map(d => { const ev = eventosDoDia(d); return `<section class="cartao dia ${mesmoDia(d, hoje()) ? "hoje" : ""}"><h3>${cap(DIAS[d.getDay()])} <small>${fData(d)}</small>${mesmoDia(d, hoje()) ? ` <span class="pill app">hoje</span>` : ""}</h3>
    ${ev.length ? ev.map(e => `<div class="evento ${e.origem} ${e.prova ? "prova" : ""} ${e.conflito ? "conflito" : ""}" ${e.cor ? `style="border-left-color:${esc(e.cor)}"` : ""}><span class="h">${e.diaTodo ? "Dia todo" : fHora(e.ini) + (e.fim > e.ini ? "–" + fHora(e.fim) : "")}${e.prova ? ` <span class="pill bad">prova</span>` : ""}${e.conflito ? ` <span class="pill bad">conflito</span>` : ""}</span><span class="tag">${tagEvento(e)}</span><span class="titulo">${esc(e.titulo)}${e.local ? `<span class="local">${esc(e.local)}</span>` : ""}</span></div>`).join("") : `<p class="nota">Livre</p>`}
  </section>`; }).join("")}</div>
  <p class="nota" style="margin-top:12px">O MY LIFE nunca cria, altera ou apaga nada no seu Google Agenda. Provas e substitutivas do Google entram sozinhas em Faculdade.</p>`;
};

T.saude = () => {
  const sub = S.ui.subSaude, hj = iso(hoje());
  const abas = [["tratamento", "Tratamento (SOP)"], ["treino", "Treino"], ["alimentacao", "Alimentação e água"]];
  let corpo = "";
  if (sub === "tratamento"){
    const doses = lista("dose").filter(d => d.data === hj);
    corpo = `<div class="grade dupla">
    <section class="cartao"><header><h2>Medicamentos</h2><small>registro, sem recomendação de dose</small></header>
      <div class="lista">${lista("med").map(x => { const tomado = doses.find(d => d.medId === x.id); return `<div class="item"><span><b>${esc(x.nome)}</b><div class="sub">${esc(x.orient || "Conforme prescrição médica")}${x.hora ? " · " + esc(x.hora) : ""}</div></span><span class="linha">${tomado ? `<span class="pill ok">tomado hoje</span><button class="btn x" data-acao="apagar" data-id="${tomado.id}" aria-label="Desmarcar">↺</button>` : `<button class="btn sec peq" data-acao="tomar" data-id="${x.id}">Marcar como tomado</button>`}<button class="btn x" data-acao="apagar" data-id="${x.id}" aria-label="Remover medicamento">×</button></span></div>`; }).join("") || `<p class="nota">Nenhum medicamento cadastrado.</p>`}</div>
      <form data-form="med"><div class="form-msg"></div><div class="campos">
        <label for="m-nome">Nome<input id="m-nome" name="nome" required></label>
        <label for="m-hora">Horário<input id="m-hora" name="hora" type="time"></label></div>
        <label for="m-or">Como foi prescrito <small>(copie da receita)</small><input id="m-or" name="orient" placeholder="Conforme prescrição médica"></label>
        <button class="btn" type="submit">Cadastrar</button></form>
      <p class="nota">Dúvidas sobre dose ou mudança de medicamento devem ser levadas ao seu médico. O app só registra.</p>
    </section>
    <section class="cartao"><header><h2>Consultas</h2></header>
      <div class="lista">${lista("consulta").sort((a, b) => new Date(a.data) - new Date(b.data)).map(c => `<div class="item"><span><b>${esc(c.titulo)}</b><div class="sub">${fData(c.data)} às ${fHora(c.data)}${c.nota ? " · " + esc(c.nota) : ""}</div></span><span class="linha"><span class="pill neutro">${diasAte(c.data) >= 0 ? "em " + diasAte(c.data) + " dia(s)" : "passou"}</span><button class="btn x" data-acao="apagar" data-id="${c.id}" aria-label="Apagar">×</button></span></div>`).join("") || `<p class="nota">Nenhuma consulta.</p>`}</div>
      <form data-form="consulta"><div class="form-msg"></div><label for="c-t">Consulta<input id="c-t" name="titulo" placeholder="Ex.: Ginecologista" required></label>
        <div class="campos"><label for="c-d">Data<input id="c-d" type="date" name="data" required></label><label for="c-h">Hora<input id="c-h" type="time" name="hora" value="09:00"></label></div>
        <label for="c-n">Observação<input id="c-n" name="nota"></label><button class="btn" type="submit">Adicionar</button></form>
      <h3>Exames</h3>
      <div class="lista">${lista("exame").sort((a, b) => new Date(b.data) - new Date(a.data)).map(x => `<div class="item"><span><b>${esc(x.titulo)}</b><div class="sub">${fData(x.data)}</div></span><span class="linha"><button class="btn sec peq" data-acao="exame-status" data-id="${x.id}">${esc(x.status)}</button><button class="btn x" data-acao="apagar" data-id="${x.id}" aria-label="Apagar">×</button></span></div>`).join("") || `<p class="nota">Nenhum exame.</p>`}</div>
      <form data-form="exame"><div class="form-msg"></div><div class="campos"><label for="x-t">Exame<input id="x-t" name="titulo" required></label><label for="x-d">Data<input id="x-d" type="date" name="data" required></label></div>
        <label for="x-s">Situação<select id="x-s" name="status"><option>Agendado</option><option>Aguardando resultado</option><option>Resultado recebido</option></select></label><button class="btn" type="submit">Adicionar</button></form>
    </section>
    <section class="cartao"><header><h2>Sintomas</h2><small>diário para levar à consulta</small></header>
      <form data-form="sintoma"><div class="form-msg"></div><div class="campos">
        <label for="s-sin">Sintoma<input id="s-sin" name="sintoma" required></label>
        <label for="s-int">Intensidade (1 a 5)<select id="s-int" name="intens">${[1, 2, 3, 4, 5].map(n => `<option ${n === 2 ? "selected" : ""}>${n}</option>`).join("")}</select></label></div>
        <label for="s-nota">Observação<input id="s-nota" name="nota"></label>
        <button class="btn" type="submit">Registrar</button></form>
      <div class="lista">${lista("sintoma").sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 30).map(s => `<div class="item"><span><b>${esc(s.sintoma)}</b><div class="sub">${rotuloDia(s.data)}, ${fData(s.data)}${s.nota ? " · " + esc(s.nota) : ""}</div></span><span class="linha"><span class="pill neutro">intensidade ${s.intens}</span><button class="btn x" data-acao="apagar" data-id="${s.id}" aria-label="Apagar">×</button></span></div>`).join("")}</div>
    </section></div>`;
  }
  if (sub === "treino"){
    const tr = lista("treino").sort((a, b) => new Date(b.data) - new Date(a.data));
    const cargas = lista("carga").sort((a, b) => new Date(a.data) - new Date(b.data));
    const porEx = new Map();
    for (const c of cargas){ const k = norm(c.exercicio); if (!porEx.has(k)) porEx.set(k, { nome: c.exercicio, regs: [] }); porEx.get(k).regs.push(c); }
    const exs = [...porEx.values()].sort((a, b) => new Date(b.regs.at(-1).data) - new Date(a.regs.at(-1).data));
    const kg = v => (Math.round(v * 100) / 100).toLocaleString("pt-BR") + " kg";
    const serie = c => (c.series || c.reps) ? ` · ${c.series || "?"}×${c.reps || "?"}` : "";
    const grafico = regs => {
      if (regs.length < 2) return "";
      const v = regs.map(r => r.peso), mn = Math.min(...v), mx = Math.max(...v), W = 220, H = 48, P = 4;
      const pts = v.map((y, i) => [P + i * (W - 2 * P) / (v.length - 1), mx === mn ? H / 2 : H - P - (y - mn) * (H - 2 * P) / (mx - mn)]);
      return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução do peso"><polyline points="${pts.map(p => p.map(n => n.toFixed(1)).join(",")).join(" ")}"/>${pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.5"/>`).join("")}</svg>`;
    };
    const progresso = exs.map(e => {
      const ult = e.regs.at(-1), ant = e.regs.at(-2), pri = e.regs[0], max = Math.max(...e.regs.map(r => r.peso));
      const dif = ant ? ult.peso - ant.peso : 0, total = ult.peso - pri.peso;
      const tend = !ant ? `<span class="pill neutro">1º registro</span>` : dif > 0 ? `<span class="pill ok">▲ +${kg(dif)}</span>` : dif < 0 ? `<span class="pill bad">▼ ${kg(dif)}</span>` : `<span class="pill neutro">= igual</span>`;
      return `<div class="ex"><div class="ex-topo"><b>${esc(e.nome)}</b>${tend}</div>
        <div class="ex-num"><span><small>Atual</small>${kg(ult.peso)}</span><span><small>Recorde</small>${kg(max)}</span><span><small>Desde o início</small>${total >= 0 ? "+" : ""}${kg(total)}</span></div>
        ${grafico(e.regs.slice(-12))}
        <div class="sub">${e.regs.slice(-4).reverse().map(r => `${fData(r.data)}: ${kg(r.peso)}${serie(r)}`).join(" · ")}</div></div>`;
    }).join("");
    const dias = new Map();
    for (const c of [...cargas].reverse()){ const k = iso(new Date(c.data)); if (!dias.has(k)) dias.set(k, []); dias.get(k).push(c); }
    const historico = [...dias.entries()].slice(0, 14).map(([d, cs]) => `<div class="dia-treino"><h3>${cap(rotuloDia(deIso(d, "12:00")))} <small>${fData(deIso(d, "12:00"))}</small></h3>
      ${cs.map(c => `<div class="item"><span><b>${esc(c.exercicio)}</b>${c.nota ? `<div class="sub">${esc(c.nota)}</div>` : ""}</span><span class="linha"><span class="mono">${kg(c.peso)}${serie(c)}</span><button class="btn x" data-acao="apagar" data-id="${c.id}" aria-label="Apagar">×</button></span></div>`).join("")}</div>`).join("");
    corpo = `<div class="grade dupla">
    <section class="cartao"><header><h2>Registrar exercício</h2><small>peso do dia</small></header>
      <form data-form="carga"><div class="form-msg"></div><div class="campos">
        <label for="c-ex">Exercício<input id="c-ex" name="exercicio" list="c-exs" placeholder="Ex.: Agachamento" required><datalist id="c-exs">${exs.map(e => `<option>${esc(e.nome)}</option>`).join("")}</datalist></label>
        <label for="c-peso">Peso (kg)<input id="c-peso" name="peso" inputmode="decimal" placeholder="Ex.: 22,5" required></label>
        <label for="c-ser">Séries<input id="c-ser" name="series" inputmode="numeric" placeholder="3"></label>
        <label for="c-rep">Repetições<input id="c-rep" name="reps" inputmode="numeric" placeholder="12"></label>
        <label for="c-d">Data<input id="c-d" type="date" name="data" value="${S.ui.dataCarga || hj}"></label>
        <label for="c-nota">Observação<input id="c-nota" name="nota" placeholder="opcional"></label></div>
        <button class="btn" type="submit">Salvar exercício</button>
        <p class="nota">Dica: registre um exercício por vez. A data fica guardada para lançar o treino inteiro do dia.</p></form></section>
    <section class="cartao"><header><h2>Progresso de carga</h2><small>${exs.length} exercício(s)</small></header>
      ${progresso || `<p class="nota">Registre seus exercícios com o peso para ver aqui se você está subindo de carga.</p>`}</section>
    <section class="cartao"><header><h2>Treinos por dia</h2></header>
      ${historico || `<p class="nota">Nenhum exercício registrado.</p>`}</section>
    <section class="cartao"><header><h2>Outras atividades</h2><small>${tr.filter(t => new Date(t.data) >= dia(-6)).length} nos últimos 7 dias</small></header>
      <form data-form="treino"><div class="form-msg"></div><div class="campos">
        <label for="t-tipo">Atividade<input id="t-tipo" name="tipo" list="t-tipos" required><datalist id="t-tipos"><option>Caminhada</option><option>Musculação</option><option>Yoga</option><option>Corrida</option><option>Pilates</option></datalist></label>
        <label for="t-min">Duração (min)<input id="t-min" name="min" inputmode="numeric" value="30" required></label>
        <label for="t-d">Data<input id="t-d" type="date" name="data" value="${hj}"></label></div>
        <button class="btn" type="submit">Registrar</button></form>
      <div class="lista">${tr.slice(0, 30).map(t => `<div class="item"><span><b>${esc(t.tipo)}</b><div class="sub">${rotuloDia(t.data)}, ${fData(t.data)}</div></span><span class="linha">${t.min} min<button class="btn x" data-acao="apagar" data-id="${t.id}" aria-label="Apagar">×</button></span></div>`).join("") || `<p class="nota">Nenhuma atividade registrada.</p>`}</div></section></div>`;
  }
  if (sub === "alimentacao"){
    const agua = lista("agua").find(a => a.data === hj)?.copos || 0;
    corpo = `<div class="grade dupla">
    <section class="cartao"><header><h2>Água hoje</h2><small>copos de 250 ml</small></header>
      <div class="agua" role="img" aria-label="${agua} copos">${Array.from({ length: Math.max(8, agua) }, (_, i) => `<span class="copo ${i < agua ? "cheio" : ""}"></span>`).join("")}</div>
      <div class="linha"><b>${agua} copo(s) · ${(agua * 0.25).toLocaleString("pt-BR")} L</b><button class="btn sec peq" data-acao="agua" data-d="1">+ 1 copo</button><button class="btn sec peq" data-acao="agua" data-d="-1" ${agua ? "" : "disabled"}>− 1</button></div>
    </section>
    <section class="cartao"><header><h2>Refeições de hoje</h2><small>só registro, sem calorias ou metas</small></header>
      <form data-form="refeicao"><div class="form-msg"></div><div class="campos">
        <label for="r-q">Refeição<select id="r-q" name="quando"><option>Café da manhã</option><option>Lanche</option><option>Almoço</option><option>Jantar</option><option>Ceia</option></select></label></div>
        <label for="r-t">O que comeu<input id="r-t" name="texto" required></label>
        <button class="btn" type="submit">Registrar</button></form>
      <div class="lista">${lista("refeicao").filter(r => r.data === hj).map(r => `<div class="item"><span><b>${esc(r.quando)}</b><div class="sub">${esc(r.texto)}</div></span><button class="btn x" data-acao="apagar" data-id="${r.id}" aria-label="Apagar">×</button></div>`).join("")}</div>
    </section></div>`;
  }
  return `${cab("Saúde", "Módulo separado, com proteção extra")}
  <div class="msg info" style="margin-bottom:14px">Os dados de saúde ficam cifrados no seu aparelho e não passam pelo assistente nem por serviços externos. O app não diagnostica nem recomenda doses.</div>
  <div class="abas" role="tablist">${abas.map(([k, t]) => `<button class="aba" role="tab" aria-selected="${sub === k}" data-acao="subsaude" data-s="${k}">${t}</button>`).join("")}</div>
  ${corpo}`;
};

function htmlPrevia(p, i){
  const linhas = Object.entries(p.campos).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
  return `<div class="previa"><b>Prévia antes de salvar</b><dl>${linhas}</dl>${p.estado === "pendente" ? `<div class="linha"><button class="btn peq" data-acao="confirmar" data-i="${i}">Confirmar</button><button class="btn sec peq" data-acao="cancelar" data-i="${i}">Cancelar</button></div>` : `<span class="pill ${p.estado === "salvo" ? "ok" : "neutro"}">${p.estado}</span>`}</div>`;
}
T.assistente = () => {
  if (!S.ui.chat.length) S.ui.chat.push({ de: "ela", texto: "Oi! Eu entendo comandos simples. Toque numa sugestão ou escreva do seu jeito." });
  const rot = lista("rotina"), ter = lista("termo");
  return `${cab("Assistente", "Entende comandos previstos e mostra uma prévia antes de salvar")}
  <section class="cartao">
    <div class="chat" id="chat" aria-live="polite">${S.ui.chat.map((m, i) => `<div class="bolha ${m.de}">${esc(m.texto)}${m.previa ? htmlPrevia(m.previa, i) : ""}</div>`).join("")}</div>
    <div class="chips">${SUGESTOES.map(s => `<button class="chip" data-acao="sugestao" data-t="${esc(s)}">${esc(s)}</button>`).join("")}</div>
    <form data-form="chat" class="entrada"><label for="c-in" class="so-leitor">Mensagem</label><input id="c-in" name="t" placeholder="Escreva um comando…" autocomplete="off"><button class="btn" type="submit">Enviar</button></form>
  </section>
  <div class="grade dupla" style="margin-top:14px">
    <section class="cartao"><header><h2>Minha rotina</h2><small>aparece na Agenda</small></header>
      ${rot.length ? `<div class="lista">${rot.map(r => `<div class="item"><span><b>${esc(r.titulo)}</b><div class="sub">${descDias(r.dias)} · ${r.ini}–${r.fim}</div></span><button class="btn x" data-acao="apagar" data-id="${r.id}" aria-label="Remover">×</button></div>`).join("")}</div>` : `<p class="nota">Vazia. Ex.: "Toda terça e quinta tenho estágio das 14h às 17h".</p>`}
    </section>
    <section class="cartao"><header><h2>Meus termos</h2><small>palavras suas → categoria de gasto</small></header>
      ${ter.length ? `<div class="lista">${ter.map(t => `<div class="item"><span>"${esc(t.termo)}" → <b>${esc(t.cat)}</b></span><button class="btn x" data-acao="apagar" data-id="${t.id}" aria-label="Remover">×</button></div>`).join("")}</div>` : `<p class="nota">Vazio. Ex.: "Quando eu disser padaria do Zé, é Alimentação".</p>`}
    </section>
  </div>`;
};

T.perfil = () => {
  const cfg = config(), n = S.itens.length;
  return `${cab("Perfil", `<span class="mono">${esc(S.sessao.email)}</span>`)}
  <div class="grade dupla">
    <section class="cartao"><header><h2>IA local (Ollama)</h2><small>só neste aparelho</small></header>
      ${(() => { const o = cfgOllama(); return `<form data-form="ollama"><div class="form-msg"></div>
        <label class="linha" for="o-at"><input id="o-at" type="checkbox" name="ativo" ${o.ativo ? "checked" : ""}> Usar o Ollama quando o assistente não entender</label>
        <div class="campos"><label for="o-url">Endereço<input id="o-url" name="url" value="${esc(o.url)}" required></label>
        <label for="o-mod">Modelo<input id="o-mod" name="modelo" value="${esc(o.modelo)}" required></label></div>
        <div class="linha"><button class="btn sec" type="submit">Salvar</button><button class="btn sec" type="button" data-acao="ollama-testar">Testar conexão</button></div>
        ${S.ui.ollamaStatus ? `<div class="msg ${S.ui.ollamaStatus.ok ? "ok" : "erro"}">${esc(S.ui.ollamaStatus.texto)}</div>` : ""}</form>`; })()}
      <p class="nota">O Ollama roda no seu computador. A frase vai só até ele, nunca para a internet. Assuntos de saúde nunca são enviados. No celular, deixe desligado.</p>
    </section>
    <section class="cartao"><header><h2>Segurança</h2></header>
      <div class="item"><span>Dados sensíveis</span><span class="pill ok">cifrados no aparelho</span></div>
      <div class="item"><span>Verificação em duas etapas</span><span class="pill neutro">próxima atualização</span></div>
      <form data-form="logout" class="linha"><label for="p-logout" style="flex:1">Sair automaticamente após<select id="p-logout" name="min">${[5, 10, 15, 30, 60].map(m => `<option value="${m}" ${m === cfg.logoutMin ? "selected" : ""}>${m} minutos sem uso</option>`).join("")}</select></label><button class="btn sec" type="submit" style="align-self:end">Salvar</button></form>
      <p class="nota">O logout automático é feito pelo app neste aparelho; no plano gratuito o servidor não encerra a sessão sozinho. Fechar a aba também encerra.</p>
    </section>
    <section class="cartao"><header><h2>Backup</h2><small>Último: ${cfg.ultimoBackup ? new Date(cfg.ultimoBackup).toLocaleString("pt-BR") : "nunca"}</small></header>
      <p class="nota">O plano gratuito não faz backup automático. A exportação gera um arquivo cifrado que vai para o seu computador. Sem a senha do arquivo, ninguém consegue abrir, nem você.</p>
      <form data-form="exportar"><div class="form-msg"></div>
        <label for="ex-s">Sua senha do MY LIFE <small>(confirmação de segurança)</small><input id="ex-s" name="senha" type="password" autocomplete="current-password" required></label>
        <label for="ex-a">Senha para o arquivo de backup<input id="ex-a" name="arq" type="password" autocomplete="new-password" required minlength="10"></label>
        <label for="ex-a2">Repita a senha do arquivo<input id="ex-a2" name="arq2" type="password" autocomplete="new-password" required></label>
        <button class="btn" type="submit">Exportar ${n} registro(s)</button></form>
      <label class="chk" for="lembrete"><input type="checkbox" id="lembrete" data-acao-change="lembrete" ${cfg.lembreteMensal ? "checked" : ""}> Lembrar de exportar todo mês</label>
      <details><summary>Restaurar um backup</summary>
        <form data-form="importar" style="margin-top:8px"><div class="form-msg"></div>
          <label for="im-f">Arquivo de backup (.mylife.json)<input id="im-f" name="arquivo" type="file" accept=".json,application/json" required></label>
          <label for="im-s">Senha do arquivo<input id="im-s" name="arq" type="password" required></label>
          <label class="chk" for="im-ok"><input type="checkbox" id="im-ok" name="ok" required> Entendo que isso <b>substitui todos os dados atuais</b> pelos do arquivo</label>
          <button class="btn sec" type="submit">Restaurar</button></form>
      </details>
    </section>
    ${S.bloqueados.length ? `<section class="cartao"><header><h2>Dados bloqueados</h2><small>${S.bloqueados.length} registro(s)</small></header>
      <p class="nota">São registros de antes de uma troca de senha feita sem a chave de recuperação. Com a chave antiga, eles voltam.</p>
      <form data-form="desbloquear"><div class="form-msg"></div><label for="db-k">Chave de recuperação antiga<input id="db-k" name="chave" autocomplete="off" placeholder="XXXX-XXXX-…" required></label><button class="btn sec" type="submit">Desbloquear</button></form>
    </section>` : ""}
    <section class="cartao"><header><h2>Google Agenda</h2></header>
      <div class="item"><span>Conexão nesta sessão</span><span class="pill ${googleAtivo() ? "google" : "neutro"}">${googleAtivo() ? "conectada · somente leitura" : "desconectada"}</span></div>
      <p class="nota">Para cancelar o acesso de vez: myaccount.google.com/permissions → MY LIFE → Remover acesso.</p>
    </section>
    <section class="cartao"><header><h2>Excluir conta</h2></header>
      <form data-form="excluir"><div class="form-msg"></div>
        <p class="nota">Apaga todos os seus dados do banco e a conta de login. Não tem volta. Faça um backup antes.</p>
        <label for="xc-s">Sua senha<input id="xc-s" name="senha" type="password" autocomplete="current-password" required></label>
        <label for="xc-c">Digite EXCLUIR para confirmar<input id="xc-c" name="conf" autocomplete="off" required></label>
        <button class="btn perigo" type="submit">Excluir conta e dados</button></form>
    </section>
  </div>`;
};

export function telaModulo(){ return (T[S.ui.aba] || T.inicio)(); }

/* ---------- Ações ---------- */
async function enviarChat(texto){
  if (!texto.trim()) return;
  S.ui.chat.push({ de: "eu", texto });
  const rolar = () => { render(); const c = $("#chat"); if (c) c.scrollTop = c.scrollHeight; $("#c-in")?.focus(); };
  // Cada parte da mensagem é respondida em ordem; o que as regras não entendem pode ir para a IA.
  for (const r of interpretarVarias(texto, ctxAssistente)) await responderParte(r, r.parte || texto, rolar);
  rolar();
}
async function responderParte(r, texto, rolar){
  const ia = cfgOllama();
  if (!r.naoEntendi || !ia.ativo){ S.ui.chat.push({ de: "ela", texto: r.resp, previa: r.previa ? { ...r.previa, estado: "pendente" } : null }); return; }
  if (ehSaude(texto)){ S.ui.chat.push({ de: "ela", texto: "Não entendi. Assuntos de saúde não vão para a IA, então tente um destes formatos:\n• Estou com dor de cabeça forte\n• Bebi 2 copos de água / Fiz 30 min de caminhada\n• Supino 20 kg 3x10 / Almocei arroz e frango\n• Comecei a tomar Metformina às 8h / Tomei a Metformina\n• Consulta com ginecologista dia 20/11 às 15h\n• Exame de sangue dia 15/11\nDúvidas clínicas, leve ao seu médico." }); return; }
  const espera = { de: "ela", texto: "Pensando com a IA local…" }; S.ui.chat.push(espera); rolar();
  try {
    const t = await traduzir(texto);
    S.ui.chat.splice(S.ui.chat.indexOf(espera), 1);
    let algum = false;
    for (const cmd of t.comandos){
      const r2 = interpretar(cmd, ctxAssistente);
      if (r2.naoEntendi) continue;
      algum = true;
      S.ui.chat.push({ de: "ela", texto: `Entendi como: "${cmd}"\n\n${r2.resp}`, previa: r2.previa ? { ...r2.previa, estado: "pendente" } : null });
    }
    if (!algum) S.ui.chat.push({ de: "ela", texto: t.resposta || r.resp });
  } catch (e){
    S.ui.chat.splice(S.ui.chat.indexOf(espera), 1);
    S.ui.chat.push({ de: "ela", texto: e.message + "\n\n" + r.resp });
  }
}
async function sincronizarGoogle(primeiraVez){
  const g = S.google;
  try {
    if (!googleAtivo()){ const t = await G.pedirAcesso(primeiraVez); g.token = t.token; g.expira = t.expira; }
    g.carregando = true; g.erro = null; render();
    const r = await G.buscar(g.token);
    g.agendas = r.agendas; g.eventos = r.eventos; g.ultimaSync = new Date();
  } catch (e){ g.erro = e.message; if (e.expirou){ g.token = null; } }
  finally { g.carregando = false; render(); }
}

export const acoes = {
  semana: el => { const d = Number(el.dataset.d); S.ui.semana = d === 0 ? 0 : Math.max(-1, Math.min(8, S.ui.semana + d)); render(); },
  subsaude: el => { S.ui.subSaude = el.dataset.s; S.ui.msg = null; render(); },
  "google-conectar": () => sincronizarGoogle(true),
  "google-sync": () => sincronizarGoogle(false),
  "google-sair": () => { G.revogar(S.google.token); S.google = { token: null, expira: 0, agendas: [], eventos: [], ultimaSync: null, erro: null, carregando: false }; aviso("ok", "Google Agenda desconectado. Os eventos foram apagados desta sessão."); },
  "ollama-testar": async () => {
    S.ui.ollamaStatus = { ok: true, texto: "Testando…" }; render();
    try {
      const t = await testarOllama(), m = cfgOllama().modelo;
      S.ui.ollamaStatus = t.tem ? { ok: true, texto: `Conectado. Modelo ${m} encontrado.` } : { ok: false, texto: `Conectado, mas o modelo ${m} não está instalado. Modelos no seu computador: ${t.modelos.join(", ") || "nenhum"}. No Terminal: ollama pull ${m}` };
    } catch (e){ S.ui.ollamaStatus = { ok: false, texto: e.message }; }
    render();
  },
  apagar: async el => { await apagar(el.dataset.id); render(); },
  feita: async el => { const a = lista("aval").find(x => x.id === el.dataset.id); const { id, ...d } = a; await salvar("aval", { ...d, feita: true }, id); aviso("ok", `${a.tipo} de ${a.disc} marcada como feita.`); },
  tomar: async el => { await salvar("dose", { medId: el.dataset.id, data: iso(hoje()), hora: fHora(new Date()) }); render(); },
  "exame-status": async el => { const x = lista("exame").find(e => e.id === el.dataset.id); const ordem = ["Agendado", "Aguardando resultado", "Resultado recebido"]; const { id, ...d } = x; await salvar("exame", { ...d, status: ordem[(ordem.indexOf(x.status) + 1) % ordem.length] }, id); render(); },
  agua: async el => { const hj = iso(hoje()); const a = lista("agua").find(x => x.data === hj); const copos = Math.max(0, (a?.copos || 0) + Number(el.dataset.d)); await salvar("agua", { data: hj, copos }, a?.id); render(); },
  "tirar-disc": async el => { const d = el.dataset.d; await salvarConfig({ disciplinas: config().disciplinas.filter(x => x !== d) }); render(); },
  sugestao: el => enviarChat(el.dataset.t),
  confirmar: async el => {
    const msg = S.ui.chat[Number(el.dataset.i)], p = msg.previa; if (!p || p.estado !== "pendente") return;
    p.estado = "salvando"; render();
    try {
      if (p.acao === "fin") await salvar("fin", p.dados);
      if (p.acao === "aval"){ if (!config().disciplinas.includes(p.dados.disc)) await salvarConfig({ disciplinas: [...config().disciplinas, p.dados.disc] }); await salvar("aval", p.dados); }
      if (p.acao === "rotina") await salvar("rotina", p.dados);
      if (p.acao === "termo"){ for (const t of lista("termo").filter(t => norm(t.termo) === norm(p.dados.termo))) await apagar(t.id); await salvar("termo", p.dados); }
      if (p.acao === "tirar-rotina") await apagar(p.dados.id);
      if (p.acao === "sintoma") await salvar("sintoma", p.dados);
      if (p.acao === "treino") await salvar("treino", p.dados);
      if (p.acao === "agua"){ const hj = iso(hoje()); const a = lista("agua").find(x => x.data === hj); p.dados.total = (a?.copos || 0) + p.dados.copos; await salvar("agua", { data: hj, copos: p.dados.total }, a?.id); }
      for (const c of ["estudo", "med", "dose", "consulta", "exame", "carga", "refeicao"]) if (p.acao === c) await salvar(c, p.dados);
      if (p.acao === "dose-nova"){ const medId = await salvar("med", { nome: p.dados.nome, hora: "", orient: "Uso eventual (como você disse)" }); await salvar("dose", { medId, data: iso(hoje()), hora: p.dados.hora }); }
      if (p.acao === "orcamento") await salvarConfig({ orcamento: { ...config().orcamento, [p.dados.cat]: p.dados.valor } });
      if (p.acao === "disciplina" && !config().disciplinas.includes(p.dados.nome)) await salvarConfig({ disciplinas: [...config().disciplinas, p.dados.nome] });
      if (p.acao === "aval-feita"){ const a = lista("aval").find(x => x.id === p.dados.id); if (a){ const { id, ...d } = a; await salvar("aval", { ...d, feita: true }, id); } }
      if (p.acao === "exame-status"){ const x = lista("exame").find(e => e.id === p.dados.id); if (x){ const { id, ...d } = x; await salvar("exame", { ...d, status: p.dados.status }, id); } }
      p.estado = "salvo";
      S.ui.chat.push({ de: "ela", texto: { fin: "Pronto, lançamento salvo em Finanças.", aval: "Pronto, salvo em Faculdade e já aparece na Agenda.", rotina: "Pronto, entrou na sua rotina e já aparece na Agenda.", termo: `Pronto. Quando você registrar um gasto com "${p.dados.termo}", vou usar a categoria ${p.dados.cat}.`, "tirar-rotina": "Removido da sua rotina.", sintoma: "Pronto, anotado no seu diário de sintomas (Saúde → Tratamento). Leve o diário à consulta.", treino: "Pronto, treino registrado em Saúde → Treino.", agua: `Pronto. Hoje você já tomou ${p.dados.total} copo(s) de água.`, estudo: "Pronto, horas de estudo registradas em Faculdade.", orcamento: `Pronto, limite de ${p.dados.cat} atualizado em Finanças.`, disciplina: `Pronto, ${p.dados.nome} entrou na sua lista de disciplinas.`, "aval-feita": "Pronto, marcada como feita em Faculdade.", med: "Pronto, remédio cadastrado em Saúde → Tratamento (só registro).", dose: "Pronto, dose marcada como tomada hoje.", "dose-nova": `Pronto, ${p.dados.nome} cadastrado em Saúde → Tratamento e marcado como tomado hoje.`, consulta: "Pronto, consulta salva em Saúde e já aparece na Agenda.", exame: "Pronto, exame salvo em Saúde → Tratamento.", "exame-status": "Pronto, situação do exame atualizada.", carga: "Pronto, carga registrada em Saúde → Treino.", refeicao: "Pronto, refeição registrada em Saúde → Alimentação e água." }[p.acao] });
    } catch (e){ p.estado = "pendente"; S.ui.chat.push({ de: "ela", texto: "Não consegui salvar: " + e.message }); }
    render(); const c = $("#chat"); if (c) c.scrollTop = c.scrollHeight;
  },
  cancelar: el => { const p = S.ui.chat[Number(el.dataset.i)].previa; p.estado = "cancelado"; S.ui.chat.push({ de: "ela", texto: "Cancelado. Nada foi salvo." }); render(); }
};
export const mudancas = {
  "agenda-visivel": async el => { const o = new Set(config().agendasOcultas); el.checked ? o.delete(el.dataset.id) : o.add(el.dataset.id); await salvarConfig({ agendasOcultas: [...o] }); render(); },
  lembrete: async el => { await salvarConfig({ lembreteMensal: el.checked }); aviso("ok", el.checked ? "Lembrete mensal de backup ligado." : "Lembrete mensal desligado."); }
};

const comData = (s, h) => deIso(s, h).toISOString();
export const formularios = {
  lancamento: async (fd, form) => {
    const valor = valorBR(fd.get("valor")); if (!(valor > 0)) return erroForm(form, "Digite um valor válido, por exemplo 35,00.");
    const tipo = fd.get("tipo");
    await salvar("fin", { tipo, valor, desc: String(fd.get("desc")).trim(), cat: tipo === "receita" ? "Receita" : String(fd.get("cat")), data: comData(fd.get("data"), "12:00") });
    aviso("ok", `${tipo === "receita" ? "Receita" : "Despesa"} de ${brl(valor)} adicionada.`);
  },
  orcamento: async fd => { const o = {}; for (const [k, v] of fd.entries()){ const n = valorBR(v); o[k] = n >= 0 ? n : 0; } await salvarConfig({ orcamento: o }); aviso("ok", "Limites do orçamento salvos."); },
  avaliacao: async fd => { await salvar("aval", { tipo: String(fd.get("tipo")), disc: String(fd.get("disc")), titulo: String(fd.get("titulo")), data: comData(fd.get("data"), fd.get("hora") || "08:00"), feita: false }); aviso("ok", "Adicionado. Já aparece na Agenda."); },
  estudo: async (fd, form) => { const h = valorBR(fd.get("horas")); if (!(h > 0)) return erroForm(form, "Digite as horas, por exemplo 1,5."); await salvar("estudo", { disc: String(fd.get("disc")), horas: h, data: new Date().toISOString() }); aviso("ok", `${h.toLocaleString("pt-BR")} h de ${fd.get("disc")} registradas.`); },
  disciplina: async fd => { const nome = String(fd.get("nome")).trim(); if (!nome || config().disciplinas.includes(nome)) return; await salvarConfig({ disciplinas: [...config().disciplinas, nome] }); render(); },
  med: async fd => { await salvar("med", { nome: String(fd.get("nome")).trim(), hora: String(fd.get("hora") || ""), orient: String(fd.get("orient") || "").trim() || "Conforme prescrição médica" }); aviso("ok", "Medicamento cadastrado (só registro)."); },
  consulta: async fd => { await salvar("consulta", { titulo: String(fd.get("titulo")).trim(), data: comData(fd.get("data"), fd.get("hora") || "09:00"), nota: String(fd.get("nota") || "") }); aviso("ok", "Consulta adicionada. Já aparece na Agenda."); },
  exame: async fd => { await salvar("exame", { titulo: String(fd.get("titulo")).trim(), data: comData(fd.get("data"), "08:00"), status: String(fd.get("status")) }); aviso("ok", "Exame adicionado."); },
  sintoma: async fd => { await salvar("sintoma", { data: new Date().toISOString(), sintoma: String(fd.get("sintoma")).trim(), intens: Number(fd.get("intens")), nota: String(fd.get("nota") || "") }); aviso("ok", "Sintoma registrado no diário."); },
  carga: async (fd, form) => {
    const exercicio = String(fd.get("exercicio") || "").trim(); if (!exercicio) return erroForm(form, "Digite o nome do exercício.");
    const peso = valorBR(fd.get("peso")); if (!(peso >= 0) || String(fd.get("peso")).trim() === "") return erroForm(form, "Digite o peso em kg, por exemplo 22,5.");
    const int = n => { const v = parseInt(fd.get(n), 10); return v > 0 ? v : null; };
    const d = fd.get("data") || iso(hoje()); S.ui.dataCarga = d;
    await salvar("carga", { data: comData(d, "12:00"), exercicio, peso, series: int("series"), reps: int("reps"), nota: String(fd.get("nota") || "").trim() });
    aviso("ok", `${exercicio}: ${peso.toLocaleString("pt-BR")} kg registrado.`);
  },
  treino: async (fd, form) => { const min = parseInt(fd.get("min"), 10); if (!(min > 0)) return erroForm(form, "Digite a duração em minutos."); await salvar("treino", { data: comData(fd.get("data") || iso(hoje()), "12:00"), tipo: String(fd.get("tipo")).trim(), min }); aviso("ok", "Treino registrado."); },
  refeicao: async fd => { await salvar("refeicao", { data: iso(hoje()), quando: String(fd.get("quando")), texto: String(fd.get("texto")).trim() }); aviso("ok", "Refeição registrada."); },
  chat: async (fd, form) => { const t = String(fd.get("t")); form.reset(); await enviarChat(t); },
  ollama: async fd => { salvarOllama({ ativo: fd.get("ativo") === "on", url: String(fd.get("url")).trim() || "http://localhost:11434", modelo: String(fd.get("modelo")).trim() || "qwen2.5:3b" }); S.ui.ollamaStatus = null; aviso("ok", "Configuração da IA local salva neste aparelho."); },
  logout: async fd => { await salvarConfig({ logoutMin: Number(fd.get("min")) }); aviso("ok", "Tempo de logout automático salvo."); }
};
