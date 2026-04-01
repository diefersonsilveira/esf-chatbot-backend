const moment = require("moment-timezone");
const logger = require("../utils/logger");
const {
  listarAtendimentosInativos,
  atualizarAtendimento,
  adicionarMensagem,
} = require("./firebaseService");
const {
  buscarMensagemPosResposta,
  buscarMensagemInatividadeAviso,
} = require("./responseService");
const { encerrarAtendimento } = require("./finalizationService");

const TEMPO_LEMBRETE_MENU_MIN = 5;
const TEMPO_AVISO_INATIVIDADE_MIN = 25;
const TEMPO_ENCERRAMENTO_MIN = 30;

const STATUS_MONITORADOS = [
  "bot",
  "aguardando_identificacao",
  "aguardando_acs",
  "em_atendimento",
  "aguardando_usuario",
];

function agoraSP() {
  return moment().tz("America/Sao_Paulo");
}

function agoraISO() {
  return agoraSP().format("YYYY-MM-DDTHH:mm:ss.SSSZ");
}

function diffMinutos(iso) {
  if (!iso) return 0;
  return agoraSP().diff(moment(iso), "minutes");
}

async function enviarERegistrar(client, atendimento, texto, origem) {
  await client.sendMessage(atendimento.jid_original, texto);
  await adicionarMensagem(atendimento.id, {
    autor: "bot",
    texto,
    origem,
  });
}

async function processarAtendimentoInativo(client, atendimento) {
  if (!atendimento?.id) return;
  if (!STATUS_MONITORADOS.includes(atendimento.status)) return;
  if (!atendimento.jid_original) return;
  if (!atendimento.aberto) return;
  if (!atendimento.ultima_mensagem_em) return;
  if (atendimento.aguardando_nps) return;

  const minutos = diffMinutos(atendimento.ultima_mensagem_em);
  const atualizadoEm = agoraISO();

  if (
    minutos >= TEMPO_ENCERRAMENTO_MIN &&
    atendimento.aberto
  ) {
    await encerrarAtendimento(client, atendimento, {
      motivo: "inatividade",
      status: "encerrado_por_inatividade",
      origemEncerramento: "inatividade_encerramento",
      enviarMensagemEncerramento: true,
      enviarNPS: true,
    });

    logger.info(`Atendimento encerrado por inatividade — ${atendimento.id}`);
    return;
  }

  if (
    minutos >= TEMPO_AVISO_INATIVIDADE_MIN &&
    !atendimento.aviso_inatividade_enviado
  ) {
    const msgAviso = buscarMensagemInatividadeAviso();

    await enviarERegistrar(client, atendimento, msgAviso, "inatividade_aviso");
    await atualizarAtendimento(atendimento.id, {
      aviso_inatividade_enviado: true,
      atualizado_em: atualizadoEm,
    });

    logger.info(`Aviso 25min enviado — ${atendimento.id}`);
  }

  if (
    minutos >= TEMPO_LEMBRETE_MENU_MIN &&
    !atendimento.lembrete_menu_enviado
  ) {
    const msgMenu = buscarMensagemPosResposta();

    await enviarERegistrar(client, atendimento, msgMenu, "lembrete_menu");
    await atualizarAtendimento(atendimento.id, {
      lembrete_menu_enviado: true,
      atualizado_em: atualizadoEm,
    });

    logger.info(`Lembrete 5min enviado — ${atendimento.id}`);
  }
}

async function processarInatividade(client) {
  const atendimentos = await listarAtendimentosInativos();

  for (const atendimento of atendimentos) {
    try {
      await processarAtendimentoInativo(client, atendimento);
    } catch (err) {
      logger.error(
        `Erro ao processar inatividade do atendimento ${atendimento?.id || "sem-id"}: ${err.message}`
      );
    }
  }
}

function iniciarMonitorInatividade(client) {
  setInterval(async () => {
    try {
      await processarInatividade(client);
    } catch (err) {
      logger.error("Erro no monitor de inatividade: " + err.message);
    }
  }, 60 * 1000);

  logger.info("Monitor de inatividade iniciado");
}

module.exports = {
  iniciarMonitorInatividade,
};