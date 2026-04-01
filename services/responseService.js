const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

const _cache = {};

function carregarJson(nomeArquivo) {
  if (_cache[nomeArquivo]) return _cache[nomeArquivo];

  const caminho = path.join(DATA_DIR, nomeArquivo);
  if (!fs.existsSync(caminho)) return {};

  try {
    const conteudo = JSON.parse(fs.readFileSync(caminho, "utf-8"));
    _cache[nomeArquivo] = conteudo;
    return conteudo;
  } catch {
    return {};
  }
}

function invalidarCache(nomeArquivo) {
  delete _cache[nomeArquivo];
}

function obterConfig() {
  return carregarJson("config.json");
}

function obterRespostas() {
  return carregarJson("respostas.json");
}

function buscarResposta(chave) {
  const respostas = obterRespostas();
  const config = obterConfig();

  return (
    respostas[chave] ||
    respostas.default ||
    config.mensagem_default ||
    "Não consegui identificar sua dúvida. Digite MENU para ver as opções disponíveis."
  );
}

function buscarMenu() {
  const config = obterConfig();
  const nomeUnidade = config.nome_unidade || "Unidade de Saúde";

  const linhas = [
    config.mensagem_boas_vindas || `Olá! Sou o assistente virtual da ${nomeUnidade}.`,
    "",
    "Digite uma das opções abaixo:",
    ...(config.menu_opcoes || []),
    "",
    "Você também pode escrever sua dúvida por texto.",
  ];

  return linhas.join("\n");
}

function buscarDadosUnidade() {
  const config = obterConfig();
  return {
    nome_unidade: config.nome_unidade || "Unidade de Saúde",
    telefone: config.telefone || "Não informado",
    endereco: config.endereco || "Não informado",
    horario_funcionamento: config.horario_funcionamento || "Não informado",
  };
}

function montarRespostaLocalizacao() {
  const d = buscarDadosUnidade();
  return (
    `📍 *${d.nome_unidade}*\n` +
    `Endereço: ${d.endereco}\n` +
    `Horário: ${d.horario_funcionamento}\n` +
    `Telefone: ${d.telefone}`
  );
}

function montarRespostaContato() {
  const d = buscarDadosUnidade();
  return (
    `📞 *Contato da unidade*\n` +
    `Telefone: ${d.telefone}\n` +
    `Horário de funcionamento: ${d.horario_funcionamento}`
  );
}

function buscarMensagemPosResposta() {
  return (
    obterConfig().mensagem_pos_resposta ||
    "Digite *MENU* para voltar ao menu principal, *0* para falar com um ACS ou *SAIR* para encerrar."
  );
}

function buscarMensagemEncerramento() {
  return (
    obterConfig().mensagem_encerramento ||
    "Atendimento encerrado. Quando precisar, envie uma nova mensagem. 👋"
  );
}

function buscarMensagemInatividadeAviso() {
  return (
    obterConfig().mensagem_inatividade_aviso ||
    "Seu atendimento está sem interação há algum tempo. Se ainda precisar de ajuda, responda esta mensagem. Caso contrário, ele será encerrado em breve."
  );
}

function buscarMensagemInatividadeEncerramento() {
  return (
    obterConfig().mensagem_inatividade_encerramento ||
    "Seu atendimento foi encerrado por inatividade. Se precisar de ajuda, basta enviar uma nova mensagem."
  );
}

function buscarMensagemNPS() {
  return (
    obterConfig().mensagem_nps ||
    "Antes de sair, de *0 a 10*, como você avalia este atendimento?"
  );
}

function montarRespostaComRodape(texto) {
  if (!texto) return buscarMensagemPosResposta();
  return `${texto}\n\n${buscarMensagemPosResposta()}`;
}

module.exports = {
  carregarJson,
  invalidarCache,
  obterConfig,
  obterRespostas,
  buscarResposta,
  buscarMenu,
  buscarDadosUnidade,
  montarRespostaLocalizacao,
  montarRespostaContato,
  buscarMensagemPosResposta,
  buscarMensagemEncerramento,
  buscarMensagemInatividadeAviso,
  buscarMensagemInatividadeEncerramento,
  buscarMensagemNPS,
  montarRespostaComRodape,
};
