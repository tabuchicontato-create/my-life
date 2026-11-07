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
  return { resp: "Não entendi. Eu entendo comandos como:\n• Registre despesa de R$ 35 com ração\n• Gastei 80 em roupa\n• Recebi 200 de freela\n• Tenho prova de Anatomia quinta às 14h\n• Quais provas estão chegando?\n• Quanto gastei este mês? / Qual meu saldo?\n• Organize minha semana / O que tenho hoje?\n• Toda segunda e quarta tenho academia das 7h às 8h\n• Quando eu disser mercadinho, é Alimentação\n• Mostre minha rotina / Remover academia" };
}
