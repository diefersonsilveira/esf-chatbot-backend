const { carregarJson } = require("./responseService");
const { normalizarTexto, contemFrase } = require("../utils/textUtils");

function classificarTriagem(texto = "") {
  const textoNorm = normalizarTexto(texto);
  const triagem = carregarJson("triagem.json");

  for (const nivel of ["urgente", "moderado", "leve"]) {
    const sintomas = (triagem[nivel] || []).map(normalizarTexto);
    for (const sintoma of sintomas) {
      if (contemFrase(textoNorm, sintoma)) return nivel;
    }
  }

  return "nao_classificado";
}

function obterMensagemTriagem(texto = "") {
  const nivel = classificarTriagem(texto);

  const mensagens = {
    urgente:
      "⚠️ *Atenção:* Os sintomas relatados podem indicar uma situação de urgência. Se houver falta de ar, dor no peito, desmaio, convulsão ou outro sintoma grave, procure atendimento de urgência *imediatamente*.",
    moderado:
      "Os sintomas relatados merecem atenção. Se persistirem, piorarem ou estiverem fortes, procure avaliação na unidade de saúde o quanto antes.",
    leve:
      "Mantenha atenção aos sintomas. Se houver piora, persistência ou dúvida, procure orientação da unidade de saúde.",
  };

  return mensagens[nivel] || null;
}

module.exports = {
  classificarTriagem,
  obterMensagemTriagem,
};
