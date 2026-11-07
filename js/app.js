// Ponto de entrada: telas de acesso (cadastro, login, recuperação), estrutura do app,
// eventos, logout automático e backup.
import { $, esc, msgHtml, erroForm, fDuracao, fTempo, definirAlertaGlobal } from "./util.js";
import * as C from "./cripto.js";
import * as N from "./nuvem.js";
import { S, carregar, limpar, config, salvarConfig } from "./dados.js";
import { telaModulo, acoes as acoesModulos, mudancas, formularios as formModulos, definirRender } from "./telas.js";
import * as G from "./google.js";

const raiz = $("#app");
let ultimaAtividade = Date.now();
const A = { tela: "login", msg: null, email: "", chaveRec: null, depoisRec: null, aposReset: false, reset: null };

/* ---------- Ícones e navegação ---------- */
const IC = {
  inicio: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  financas: "M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM3 7l12-4v4M16 13h2",
  faculdade: "M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5",
  agenda: "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5",
  saude: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
  assistente: "M4 5h16v11H9l-5 4z",
  perfil: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6"
};
const ABAS = [["inicio", "Início"], ["financas", "Finanças"], ["faculdade", "Faculdade"], ["agenda", "Agenda"], ["saude", "Saúde"], ["assistente", "Assistente"], ["perfil", "Perfil"]];
const icone = k => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="${IC[k]}"/></svg>`;
const cadeado = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2.5" stroke="currentColor" stroke-width="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="2"/></svg>`;

/* ---------- Telas de acesso ---------- */
function campoSenha(id, rotulo, ajuda = "", auto = "new-password"){
  return `<label for="${id}">${rotulo}${ajuda ? ` <small>${ajuda}</small>` : ""}<input type="password" id="${id}" name="${id}" autocomplete="${auto}" data-forca="${id}-forca" required></label>
  <div class="forca" id="${id}-forca"><div class="trilho"><i></i></div><span>Digite uma senha</span></div>`;
}
const TA = {
  login: () => `<h2>Entrar</h2>
    <form data-form="login" novalidate><div class="form-msg"></div>
      <label for="l-email">E-mail<input type="email" id="l-email" name="email" value="${esc(A.email)}" autocomplete="email" required></label>
      <label for="l-senha">Senha<input type="password" id="l-senha" name="senha" autocomplete="current-password" required></label>
      <button class="btn" type="submit">Entrar</button></form>
    <div class="linha"><button class="btn link" data-acao="auth" data-t="esqueci">Esqueci a senha</button><span class="nota">·</span><button class="btn link" data-acao="auth" data-t="cadastro">Criar conta</button></div>`,
  cadastro: () => `<h2>Criar conta</h2>
    <p class="nota">Sua senha abre o login e também o cofre dos seus dados. Ela nunca sai deste aparelho.</p>
    <form data-form="cadastro" novalidate><div class="form-msg"></div>
      <label for="c-email">E-mail<input type="email" id="c-email" name="email" value="${esc(A.email)}" autocomplete="email" required></label>
      ${campoSenha("c-senha", "Senha", "mínimo 14 caracteres ou 5 palavras")}
      <label for="c-senha2">Repita a senha<input type="password" id="c-senha2" name="senha2" autocomplete="new-password" required></label>
      <div class="linha"><button type="button" class="btn link" data-acao="gerar-frase">Gerar frase-senha</button><span class="nota">(anote antes de continuar)</span></div>
      <button class="btn" type="submit">Criar conta</button></form>
    <div class="linha"><span class="nota">Já tem conta?</span><button class="btn link" data-acao="auth" data-t="login">Entrar</button></div>`,
  recuperacao: () => `<h2>${A.aposReset ? "Sua NOVA chave de recuperação" : "Sua chave de recuperação"}</h2>
    <p class="nota">Imprima ou anote no papel e guarde num lugar seguro. Ela aparece <b>só esta vez</b>. Se você esquecer a senha, é ela que salva seus dados. Sem a senha e sem esta chave, ninguém consegue abrir seus dados, nem você.</p>
    ${A.aposReset ? `<div class="msg aviso">A chave antiga continua servindo só para desbloquear os dados antigos, se você encontrá-la.</div>` : ""}
    <div class="chave" id="chave-rec">${esc(A.chaveRec)}</div>
    <div class="linha"><button class="btn sec peq" data-acao="copiar-chave">Copiar</button><button class="btn sec peq" data-acao="imprimir-chave">Imprimir</button><span id="copiado" class="nota" aria-live="polite"></span></div>
    <form data-form="confirmar-chave" novalidate><div class="form-msg"></div>
      <label for="k-bloco">Para confirmar que anotou, digite o último bloco (4 caracteres)<input type="text" id="k-bloco" name="bloco" maxlength="4" autocomplete="off" required></label>
      <button class="btn" type="submit">Anotei, continuar</button></form>`,
  "confirmar-email": () => `<h2>Confirme seu e-mail</h2>
    <p>Enviamos um link de confirmação para <b>${esc(A.email)}</b>. Abra o e-mail (olhe também o spam), clique no link e depois volte para entrar.</p>
    <button class="btn" data-acao="auth" data-t="login">Ir para o login</button>`,
  esqueci: () => `<h2>Esqueci a senha</h2>
    <p class="nota">Você vai receber um link por e-mail. A página de senha nova é do próprio MY LIFE, para que a senha nunca saia do aparelho. Tenha em mãos a chave de recuperação impressa.</p>
    <form data-form="esqueci" novalidate><div class="form-msg"></div>
      <label for="e-email">E-mail<input type="email" id="e-email" name="email" value="${esc(A.email)}" required></label>
      <button class="btn" type="submit">Enviar link</button></form>
    <button class="btn link" data-acao="auth" data-t="login">Voltar ao login</button>`,
  "reset-senha": () => `<h2>Criar senha nova</h2>
    <p class="nota">Conta: <b>${esc(A.reset.email)}</b></p>
    <form data-form="reset-senha" novalidate><div class="form-msg"></div>
      ${campoSenha("r-senha", "Senha nova")}
      <label for="r-senha2">Repita a senha nova<input type="password" id="r-senha2" name="senha2" autocomplete="new-password" required></label>
      <div class="linha"><button type="button" class="btn link" data-acao="gerar-frase-reset">Gerar frase-senha</button></div>
      <button class="btn" type="submit">Salvar senha nova</button></form>`,
  "reset-chave": () => `<h2>Recuperar seus dados</h2>
    <p>A senha nova já está valendo. Agora digite a <b>chave de recuperação impressa</b> para manter seus dados.</p>
    <form data-form="reset-chave" novalidate><div class="form-msg"></div>
      <label for="rk-k">Chave de recuperação<input id="rk-k" name="chave" autocomplete="off" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" required></label>
      <button class="btn" type="submit">Recuperar meus dados</button></form>
    <details><summary>Não tenho a chave</summary>
      <div class="msg aviso" style="margin-top:8px"><b>Sem a chave de recuperação, seus dados criptografados antigos não poderão ser abertos.</b> Você entrará com um cofre novo e vazio. Os dados antigos ficam guardados como <b>bloqueados</b>, e você pode desbloqueá-los depois se encontrar a chave.</div>
      <form data-form="reset-sem-chave" novalidate style="margin-top:8px"><div class="form-msg"></div>
        <label class="chk" for="rs-ok"><input type="checkbox" id="rs-ok" name="ok"> Entendi e quero continuar sem a chave</label>
        <button class="btn perigo" type="submit">Continuar sem a chave</button></form>
    </details>`,
  mensagem: () => `<div class="linha"><button class="btn" data-acao="auth" data-t="login">Ir para o login</button></div>`
};
function telaAcesso(){
  return `<main class="acesso"><div class="cartao acesso-cartao">
    <div class="marca grande">${cadeado} MY LIFE</div>
    ${msgHtml(A.msg)}
    ${TA[A.tela]()}
    <p class="nota rodape">Seus dados são cifrados neste aparelho antes de ir para a nuvem.</p>
  </div><div class="ocupado" id="ocupado" role="status" aria-live="polite"><div><div class="giro"></div><div id="ocupado-txt">Processando…</div></div></div></main>`;
}

function shell(){
  const nav = ABAS.map(([k, t]) => `<button class="nav-item" data-acao="aba" data-aba="${k}" ${S.ui.aba === k ? 'aria-current="page"' : ""}>${icone(k)}<span>${t}</span></button>`).join("");
  return `<div class="casca">
    <nav class="lateral" aria-label="Módulos"><div class="marca">${cadeado} MY LIFE</div>${nav}
      <div class="lateral-rodape"><span class="pill neutro">Sai em <span class="contagem">${fTempo(config().logoutMin * 60000)}</span> sem uso</span><button class="btn sec peq" data-acao="sair">Sair</button></div></nav>
    <main class="conteudo"><div class="topo-movel"><div class="marca">${cadeado} MY LIFE</div><button class="btn sec peq" data-acao="sair">Sair</button></div>${telaModulo()}</main>
  </div><nav class="inferior" aria-label="Módulos">${nav}</nav>
  <div class="ocupado" id="ocupado" role="status" aria-live="polite"><div><div class="giro"></div><div id="ocupado-txt">Processando…</div></div></div>`;
}

export function render(){
  raiz.innerHTML = S.sessao ? shell() : telaAcesso();
  S.ui.msg = null;
}
definirRender(render);
definirAlertaGlobal((tipo, texto) => { if (S.sessao){ S.ui.msg = { tipo, texto }; } else { A.msg = { tipo, texto }; } render(); });

function irAcesso(tela, msg = null){ A.tela = tela; A.msg = msg; render(); window.scrollTo(0, 0); }
function ocupado(on, txt){ const o = $("#ocupado"); if (!o) return; o.classList.toggle("on", on); if (txt) $("#ocupado-txt").textContent = txt; }
async function comOcupado(txt, fn){ ocupado(true, txt); await new Promise(r => setTimeout(r, 30)); try { return await fn(); } finally { ocupado(false); } }

async function abrirSessao(sessao){
  S.sessao = sessao; ultimaAtividade = Date.now();
  await carregar();
  S.ui.aba = "inicio"; A.msg = null;
  render();
}
async function encerrar(msg){
  G.revogar(S.google.token);
  limpar(); await N.sair();
  irAcesso("login", msg);
}

/* ---------- Formulários de acesso e conta ---------- */
const formAcesso = {
  async cadastro(fd, form){
    const email = String(fd.get("email")).trim().toLowerCase(), senha = String(fd.get("c-senha")), senha2 = String(fd.get("senha2"));
    A.email = email;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return erroForm(form, "Digite um e-mail válido.");
    if (!C.forcaSenha(senha).forte) return erroForm(form, "Senha fraca. Use pelo menos 14 caracteres ou uma frase de 5 palavras.");
    if (senha !== senha2) return erroForm(form, "As duas senhas não são iguais.");
    await comOcupado("Criando sua conta e o cofre (600.000 iterações)…", async () => {
      try { const r = await N.cadastrar(email, senha); A.chaveRec = r.chaveRecuperacao; A.depoisRec = "confirmar-email"; A.aposReset = false; irAcesso("recuperacao"); }
      catch (e){ erroForm(form, N.traduzirErro(e)); }
    });
  },
  "confirmar-chave"(fd, form){
    if (String(fd.get("bloco")).trim().toUpperCase() !== A.chaveRec.split("-").pop()) return erroForm(form, "Bloco diferente. Confira o que você anotou.");
    A.chaveRec = null;
    if (A.depoisRec === "app") return abrirSessao(A.sessaoPendente);
    irAcesso(A.depoisRec);
  },
  async login(fd, form){
    const email = String(fd.get("email")).trim().toLowerCase(), senha = String(fd.get("senha"));
    A.email = email;
    if (!email || !senha) return erroForm(form, "Preencha e-mail e senha.");
    await comOcupado("Conferindo a senha neste aparelho…", async () => {
      try {
        const r = await N.entrar(email, senha);
        if (r.naoVerificado){
          A.senhaReenvio = senha;
          form.querySelector(".form-msg").innerHTML = msgHtml({ tipo: "aviso", html: `Confirme seu e-mail antes de entrar (olhe também o spam). <button type="button" class="btn link" data-acao="reenviar">Reenviar e-mail de confirmação</button>` });
          return;
        }
        await abrirSessao(r);
      } catch (e){ erroForm(form, N.traduzirErro(e)); }
    });
  },
  async esqueci(fd, form){
    const email = String(fd.get("email")).trim().toLowerCase(); A.email = email;
    await comOcupado("Enviando…", async () => {
      try { await N.pedirNovaSenha(email); irAcesso("login", { tipo: "ok", texto: "Se houver uma conta com esse e-mail, enviamos o link. Olhe também o spam." }); }
      catch (e){ erroForm(form, N.traduzirErro(e)); }
    });
  },
  async "reset-senha"(fd, form){
    const senha = String(fd.get("r-senha")), senha2 = String(fd.get("senha2"));
    if (!C.forcaSenha(senha).forte) return erroForm(form, "Senha fraca. Use pelo menos 14 caracteres ou uma frase de 5 palavras.");
    if (senha !== senha2) return erroForm(form, "As duas senhas não são iguais.");
    await comOcupado("Salvando a senha nova…", async () => {
      try { A.reset.ctx = await N.redefinirSenha(A.reset.codigo, A.reset.email, senha); history.replaceState(null, "", location.pathname); irAcesso("reset-chave"); }
      catch (e){ erroForm(form, N.traduzirErro(e)); }
    });
  },
  async "reset-chave"(fd, form){
    await comOcupado("Abrindo o cofre com a chave de recuperação…", async () => {
      try { const sessao = await N.recuperarComChave(A.reset.ctx, String(fd.get("chave"))); A.reset = null; await abrirSessao(sessao); S.ui.msg = { tipo: "ok", texto: "Senha trocada e dados recuperados." }; render(); }
      catch (e){ erroForm(form, e.code?.startsWith("chave") ? e.message : N.traduzirErro(e)); }
    });
  },
  async "reset-sem-chave"(fd, form){
    if (fd.get("ok") !== "on") return erroForm(form, "Marque a caixa para confirmar que entendeu.");
    await comOcupado("Criando um cofre novo…", async () => {
      try {
        const r = await N.recuperarSemChave(A.reset.ctx);
        A.reset = null; A.sessaoPendente = r.sessao; A.chaveRec = r.chaveRecuperacao; A.depoisRec = "app"; A.aposReset = true;
        irAcesso("recuperacao", r.bloqueados ? { tipo: "aviso", texto: `${r.bloqueados} registro(s) antigo(s) ficaram bloqueados.` } : null);
      } catch (e){ erroForm(form, N.traduzirErro(e)); }
    });
  }
};

const formConta = {
  async exportar(fd, form){
    const senha = String(fd.get("senha")), arq = String(fd.get("arq")), arq2 = String(fd.get("arq2"));
    if (arq.length < 10) return erroForm(form, "A senha do arquivo precisa ter pelo menos 10 caracteres.");
    if (arq !== arq2) return erroForm(form, "As senhas do arquivo não são iguais.");
    await comOcupado("Conferindo e cifrando o backup…", async () => {
      try {
        await N.conferirSenha(S.sessao.email, senha);
        const sal = C.rnd(16), k = await C.chaveDeBackup(arq, sal);
        const corpo = new TextEncoder().encode(JSON.stringify({ itens: S.itens.map(i => ({ id: i.id, colecao: i.colecao, dados: i.dados })) }));
        const arquivo = { formato: "mylife-backup", versao: 1, criadoEm: new Date().toISOString(), iteracoes: 600000, sal: C.b64(sal), dados: await C.cifrarBytes(k, corpo) };
        const blob = new Blob([JSON.stringify(arquivo)], { type: "application/json" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
        a.download = `mylife-backup-${new Date().toISOString().slice(0, 10)}.mylife.json`; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        await salvarConfig({ ultimoBackup: new Date().toISOString() });
        S.ui.msg = { tipo: "ok", texto: "Backup baixado. Guarde o arquivo e a senha dele em lugares diferentes." }; render();
      } catch (e){ erroForm(form, N.traduzirErro(e)); }
    });
  },
  async importar(fd, form){
    const f = fd.get("arquivo"), arq = String(fd.get("arq"));
    if (!f || !f.size) return erroForm(form, "Escolha o arquivo de backup.");
    if (fd.get("ok") !== "on") return erroForm(form, "Marque a confirmação.");
    await comOcupado("Abrindo o backup…", async () => {
      let itens;
      try {
        const j = JSON.parse(await f.text());
        if (j.formato !== "mylife-backup") throw new Error("formato");
        const k = await C.chaveDeBackup(arq, C.unb64(j.sal));
        itens = JSON.parse(new TextDecoder().decode(await C.decifrarBytes(k, j.dados))).itens;
      } catch { return erroForm(form, "Não consegui abrir: o arquivo não é um backup do MY LIFE ou a senha está errada."); }
      try { await N.substituirTudo(S.sessao, itens); await carregar(); S.ui.msg = { tipo: "ok", texto: `Backup restaurado: ${itens.length} registro(s).` }; render(); }
      catch (e){ erroForm(form, N.traduzirErro(e)); }
    });
  },
  async desbloquear(fd, form){
    await comOcupado("Abrindo os dados antigos…", async () => {
      try { const n = await N.desbloquear(S.sessao, S.bloqueados, String(fd.get("chave"))); await carregar(); S.ui.msg = { tipo: "ok", texto: `${n} registro(s) desbloqueado(s).` }; render(); }
      catch (e){ erroForm(form, e.message); }
    });
  },
  async excluir(fd, form){
    if (String(fd.get("conf")).trim() !== "EXCLUIR") return erroForm(form, "Digite EXCLUIR, em maiúsculas, para confirmar.");
    await comOcupado("Excluindo…", async () => {
      try { await N.conferirSenha(S.sessao.email, String(fd.get("senha"))); await N.excluirConta(S.sessao); limpar(); irAcesso("login", { tipo: "ok", texto: "Conta e dados excluídos." }); }
      catch (e){ erroForm(form, N.traduzirErro(e)); }
    });
  }
};

const acoesAcesso = {
  aba: el => { S.ui.aba = el.dataset.aba; S.ui.msg = null; render(); window.scrollTo(0, 0); },
  auth: el => irAcesso(el.dataset.t),
  sair: () => encerrar({ tipo: "ok", texto: "Você saiu. A chave dos seus dados foi apagada da memória deste aparelho." }),
  "gerar-frase": () => preencherFrase("#c-senha", "[name=senha2]"),
  "gerar-frase-reset": () => preencherFrase("#r-senha", "#r-senha2"),
  async "copiar-chave"(){ try { await navigator.clipboard.writeText(A.chaveRec); $("#copiado").textContent = "Copiada."; } catch { $("#copiado").textContent = "Não consegui copiar. Anote à mão."; } },
  "imprimir-chave"(){ const w = window.open("", "_blank", "width=600,height=400"); if (!w){ $("#copiado").textContent = "O navegador bloqueou a janela. Anote à mão."; return; } w.document.write(`<title>Chave de recuperação MY LIFE</title><body style="font-family:sans-serif;padding:24px"><h2>MY LIFE · chave de recuperação</h2><p>Conta: ${esc(A.email)}</p><p style="font:20px monospace;letter-spacing:2px">${esc(A.chaveRec)}</p><p>Guarde em lugar seguro. Não fotografe nem salve no celular.</p></body>`); w.document.close(); w.print(); },
  async reenviar(){ await comOcupado("Reenviando…", async () => { try { await N.reenviarConfirmacao(A.email, A.senhaReenvio); A.senhaReenvio = null; irAcesso("login", { tipo: "ok", texto: "Enviamos de novo. Olhe a caixa de entrada e o spam." }); } catch (e){ irAcesso("login", { tipo: "erro", texto: N.traduzirErro(e) }); } }); }
};
function preencherFrase(a, b){ const f = C.gerarFraseSenha(); const x = $(a), y = $(b); x.value = f; y.value = f; x.type = "text"; y.type = "text"; atualizarForca(x); }
function atualizarForca(input){
  const alvo = document.getElementById(input.dataset.forca); if (!alvo) return;
  const f = C.forcaSenha(input.value), barra = alvo.querySelector("i");
  barra.style.width = (input.value ? f.pontos : 0) + "%";
  barra.style.background = f.forte ? "var(--ok)" : f.pontos > 35 ? "var(--warn)" : "var(--bad)";
  alvo.querySelector("span").textContent = input.value ? f.texto : "Digite uma senha";
}

/* ---------- Eventos ---------- */
const todasAcoes = { ...acoesModulos, ...acoesAcesso };
const todosForms = { ...formModulos, ...formAcesso, ...formConta };
document.addEventListener("click", async e => {
  const el = e.target.closest("[data-acao]"); if (!el || el.disabled || el.tagName === "SELECT" || el.type === "checkbox") return;
  try { await todasAcoes[el.dataset.acao]?.(el); } catch (err){ console.error(err); S.ui.msg = { tipo: "erro", texto: N.traduzirErro(err) }; render(); }
});
document.addEventListener("submit", async e => {
  const f = e.target.closest("form[data-form]"); if (!f) return; e.preventDefault();
  const btn = f.querySelector("[type=submit]"); if (btn) btn.disabled = true;
  try { await todosForms[f.dataset.form]?.(new FormData(f), f); }
  catch (err){ console.error(err); ocupado(false); erroForm(f, N.traduzirErro(err)); }
  finally { if (btn && document.body.contains(btn)) btn.disabled = false; }
});
document.addEventListener("change", async e => {
  const k = e.target.dataset?.acaoChange; if (!k) return;
  try { await mudancas[k]?.(e.target); } catch (err){ console.error(err); S.ui.msg = { tipo: "erro", texto: N.traduzirErro(err) }; render(); }
});
document.addEventListener("input", e => { if (e.target.dataset?.forca) atualizarForca(e.target); });
["pointerdown", "keydown", "input", "scroll"].forEach(ev => document.addEventListener(ev, () => { ultimaAtividade = Date.now(); }, { passive: true }));

setInterval(() => {
  if (!S.sessao) return;
  const limite = config().logoutMin * 60000, resta = limite - (Date.now() - ultimaAtividade);
  if (resta <= 0){ encerrar({ tipo: "aviso", texto: `Você saiu automaticamente após ${fDuracao(limite)} sem uso. Esse controle é feito pelo app neste aparelho.` }); return; }
  document.querySelectorAll(".contagem").forEach(c => { c.textContent = fTempo(resta); });
}, 1000);

/* ---------- Links dos e-mails (confirmação e senha nova) ---------- */
async function tratarLink(){
  const p = new URLSearchParams(location.search);
  const modo = p.get("mode"), codigo = p.get("oobCode");
  if (!modo || !codigo) return false;
  if (modo === "verifyEmail"){
    try { await N.confirmarEmailPorLink(codigo); irAcesso("login", { tipo: "ok", texto: "E-mail confirmado. Agora você pode entrar." }); }
    catch (e){ irAcesso("login", { tipo: "erro", texto: N.traduzirErro(e) }); }
    history.replaceState(null, "", location.pathname);
    return true;
  }
  if (modo === "resetPassword"){
    try { const email = await N.emailDoLinkDeSenha(codigo); A.reset = { codigo, email }; A.email = email; irAcesso("reset-senha"); }
    catch (e){ history.replaceState(null, "", location.pathname); irAcesso("login", { tipo: "erro", texto: N.traduzirErro(e) }); }
    return true;
  }
  return false;
}

/* ---------- Início ---------- */
if (!window.crypto?.subtle){ raiz.innerHTML = `<main class="acesso"><div class="msg erro">Este navegador não tem as ferramentas de criptografia necessárias. Use um navegador atualizado (Chrome, Edge, Firefox ou Safari).</div></main>`; }
else {
  await N.sair();
  if (!(await tratarLink())) render();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
}
