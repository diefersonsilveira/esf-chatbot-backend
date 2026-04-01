const {
  criarOuObterAtendimentoAberto,
  atualizarAtendimento,
  adicionarMensagem,
  incrementarTotalMensagensAtendimento,
  agoraISO,
} = require("./firebaseService");

async function obterOuCriarAtendimento(usuarioId, dados = {}) {
  return criarOuObterAtendimentoAberto(usuarioId, {
    status: "bot",
    origem_abertura: "nova_mensagem",
    ...dados,
  });
}

async function registrarMensagemUsuario(atendimentoId, payload) {
  await adicionarMensagem(atendimentoId, {
    autor: "usuario",
    ...payload,
  });

  await incrementarTotalMensagensAtendimento(atendimentoId);
}

async function registrarMensagemBot(atendimentoId, payload) {
  await adicionarMensagem(atendimentoId, {
    autor: "bot",
    ...payload,
  });

  await atualizarAtendimento(atendimentoId, {
    ultima_mensagem_em: agoraISO(),
  });
}

async function registrarMensagemACS(atendimentoId, payload) {
  await adicionarMensagem(atendimentoId, {
    autor: "acs",
    ...payload,
  });

  await atualizarAtendimento(atendimentoId, {
    status: "aguardando_usuario",
    ultima_mensagem_em: agoraISO(),
  });
}

module.exports = {
  obterOuCriarAtendimento,
  registrarMensagemUsuario,
  registrarMensagemBot,
  registrarMensagemACS,
};
