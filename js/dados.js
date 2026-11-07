// Estado do app em memória. Os registros chegam do banco já decifrados e só existem aqui
// enquanto a sessão estiver aberta.
import * as N from "./nuvem.js";

export const CATEGORIAS_PADRAO = { "Moradia": 1200, "Alimentação": 800, "Transporte": 250, "Pets": 200, "Faculdade": 400, "Saúde": 300, "Lazer": 300, "Vestuário": 200, "Outros": 150 };
export const DISCIPLINAS_PADRAO = ["Anatomia", "Histologia", "Habilidades Clínicas", "METEP", "Interação Comunitária", "Módulo de Concepção", "Agressão e Defesa"];
const CONFIG_PADRAO = { logoutMin: 15, lembreteMensal: true, ultimoBackup: null, orcamento: CATEGORIAS_PADRAO, disciplinas: DISCIPLINAS_PADRAO, agendasOcultas: [] };

export const S = {
  sessao: null,
  itens: [],
  bloqueados: [],
  google: { token: null, expira: 0, agendas: [], eventos: [], ultimaSync: null, erro: null, carregando: false },
  ui: { aba: "inicio", msg: null, semana: 0, subSaude: "tratamento", auth: "login", chat: [], pendentes: {} }
};

export function lista(colecao){ return S.itens.filter(i => i.colecao === colecao).map(i => ({ id: i.id, ...i.dados })); }
export function config(){ const c = S.itens.find(i => i.colecao === "config"); return { ...CONFIG_PADRAO, ...(c?.dados || {}) }; }

export async function carregar(){
  const { ativos, bloqueados } = await N.carregarItens(S.sessao);
  S.itens = ativos; S.bloqueados = bloqueados;
}

export async function salvar(colecao, dados, id){
  const novoId = await N.salvarItem(S.sessao, colecao, dados, id);
  const i = S.itens.findIndex(x => x.id === novoId);
  if (i >= 0) S.itens[i] = { id: novoId, colecao, dados }; else S.itens.push({ id: novoId, colecao, dados });
  return novoId;
}
export async function apagar(id){ await N.apagarItem(S.sessao, id); S.itens = S.itens.filter(x => x.id !== id); }
export async function salvarConfig(parcial){ await salvar("config", { ...config(), ...parcial }, "config"); }

export function limpar(){
  S.sessao = null; S.itens = []; S.bloqueados = [];
  S.google = { token: null, expira: 0, agendas: [], eventos: [], ultimaSync: null, erro: null, carregando: false };
  S.ui.chat = []; S.ui.pendentes = {}; S.ui.aba = "inicio"; S.ui.semana = 0;
}
