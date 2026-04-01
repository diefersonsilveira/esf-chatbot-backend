const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

const logger = require("./utils/logger");
const { mascararCPF } = require("./utils/cpfUtils");
const { processarMensagem } = require("./services/botService");
const {
  salvarUsuario,
  salvarEvento,
  buscarUsuario,
  atualizarAtendimento,
  buscarAtendimentoAguardandoNPSPorUsuario,
  agoraISO,
} = require("./services/firebaseService");
const {
  obterOuCriarAtendimento,
  registrarMensagemUsuario,
  registrarMensagemBot,
} = require("./services/atendimentoService");
const { iniciarMonitorInatividade } = require("./services/inactivityService");
const { iniciarMonitorSaida } = require("./services/outboundQueueService");

const client = new Client({
  authStrategy: new LocalAuth(),
  authTimeoutMs: 60000,
  webVersionCache: { type: "none" },
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  },
});

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function encerrarAtendimentoComNPS({
  atendimento,
  jidOriginal,
  motivo = "encerramento",
  textoEncerramento = "Atendimento encerrado. Quando precisar, envie uma nova mensagem. 👋",
  textoNps = "Antes de sair, de 0 a 10, como você avalia este atendimento?",
}) {
  const agora = agoraISO();

  await client.sendMessage(jidOriginal, textoEncerramento);
  await registrarMensagemBot(atendimento.id, {
    autor_id: "bot",
    texto: textoEncerramento,
    origem: "encerramento",
  });

  await delay(500);

  await client.sendMessage(jidOriginal, textoNps);
  await registrarMensagemBot(atendimento.id, {
    autor_id: "bot",
    texto: textoNps,
    origem: "nps",
  });

  await atualizarAtendimento(atendimento.id, {
    aberto: false,
    isHuman: false,
    status: motivo === "inatividade" ? "encerrado_por_inatividade" : "finalizado",
    motivo_encerramento: motivo,
    encerrado_em: agora,
    finalizado_em: agora,
    atualizado_em: agora,
    aguardando_nps: true,
    nps_enviado: true,
  });
}

client.on("qr", (qr) => {
  logger.info("QR Code gerado — aguardando leitura");
  salvarEvento("QR", "QR gerado para login");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  logger.info("Autenticado com sucesso");
  salvarEvento("AUTH", "Usuário autenticado");
});

client.on("ready", () => {
  logger.info("WhatsApp conectado e pronto");
  salvarEvento("READY", "Bot conectado");
  iniciarMonitorInatividade(client);
  iniciarMonitorSaida(client);
});

client.on("auth_failure", (msg) => {
  logger.error("Falha na autenticação: " + msg);
  salvarEvento("AUTH_FAIL", String(msg));
});

client.on("disconnected", (reason) => {
  logger.warn("Desconectado: " + reason);
  salvarEvento("DISCONNECT", String(reason));
});

client.on("message", async (msg) => {
  try {
    if (!msg.from || msg.from.endsWith("@g.us")) return;

    const chat = await msg.getChat();
    if (chat.isGroup) return;

    const texto = (msg.body || "").trim();
    if (!texto) return;

    const contact = await msg.getContact().catch(() => null);

    const jidOriginal = msg.from;
    const tipoId = jidOriginal.endsWith("@lid")
      ? "lid"
      : jidOriginal.endsWith("@c.us")
      ? "c.us"
      : "outro";

    const usuarioId = jidOriginal.replace(/@.*$/, "");
    const nomeContato =
      contact?.pushname || contact?.name || chat?.name || null;

    await salvarUsuario(usuarioId, {
      jid_original: jidOriginal,
      tipo_id: tipoId,
      nome_contato_whatsapp: nomeContato,
    });

    logger.info(`Mensagem de ${usuarioId} (${tipoId}): "${texto}"`);

    const atendimentoNps = await buscarAtendimentoAguardandoNPSPorUsuario(usuarioId);

    if (atendimentoNps && /^(10|[0-9])$/.test(texto)) {
      const nota = Number(texto);

      await registrarMensagemUsuario(atendimentoNps.id, {
        autor_id: usuarioId,
        texto,
        origem: "nps_resposta",
        jid_original: jidOriginal,
      });

      await atualizarAtendimento(atendimentoNps.id, {
        nps_respondido: true,
        nps_nota: nota,
        aguardando_nps: false,
        atualizado_em: agoraISO(),
      });

      const respostaNps = "Obrigada pela avaliação! 😊";
      await client.sendMessage(jidOriginal, respostaNps);

      await registrarMensagemBot(atendimentoNps.id, {
        autor_id: "bot",
        texto: respostaNps,
        origem: "nps_confirmacao",
      });

      logger.info(`NPS ${nota} registrado para atendimento ${atendimentoNps.id}`);
      return;
    }

    const atendimento = await obterOuCriarAtendimento(usuarioId, {
      jid_original: jidOriginal,
      tipo_id: tipoId,
      nome_contato_whatsapp: nomeContato,
    });

    await atualizarAtendimento(atendimento.id, {
      jid_original: jidOriginal,
      tipo_id: tipoId,
      nome_contato_whatsapp: nomeContato,
      ultima_mensagem_em: agoraISO(),
      aviso_inatividade_enviado: false,
      lembrete_menu_enviado: false,
      atualizado_em: agoraISO(),
    });

    await registrarMensagemUsuario(atendimento.id, {
      autor_id: usuarioId,
      texto,
      origem: "whatsapp",
      jid_original: jidOriginal,
    });

    if (atendimento.isHuman) {
      if (atendimento.status === "aguardando_usuario") {
        await atualizarAtendimento(atendimento.id, {
          status: "em_atendimento",
          ultima_mensagem_em: agoraISO(),
          atualizado_em: agoraISO(),
          aviso_inatividade_enviado: false,
          lembrete_menu_enviado: false,
        });
      }
      logger.info(`Atendimento ${atendimento.id} em modo humano — bot silencioso`);
      return;
    }

    const resultado = await processarMensagem(texto, usuarioId);
    const resposta = resultado.resposta;

    await delay(800);
    await chat.sendStateTyping();
    await delay(1200);

    await client.sendMessage(jidOriginal, resposta);

    await registrarMensagemBot(atendimento.id, {
      autor_id: "bot",
      texto: resposta,
      origem: "whatsapp_bot",
    });

    if (resultado.novoStatus === "finalizado") {
      await encerrarAtendimentoComNPS({
        atendimento,
        jidOriginal,
        motivo: "encerramento_usuario",
      });

      logger.info(`Atendimento ${atendimento.id} encerrado pelo usuário com NPS pendente`);
      return;
    }

    const payloadAtendimento = {
      status: resultado.novoStatus || "bot",
      intencao_inicial: atendimento.intencao_inicial || resultado.intencao || null,
      intencao_ultima: resultado.intencao || null,
      triagem: resultado.triagem || null,
      ultima_mensagem_em: agoraISO(),
      atualizado_em: agoraISO(),
      aviso_inatividade_enviado: false,
      lembrete_menu_enviado: false,
    };

    await atualizarAtendimento(atendimento.id, payloadAtendimento);

    logger.info(`Resposta enviada para ${usuarioId} | intenção: ${resultado.intencao}`);

    const usuarioAtual = await buscarUsuario(usuarioId);
    if (usuarioAtual?.cpf) {
      logger.info(`Usuário ${usuarioId} identificado com CPF ${mascararCPF(usuarioAtual.cpf)}`);
    }
  } catch (error) {
    logger.error("Erro no processamento da mensagem: " + error.message);
    salvarEvento("ERRO", error.message).catch(() => {});
  }
});

client.initialize().catch((err) => {
  logger.error("Falha ao inicializar o WhatsApp: " + err.message);
  process.exit(1);
});
