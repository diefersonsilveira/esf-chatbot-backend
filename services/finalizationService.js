const logger = require("../utils/logger");
const {
  atualizarAtendimento,
  adicionarMensagem,
  agoraISO,
  limparEstadoConversa,
} = require("./firebaseService");
const {
  buscarMensagemEncerramento,
  buscarMensagemNPS,
  buscarMensagemInatividadeEncerramento,
} = require("./responseService");

async function enviarMensagemSistema(client, atendimento, texto, origem) {
  if (!atendimento?.jid_original) return;

  await client.sendMessage(atendimento.jid_original, texto);

  await adicionarMensagem(atendimento.id, {
    autor: "bot",
    texto,
    origem,
  });
}

async function encerrarAtendimento(client, atendimento, opts = {}) {
  const agora = agoraISO();

  const {
    motivo = "encerramento",
    status = "finalizado",
    encerradoPorId = null,
    encerradoPorNome = null,
    textoEncerramento = null,
    enviarMensagemEncerramento = true,
    enviarNPS = true,
    origemEncerramento = "encerramento",
  } = opts;

  if (!atendimento?.id) {
    throw new Error("Atendimento inválido para encerramento");
  }

  if (!atendimento.aberto) {
    return { success: true, jaEncerrado: true };
  }

  const podeEnviarWhatsapp = Boolean(atendimento.jid_original);

  if (enviarMensagemEncerramento && podeEnviarWhatsapp) {
    const msgEnc =
      textoEncerramento ||
      (motivo === "inatividade"
        ? buscarMensagemInatividadeEncerramento()
        : buscarMensagemEncerramento());

    await enviarMensagemSistema(client, atendimento, msgEnc, origemEncerramento);
  }

  let npsEnviado = false;

  if (enviarNPS && podeEnviarWhatsapp) {
    const msgNps = buscarMensagemNPS();
    await enviarMensagemSistema(client, atendimento, msgNps, "nps");
    npsEnviado = true;
  }

  await atualizarAtendimento(atendimento.id, {
    aberto: false,
    isHuman: false,
    status,
    motivo_encerramento: motivo,
    encerrado_em: agora,
    finalizado_em: agora,
    atualizado_em: agora,
    ultima_mensagem_em: agora,

    finalizado_por: encerradoPorId,
    finalizado_por_nome: encerradoPorNome,

    nps_enviado: npsEnviado,
    aguardando_nps: npsEnviado,
    nps_respondido: false,

    aviso_inatividade_enviado: false,
    lembrete_menu_enviado: false,
  });

  if (atendimento.usuario_id || atendimento.id) {
    try {
      await limparEstadoConversa(atendimento.usuario_id || atendimento.id);
    } catch (err) {
      logger.warn(
        `Aviso: não foi possível limpar estado da conversa para ${atendimento.id}: ${err.message}`
      );
    }
  }

  logger.info(
    `Atendimento ${atendimento.id} encerrado | motivo=${motivo} | nps=${npsEnviado}`
  );

  return { success: true, npsEnviado };
}

module.exports = {
  encerrarAtendimento,
};
