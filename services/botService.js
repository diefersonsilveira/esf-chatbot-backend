const { detectarIntencao } = require("./intentService");
const {
  buscarMenu,
  buscarResposta,
  montarRespostaLocalizacao,
  montarRespostaContato,
  obterConfig,
  buscarMensagemEncerramento,
  montarRespostaComRodape,
} = require("./responseService");
const { obterMensagemTriagem } = require("./triageService");
const { normalizarTexto, contemFrase } = require("../utils/textUtils");
const {
  processarFluxoIdentificacao,
  iniciarFluxoACS,
  encerrarFluxo,
} = require("./identityService");

const SAUDACOES_BOM_DIA   = ["bom dia", "bom diaa", "bom dia!", "bom dia gente"];
const SAUDACOES_BOA_TARDE = ["boa tarde", "boa tardee", "boa tarde!", "boa tarde gente"];
const SAUDACOES_BOA_NOITE = ["boa noite", "boa noitee", "boa noite!", "boa noite gente"];

function detectarSaudacaoTemporal(textoNorm) {
  if (SAUDACOES_BOM_DIA.some((s) => contemFrase(textoNorm, normalizarTexto(s)))) return "Bom dia";
  if (SAUDACOES_BOA_TARDE.some((s) => contemFrase(textoNorm, normalizarTexto(s)))) return "Boa tarde";
  if (SAUDACOES_BOA_NOITE.some((s) => contemFrase(textoNorm, normalizarTexto(s)))) return "Boa noite";
  return null;
}

function desejaEncerrar(texto = "") {
  const config = obterConfig();
  const palavras = config.palavras_encerramento || [];
  const textoNorm = normalizarTexto(texto);
  return palavras.map(normalizarTexto).includes(textoNorm);
}

async function processarMensagem(texto = "", usuarioId) {
  const textoNorm = normalizarTexto(texto);

  if (desejaEncerrar(texto)) {
    await encerrarFluxo(usuarioId);
    return {
      resposta: buscarMensagemEncerramento(),
      intencao: "encerramento",
      triagem: null,
      novoStatus: "finalizado",
    };
  }

  const resultadoIdentificacao = await processarFluxoIdentificacao(usuarioId, texto);

  if (resultadoIdentificacao.handled) {
    const estaIdentificado = resultadoIdentificacao.estado === "identificado";
    return {
      resposta: resultadoIdentificacao.resposta,
      intencao: "identificacao",
      triagem: null,
      estado_conversa: resultadoIdentificacao.estado || null,
      novoStatus: estaIdentificado ? "aguardando_acs" : "aguardando_identificacao",
    };
  }

  const intencao = detectarIntencao(texto);

  const saudacaoTemporal = detectarSaudacaoTemporal(textoNorm);

  const prefixoSaudacao = saudacaoTemporal ? `${saudacaoTemporal}! ` : "";

  switch (intencao) {
    case "menu":
      return {
        resposta: prefixoSaudacao
          ? prefixoSaudacao + buscarMenu()
          : buscarMenu(),
        intencao,
        triagem: null,
        novoStatus: "bot",
      };

    case "localizacao":
      return {
        resposta: montarRespostaComRodape(montarRespostaLocalizacao()),
        intencao,
        triagem: null,
        novoStatus: "bot",
      };

    case "contato":
      return {
        resposta: montarRespostaComRodape(montarRespostaContato()),
        intencao,
        triagem: null,
        novoStatus: "bot",
      };

    case "pressao": {
      const respostaBase = buscarResposta("pressao");
      const mensagemTriagem = obterMensagemTriagem(texto);
      return {
        resposta: montarRespostaComRodape(
          mensagemTriagem ? `${respostaBase}\n\n${mensagemTriagem}` : respostaBase
        ),
        intencao,
        triagem: mensagemTriagem || null,
        novoStatus: "bot",
      };
    }

    case "acs": {
      const respostaACS = await iniciarFluxoACS(usuarioId);
      return {
        resposta: respostaACS,
        intencao,
        triagem: null,
        estado_conversa: "aguardando_nome",
        novoStatus: "aguardando_identificacao",
      };
    }

    default:
      return {
        resposta: montarRespostaComRodape(buscarResposta(intencao)),
        intencao,
        triagem: null,
        novoStatus: "bot",
      };
  }
}

module.exports = {
  processarMensagem,
};
