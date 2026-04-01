const {
  buscarEstadoConversa,
  salvarEstadoConversa,
  limparEstadoConversa,
  atualizarUsuario,
  buscarUsuario,
} = require("./firebaseService");
const { validarCPF, limparCPF } = require("../utils/cpfUtils");

async function processarFluxoIdentificacao(usuarioId, texto) {
  const estadoAtual = await buscarEstadoConversa(usuarioId);

  if (estadoAtual.estado === "aguardando_nome") {
    const nome = (texto || "").trim();

    if (nome.length < 3) {
      return {
        handled: true,
        resposta:
          "Por favor, informe seu nome completo para continuar o atendimento.",
        estado: "aguardando_nome",
      };
    }

    await atualizarUsuario(usuarioId, { nome });
    await salvarEstadoConversa(usuarioId, "aguardando_cpf", {
      fluxo: "identificacao_acs",
      nome_informado: nome,
    });

    return {
      handled: true,
      resposta:
        "Obrigada. Agora informe seu CPF para confirmar o atendimento.\n\nDigite apenas os números ou no formato 000.000.000-00.",
      estado: "aguardando_cpf",
    };
  }

  if (estadoAtual.estado === "aguardando_cpf") {
    const cpf = limparCPF(texto || "");

    if (!validarCPF(cpf)) {
      return {
        handled: true,
        resposta:
          "O CPF informado parece inválido. Por favor, envie novamente um CPF válido.",
        estado: "aguardando_cpf",
      };
    }

    await atualizarUsuario(usuarioId, { cpf, identificado: true });
    await salvarEstadoConversa(usuarioId, "identificado", {
      fluxo: "identificacao_acs",
    });

    const nomeConfirmado = estadoAtual.nome_informado || "usuário";

    return {
      handled: true,
      resposta:
        `Cadastro confirmado, *${nomeConfirmado}*.\n\n` +
        `Seus dados foram registrados e um ACS poderá dar continuidade ao atendimento.\n\n` +
        `Digite *MENU* para voltar ao menu principal ou aguarde orientação da equipe.`,
      estado: "identificado",
    };
  }

  return { handled: false };
}

async function iniciarFluxoACS(usuarioId) {
  await salvarEstadoConversa(usuarioId, "aguardando_nome", {
    fluxo: "identificacao_acs",
  });

  return (
    "Para falar com um ACS, preciso confirmar alguns dados.\n\n" +
    "Por favor, informe seu *nome completo*."
  );
}

async function encerrarFluxo(usuarioId) {
  await limparEstadoConversa(usuarioId);
}

module.exports = {
  processarFluxoIdentificacao,
  iniciarFluxoACS,
  encerrarFluxo,
};
