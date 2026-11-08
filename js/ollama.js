// IA local (Ollama no computador da usuária). Só funciona no aparelho onde o Ollama roda.
// O Ollama apenas TRADUZ a frase para os comandos que o assistente por regras já entende.
// Nada de saúde é enviado: frases com termos de saúde são barradas antes.
import { norm, DIAS, fData } from "./util.js";
import { lista, config } from "./dados.js";

const CHAVE = "mylife-ollama";
const PADRAO = { ativo: false, url: "http://localhost:11434", modelo: "qwen2.5:3b" };

export function cfgOllama(){
  try { return { ...PADRAO, ...JSON.parse(localStorage.getItem(CHAVE) || "{}") }; } catch { return { ...PADRAO }; }
}
export function salvarOllama(c){
  try { localStorage.setItem(CHAVE, JSON.stringify({ ...cfgOllama(), ...c })); return true; } catch { return false; }
}

const SAUDE = /(remedi|medicament|medicac|dose|dosagem|\bsop\b|ovario|sintoma|menstrua|colica|ciclo|consulta|exame|medic[oa]|gineco|endocrin|metformina|anticoncep|pilula|hormon|insulina|glicose|tratamento|saude|diagnost|doen[cç]a|\bdor\b|ansiedade|depress|terapia|psico|enjo|nausea|febre|tontura|enxaqueca|insonia|vomit|azia|diarreia|sangramento|cansac|fadiga|calafrio|\btomei\b|comi\b|almocei|jantei|lanchei|refeic|treinei|malhei|musculac|supino|agachament|\bkg\b|ultrassom|hemograma|treino|academia|caminhada|corrida|pilates|yoga|menstru|insonia|sono)/;
export const ehSaude = t => SAUDE.test(norm(t));

function urlBase(){ return cfgOllama().url.replace(/\/+$/, ""); }

async function pedir(caminho, corpo, ms){
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(urlBase() + caminho, corpo ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo), signal: ctl.signal } : { signal: ctl.signal });
    if (!r.ok) throw new Error("O Ollama respondeu com erro " + r.status + ".");
    return await r.json();
  } catch (e){
    if (e.name === "AbortError") throw new Error("O Ollama demorou demais para responder.");
    if (e instanceof TypeError) throw new Error("Não consegui falar com o Ollama. Confira se ele está aberto neste computador e se a permissão de origem (OLLAMA_ORIGINS) foi configurada.");
    throw e;
  } finally { clearTimeout(t); }
}

export async function testarOllama(){
  const r = await pedir("/api/tags", null, 8000);
  const modelos = (r.models || []).map(m => m.name);
  const alvo = cfgOllama().modelo;
  const tem = modelos.some(m => m === alvo || m === alvo + ":latest" || m.split(":")[0] === alvo);
  return { modelos, tem };
}

function instrucoes(){
  const h = new Date(), cats = Object.keys(config().orcamento), discs = config().disciplinas;
  const termos = lista("termo").map(t => `"${t.termo}" → ${t.cat}`).join("; ") || "nenhum";
  return `Você converte mensagens em português do Brasil para COMANDOS de um app de organização pessoal.
Hoje é ${DIAS[h.getDay()]}, ${fData(h)}/${h.getFullYear()}.
Responda só com JSON no formato {"comandos": [...], "resposta": "..."}.
Cada comando deve seguir EXATAMENTE um destes modelos (troque o que está entre < >):
- Registre despesa de R$ <valor> com <descrição curta>
- Registre despesa de R$ <valor> com <descrição curta> ontem
- Recebi <valor> de <origem>
- Limite de <categoria> <valor>
- Tenho <prova|trabalho|seminário|substitutiva> de <disciplina> <hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|dia DD/MM> às <HH>h
- Fiz a <prova|trabalho|seminário|substitutiva> de <disciplina>
- Estudei <horas>h de <disciplina>
- Adicionar disciplina <nome>
- Quais provas estão chegando?
- Quanto gastei este mês?
- Qual meu saldo?
- Toda <dias da semana separados por "e"> tenho <atividade> das <HH>h às <HH>h
- De segunda a sexta tenho <atividade> das <HH>h às <HH>h
- Quando eu disser <palavra>, é <categoria>
- Mostre minha rotina
- Remover <atividade da rotina>
- Organize minha semana
- O que tenho hoje?
Regras:
- A usuária escreve do jeito que fala: com erros de digitação, sem acento, abreviações (hj, amn, dps, tbm, vc, pq, mto, pra, tô, tá), gírias (conto, pila, torrei, caiu na conta) e frases que não são literais. Entenda a intenção, não as palavras ao pé da letra.
- Se a mensagem tiver várias coisas (ex.: dois gastos), gere um comando para cada uma, na ordem.
- Valores com vírgula decimal (ex.: 12,50). Horários em formato 24h.
- Categorias válidas: ${cats.join(", ")}. Disciplinas: ${discs.join(", ")}. Termos da usuária: ${termos}.
- Nunca invente valores, datas ou horários que a mensagem não disse. Se faltar algo essencial, deixe "comandos" vazio e use "resposta" para perguntar o que falta, em uma frase curta.
- Se a mensagem não combinar com nenhum modelo, deixe "comandos" vazio e explique em "resposta", em uma frase, o que você consegue fazer.
- Nunca responda sobre saúde, remédios, doses ou diagnósticos.
Exemplos (a mensagem pode usar gíria; converta mesmo assim):
Mensagem: almocei e paguei 25 pila
JSON: {"comandos": ["Registre despesa de R$ 25 com almoço"], "resposta": ""}
Mensagem: gastei 12,50 na padaria e 40 de gasolina
JSON: {"comandos": ["Registre despesa de R$ 12,50 com padaria", "Registre despesa de R$ 40 com gasolina"], "resposta": ""}
Mensagem: ontem torrei 60 conto no cinema
JSON: {"comandos": ["Registre despesa de R$ 60 com cinema ontem"], "resposta": ""}
Mensagem: caiu 300 do estágio
JSON: {"comandos": ["Recebi 300 de estágio"], "resposta": ""}
Mensagem: quinta tem prova de histo às 10
JSON: {"comandos": ["Tenho prova de Histologia quinta às 10h"], "resposta": ""}
Mensagem: passei 2 horas estudando anato e já entreguei o trabalho de metep
JSON: {"comandos": ["Estudei 2h de Anatomia", "Fiz o trabalho de METEP"], "resposta": ""}
Mensagem: quero gastar no máximo 300 com lazer
JSON: {"comandos": ["Limite de Lazer 300"], "resposta": ""}
Mensagem: hj passei a tarde inteira na biblioteca com histo, umas 3hrs, e o uber de volta saiu 18
JSON: {"comandos": ["Estudei 3h de Histologia", "Registre despesa de R$ 18 com Uber"], "resposta": ""}
Mensagem: semana q vem tem prova de anato na quinta as 8 da manha
JSON: {"comandos": ["Tenho prova de Anatomia quinta às 8h"], "resposta": ""}
Mensagem: comprei umas coisas
JSON: {"comandos": [], "resposta": "Quanto você gastou e com o quê?"}`;
}

const ESQUEMA = { type: "object", properties: { comandos: { type: "array", items: { type: "string" } }, resposta: { type: "string" } }, required: ["comandos", "resposta"] };

export async function traduzir(texto){
  const c = cfgOllama();
  const r = await pedir("/api/chat", {
    model: c.modelo, stream: false, format: ESQUEMA, keep_alive: "30m",
    options: { temperature: 0 },
    messages: [{ role: "system", content: instrucoes() }, { role: "user", content: texto }]
  }, 90000);
  let j; try { j = JSON.parse(r.message?.content || "{}"); } catch { j = {}; }
  const comandos = Array.isArray(j.comandos) ? j.comandos.filter(s => typeof s === "string" && s.trim()).slice(0, 6) : [];
  return { comandos, resposta: typeof j.resposta === "string" ? j.resposta.trim() : "" };
}
