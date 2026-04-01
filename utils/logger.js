const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");

const LOG_DIR = path.join(__dirname, "..", "logs");
const LOG_FILE = path.join(LOG_DIR, "chatbot.log");

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function agora() {
  return moment().tz("America/Sao_Paulo").format("DD/MM/YYYY HH:mm:ss");
}

function escrever(nivel, mensagem) {
  const linha = `[${nivel.padEnd(4)}] [${agora()}] ${mensagem}`;
  console.log(linha);

  try {
    fs.appendFileSync(LOG_FILE, linha + "\n", "utf8");
  } catch {
  }
}

module.exports = {
  info: (m) => escrever("INFO", m),
  warn: (m) => escrever("WARN", m),
  error: (m) => escrever("ERRO", m),
};
