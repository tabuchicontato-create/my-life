// Conversa com o Firebase (login e banco). Tudo que vai para o banco já sai cifrado daqui.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, setPersistence, browserSessionPersistence, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, verifyPasswordResetCode, confirmPasswordReset, applyActionCode,
  signOut, reauthenticateWithCredential, EmailAuthProvider, deleteUser
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { FIREBASE, APP_URL } from "./config.js";
import * as C from "./cripto.js";

const app = initializeApp(FIREBASE);
export const auth = getAuth(app);
auth.languageCode = "pt-BR";
const db = getFirestore(app);
await setPersistence(auth, browserSessionPersistence);

const acaoEmail = { url: APP_URL, handleCodeInApp: false };
const refUsuario = uid => doc(db, "users", uid);
const refItens = uid => collection(db, "users", uid, "itens");
const refItem = (uid, id) => doc(db, "users", uid, "itens", id);

export function traduzirErro(e){
  const c = e?.code || "";
  const mapa = {
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/invalid-login-credentials": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Já existe uma conta com esse e-mail. Use \"Entrar\" ou \"Esqueci a senha\".",
    "auth/invalid-email": "Esse e-mail não parece válido.",
    "auth/too-many-requests": "Muitas tentativas seguidas. O Google bloqueou por alguns minutos por segurança. Tente de novo mais tarde.",
    "auth/network-request-failed": "Sem conexão com a internet. Verifique e tente de novo.",
    "auth/expired-action-code": "Esse link expirou. Peça um novo.",
    "auth/invalid-action-code": "Esse link já foi usado ou não é válido. Peça um novo.",
    "auth/requires-recent-login": "Por segurança, entre de novo antes de fazer isso.",
    "auth/operation-not-allowed": "Esse tipo de login não está ativado no Firebase.",
    "auth/admin-restricted-operation": "Novos cadastros estão bloqueados neste app.",
    "permission-denied": "O banco recusou o acesso (regra de segurança). Se você acabou de confirmar o e-mail, saia e entre de novo."
  };
  return mapa[c] || (e?.message ? "Erro: " + e.message : "Algo deu errado.");
}

// ---------- Conta ----------
export async function cadastrar(email, senha){
  const { senhaLogin, kek } = await C.derivarFilhas(email, senha);
  const cred = await createUserWithEmailAndPassword(auth, email, senhaLogin);
  const dek = await C.novaChaveDados(); const raw = await C.exportarChave(dek);
  const rec = C.novaChaveRecuperacao(); const kr = await C.chaveDaRecuperacao(rec.bytes);
  const cofre = { geracao: 1, porSenha: await C.cifrarBytes(kek, raw), porRecuperacao: { "1": await C.cifrarBytes(kr, raw) } };
  raw.fill(0);
  await setDoc(refUsuario(cred.user.uid), { versao: 1, cofre, criadoEm: serverTimestamp() });
  await sendEmailVerification(cred.user, acaoEmail);
  await signOut(auth);
  return { chaveRecuperacao: rec.texto };
}

export async function reenviarConfirmacao(email, senha){
  const { senhaLogin } = await C.derivarFilhas(email, senha);
  const cred = await signInWithEmailAndPassword(auth, email, senhaLogin);
  await sendEmailVerification(cred.user, acaoEmail);
  await signOut(auth);
}

// Entra e abre o cofre. Devolve { uid, email, dek, cofre } ou { naoVerificado: true }.
export async function entrar(email, senha){
  const { senhaLogin, kek } = await C.derivarFilhas(email, senha);
  const cred = await signInWithEmailAndPassword(auth, email, senhaLogin);
  await cred.user.reload();
  if (!auth.currentUser.emailVerified){ await signOut(auth); return { naoVerificado: true }; }
  await auth.currentUser.getIdToken(true);
  const snap = await getDoc(refUsuario(cred.user.uid));
  if (!snap.exists()) throw new Error("Cofre não encontrado para esta conta.");
  const cofre = snap.data().cofre;
  const raw = await C.decifrarBytes(kek, cofre.porSenha);
  const dek = await C.importarChave(raw); raw.fill(0);
  return { uid: cred.user.uid, email, dek, cofre };
}

export async function conferirSenha(email, senha){
  const { senhaLogin } = await C.derivarFilhas(email, senha);
  await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(email, senhaLogin));
}

export const sair = () => signOut(auth).catch(() => {});

export async function pedirNovaSenha(email){
  try { await sendPasswordResetEmail(auth, email, acaoEmail); } catch (e){ if (e.code !== "auth/user-not-found" && e.code !== "auth/invalid-email") throw e; }
}

export const confirmarEmailPorLink = codigo => applyActionCode(auth, codigo);
export const emailDoLinkDeSenha = codigo => verifyPasswordResetCode(auth, codigo);

// Fase 1 da redefinição: troca a senha de login e entra.
export async function redefinirSenha(codigo, email, senhaNova){
  const { senhaLogin, kek } = await C.derivarFilhas(email, senhaNova);
  await confirmPasswordReset(auth, codigo, senhaLogin);
  const cred = await signInWithEmailAndPassword(auth, email, senhaLogin);
  await cred.user.reload(); await auth.currentUser.getIdToken(true);
  const snap = await getDoc(refUsuario(cred.user.uid));
  return { uid: cred.user.uid, email, kek, cofre: snap.data().cofre, verificado: auth.currentUser.emailVerified };
}

// Fase 2a: tem a chave de recuperação -> tranca a mesma chave de dados com a senha nova.
export async function recuperarComChave(ctx, chaveTexto){
  const bytes = C.deB32(chaveTexto);
  if (!bytes) throw Object.assign(new Error("Formato da chave inválido. São 32 caracteres, em 8 blocos de 4."), { code: "chave-formato" });
  let raw;
  try { raw = await C.decifrarBytes(await C.chaveDaRecuperacao(bytes), ctx.cofre.porRecuperacao[String(ctx.cofre.geracao)]); }
  catch { throw Object.assign(new Error("Chave de recuperação incorreta. Confira o que você anotou."), { code: "chave-errada" }); }
  const cofre = { ...ctx.cofre, porSenha: await C.cifrarBytes(ctx.kek, raw) };
  await setDoc(refUsuario(ctx.uid), { cofre }, { merge: true });
  const dek = await C.importarChave(raw); raw.fill(0);
  return { uid: ctx.uid, email: ctx.email, dek, cofre };
}

// Fase 2b: sem a chave -> cofre novo; dados antigos ficam "bloqueados".
export async function recuperarSemChave(ctx){
  const dek = await C.novaChaveDados(); const raw = await C.exportarChave(dek);
  const rec = C.novaChaveRecuperacao(); const kr = await C.chaveDaRecuperacao(rec.bytes);
  const g = ctx.cofre.geracao + 1;
  const cofre = { geracao: g, porSenha: await C.cifrarBytes(ctx.kek, raw), porRecuperacao: { ...ctx.cofre.porRecuperacao, [String(g)]: await C.cifrarBytes(kr, raw) } };
  raw.fill(0);
  await setDoc(refUsuario(ctx.uid), { cofre }, { merge: true });
  let docs = { docs: [] };
  try { docs = await getDocs(refItens(ctx.uid)); } catch { /* conta ainda sem e-mail confirmado: não há registros */ }
  let n = 0, lote = writeBatch(db), noLote = 0;
  for (const d of docs.docs){
    if (d.data().estado !== "ativo") continue;
    lote.set(d.ref, { ...d.data(), estado: "bloqueado" }); n++; noLote++;
    if (noLote === 400){ await lote.commit(); lote = writeBatch(db); noLote = 0; }
  }
  if (noLote) await lote.commit();
  return { sessao: { uid: ctx.uid, email: ctx.email, dek, cofre }, chaveRecuperacao: rec.texto, bloqueados: n };
}

// ---------- Dados ----------
export async function carregarItens(sessao){
  const docs = await getDocs(refItens(sessao.uid));
  const ativos = [], bloqueados = [];
  for (const d of docs.docs){
    const x = d.data();
    if (x.estado === "bloqueado"){ bloqueados.push({ id: d.id, ...x }); continue; }
    try { ativos.push({ id: d.id, colecao: x.colecao, dados: await C.decifrarJSON(sessao.dek, x.conteudo) }); }
    catch { bloqueados.push({ id: d.id, ...x }); }
  }
  return { ativos, bloqueados };
}

export function novoId(){ return Date.now().toString(36) + C.b64(C.rnd(6)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 6); }

export async function salvarItem(sessao, colecao, dados, id = novoId()){
  const conteudo = await C.cifrarJSON(sessao.dek, dados);
  await setDoc(refItem(sessao.uid, id), { colecao, conteudo, geracao: sessao.cofre.geracao, estado: "ativo", atualizadoEm: serverTimestamp() });
  return id;
}
export const apagarItem = (sessao, id) => deleteDoc(refItem(sessao.uid, id));

// Abre registros bloqueados com a chave de recuperação antiga e tranca de novo com a chave atual.
export async function desbloquear(sessao, bloqueados, chaveTexto){
  const bytes = C.deB32(chaveTexto);
  if (!bytes) throw new Error("Formato da chave inválido. São 32 caracteres, em 8 blocos de 4.");
  const kr = await C.chaveDaRecuperacao(bytes);
  const chaves = {};
  let abertos = 0;
  for (const b of bloqueados){
    const g = String(b.geracao);
    if (!(g in chaves)){
      try { chaves[g] = await C.importarChave(await C.decifrarBytes(kr, sessao.cofre.porRecuperacao[g])); } catch { chaves[g] = null; }
    }
    if (!chaves[g]) continue;
    try { const dados = await C.decifrarJSON(chaves[g], b.conteudo); await salvarItem(sessao, b.colecao, dados, b.id); abertos++; } catch { /* registro de outra geração */ }
  }
  if (!abertos) throw new Error("Essa chave não abre nenhum dado bloqueado. Confira se é a chave antiga.");
  return abertos;
}

export async function substituirTudo(sessao, itens){
  const atuais = await getDocs(refItens(sessao.uid));
  let lote = writeBatch(db), n = 0;
  const flush = async () => { if (n){ await lote.commit(); lote = writeBatch(db); n = 0; } };
  for (const d of atuais.docs){ lote.delete(d.ref); if (++n === 400) await flush(); }
  await flush();
  for (const it of itens){
    const conteudo = await C.cifrarJSON(sessao.dek, it.dados);
    lote.set(refItem(sessao.uid, it.id || novoId()), { colecao: it.colecao, conteudo, geracao: sessao.cofre.geracao, estado: "ativo", atualizadoEm: serverTimestamp() });
    if (++n === 400) await flush();
  }
  await flush();
}

export async function excluirConta(sessao){
  const atuais = await getDocs(refItens(sessao.uid));
  let lote = writeBatch(db), n = 0;
  for (const d of atuais.docs){ lote.delete(d.ref); if (++n === 400){ await lote.commit(); lote = writeBatch(db); n = 0; } }
  if (n) await lote.commit();
  await deleteDoc(refUsuario(sessao.uid));
  await deleteUser(auth.currentUser);
}
