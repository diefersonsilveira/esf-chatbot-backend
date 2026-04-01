const logger = require("../utils/logger");
const {
  listarMensagensPendentes,
  marcarMensagemPendenteEnviada,
  marcarMensagemPendenteErro,
  atualizarAtendimento,
  agoraISO,
} = require("./firebaseService");

async function processarMensagensPendentes(client) {
  const pendentes = await listarMensagensPendentes();

  for (const item of pendentes) {
    try {
      if (!item.jid_original || !item.texto) {
        await marcarMensagemPendenteErro(
          item.id,
          "jid_original ou texto ausente"
        );
        logger.warn(
          `Mensagem pendente ${item.id} ignorada: campos obrigatórios ausentes`
        );
        continue;
      }

      await client.sendMessage(item.jid_original, item.texto);

      if (item.atendimento_id) {
        const agora = agoraISO();

        await atualizarAtendimento(item.atendimento_id, {
          status: "aguardando_usuario",
          ultima_mensagem_em: agora,
          atualizado_em: agora,
          aviso_inatividade_enviado: false,
          lembrete_menu_enviado: false,
        });
      }

      await marcarMensagemPendenteEnviada(item.id);
      logger.info(`Mensagem pendente enviada — id: ${item.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      await marcarMensagemPendenteErro(item.id, msg);
      logger.error(`Erro ao enviar mensagem pendente ${item.id}: ${msg}`);
    }
  }
}

function iniciarMonitorSaida(client) {
  setInterval(async () => {
    try {
      await processarMensagensPendentes(client);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      logger.error("Erro no monitor de mensagens pendentes: " + msg);
    }
  }, 5000);

  logger.info("Monitor de fila de saída iniciado");
}

module.exports = {
  iniciarMonitorSaida,
};
