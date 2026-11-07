// Testes de isolamento: duas usuárias fictícias tentam acessar os dados uma da outra.
// Todas as tentativas indevidas precisam ser NEGADAS. Rodam no emulador do Firebase.
import { readFileSync } from "node:fs";
import { test, before, after, beforeEach } from "node:test";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc, updateDoc, collection, getDocs } from "firebase/firestore";

let env;
const CIFRADO = "v1:QUJDREVGR0hJSktM.ZmljdGljaW8tY2lmcmFkbw==";
const ITEM = { colecao: "fin", conteudo: CIFRADO, geracao: 1, estado: "ativo" };
const COFRE = { versao: 1, cofre: { geracao: 1, porSenha: "a.b", porRecuperacao: { "1": "c.d" } } };

before(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-mylife", firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 } });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users/teste-b"), COFRE);
    await setDoc(doc(db, "users/teste-b/itens/reg-b"), ITEM);
  });
});
const A = () => env.authenticatedContext("teste-a", { email: "a@exemplo.invalid", email_verified: true }).firestore();
const AnaoVerificada = () => env.authenticatedContext("teste-a", { email: "a@exemplo.invalid", email_verified: false }).firestore();
const B = () => env.authenticatedContext("teste-b", { email: "b@exemplo.invalid", email_verified: true }).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();

test("sem login não lê o cofre de ninguém", async () => { await assertFails(getDoc(doc(anonimo(), "users/teste-b"))); });
test("sem login não lê registros", async () => { await assertFails(getDoc(doc(anonimo(), "users/teste-b/itens/reg-b"))); });
test("A não lê o cofre de B", async () => { await assertFails(getDoc(doc(A(), "users/teste-b"))); });
test("A não lista os registros de B", async () => { await assertFails(getDocs(collection(A(), "users/teste-b/itens"))); });
test("A não lê um registro de B", async () => { await assertFails(getDoc(doc(A(), "users/teste-b/itens/reg-b"))); });
test("A não altera um registro de B", async () => { await assertFails(updateDoc(doc(A(), "users/teste-b/itens/reg-b"), { estado: "bloqueado" })); });
test("A não apaga um registro de B", async () => { await assertFails(deleteDoc(doc(A(), "users/teste-b/itens/reg-b"))); });
test("A não cria registro dentro da conta de B", async () => { await assertFails(setDoc(doc(A(), "users/teste-b/itens/novo"), ITEM)); });
test("A não substitui o cofre de B", async () => { await assertFails(setDoc(doc(A(), "users/teste-b"), COFRE)); });
test("A não apaga a conta de B", async () => { await assertFails(deleteDoc(doc(A(), "users/teste-b"))); });
test("nada fora de users/ é acessível", async () => { await assertFails(setDoc(doc(A(), "outra/coisa"), { x: 1 })); });

test("A cria o próprio cofre", async () => { await assertSucceeds(setDoc(doc(A(), "users/teste-a"), COFRE)); });
test("A cria e lê o próprio registro cifrado", async () => {
  await assertSucceeds(setDoc(doc(A(), "users/teste-a/itens/r1"), ITEM));
  await assertSucceeds(getDoc(doc(A(), "users/teste-a/itens/r1")));
});
test("registro em texto puro (sem cifrar) é recusado", async () => { await assertFails(setDoc(doc(A(), "users/teste-a/itens/r2"), { ...ITEM, conteudo: "Gastei 35 com ração" })); });
test("campos extras no registro são recusados", async () => { await assertFails(setDoc(doc(A(), "users/teste-a/itens/r3"), { ...ITEM, valorEmTexto: 35 })); });
test("e-mail não confirmado não grava registros", async () => { await assertFails(setDoc(doc(AnaoVerificada(), "users/teste-a/itens/r4"), ITEM)); });
test("B lê o próprio registro", async () => { await assertSucceeds(getDoc(doc(B(), "users/teste-b/itens/reg-b"))); });
