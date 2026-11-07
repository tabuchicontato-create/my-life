// Assistente por regras: entende comandos previstos e sempre mostra uma prévia antes de salvar.
// Nenhum dado de saúde passa por aqui. Dúvidas clínicas são encaminhadas ao médico.
import { norm, brl, fData, fHora, rotuloDia, dia, hoje, diasAte, DIAS, DIAS_N, valorBR, cap } from "./util.js";
import { lista, config } from "./dados.js";

export const SUGESTOES = [
  "Registre despesa de R$ 35 com ração",
  "Tenho prova de Anatomia quinta às 14h",
  "Quais provas estão chegando?",
  "Organize minha semana",
  "Quanto gastei este mês?",
  "Toda segunda e quarta tenho academia das 7h às 8h",
  "Quando eu disser mercadinho, é Alimentação",
  "Mostre minha rotina"
];

export function categoriaPor(t){
  const n = norm(t);
  for (const tm of lista("termo")) if (n.includes(norm(tm.termo))) return tm.cat;
  const regras = [[/racao|pet|veterin|petshop|banho e tosa/, "Pets"], [/mercado|comida|lanche|restaurante|ifood|padaria|almoco|jantar|cafe/, "Alimentação"], [/uber|onibus|gasolina|combust|metro|passagem|estacionamento/, "Transporte"], [/livro|faculdade|xerox|mensalidade|apostila|curso|jaleco/, "Faculdade"], [/aluguel|luz|energia|agua|internet|condominio|gas/, "Moradia"], [/cinema|show|bar|jogo|passeio|streaming|netflix|spotify/, "Lazer"], [/farmacia|consulta|exame|dentista|remedio/, "Saúde"], [/roupa|sapato|tenis|blusa|calca|vestido/, "Vestuário"]];
  for (const [r, c] of regras) if (r.test(n)) return c;
  return "Outros";
}

/* ---------- Saúde por regras (nada disso vai para a IA) ---------- */
const NUM = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, meio: 0.5, meia: 0.5 };
const numero = s => NUM[s] ?? valorBR(s);

// Água: "bebi 2 copos de água", "tomei 1 litro de água", "mais um copo de água"
function lerAgua(n){
  if (!/\bagua\b/.test(n) || !/\b(bebi|tomei|mais|beber)\b/.test(n)) return null;
  const m = n.match(/\b(\d+(?:,\d+)?|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|meio|meia)\s*(copos?|garrafas?|garrafinhas?|litros?|l|ml)?\s*(?:de\s+)?agua\b/);
  if (!m) return { resp: "Quantos copos de água? Ex.: \"Bebi 2 copos de água\"." };
  const q = numero(m[1]), u = m[2] || "copo";
  const fator = /^garraf/.test(u) ? 2 : /^(litro|l$)/.test(u) ? 4 : u === "ml" ? 1 / 250 : 1;
  const copos = Math.max(1, Math.round(q * fator));
  if (!(copos > 0) || copos > 40) return { resp: "Não entendi a quantidade. Ex.: \"Bebi 2 copos de água\"." };
  return { resp: "Confere antes de eu salvar?", previa: { acao: "agua", dados: { copos }, campos: { "Água": `+${copos} copo(s) de 250 ml`, "Quando": "Hoje, " + fData(hoje()) } } };
}

// Treino: "fiz 30 min de caminhada", "corri 40 minutos", "malhei 1h ontem"
const ATIVIDADES = [[/musculacao|academia|malhei/, "Musculação"], [/\bi?oga\b|yoga/, "Yoga"], [/pilates/, "Pilates"], [/corri\b|corrida/, "Corrida"], [/caminhei|caminhada/, "Caminhada"], [/nadei|natacao/, "Natação"], [/pedalei|bike|bicicleta|ciclismo|spinning/, "Bicicleta"], [/danc/, "Dança"], [/funcional/, "Funcional"], [/crossfit/, "Crossfit"], [/alongamento|alonguei/, "Alongamento"]];
function duracaoMin(n){
  let m;
  if (/uma hora e meia/.test(n)) return 90;
  if ((m = n.match(/(\d+)\s*h(?:oras?)?\s*(?:e\s*)?(\d{1,2})\s*(?:min(?:utos?)?)?\b/))) return Number(m[1]) * 60 + Number(m[2]);
  if ((m = n.match(/(\d+(?:,\d+)?)\s*h(?:oras?)?\b/))) return Math.round(valorBR(m[1]) * 60);
  if ((m = n.match(/(\d+)\s*min/))) return Number(m[1]);
  if (/meia hora/.test(n)) return 30;
  if (/uma hora/.test(n)) return 60;
  return null;
}
function lerTreino(n, base){
  if (/estud|prova|trabalho|seminario|aula/.test(n)) return null;
  const verbo = /\b(treinei|pratiquei|corri|caminhei|nadei|pedalei|malhei|alonguei)\b/.test(n);
  const fiz = /\b(fiz|fui)\b/.test(n);
  const ativ = ATIVIDADES.find(([r]) => r.test(n));
  const min = duracaoMin(n);
  if (!verbo && !(fiz && (ativ || min))) return null;
  let tipo = ativ ? ativ[1] : null;
  if (!tipo){
    const i = norm(base).search(/\bde\s+[a-z]/);
    const resto = i >= 0 ? base.slice(i + 3).replace(/\b(ontem|hoje|agora|de manh[ãa]|à tarde|a tarde|à noite|a noite)\b.*$/i, "").replace(/[.,;!?]+.*$/, "").trim() : "";
    tipo = resto && resto.length <= 30 ? cap(resto) : "Treino";
  }
  if (!min) return { resp: `Quanto tempo durou? Ex.: "Fiz 30 min de ${tipo.toLowerCase() === "treino" ? "caminhada" : tipo.toLowerCase()}".` };
  if (min > 600) return { resp: "Não entendi a duração. Ex.: \"Fiz 45 min de musculação\"." };
  const quando = /\bontem\b/.test(n) ? dia(-1, 12) : dia(0, 12);
  return { resp: "Confere antes de eu salvar?", previa: { acao: "treino", dados: { data: quando.toISOString(), tipo, min }, campos: { "Atividade": tipo, "Duração": `${min} min`, "Data": rotuloDia(quando) + ", " + fData(quando) } } };
}

// Sintoma: "estou com dor de cabeça forte", "tive cólica ontem", "acordei enjoada"
const SINTOMA = /\b(dor(es)?\b|doendo|colica|enjo|nausea|tontura|tonta|tonto|enxaqueca|febre|calafrio|cansac|cansad|fadiga|exaust|insonia|inchac|inchad|acne|espinha|queda de cabelo|sangramento|fluxo|gases|azia|diarreia|constipa|prisao de ventre|mal[- ]estar|indisposi|vomit|irritad|irritabil|triste|desanim|ansios|ansiedade|estress|coceira|falta de ar|palpita|tosse|coriza|gripad|resfriad|sonolen)/;
const GATILHO = /\b(estou|esta|to|tou|ando|acordei|amanheci|fiquei|sinto|senti|sentindo|tive|tenho|bateu|deu|com)\b/;
function lerSintoma(n, base){
  const k = n.search(SINTOMA);
  if (k < 0) return null;
  if (k > 0 && !GATILHO.test(n.slice(0, k))) return null;
  const nb = norm(base), kb = nb.search(SINTOMA);
  let desc = base.slice(kb).replace(/[.;!?].*$/, "");
  const corte = norm(desc).search(/\s(muito|muita|bem|super|forte|fortissim|leve|fraca|fraco|pouc|moderad|media|insuportavel|demais|desde|hoje|ontem|agora|o dia|a tarde|a noite|de manha|de novo|outra vez)\b|,/);
  if (corte > 0) desc = desc.slice(0, corte);
  desc = desc.trim();
  if (!desc) return null;
  const NOMES = [[/^enjoad[oa]s?$/, "Enjoo"], [/^cansad[oa]s?$/, "Cansaço"], [/^tont[oa]s?$/, "Tontura"], [/^inchad[oa]s?$/, "Inchaço"], [/^gripad[oa]s?$/, "Gripe"], [/^resfriad[oa]s?$/, "Resfriado"], [/^ansios[oa]s?$/, "Ansiedade"], [/^triste$/, "Tristeza"], [/^desanimad[oa]s?$/, "Desânimo"], [/^irritad[oa]s?$/, "Irritação"], [/^estressad[oa]s?$/, "Estresse"], [/^exaust[oa]s?$/, "Exaustão"]];
  const nome = NOMES.find(([r]) => r.test(norm(desc)));
  if (nome) desc = nome[1];
  const intens = /insuportavel|muito forte|fortissim|pior (dor|de todas)/.test(n) ? 5 : /\b(forte|muita|muito|demais|bastante)\b/.test(n) ? 4 : /\b(moderad|media)/.test(n) ? 3 : /\b(leve|pouca|pouco|fraca|fraco|um pouco)\b/.test(n) ? 1 : 2;
  const quando = /\bontem\b/.test(n) ? dia(-1, 12) : new Date();
  return { resp: "Confere antes de eu salvar no seu diário de sintomas? Eu só anoto: não diagnostico. Se te preocupar, fale com seu médico.", previa: { acao: "sintoma", dados: { data: quando.toISOString(), sintoma: cap(desc), intens, nota: base }, campos: { "Sintoma": cap(desc), "Intensidade": `${intens} de 5`, "Quando": rotuloDia(quando) + ", " + fData(quando), "Anotação": base } } };
}

export function descDias(ds){
  const s = [...ds].sort((a, b) => a - b).join(",");
  if (s === "0,1,2,3,4,5,6") return "Todo dia"; if (s === "1,2,3,4,5") return "Segunda a sexta"; if (s === "0,6") return "Fim de semana";
  return [...ds].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => cap(DIAS[d]).slice(0, 3)).join(", ");
}

// ctx: { proximas(), eventosDoDia(d), gastoPorCat(), saldoMes() }
export function interpretar(texto, ctx){
  const n = norm(texto).replace(/\s+/g, " ").trim();
  if (!n) return { resp: "Escreva um comando. Toque numa sugestão para ver exemplos." };

  if (/(dose|dosagem|posso tomar|devo tomar|aumentar|diminuir|parar de tomar|efeito colateral|diagnost|e normal sentir|que remedio|qual remedio)/.test(n))
    return { resp: "Essa é uma dúvida clínica. Eu não diagnostico nem recomendo doses. Leve essa pergunta ao seu médico. Se quiser, registre o sintoma em Saúde → Sintomas para mostrar na consulta." };

  let m = n.match(/(?:registr\w*|anot\w*|lanc\w*|adicion\w*|gastei|recebi)\s+(?:uma?\s+)?(?:(despesa|gasto|receita)\s+de\s+)?r?\$?\s*([\d.]+(?:,\d{1,2})?)\s+(?:reais\s+)?(?:com|de|em|no|na|do|da|pra|para)\s+(.+)/);
  if (m){
    const tipo = m[1] === "receita" || /^recebi/.test(n) ? "receita" : "despesa";
    const valor = valorBR(m[2]);
    const dm = texto.match(/\d(?:[\d.,]*)\s+(?:reais\s+)?(?:com|de|em|no|na|do|da|pra|para)\s+(.+)$/i);
    const desc = (dm ? dm[1] : m[3]).replace(/[.!?]+$/, "").trim();
    if (!valor) return { resp: "Não entendi o valor. Tente: \"Registre despesa de R$ 35 com ração\"." };
    const cat = tipo === "receita" ? "Receita" : categoriaPor(desc);
    const quando = /ontem/.test(n) ? dia(-1) : hoje();
    return { resp: "Confere antes de eu salvar?", previa: { acao: "fin", dados: { tipo, valor, desc: cap(desc.replace(/\s*ontem\s*$/i, "")), cat, data: quando.toISOString() }, campos: { "Tipo": cap(tipo), "Valor": brl(valor), "Descrição": desc, "Categoria": cat, "Data": rotuloDia(quando) + ", " + fData(quando) } } };
  }

  m = n.match(/tenho\s+(?:uma?\s+)?(prova|trabalho|seminario|substitutiva)\s+(?:de|da|do)\s+([a-z ]+?)\s+(hoje|amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo|dia \d{1,2}(?:\/\d{1,2})?)(?:[- ]feira)?(?:\s+(?:as|a)\s+(\d{1,2})(?:[:h](\d{2}))?\s*h?)?/);
  if (m){
    const tipo = { prova: "Prova", trabalho: "Trabalho", seminario: "Seminário", substitutiva: "Substitutiva" }[m[1]];
    const discN = m[2].trim();
    const discs = config().disciplinas;
    const disc = discs.find(d => norm(d).startsWith(discN.slice(0, 5))) || cap(discN);
    let d;
    if (m[3] === "hoje") d = dia(0); else if (m[3] === "amanha") d = dia(1);
    else if (m[3].startsWith("dia")){ const [dd, mm] = m[3].slice(4).split("/").map(Number); d = new Date(hoje().getFullYear(), mm ? mm - 1 : hoje().getMonth(), dd); if (d < hoje()) d.setMonth(d.getMonth() + (mm ? 12 : 1)); }
    else { const alvo = DIAS_N.indexOf(m[3]); d = dia((alvo - hoje().getDay() + 7) % 7); }
    d.setHours(m[4] ? Number(m[4]) : 8, m[5] ? Number(m[5]) : 0, 0, 0);
    const fimD = new Date(d.getTime() + 7200000);
    const choque = ctx.eventosDoDia(d).find(e => !e.diaTodo && e.ini < fimD && d < e.fim);
    return { resp: "Confere antes de eu salvar?" + (choque ? `\n\nAtenção: choca com "${choque.titulo}" (${fHora(choque.ini)}–${fHora(choque.fim)}).` : ""), previa: { acao: "aval", dados: { tipo, disc, titulo: tipo + " de " + disc, data: d.toISOString(), feita: false }, campos: { "Tipo": tipo, "Disciplina": disc + (discs.includes(disc) ? "" : " (nova)"), "Quando": `${rotuloDia(d)}, ${fData(d)} às ${fHora(d)}` } } };
  }

  const base = texto.normalize("NFC").replace(/\s+/g, " ").trim();
  const saude = lerAgua(n) || lerTreino(n, base) || lerSintoma(n, base);
  if (saude) return saude;

  if (/(quais|proximas|que) (provas|trabalhos|avaliacoes)|provas (estao )?chegando|minhas provas/.test(n)){
    const p = ctx.proximas();
    if (!p.length) return { resp: "Você não tem provas ou trabalhos pendentes." };
    return { resp: "Próximas avaliações:\n" + p.slice(0, 10).map(a => `• ${a.tipo} de ${a.disc}: ${rotuloDia(a.data).toLowerCase()}, ${fData(a.data)} às ${fHora(a.data)} (em ${diasAte(a.data)} dia(s))`).join("\n") };
  }
  if (/quanto (eu )?gastei|gastos do mes|total de despesas/.test(n)){
    const g = Object.entries(ctx.gastoPorCat()).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const total = g.reduce((s, [, v]) => s + v, 0);
    return { resp: `Neste mês você gastou ${brl(total)}.` + (g.length ? "\nMaiores categorias:\n" + g.slice(0, 4).map(([c, v]) => `• ${c}: ${brl(v)}`).join("\n") : "") };
  }
  if (/\bsaldo\b/.test(n)) return { resp: `Seu saldo do mês é ${brl(ctx.saldoMes())}.` };

  m = n.match(/quando eu (?:disser|falar|escrever)\s+(.+?)\s*,?\s*(?:e|eh|quer dizer|significa|e da categoria|vai para|vai pra)\s+(?:a categoria\s+|categoria\s+)?(.+?)[.!]?$/);
  if (m){
    const cats = Object.keys(config().orcamento);
    const cat = cats.find(c => norm(c) === m[2].trim());
    const orig = texto.match(/(?:disser|falar|escrever)\s+["“']?(.+?)["”']?\s*,?\s+(?:é|e|eh|quer dizer|significa|vai)(?=\s)/i);
    const termo = (orig ? orig[1] : m[1]).replace(/^["“']|["”']$/g, "").trim();
    if (!cat) return { resp: `Por enquanto, os termos servem para escolher a categoria de um gasto. Categorias: ${cats.join(", ")}.\nEx.: "Quando eu disser ${termo}, é Alimentação".` };
    return { resp: "Confere antes de eu salvar?", previa: { acao: "termo", dados: { termo, cat }, campos: { "Quando você disser": termo, "Categoria": cat } } };
  }

  if (/(mostr\w*|ver|qual|quais) (a )?minha rotina|^minha rotina|meus termos/.test(n)){
    const rot = lista("rotina"), ter = lista("termo");
    if (!rot.length && !ter.length) return { resp: "Sua rotina ainda está vazia. Ex.: \"Toda segunda e quarta tenho academia das 7h às 8h\"." };
    return { resp: (rot.length ? "Sua rotina:\n" + rot.map(r => `• ${r.titulo}: ${descDias(r.dias)}, ${r.ini}–${r.fim}`).join("\n") : "Sem itens de rotina.") + (ter.length ? "\n\nSeus termos:\n" + ter.map(t => `• "${t.termo}" → ${t.cat}`).join("\n") : "") };
  }
  m = n.match(/^(?:remov\w*|apag\w*|tir\w*)\s+(?:a\s+|da\s+)?(?:rotina\s+(?:de\s+|do\s+|da\s+)?)?(.+)$/);
  if (m){
    const alvo = lista("rotina").find(r => norm(r.titulo).includes(m[1].trim()) || m[1].includes(norm(r.titulo)));
    if (alvo) return { resp: `Remover "${alvo.titulo}" da sua rotina?`, previa: { acao: "tirar-rotina", dados: { id: alvo.id }, campos: { "Remover": alvo.titulo, "Dias": descDias(alvo.dias), "Horário": `${alvo.ini}–${alvo.fim}` } } };
  }

  const ehRotina = /^(?:eu\s+)?(?:tod[ao]s?\b|de segunda a sexta|nos dias uteis|nos fins? de semana|aos? (?:sabados|domingos|segundas|tercas|quartas|quintas|sextas))/.test(n) || /^rotina:/.test(n);
  if (ehRotina){
    let dsel = [];
    if (/todos os dias|todo dia|todo santo dia/.test(n)) dsel = [0, 1, 2, 3, 4, 5, 6];
    else if (/segunda a sexta|dias uteis|dia de semana/.test(n)) dsel = [1, 2, 3, 4, 5];
    else if (/fins? de semana/.test(n)) dsel = [0, 6];
    else DIAS_N.forEach((dn, i) => { if (new RegExp("\\b" + dn).test(n)) dsel.push(i); });
    if (!dsel.length) return { resp: "Em quais dias? Ex.: \"Toda terça e quinta tenho estágio das 14h às 17h\"." };
    const t = n.match(/(?:das|de|as|a partir das)\s*(\d{1,2})(?:[:h](\d{2}))?\s*h?(?:\s*(?:as|ate|a)\s*(\d{1,2})(?:[:h](\d{2}))?\s*h?)?/);
    if (!t) return { resp: "Em que horário? Ex.: \"...das 7h às 8h\"." };
    const pad = x => String(x).padStart(2, "0");
    const h1 = Number(t[1]), mi1 = Number(t[2] || 0); let h2 = t[3] ? Number(t[3]) : h1 + 1, mi2 = Number(t[4] || 0);
    if (h1 > 23 || h2 > 24) return { resp: "Não entendi o horário. Use algo como \"das 7h às 8h\"." };
    if (h2 * 60 + mi2 <= h1 * 60 + mi1) h2 = Math.min(23, h1 + 1);
    let titulo = texto
      .replace(/^\s*rotina:\s*/i, "").replace(/^\s*eu\s+/i, "")
      .replace(/tod[ao]s?\s+(os\s+|as\s+)?dias?|todo santo dia|de segunda a sexta(-feira)?|nos dias úteis|nos dias uteis|nos fins? de semana|fins? de semana/gi, "")
      .replace(/\b(tod[ao]s?\s+(as\s+|os\s+)?|às\s+|aos?\s+)?(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)s?(-feiras?)?(\s*(,|e)\s*)?/gi, "")
      .replace(/(das|de|às|as|a partir das)\s*\d{1,2}([:h]\d{2})?\s*h?(\s*(às|as|até|ate|a)\s*\d{1,2}([:h]\d{2})?\s*h?)?/gi, "")
      .replace(/^\s*(eu\s+)?(tenho|faço|faco|vou\s+(pra|para|ao|à|a|no|na)?|levo|busco|trabalho\s+(no|na|em)?)\s+/i, "")
      .replace(/^[\s,.;:-]+|[\s,.;:!?-]+$/g, "").trim();
    if (!titulo) return { resp: "O que acontece nesse horário? Ex.: \"Toda segunda tenho academia das 7h às 8h\"." };
    const r = { titulo: cap(titulo), dias: dsel, ini: `${pad(h1)}:${pad(mi1)}`, fim: `${pad(h2)}:${pad(mi2)}` };
    return { resp: "Confere antes de eu salvar na sua rotina?", previa: { acao: "rotina", dados: r, campos: { "O quê": r.titulo, "Dias": descDias(r.dias), "Horário": `${r.ini}–${r.fim}` } } };
  }

  if (/organiz\w* (a |minha )?semana|planej\w* (a |minha )?semana/.test(n)){
    const prox = ctx.proximas()[0];
    const linhas = [];
    for (let i = 0; i < 7; i++){
      const d = dia(i), ev = ctx.eventosDoDia(d);
      const ocup = ev.map(e => `${e.diaTodo ? "dia todo" : fHora(e.ini)} ${e.titulo}${e.conflito ? " (conflito!)" : ""}`).join("; ");
      const livreNoite = !ev.some(e => !e.diaTodo && e.ini.getHours() < 20 && (e.fim.getHours() >= 19 || e.fim.getDate() !== e.ini.getDate()));
      const sug = livreNoite && prox && d < new Date(prox.data) ? ` → sugestão: estudar ${prox.disc} das 19h às 20h` : "";
      linhas.push(`• ${rotuloDia(d)} ${fData(d)}: ${ocup || "livre"}${sug}`);
    }
    return { resp: "Sua semana:\n" + linhas.join("\n") + "\n\nAs sugestões ficam só no MY LIFE. Sua agenda do Google não é alterada." };
  }
  if (/(o que tenho|agenda de|compromissos de) hoje/.test(n)){
    const ev = ctx.eventosDoDia(hoje());
    return { resp: ev.length ? "Hoje:\n" + ev.map(e => `• ${e.diaTodo ? "dia todo" : fHora(e.ini)} ${e.titulo}`).join("\n") : "Nada marcado para hoje." };
  }
  return { naoEntendi: true, resp: "Não entendi. Eu entendo comandos como:\n• Registre despesa de R$ 35 com ração\n• Gastei 80 em roupa\n• Recebi 200 de freela\n• Tenho prova de Anatomia quinta às 14h\n• Quais provas estão chegando?\n• Quanto gastei este mês? / Qual meu saldo?\n• Organize minha semana / O que tenho hoje?\n• Toda segunda e quarta tenho academia das 7h às 8h\n• Quando eu disser mercadinho, é Alimentação\n• Mostre minha rotina / Remover academia\n• Estou com dor de cabeça forte\n• Bebi 2 copos de água\n• Fiz 30 min de caminhada" };
}
