// Assistente por regras: entende comandos previstos e sempre mostra uma prévia antes de salvar.
// Nenhum dado de saúde passa por aqui. Dúvidas clínicas são encaminhadas ao médico.
import { norm, brl, fData, fHora, rotuloDia, dia, hoje, diasAte, DIAS, DIAS_N, valorBR, cap, iso } from "./util.js";
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
  if ((m = n.match(/(\d+)\s*h(?:oras?)?\s*e\s*meia\b/))) return Number(m[1]) * 60 + 30;
  if ((m = n.match(/(\d+)\s*h(?:oras?)?\s*(?:e\s*)?(\d{1,2})\s*(?:min(?:utos?)?)?\b/))) return Number(m[1]) * 60 + Number(m[2]);
  if ((m = n.match(/(\d+(?:,\d+)?)\s*h(?:oras?)?\b/))) return Math.round(valorBR(m[1]) * 60);
  if ((m = n.match(/(\d+)\s*min/))) return Number(m[1]);
  if (/meia hora/.test(n)) return 30;
  if (/uma hora/.test(n)) return 60;
  return null;
}
function lerTreino(n, base){
  if (/estud|prova|trabalho|seminario|aula/.test(n)) return null;
  if (/^(?:eu\s+)?(?:tod[ao]s?\b|de segunda a sexta|nos dias uteis)/.test(n)) return null; // é rotina
  const verbo = /\b(treinei|pratiquei|corri|caminhei|nadei|pedalei|malhei|alonguei)\b/.test(n) || (/\btreino\b/.test(n) && /\b(deu|foi|durou|fiz|teve|de)\b/.test(n));
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
const SINTOMA = /\b(dor(es)?\b|doendo|colica|menstrua|enjo|nausea|tontura|tonta|tonto|enxaqueca|febre|calafrio|cansac|cansad|fadiga|exaust|insonia|inchac|inchad|acne|espinha|queda de cabelo|sangramento|fluxo|gases|azia|diarreia|constipa|prisao de ventre|mal[- ]estar|indisposi|vomit|irritad|irritabil|triste|desanim|ansios|ansiedade|estress|coceira|falta de ar|palpita|tosse|coriza|gripad|resfriad|sonolen)/;
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

/* ---------- Datas e horas ditas em português ---------- */
const pad2 = x => String(x).padStart(2, "0");
const FIM_TEXTO = /\s+(?:(?:hoje|amanha|ontem|(?:na |nesta |proxima )?(?:segunda|terca|quarta|quinta|sexta|sabado|domingo)|de manha|a tarde|a noite|que vem)\b|dia \d|\d{1,2}\/\d{1,2}|as \d|a \d|\d{1,2}h).*$/;
function lerData(n, futuro){
  if (/\bhoje\b/.test(n)) return dia(0);
  if (/\bamanha\b/.test(n)) return dia(1);
  if (/\bontem\b/.test(n)) return dia(-1);
  const m = n.match(/\bdia (\d{1,2})(?:\/(\d{1,2}))?\b/) || n.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (m){
    const d = new Date(hoje().getFullYear(), m[2] ? Number(m[2]) - 1 : hoje().getMonth(), Number(m[1]));
    if (futuro && d < hoje()) d.setMonth(d.getMonth() + (m[2] ? 12 : 1));
    return d;
  }
  const w = n.match(/\b(domingo|segunda|terca|quarta|quinta|sexta|sabado)\b/);
  if (w){ const alvo = DIAS_N.indexOf(w[1]); return futuro ? dia((alvo - hoje().getDay() + 7) % 7) : dia(-((hoje().getDay() - alvo + 7) % 7)); }
  return null;
}
function lerHora(n){
  const m = n.match(/\b(?:as|a|pras|para as)\s+(\d{1,2})(?:[:h](\d{2}))?\s*(?:h|hs|horas?)?\b/) || n.match(/\b(\d{1,2})(?:h(\d{2})|:(\d{2}))?\s*(?:h|hs|horas)\b/) || n.match(/\b(\d{1,2})h(\d{2})\b/);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2] || m[3] || 0);
  return h <= 23 && mi <= 59 ? `${pad2(h)}:${pad2(mi)}` : null;
}
const comHora = (d, h) => { const x = new Date(d); const [hh, mm] = (h || "00:00").split(":").map(Number); x.setHours(hh, mm, 0, 0); return x; };
const quandoTxt = (d, comH) => `${rotuloDia(d)}, ${fData(d)}${comH ? " às " + fHora(d) : ""}`;
// Pega o trecho original (com acentos) correspondente a uma posição do texto normalizado.
const trecho = (base, ini, fim) => base.slice(ini, fim).replace(/^[\s,:;-]+|[\s,.;:!?-]+$/g, "");

/* ---------- Faculdade ---------- */
const APELIDOS = [[/\bhc\b|habilidades/, "Habilidades Clínicas"], [/concepcao/, "Módulo de Concepção"], [/\bic\b|comunitaria/, "Interação Comunitária"], [/\bagressao\b/, "Agressão e Defesa"]];
function acharDisc(t){
  const n = norm(t).trim(); if (!n) return null;
  const discs = config().disciplinas;
  const ap = APELIDOS.find(([r]) => r.test(n)); if (ap && discs.includes(ap[1])) return ap[1];
  const pal = n.split(/\s+/).filter(p => p.length >= 4);
  return discs.find(d => n.includes(norm(d))) || discs.find(d => norm(d).split(/\s+/).some(q => q.length >= 4 && pal.some(p => q.slice(0, 5) === p.slice(0, 5)))) || null;
}
// Assunto citado em outra parte da mesma mensagem ("toda segunda tenho tutoria, vou estudar 2h pra próxima").
let assuntoDaMensagem = null;
function lerEstudo(n, base){
  if (!/\b(estudei|estudando|revisei|li|estudar|estudo)\b/.test(n) || /\b(prova|seminario)\b.*\b(amanha|dia|segunda|terca|quarta|quinta|sexta)\b/.test(n)) return null;
  if (/^(?:eu\s+)?(?:tod[ao]s?\b|de segunda a sexta|nos dias uteis)/.test(n)) return null; // é rotina
  if (/\bli\b/.test(n) && !/\b(capitulo|apostila|livro|artigo|resumo|materia)\b/.test(n)) return null;
  const min = duracaoMin(n);
  const planejado = /\b(vou|vamos|pretendo|quero|preciso|devo|tenho que)\b.*\bestudar\b/.test(n);
  let disc = acharDisc(n);
  if (!disc){
    const mm = n.match(/\b(?:estudei|revisei|li|estudar|estudando)\s+(?:\S+\s+){0,3}?(?:de|da|do|sobre|em)\s+([a-z ]+?)(?:\s+(?:hoje|ontem|por|durante|\d).*)?$/);
    disc = mm && !/^(essa|esta|a|o|proxima|semana)\b/.test(mm[1].trim()) ? cap(mm[1].trim()) : null;
  }
  if (!disc && assuntoDaMensagem) disc = assuntoDaMensagem;
  if (!disc) return { resp: `Estudou qual disciplina? Ex.: "Estudei 2 h de ${config().disciplinas[0] || "Anatomia"}".` };
  if (!min) return { resp: `Quanto tempo você estudou ${disc}? Ex.: "Estudei 1h30 de ${disc}".` };
  const horas = Math.round(min / 60 * 100) / 100;
  const quando = /\bontem\b/.test(n) ? dia(-1, 12) : planejado && /\bamanha\b/.test(n) ? dia(1, 12) : new Date();
  return { resp: planejado ? `Você disse que vai estudar. Confirme agora para já contar as ${horas.toLocaleString("pt-BR")} h, ou só depois de estudar.` : "Confere antes de eu salvar?", previa: { acao: "estudo", dados: { disc, horas, data: quando.toISOString() }, campos: { "Disciplina": disc + (config().disciplinas.includes(disc) ? "" : " (fora da sua lista)"), "Tempo": `${horas.toLocaleString("pt-BR")} h`, "Quando": quandoTxt(quando) } } };
}
function lerDisciplina(n, base){
  const m = n.match(/\b(?:adicion\w*|cadastr\w*|inclu\w*|nova|novo|criar?)\s+(?:a\s+|uma\s+)?(?:materia|disciplina)\s+(?:de\s+|chamada\s+)?(.+)$/);
  if (!m) return null;
  const nome = cap(trecho(base, n.length - m[1].length));
  if (!nome) return { resp: "Qual o nome da disciplina?" };
  if (config().disciplinas.some(d => norm(d) === norm(nome))) return { resp: `${nome} já está na sua lista de disciplinas.` };
  return { resp: "Confere antes de eu salvar?", previa: { acao: "disciplina", dados: { nome }, campos: { "Nova disciplina": nome } } };
}
function lerFeita(n){
  const m = n.match(/\b(?:fiz|fizemos|entreguei|apresentei|apresentamos|terminei|acabei)\s+(?:a\s+|o\s+|minha\s+|meu\s+)?(prova|trabalho|seminario|substitutiva)\s+(?:de|da|do)\s+([a-z ]+?)(?:\s+(?:hoje|ontem|agora)\b.*)?$/);
  if (!m) return null;
  const tipo = { prova: "Prova", trabalho: "Trabalho", seminario: "Seminário", substitutiva: "Substitutiva" }[m[1]];
  const disc = acharDisc(m[2]) || cap(m[2].trim());
  const a = lista("aval").filter(x => !x.feita && x.tipo === tipo && norm(x.disc) === norm(disc)).sort((x, y) => Math.abs(new Date(x.data) - Date.now()) - Math.abs(new Date(y.data) - Date.now()))[0];
  if (!a) return { resp: `Não achei ${tipo.toLowerCase()} de ${disc} pendente no app. Se quiser cadastrar: "Tenho ${tipo.toLowerCase()} de ${disc} quinta às 14h".` };
  return { resp: "Marcar como feita?", previa: { acao: "aval-feita", dados: { id: a.id }, campos: { "Avaliação": `${a.tipo} de ${a.disc}`, "Data": quandoTxt(new Date(a.data), true), "Marcar como": "Feita" } } };
}
function lerNota(n){
  if ((/\b(tirei|tive|fiquei com|minha nota|nota)\b.*\b\d/.test(n) || /\b(prova|trabalho|seminario|substitutiva)\b.*\b(foi|deu|ficou)\s+\d+(?:[.,]\d+)?\s*$/.test(n)) && /\b(prova|nota|trabalho|seminario|substitutiva|media)\b/.test(n))
    return { resp: "O MY LIFE ainda não tem lugar para guardar notas de prova. Por enquanto eu consigo marcar a prova como feita: \"Fiz a prova de Anatomia\"." };
  return null;
}

/* ---------- Finanças: limite do orçamento ---------- */
function lerOrcamento(n){
  const m = n.match(/\b(?:limite|orcamento|teto|meta de gasto)\s+(?:de|do|da|para|pra|com|em)?\s*([a-z ]+?)\s*(?:e|eh|de|para|pra|em|fica|ficar|:|=)?\s*(?:r\$\s*)?([\d.]+(?:,\d{1,2})?)\s*(?:reais)?\s*$/);
  if (!m) return null;
  const cats = Object.keys(config().orcamento);
  const cat = cats.find(c => norm(c) === m[1].trim()) || cats.find(c => norm(c).startsWith(m[1].trim().slice(0, 4)));
  if (!cat) return { resp: `Qual categoria? As suas são: ${cats.join(", ")}.` };
  const valor = valorBR(m[2]);
  if (!(valor >= 0)) return { resp: "Não entendi o valor. Ex.: \"Limite de Lazer 300\"." };
  return { resp: "Confere antes de eu salvar?", previa: { acao: "orcamento", dados: { cat, valor }, campos: { "Categoria": cat, "Limite por mês": brl(valor), "Antes": brl(config().orcamento[cat]) } } };
}

/* ---------- Saúde (só regras, nunca IA) ---------- */
function lerMed(n, base){
  const m = n.match(/\b(?:comecei a tomar|vou comecar a tomar|cadastr\w*\s+(?:o\s+|a\s+|um\s+|uma\s+)?(?:remedio|medicamento|suplemento|vitamina)|(?:novo|nova)\s+(?:remedio|medicamento|suplemento|vitamina)|adicion\w*\s+(?:o\s+|a\s+)?(?:remedio|medicamento|suplemento|vitamina)|o medico (?:passou|receitou)|a medica (?:passou|receitou))\s*:?\s+(.+)$/);
  if (!m) return null;
  const ini = n.length - m[1].length;
  const corte = m[1].search(/\s+(?:todo dia|todos os dias|diariamente|toda noite|toda manha|de manha|a noite)\b|\s+(?:as|a)\s+\d|\s+\d{1,2}h|\s+de \d+ em \d+|,/);
  const nome = cap(trecho(base, ini, corte > 0 ? ini + corte : undefined));
  if (!nome) return { resp: "Qual o nome do remédio?" };
  const hora = lerHora(n) || "";
  let extra = corte > 0 ? trecho(base, ini + corte) : "";
  if (/^(?:às|as|a|à)?\s*\d{1,2}(?:[:h]\d{2})?\s*h?(?:oras)?$/i.test(extra)) extra = "";
  const orient = extra ? cap(extra) + " (como você disse)" : "Conforme prescrição médica";
  return { resp: "Confere antes de eu salvar? Eu só registro, não recomendo doses.", previa: { acao: "med", dados: { nome, hora, orient }, campos: { "Remédio": nome, "Horário": hora || "—", "Orientação": orient } } };
}
function lerDose(n){
  if (!/\b(tomei|ja tomei|tomado)\b/.test(n)) return null;
  const meds = lista("med");
  const med = meds.find(x => norm(x.nome).split(/\s+/).some(p => p.length >= 4 && n.includes(p)));
  if (med) return { resp: "Confere antes de eu salvar?", previa: { acao: "dose", dados: { medId: med.id, data: iso(hoje()), hora: fHora(new Date()) }, campos: { "Remédio": med.nome, "Tomado": "Hoje, " + fHora(new Date()) } } };
  // Remédio que não está cadastrado ("tomei uma dipirona"): cadastra como uso eventual e marca a dose.
  const x = n.match(/\btomei\s+(?:um|uma|o|a|1|meio|meia|dois|duas|2)?\s*(?:comprimidos?\s+de\s+|gotas\s+de\s+|capsulas?\s+de\s+)?([a-z][a-z0-9-]{3,})(?:\s+(\d+\s*(?:mg|ml|g|gotas)))?/);
  const novo = x && !/^(agua|cafe|banho|suco|leite|cerveja|vinho|refri|refrigerante|susto|chuva|sorvete|sopa|vergonha|coragem|conta|vacina|cuidado|decisao|cha|uber|onibus|metro|remedio|remedios|medicamento|medicamentos|comprimido|comprimidos|pilula|anticoncepcional|capsula|vitamina|suplemento)$/.test(x[1]);
  if (!novo && !/\b(remedio|medicamento|comprimido|pilula|anticoncepcional|capsula|suplemento|vitamina)\b/.test(n)) return null;
  if (novo){
    const nome = cap(x[1] + (x[2] ? " " + x[2] : ""));
    return { resp: `${nome} não está nos seus remédios. Cadastro como uso eventual e marco como tomado agora? Eu só registro, não recomendo doses.`, previa: { acao: "dose-nova", dados: { nome, hora: fHora(new Date()) }, campos: { "Remédio": `${nome} (novo, uso eventual)`, "Tomado": "Hoje, " + fHora(new Date()) } } };
  }
  if (!meds.length) return { resp: "Você ainda não tem remédios cadastrados. Ex.: \"Comecei a tomar Metformina às 8h\"." };
  if (meds.length === 1) return lerDose(n + " " + norm(meds[0].nome));
  return { resp: `Qual deles? ${meds.map(x => x.nome).join(", ")}. Ex.: "Tomei a ${meds[0].nome}".` };
}
const ESPECIALIDADE = /\b(gineco\w*|endocrino\w*|dermato\w*|nutri\w*|psico\w*|psiquiatra|dentista|cardio\w*|oftalmo\w*|clinico geral|medic[oa]|fisioterap\w*|ortopedista|otorrino)\b/;
function lerConsulta(n, base){
  if (!/\bconsulta\b/.test(n) && !(ESPECIALIDADE.test(n) && /\b(tenho|marquei|marcado|marcada|vou)\b/.test(n) && lerData(n, true))) return null;
  if (/\b(paguei|gastei|custou|reais|r\$)\b/.test(n)) return null;
  const d = lerData(n, true);
  let titulo = "Consulta";
  const com = n.match(/\b(?:com|no|na)\s+(?:o\s+|a\s+|dr\.?\s+|dra\.?\s+)?(.+)$/);
  if (com){ const ini = n.length - com[1].length; const c = com[1].replace(FIM_TEXTO, "").trim(); if (c) titulo = "Consulta com " + trecho(base, ini, ini + c.length); }
  else { const e = n.match(ESPECIALIDADE); if (e) titulo = "Consulta com " + e[1]; }
  if (!d) return { resp: `Para quando é a ${titulo.toLowerCase()}? Ex.: "Consulta com ginecologista dia 20/11 às 15h".` };
  const h = lerHora(n); const quando = comHora(d, h || "09:00");
  return { resp: "Confere antes de eu salvar? Ela vai aparecer na Agenda do MY LIFE.", previa: { acao: "consulta", dados: { titulo, data: quando.toISOString(), nota: "" }, campos: { "Consulta": titulo, "Quando": quandoTxt(quando, true) + (h ? "" : " (horário não dito)") } } };
}
const EXAME = /\b(exames?|ultrassom|ultrassonografia|ecografia|hemograma|ressonancia|tomografia|raio[- ]?x|papanicolau|preventivo|mamografia|eletrocardiograma|glicemia|coleta de sangue)\b/;
function lerExame(n, base){
  const k = n.search(EXAME); if (k < 0) return null;
  if (/\b(paguei|gastei|custou|reais|r\$)\b/.test(n)) return null;
  const status = /\b(resultado|saiu|sairam|chegou|chegaram|ficou pronto|ficaram prontos)\b/.test(n) ? "Resultado recebido" : /\b(fiz|coletei|realizei|tirei|fui fazer)\b/.test(n) ? "Aguardando resultado" : "Agendado";
  let tituloN = n.slice(k).replace(FIM_TEXTO, "").replace(/\s+(saiu|sairam|chegou|ficou|ficaram|esta|ta|ja)\b.*$/, "").trim();
  const titulo = cap(trecho(base, k, k + tituloN.length)) || "Exame";
  const chave = norm(titulo).replace(/^exames?\s+(de\s+|do\s+|da\s+)?/, "");
  const existente = lista("exame").filter(e => e.status !== status && (norm(e.titulo).includes(chave) || chave.includes(norm(e.titulo).replace(/^exames?\s+(de\s+|do\s+|da\s+)?/, "")))).sort((a, b) => new Date(b.data) - new Date(a.data))[0];
  if (existente && status !== "Agendado") return { resp: "Atualizar este exame?", previa: { acao: "exame-status", dados: { id: existente.id, status }, campos: { "Exame": existente.titulo, "Situação": `${existente.status} → ${status}` } } };
  const d = lerData(n, status === "Agendado") || (status === "Agendado" ? null : dia(0));
  if (!d) return { resp: `Para quando é o ${titulo.toLowerCase()}? Ex.: "Exame de sangue dia 15/11".` };
  const quando = comHora(d, lerHora(n) || "08:00");
  return { resp: "Confere antes de eu salvar?", previa: { acao: "exame", dados: { titulo, data: quando.toISOString(), status }, campos: { "Exame": titulo, "Data": quandoTxt(quando), "Situação": status } } };
}
function lerCarga(n, base){
  const p = n.match(/(\d+(?:,\d+)?)\s*(?:kg|quilos?|kilos?)\b/); if (!p) return null;
  if (/\b(peso|pesando|pesei|engordei|emagreci|balanca)\b/.test(n)) return { resp: "O MY LIFE não guarda peso corporal nem medidas. Eu registro a carga dos exercícios, ex.: \"Supino 20 kg 3x10\"." };
  const ini = n.search(/[a-z]/);
  let exN = n.slice(0, p.index).replace(/^(hoje|ontem)\s+/, "").replace(/^(fiz|peguei|levantei|usei|botei|coloquei|subi pra|subi para)\s+(o\s+|a\s+|no\s+|na\s+)?/, "").replace(/\s+(com|de|no|na)\s*$/, "").trim();
  let exI = n.indexOf(exN);
  if (!exN){ const depois = n.slice(p.index + p[0].length).match(/^\s*(?:no|na|de|em)\s+([a-z ]+?)(?:\s+\d.*|\s+(?:hoje|ontem).*)?$/); if (depois){ exN = depois[1].trim(); exI = n.indexOf(exN, p.index); } }
  if (!exN) return { resp: "Qual exercício? Ex.: \"Supino 20 kg 3x10\"." };
  const exercicio = cap(trecho(base, exI, exI + exN.length));
  const peso = valorBR(p[1]);
  const sx = n.match(/\b(\d+)\s*x\s*(\d+)\b/) || n.match(/\b(\d+)\s*series?\s*(?:de\s*(\d+))?/);
  const rp = n.match(/\b(\d+)\s*(?:repeticoes|reps|repeticao)\b/);
  const series = sx ? Number(sx[1]) : null, reps = sx && sx[2] ? Number(sx[2]) : rp ? Number(rp[1]) : null;
  const quando = /\bontem\b/.test(n) ? dia(-1, 12) : dia(0, 12);
  return { resp: "Confere antes de eu salvar?", previa: { acao: "carga", dados: { data: quando.toISOString(), exercicio, peso, series, reps, nota: "" }, campos: { "Exercício": exercicio, "Carga": `${peso.toLocaleString("pt-BR")} kg`, "Séries × reps": `${series || "—"} × ${reps || "—"}`, "Data": quandoTxt(quando) } } };
}
function lerRefeicao(n, base){
  const m = n.match(/\b(almocei|jantei|lanchei|tomei cafe(?: da manha)?|no cafe da manha|cafe da manha|no cafe|no almoco|no jantar|no lanche|na janta|de manha comi|a noite comi|comi|no jantar|no lanche|de lanche|na ceia|de almoco|de janta|de jantar)\b/);
  if (!m) return null;
  const q = m[1];
  const hr = new Date().getHours();
  const quando = /cafe|manha/.test(q) ? "Café da manhã" : /almo/.test(q) ? "Almoço" : /jant/.test(q) ? "Jantar" : /ceia/.test(q) ? "Ceia" : /lanch/.test(q) ? "Lanche" : hr < 10 ? "Café da manhã" : hr < 15 ? "Almoço" : hr < 18 ? "Lanche" : hr < 22 ? "Jantar" : "Ceia";
  // Refeição com valor ("almocei e paguei 25 pila") é um gasto com a refeição.
  const v = n.match(/(?:r\$\s*)?(\d+(?:,\d{1,2})?)\s*(?:reais|conto|contos|pila|pilas)\b/) || (/\b(paguei|gastei|deixei|custou|saiu)\b/.test(n) && n.match(/\b(?:paguei|gastei|deixei|custou|saiu(?: por)?)\s+(?:r\$\s*)?(\d+(?:,\d{1,2})?)\b/));
  if (v){
    const valor = valorBR(v[1]); const d = /\bontem\b/.test(n) ? dia(-1) : hoje();
    return { resp: "Confere antes de eu salvar?", previa: { acao: "fin", dados: { tipo: "despesa", valor, desc: quando, cat: categoriaPor("comida"), data: d.toISOString() }, campos: { "Tipo": "Despesa", "Valor": brl(valor), "Descrição": quando, "Categoria": categoriaPor("comida"), "Data": rotuloDia(d) + ", " + fData(d) } } };
  }
  const ini = m.index + q.length;
  const t = trecho(base, ini).replace(/^(e\s+)?(eu\s+)?(comi|almocei|jantei|lanchei)?\s*/i, "").replace(/^(de|o|a|um|uma|uns|umas|foi|:)\s+/i, "").replace(/\s+(hoje|agora)$/i, "");
  if (!t) return { resp: `O que você comeu no ${quando.toLowerCase()}? Ex.: "Almocei arroz, feijão e frango".` };
  return { resp: "Confere antes de eu salvar? (só registro, sem calorias)", previa: { acao: "refeicao", dados: { data: iso(hoje()), quando, texto: t }, campos: { "Refeição": quando, "O que": t, "Quando": "Hoje, " + fData(hoje()) } } };
}

export function descDias(ds){
  const s = [...ds].sort((a, b) => a - b).join(",");
  if (s === "0,1,2,3,4,5,6") return "Todo dia"; if (s === "1,2,3,4,5") return "Segunda a sexta"; if (s === "0,6") return "Fim de semana";
  return [...ds].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => cap(DIAS[d]).slice(0, 3)).join(", ");
}

// ctx: { proximas(), eventosDoDia(d), gastoPorCat(), saldoMes() }
// Mensagem com mais de um assunto: separa em partes e entende cada uma.
// (\b não funciona depois de letra acentuada, como em "amanhã"; por isso FB.)
const FB = "(?![a-z0-9à-ÿ])";
const VERBOS = "tomei|bebi|estudei|paguei|gastei|almocei|jantei|lanchei|recebi|ganhei|corri|treinei|comprei|malhei|caminhei";
const SEPARA = new RegExp(
  "[.!?]+\\s+" +
  "|,?\\s+e\\s+(?=(?:depois|fiz|tive|" + VERBOS + ")" + FB + ")" +
  "|[,;]\\s+(?=(?:e\\s+)?(?:acho que|depois|tamb[eé]m|al[eé]m disso|a[ií]|ent[aã]o|mas|hoje|ontem|amanh[aã]|j[aá]|eu|vou|preciso|quero|tenho|estou|t[oô]|fiz|tive|" + VERBOS + ")" + FB + ")" +
  "|\\s+(?=(?:" + VERBOS + ")" + FB + ")" +
  "|\\s+(?=(?:amanh[aã]|hoje|ontem|depois)\\s+(?:eu\\s+)?(?:vou|tenho|preciso|quero|estudei|fiz)" + FB + ")", "i");
/* ---------- Jeito de falar: abreviações, erros de digitação e expressões ----------
   Roda antes das regras. Nada sai do aparelho. */
const EXPRESSOES = [
  // "minha cabeça tá me matando" → "dor de cabeça insuportável"
  [/\b(?:minha |meu |a |o )?(cabe[cç]a|barriga|est[oô]mago|costas|garganta|c[oó]lica|dente|coluna|lombar)\s+(?:t[aá]|est[aá]|ta)\s+(?:me matando|insuport[aá]vel|horr[ií]vel|terr[ií]vel|absurd[ao]|demais|forte|muito forte)/gi, (m, p) => /c[oó]lica/i.test(p) ? "estou com cólica insuportável" : "estou com dor " + (/costas|coluna|lombar|dente/i.test(p) ? "na " : "de ") + p.toLowerCase() + " insuportável"],
  // intensidade dita de forma figurada
  [/\b(me matando|t[aá] me matando|morrendo de|absurd[ao]|do inferno|horr[ií]vel|terr[ií]vel|insuport[aá]vel|que n[aã]o passa)\b/gi, "insuportável"],
  [/\bcabe[cç]a (explodindo|estourando|latejando|rachando)\b/gi, "dor de cabeça forte"],
  [/\b(barriga|est[oô]mago|cabe[cç]a|costas|perna|pernas|garganta|dente|p[eé]|bra[cç]o|ouvido|olho|peito|lombar|joelho|coluna) (doendo|d[oó]endo|d[oó]i|ruim)(?![\wÀ-ÿ])/gi, (m, p) => "dor " + (/barriga|est|cabe|garganta/i.test(p) ? "de " : "no ") + p],
  [/\b(t[oô]|estou|fiquei|ando|acordei|amanheci) (um caco|morta|morto|acabad[ao]|destru[ií]d[ao]|podre|moíd[ao]|mo[ií]d[ao]|sem energia|esgotad[ao]|exaust[ao])\b/gi, (m, v) => v + " cansada"],
  [/\b(t[oô]|estou|fiquei|acordei|amanheci) (meio |muito |bem )?(mal|ruim|zoad[ao]|baqueada|baqueado)\b/gi, (m, v, i) => v + " com " + (i || "") + "mal-estar"],
  [/\b(t[oô]|estou|fiquei|acordei) (meio |muito |bem )?(ansiosa|ansioso|nervosa|nervoso|agoniad[ao])\b/gi, (m, v, i) => v + " com " + (i || "") + "ansiedade"],
  [/\b(dormi mal|n[aã]o dormi|n[aã]o consegui dormir|perdi o sono|virei a noite acordad[ao])\b/gi, "tive insônia"],
  [/(?<![\wÀ-ÿ])([aâ]nsia( de v[oô]mito)?|vontade de vomitar|enjoad[ao])\b/gi, "enjoo"],
  [/\b(menstruei|fiquei menstruada|desceu (minha )?menstrua[cç][aã]o|minha menstrua[cç][aã]o desceu|t[oô] menstruada|estou menstruada)\b/gi, "estou com menstruação"],
  // dinheiro
  [/\b(\d+(?:[.,]\d+)?)\s*(conto|contos|pila|pilas|mangos?|pratas?|dilmas?|paus?|rs|r)\b(?!\$)/gi, "$1 reais"],
  [/\b(torrei|queimei|larguei|deixei|foram|foi|saiu|meti|enfiei)\s+(r\$\s*)?(\d+(?:[.,]\d+)?)\s*(reais)?\s+(n[oa]s?|com|em|de|pra|para)\s+/gi, "gastei $3 $5 "],
  [/\b(caiu|entrou|pingou)\s+(r\$\s*)?(\d+(?:[.,]\d+)?)\s*(reais)?\s+(d[oa]s?|de)\s+/gi, "recebi $3 de "],
  // treino e comida
  [/\b(puxei ferro|fui (pra|na|para a) academia e treinei|treinei na academia|fiz academia|fiz muscula[cç][aã]o)\b/gi, "malhei"],
  [/\b(bati perna|andei)\b/gi, "caminhei"],
  [/\b(rangei|ranguei|matei a fome com|forrei o estômago com)\b/gi, "comi"],
  [/\bd['’]?[aá]gua\b/gi, "de água"],
  // exageros: "pra caramba", "dms" → "demais"
  [/\b(pra|para) (caramba|caralho|cacete|krl|crl|burro|cachorro)\b|\b(dms|dmais|dimais)\b/gi, "demais"],
  // "comprei um prato de 30 reais" / "o uber saiu 18"
  [/\bcomprei\s+(?:um |uma |uns |umas |o |a |os |as )?(.+?)\s+(?:de|por|a)\s+(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:reais)?(?=\s*$|\s*[,.;!])/gi, "gastei $2 com $1"],
  [/(?:^|\s)(?:o |a |os |as |no |na |nos |nas |do |da )?([a-zà-ÿ][a-zà-ÿ ]{1,25}?)\s+(?:saiu|custou|deu|ficou|foi)\s+(?:por\s+|de\s+)?(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)(?!\s*(?:min|h\b|horas?|kg|copos?|x\b|%|dias?|vezes|pontos?))\s*(?:reais)?(?=\s*$|\s*[,.;!]|\s+e\s)/gi,
    (m, o, v) => /prova|nota|media|trabalho|seminario|seminário|aula|treino|exame|estudo|sono|copo|dia\b/i.test(o) ? m : ` gastei ${v} com ${o}`],
  [/(gastei \d+(?:[.,]\d{1,2})? com [^,.;]+?) e (?:o |a |os |as )?([a-zà-ÿ][a-zà-ÿ ]{1,20}?) (?:foi |deu |saiu |custou |de )?(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:reais)?(?=\s*$|\s*[,.;!])/gi, "$1, gastei $3 com $2"],
  // "quinta tem seminário de metep às 3" → "tenho seminário de metep quinta às 3"
  [/^\s*(?:na |no |nesta |neste |essa |esse )?(hoje|amanh[ãa]|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo|dia \d{1,2}(?:\/\d{1,2})?)(?:[- ]feira)?\s+(?:eu\s+)?(?:tenho|tem|vou ter|terei|vai ter)\s+(?:uma?\s+)?(prova|trabalho|semin[áa]rio|substitutiva)\s+(de|da|do)\s+(.+?)(\s+(?:[àa]s|a)\s+\d.*)?\s*$/i, " tenho $2 $3 $4 $1$5"],
  // tempo
  [/\b(\d+)\s*(hrs?|hs|horas?)\b/gi, "$1h"],
  [/\b(\d+)\s*(mins?|minutos?|m)\b/gi, "$1 min"],
  [/\bfim de semana que vem\b/gi, "sábado"]
];
const ABREV = { tomey: "tomei", tomie: "tomei", toemi: "tomei", tomeii: "tomei", bebei: "bebi", bebii: "bebi", bebe: "bebi", pagei: "paguei", porva: "prova", prvoa: "prova", exmae: "exame", exma: "exame", febri: "febre", colca: "cólica", agau: "água", aguaa: "água", hj: "hoje", hje: "hoje", oje: "hoje", amn: "amanhã", amnh: "amanhã", amnha: "amanhã", amanha: "amanhã", manha: "manhã", ontm: "ontem", onti: "ontem", dps: "depois", dpois: "depois", tbm: "também", tb: "também", tmb: "também", tambem: "também", vc: "você", voce: "você", q: "que", oq: "o que", pq: "porque", n: "não", ñ: "não", nao: "não", naum: "não", mt: "muito", mto: "muito", mta: "muita", mts: "muitos", td: "tudo", msm: "mesmo", agr: "agora", tava: "estava", tô: "estou", tou: "estou", to: "estou", tá: "está", ta: "está", pra: "para", pro: "para o", prum: "para um", numa: "em uma", num: "em um", ai: "aí", seg: "segunda", qua: "quarta", qui: "quinta", sab: "sábado", sabado: "sábado", dom: "domingo", terca: "terça", remedio: "remédio", remedios: "remédios", agua: "água", estomago: "estômago", cabeca: "cabeça", colica: "cólica", musculacao: "musculação", materia: "matéria", seminario: "seminário", almoco: "almoço", cafe: "café", farmacia: "farmácia", orcamento: "orçamento", salario: "salário", enxaqueca: "enxaqueca", sintoma: "sintoma", rango: "comida", busao: "ônibus", onibus: "ônibus" };
const NUMS = { dois: 2, duas: 2, tres: 3, três: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, trezentos: 300, quinhentos: 500, mil: 1000 };
const UNIDADE = "(?:reais|conto|contos|pila|horas?|h|min|minutos?|copos?|litros?|garrafas?|kg|quilos?|s[eé]ries|vezes|x|comprimidos?)";
// Palavras que o app procura; erros de digitação são corrigidos para a mais parecida.
const VOCAB = "estudei estudar estudando revisei paguei gastei comprei recebi ganhei tomei bebi almocei jantei lanchei treinei malhei corri caminhei pedalei nadei consulta consultas exame exames remédio remédios comprimido água copos copo litro litros prova provas trabalho trabalhos seminário substitutiva cabeça estômago barriga cólica febre enjoo tontura enxaqueca cansada cansado ansiedade insônia amanhã ontem hoje segunda terça quarta quinta sexta sábado domingo minutos horas academia musculação caminhada corrida pilates limite orçamento disciplina matéria resultado ginecologista dentista endocrinologista nutricionista dermatologista psicóloga psiquiatra supino agachamento almoço jantar lanche mercado farmácia gasolina aluguel freela salário mensalidade estágio tutoria monitoria dipirona ibuprofeno paracetamol metformina anticoncepcional vitamina";
const NAO_CORRIGIR = new Set("estudante estudantes quarto quinto sexto segundo terço prato preto prata banco campo conta conto carro carta corpo copa cabeça caneca tutora estudo estudos provar provei tomar tomou comer comeu beber bebeu gastar gastou pagar pagou pagou compra compras exata exato trabalhe trabalho semana semanas minuto minha minhas sexta-feira domingos sábados segundas quartas quintas sextas terças".split(" "));
function distancia(a, b){
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++){
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
function vocabulario(){
  const extra = [...config().disciplinas.flatMap(d => d.split(/\s+/)), ...lista("med").flatMap(m => String(m.nome).split(/\s+/)), ...Object.keys(config().orcamento)];
  const mapa = new Map();
  for (const w of [...VOCAB.split(" "), ...extra]) if (w.length >= 4) mapa.set(norm(w), w);
  return mapa;
}
function corrigirPalavra(w, voc){
  const k = norm(w);
  if (ABREV[k] !== undefined) return ABREV[k];
  if (k.length < 6 || voc.has(k) || NAO_CORRIGIR.has(k) || /\d/.test(k)) return w;
  const lim = k.length >= 8 ? 2 : 1;
  let melhor = null, dm = 9, empate = false;
  for (const [vk, vw] of voc){
    if (vk[0] !== k[0] || vk.replace(/s$/, "") === k.replace(/s$/, "")) continue;
    const d = distancia(k, vk);
    if (d < dm){ dm = d; melhor = vw; empate = false; } else if (d === dm) empate = true;
  }
  return melhor && dm <= lim && !empate ? melhor : w;
}
function numerosPorExtenso(t){
  const pal = "(" + Object.keys(NUMS).join("|") + ")";
  // "vinte e cinco reais", "duas horas", "um copo", "meia hora" (meia hora já é entendida)
  t = t.replace(new RegExp("\\b" + pal + "\\s+e\\s+" + pal + "\\s+(?=" + UNIDADE + FB + ")", "gi"), (m, a, b) => (NUMS[norm(a)] + NUMS[norm(b)]) + " ");
  t = t.replace(new RegExp("\\b" + pal + "\\s+(?=" + UNIDADE + FB + ")", "gi"), (m, a) => NUMS[norm(a)] + " ");
  t = t.replace(new RegExp("\\b(uma?)\\s+(?=(?:hora|copo|litro|garrafa|comprimido|s[eé]rie)" + FB + ")", "gi"), "1 ");
  return t;
}
export function corrigir(texto){
  let t = " " + String(texto ?? "").normalize("NFC") + " ";
  for (const [r, s] of EXPRESSOES) t = t.replace(r, s);
  const voc = vocabulario();
  t = t.replace(/[A-Za-zÀ-ÿñ]+(?:-[A-Za-zÀ-ÿ]+)?/g, w => corrigirPalavra(w, voc));
  t = numerosPorExtenso(t);
  for (const [r, s] of EXPRESSOES) t = t.replace(r, s); // de novo, já com abreviações e números corrigidos
  return t.replace(/\s+/g, " ").trim();
}

export function interpretarVarias(texto, ctx){
  texto = corrigir(texto);
  const partes = texto.split(SEPARA).map(s => s.trim()).filter(s => s.length > 2)
    .reduce((acc, s) => { const ult = acc[acc.length - 1]; if (ult && (ult.split(/\s+/).length < 2 || s.split(/\s+/).length < 2)) acc[acc.length - 1] = ult + " e " + s; else acc.push(s); return acc; }, []);
  if (partes.length < 2) return [interpretar(texto, ctx)];
  const n = norm(texto);
  const t = n.match(/\btenho\s+(?:uma?\s+)?([a-z]{4,})/);
  assuntoDaMensagem = acharDisc(n) || (t && !/^(prova|trabalho|seminario|substitutiva|consulta|exame|que)$/.test(t[1]) ? cap(t[1]) : null);
  try {
    const rs = partes.map(p => ({ p, r: interpretar(p, ctx) }));
    if (rs.every(x => x.r.naoEntendi)) return [interpretar(texto, ctx)];
    return rs.map(({ p, r }) => r.naoEntendi ? { naoEntendi: true, parte: p, resp: `Não entendi esta parte: "${p}"` } : r);
  } finally { assuntoDaMensagem = null; }
}

export function interpretar(texto, ctx){
  const n = norm(texto).replace(/\s+/g, " ").trim();
  if (!n) return { resp: "Escreva um comando. Toque numa sugestão para ver exemplos." };

  if (/(dose|dosagem|posso tomar|devo tomar|aumentar|diminuir|parar de tomar|efeito colateral|diagnost|e normal sentir|que remedio|qual remedio)/.test(n))
    return { resp: "Essa é uma dúvida clínica. Eu não diagnostico nem recomendo doses. Leve essa pergunta ao seu médico. Se quiser, registre o sintoma em Saúde → Sintomas para mostrar na consulta." };

  let m = n.match(/(?:registr\w*|anot\w*|lanc\w*|adicion\w*|gastei|recebi|ganhei|paguei|comprei)\s+(?:uma?\s+)?(?:(despesa|gasto|receita)\s+de\s+)?r?\$?\s*([\d.]+(?:,\d{1,2})?)\s+(?:reais\s+)?(?:com|de|em|no|na|do|da|pra|para)\s+(.+)/);
  if (m){
    const tipo = m[1] === "receita" || /^(recebi|ganhei)/.test(n) ? "receita" : "despesa";
    const valor = valorBR(m[2]);
    const dm = texto.match(/\d(?:[\d.,]*)\s+(?:reais\s+)?(?:com|de|em|no|na|do|da|pra|para)\s+(.+)$/i);
    const desc = (dm ? dm[1] : m[3]).replace(/[.!?]+$/, "").trim();
    if (!valor) return { resp: "Não entendi o valor. Tente: \"Registre despesa de R$ 35 com ração\"." };
    const cat = tipo === "receita" ? "Receita" : categoriaPor(desc);
    const quando = /ontem/.test(n) ? dia(-1) : hoje();
    return { resp: "Confere antes de eu salvar?", previa: { acao: "fin", dados: { tipo, valor, desc: cap(desc.replace(/\s*ontem\s*$/i, "")), cat, data: quando.toISOString() }, campos: { "Tipo": cap(tipo), "Valor": brl(valor), "Descrição": desc, "Categoria": cat, "Data": rotuloDia(quando) + ", " + fData(quando) } } };
  }

  m = n.match(/(?:tenho|tem|vou ter|terei|vai ter|temos|teremos)\s+(?:uma?\s+)?(prova|trabalho|seminario|substitutiva)\s+(?:de|da|do)\s+([a-z ]+?)\s+(?:(?:na |nesta |essa )?(?:semana que vem|proxima semana)\s+)?(?:na |nesta |no |neste |essa |esse |nessa |nesse |proxima |proximo )?(hoje|amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo|dia \d{1,2}(?:\/\d{1,2})?)(?:[- ]feira)?(?:\s+(?:as|a)\s+(\d{1,2})(?:[:h](\d{2}))?\s*h?)?/);
  if (m){
    const tipo = { prova: "Prova", trabalho: "Trabalho", seminario: "Seminário", substitutiva: "Substitutiva" }[m[1]];
    const discN = m[2].trim();
    const discs = config().disciplinas;
    const disc = discs.find(d => norm(d).startsWith(discN.slice(0, 5))) || cap(discN);
    let d;
    if (m[3] === "hoje") d = dia(0); else if (m[3] === "amanha") d = dia(1);
    else if (m[3].startsWith("dia")){ const [dd, mm] = m[3].slice(4).split("/").map(Number); d = new Date(hoje().getFullYear(), mm ? mm - 1 : hoje().getMonth(), dd); if (d < hoje()) d.setMonth(d.getMonth() + (mm ? 12 : 1)); }
    else { const alvo = DIAS_N.indexOf(m[3]); let k = (alvo - hoje().getDay() + 7) % 7; if (/semana que vem|proxima semana/.test(n) && k <= (7 - hoje().getDay()) % 7) k += 7; /* semana começando na segunda */ d = dia(k); }
    d.setHours(m[4] ? Number(m[4]) : 8, m[5] ? Number(m[5]) : 0, 0, 0);
    if (m[4] && /\b(da tarde|da noite)\b/.test(n) && d.getHours() < 12) d.setHours(d.getHours() + 12);
    const fimD = new Date(d.getTime() + 7200000);
    const choque = ctx.eventosDoDia(d).find(e => !e.diaTodo && e.ini < fimD && d < e.fim);
    return { resp: "Confere antes de eu salvar?" + (choque ? `\n\nAtenção: choca com "${choque.titulo}" (${fHora(choque.ini)}–${fHora(choque.fim)}).` : ""), previa: { acao: "aval", dados: { tipo, disc, titulo: tipo + " de " + disc, data: d.toISOString(), feita: false }, campos: { "Tipo": tipo, "Disciplina": disc + (discs.includes(disc) ? "" : " (nova)"), "Quando": `${rotuloDia(d)}, ${fData(d)} às ${fHora(d)}` } } };
  }

  const base = texto.normalize("NFC").replace(/\s+/g, " ").trim();
  const outro = lerNota(n) || lerFeita(n) || lerDisciplina(n, base) || lerEstudo(n, base) || lerOrcamento(n)
    || lerAgua(n) || lerCarga(n, base) || lerTreino(n, base) || lerMed(n, base) || lerDose(n) || lerConsulta(n, base) || lerExame(n, base) || lerSintoma(n, base) || lerRefeicao(n, base);
  if (outro) return outro;

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
    let titulo = texto
      .replace(/^\s*rotina:\s*/i, "").replace(/^\s*eu\s+/i, "")
      .replace(/tod[ao]s?\s+(os\s+|as\s+)?dias?|todo santo dia|de segunda a sexta([- ]feira)?|nos dias úteis|nos dias uteis|nos fins? de semana|fins? de semana/gi, "")
      .replace(/\b(tod[ao]s?\s+(as\s+|os\s+)?|às\s+|aos?\s+)?(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)s?([- ]feiras?)?(\s*(,|\be\b)\s*)?/gi, "")
      .replace(/\b(das|de|às|as|a partir das)\s*\d{1,2}([:h]\d{2})?\s*h?(\s*(às|as|até|ate|a)\s*\d{1,2}([:h]\d{2})?\s*h?)?/gi, "")
      .replace(/^\s*(eu\s+)?(tenho|faço|faco|vou\s+(pra|para|ao|à|a|no|na)?|levo|busco|trabalho\s+(no|na|em)?)\s+/i, "")
      .replace(/^[\s,.;:-]+|[\s,.;:!?-]+$/g, "").trim();
    if (!titulo) return { resp: "O que acontece nesse horário? Ex.: \"Toda segunda tenho academia das 7h às 8h\"." };
    if (titulo.length > 40) return { naoEntendi: true, resp: `Não entendi bem essa rotina. Escreva só ela, por exemplo: "Toda ${DIAS[dsel[0]]} tenho tutoria das 14h às 16h".` };
    const t = n.match(/\b(?:das|de|as|a partir das)\s*(\d{1,2})(?:[:h](\d{2}))?\s*h?(?:\s*(?:as|ate|a)\s*(\d{1,2})(?:[:h](\d{2}))?\s*h?)?/);
    if (!t) return { resp: `Em que horário é ${titulo.toLowerCase()}? Ex.: "Toda ${DIAS[dsel[0]]} tenho ${titulo.toLowerCase()} das 14h às 16h".` };
    const pad = x => String(x).padStart(2, "0");
    const h1 = Number(t[1]), mi1 = Number(t[2] || 0); let h2 = t[3] ? Number(t[3]) : h1 + 1, mi2 = Number(t[4] || 0);
    if (h1 > 23 || h2 > 24) return { resp: "Não entendi o horário. Use algo como \"das 7h às 8h\"." };
    if (h2 * 60 + mi2 <= h1 * 60 + mi1) h2 = Math.min(23, h1 + 1);
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
  return { naoEntendi: true, resp: "Não entendi. Eu entendo comandos como:\n• Registre despesa de R$ 35 com ração\n• Gastei 80 em roupa\n• Recebi 200 de freela\n• Tenho prova de Anatomia quinta às 14h\n• Quais provas estão chegando?\n• Quanto gastei este mês? / Qual meu saldo?\n• Organize minha semana / O que tenho hoje?\n• Toda segunda e quarta tenho academia das 7h às 8h\n• Quando eu disser mercadinho, é Alimentação\n• Mostre minha rotina / Remover academia\n• Estudei 2h de Histologia / Fiz a prova de Anatomia\n• Limite de Lazer 300 / Adicionar disciplina Bioquímica\n• Estou com dor de cabeça forte / Bebi 2 copos de água\n• Fiz 30 min de caminhada / Supino 20 kg 3x10\n• Almocei arroz, feijão e frango\n• Comecei a tomar Metformina às 8h / Tomei a Metformina\n• Consulta com ginecologista dia 20/11 às 15h\n• Exame de sangue dia 15/11 / Saiu o resultado do exame de sangue" };
}
