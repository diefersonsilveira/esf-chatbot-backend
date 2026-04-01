const admin = require("firebase-admin");
const logger = require("../utils/logger");

if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON não configurada");
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} catch (err) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON inválida");
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function agoraISO() {
  return new Date().toISOString();
}

// ─── Usuarios ─────────────────────────────────────────────────────────────────

async function salvarUsuario(usuarioId, dados = {}) {
  try {
    const ref = db.collection("usuarios").doc(usuarioId);
    const doc = await ref.get();

    const payloadBase = {
      usuario_id: usuarioId,
      ultima_interacao: agoraISO(),
      ...dados,
    };

    if (!doc.exists) {
      await ref.set({
        ...payloadBase,
        primeira_interacao: agoraISO(),
        total_mensagens: 1,
      });
    } else {
      await ref.set(
        { ...payloadBase, total_mensagens: FieldValue.increment(1) },
        { merge: true }
      );
    }
  } catch (err) {
    logger.error("Erro ao salvar usuario: " + err.message);
  }
}

async function atualizarUsuario(usuarioId, dados = {}) {
  try {
    await db
      .collection("usuarios")
      .doc(usuarioId)
      .set({ ...dados, ultima_interacao: agoraISO() }, { merge: true });
  } catch (err) {
    logger.error("Erro ao atualizar usuario: " + err.message);
  }
}

async function buscarUsuario(usuarioId) {
  try {
    const doc = await db.collection("usuarios").doc(usuarioId).get();
    return doc.exists ? doc.data() : null;
  } catch (err) {
    logger.error("Erro ao buscar usuario: " + err.message);
    return null;
  }
}

// ─── Estado de conversa ───────────────────────────────────────────────────────

async function salvarEstadoConversa(usuarioId, estado, extras = {}) {
  try {
    await db
      .collection("estado_conversas")
      .doc(usuarioId)
      .set(
        { usuario_id: usuarioId, estado, atualizado_em: agoraISO(), ...extras },
        { merge: true }
      );
  } catch (err) {
    logger.error("Erro ao salvar estado da conversa: " + err.message);
  }
}

async function buscarEstadoConversa(usuarioId) {
  try {
    const doc = await db.collection("estado_conversas").doc(usuarioId).get();
    return doc.exists ? doc.data() : { estado: "livre" };
  } catch (err) {
    logger.error("Erro ao buscar estado da conversa: " + err.message);
    return { estado: "livre" };
  }
}

async function limparEstadoConversa(usuarioId) {
  try {
    await db
      .collection("estado_conversas")
      .doc(usuarioId)
      .set(
        { usuario_id: usuarioId, estado: "livre", atualizado_em: agoraISO() },
        { merge: true }
      );
  } catch (err) {
    logger.error("Erro ao limpar estado da conversa: " + err.message);
  }
}

// ─── Atendimentos ─────────────────────────────────────────────────────────────

async function buscarAtendimentoAbertoPorUsuario(usuarioId) {
  try {
    const doc = await db.collection("atendimentos_abertos").doc(usuarioId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  } catch (err) {
    logger.error("Erro ao buscar atendimento aberto: " + err.message);
    return null;
  }
}

async function buscarAtendimentoAguardandoNPSPorUsuario(usuarioId) {
  try {
    const doc = await db.collection("atendimentos_abertos").doc(usuarioId).get();
    if (!doc.exists) return null;

    const data = doc.data();
    if (!data.aguardando_nps) return null;

    return { id: doc.id, ...data };
  } catch (err) {
    logger.error("Erro ao buscar atendimento aguardando NPS: " + err.message);
    return null;
  }
}

async function criarOuObterAtendimentoAberto(usuarioId, dados = {}) {
  try {
    const ref = db.collection("atendimentos_abertos").doc(usuarioId);

    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(ref);
      const agora = agoraISO();

      const novoAtendimento = {
        usuario_id: usuarioId,
        aberto: true,
        status: "bot",
        assignedTo: null,
        assignedToNome: null,
        aviso_inatividade_enviado: false,
        lembrete_menu_enviado: false,
        nps_enviado: false,
        aguardando_nps: false,
        nps_respondido: false,
        nps_nota: null,
        nps_comentario: null,
        total_mensagens: 0,
        ultima_mensagem_em: agora,
        criado_em: agora,
        atualizado_em: agora,
        ...dados,
      };

      if (!doc.exists || doc.data().aberto === false) {
        transaction.set(ref, novoAtendimento);
      } else {
        transaction.set(ref, { ...dados, atualizado_em: agora }, { merge: true });
      }
    });

    const finalDoc = await ref.get();
    return { id: finalDoc.id, ...finalDoc.data() };
  } catch (err) {
    logger.error("Erro ao criar/obter atendimento aberto: " + err.message);
    return null;
  }
}

async function atualizarAtendimento(atendimentoId, dados = {}) {
  try {
    await db
      .collection("atendimentos_abertos")
      .doc(atendimentoId)
      .set({ ...dados, atualizado_em: agoraISO() }, { merge: true });
  } catch (err) {
    logger.error("Erro ao atualizar atendimento: " + err.message);
  }
}

async function incrementarTotalMensagensAtendimento(atendimentoId) {
  try {
    await db
      .collection("atendimentos_abertos")
      .doc(atendimentoId)
      .set(
        { total_mensagens: FieldValue.increment(1), atualizado_em: agoraISO() },
        { merge: true }
      );
  } catch (err) {
    logger.error("Erro ao incrementar mensagens do atendimento: " + err.message);
  }
}

// ─── Mensagens ────────────────────────────────────────────────────────────────

async function adicionarMensagem(atendimentoId, dados = {}) {
  try {
    await db.collection("mensagens").add({
      atendimento_id: atendimentoId,
      criado_em: agoraISO(),
      ...dados,
    });
  } catch (err) {
    logger.error("Erro ao adicionar mensagem: " + err.message);
  }
}

// ─── Monitores ────────────────────────────────────────────────────────────────

async function listarAtendimentosInativos() {
  try {
    const snap = await db
      .collection("atendimentos_abertos")
      .where("aberto", "==", true)
      .get();

    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    logger.error("Erro ao listar atendimentos inativos: " + err.message);
    return [];
  }
}

async function listarMensagensPendentes() {
  try {
    const snap = await db
      .collection("mensagens_pendentes")
      .where("status", "==", "pendente")
      .limit(20)
      .get();

    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => (a.criado_em > b.criado_em ? 1 : -1));
    return docs;
  } catch (err) {
    logger.error("Erro ao listar mensagens pendentes: " + err.message);
    return [];
  }
}

async function marcarMensagemPendenteEnviada(id) {
  try {
    await db
      .collection("mensagens_pendentes")
      .doc(id)
      .set({ status: "enviada", enviada_em: agoraISO() }, { merge: true });
  } catch (err) {
    logger.error("Erro ao marcar mensagem pendente como enviada: " + err.message);
  }
}

async function marcarMensagemPendenteErro(id, erro) {
  try {
    await db
      .collection("mensagens_pendentes")
      .doc(id)
      .set(
        { status: "erro", erro: String(erro || ""), erro_em: agoraISO() },
        { merge: true }
      );
  } catch (err) {
    logger.error("Erro ao marcar mensagem pendente como erro: " + err.message);
  }
}

// ─── Eventos / Logs ───────────────────────────────────────────────────────────

async function salvarEvento(tipo, detalhe) {
  try {
    await db.collection("logs_eventos").add({
      tipo,
      detalhe: String(detalhe || ""),
      data_hora: agoraISO(),
    });
  } catch (err) {
    logger.warn("Evento nao salvo no Firebase: " + err.message);
  }
}

module.exports = {
  db,
  agoraISO,
  salvarUsuario,
  atualizarUsuario,
  buscarUsuario,
  salvarEstadoConversa,
  buscarEstadoConversa,
  limparEstadoConversa,
  buscarAtendimentoAbertoPorUsuario,
  criarOuObterAtendimentoAberto,
  buscarAtendimentoAguardandoNPSPorUsuario,
  atualizarAtendimento,
  incrementarTotalMensagensAtendimento,
  adicionarMensagem,
  listarAtendimentosInativos,
  listarMensagensPendentes,
  marcarMensagemPendenteEnviada,
  marcarMensagemPendenteErro,
  salvarEvento,
};