const { carregarJson } = require("./responseService");
const { normalizarTexto, contemFrase } = require("../utils/textUtils");

const MAPA_NUMERICO = {
  "0": "acs",
  "1": "horario",
  "2": "agendamento",
  "3": "receita",
  "4": "vacina",
  "5": "pressao",
  "6": "exames",
  "7": "documentos",
  "8": "localizacao",
};

const PRIORIDADE_INTENCOES = [
  "acs",
  "pressao",
  "feriado",
  "horario",
  "agendamento",
  "receita",
  "vacina",
  "exames",
  "documentos",
  "localizacao",
  "contato",
];

const PREFIXOS_SAUDACAO = [
  "oi", "ola", "bom dia", "boa tarde", "boa noite",
  "hey", "hei", "salve", "e ai", "eai",
  "oi tudo bem", "tudo bem", "tudo bom",
];

function removerPrefixoSaudacao(textoNorm) {
  for (const prefixo of PREFIXOS_SAUDACAO.map(normalizarTexto).sort((a, b) => b.length - a.length)) {
    if (textoNorm.startsWith(prefixo)) {
      const resto = textoNorm.slice(prefixo.length).replace(/^[\s,!.?;:-]+/, "").trim();
      if (resto.length > 0) return resto;
    }
  }
  return textoNorm;
}

function calcularScore(textoNorm, palavras) {
  let score = 0;
  for (const palavra of palavras) {
    const palavraNorm = normalizarTexto(palavra);
    if (contemFrase(textoNorm, palavraNorm)) {
      score += palavraNorm.split(" ").length;
    }
  }
  return score;
}

function detectarIntencao(texto = "") {
  const textoNorm = normalizarTexto(texto);
  if (!textoNorm) return "default";

  if (MAPA_NUMERICO[textoNorm]) {
    return MAPA_NUMERICO[textoNorm];
  }

  const intencoes = carregarJson("intencoes.json");
  const saudacoes = (intencoes.saudacao || []).map(normalizarTexto);

  if (saudacoes.includes(textoNorm)) {
    return "menu";
  }

  const textoSemSaudacao = removerPrefixoSaudacao(textoNorm);
  const textoParaAnalisar = textoSemSaudacao !== textoNorm ? textoSemSaudacao : textoNorm;

  const pontuacoes = {};

  for (const [intencao, palavras] of Object.entries(intencoes)) {
    if (intencao === "saudacao") continue;

    const scoreFull = calcularScore(textoNorm, palavras);
    const scoreSemSaudacao = textoParaAnalisar !== textoNorm
      ? calcularScore(textoParaAnalisar, palavras)
      : 0;

    const score = Math.max(scoreFull, scoreSemSaudacao);
    if (score > 0) pontuacoes[intencao] = score;
  }

  if (!Object.keys(pontuacoes).length) {
    if (textoParaAnalisar !== textoNorm) return "menu";
    return "default";
  }

  const maiorScore = Math.max(...Object.values(pontuacoes));
  const candidatas = Object.keys(pontuacoes).filter((k) => pontuacoes[k] === maiorScore);

  for (const i of PRIORIDADE_INTENCOES) {
    if (candidatas.includes(i)) return i;
  }

  return candidatas[0];
}

module.exports = {
  detectarIntencao,
};
