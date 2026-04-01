const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

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
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-extensions",
      "--single-process",
      "--no-zygote"
    ],
  },
});

const PHONE_NUMBER = process.env.WHATSAPP_PHONE_NUMBER; 
// Ex.: 5553999999999

client.on("qr", (qr) => {
  console.log("QR gerado como fallback:");
  qrcode.generate(qr, { small: true });
});

client.on("code", (code) => {
  console.log("Código de pareamento:", code);
});

client.on("ready", () => {
  console.log("WhatsApp conectado");
});

client.on("authenticated", () => {
  console.log("Autenticado com sucesso");
});

client.on("auth_failure", (msg) => {
  console.error("Falha de autenticação:", msg);
});

client.on("disconnected", (reason) => {
  console.warn("Desconectado:", reason);
});

client.initialize();

client.once("loading_screen", async () => {
  try {
    if (PHONE_NUMBER) {
      const code = await client.requestPairingCode(PHONE_NUMBER, true, 180000);
      console.log("Código de pareamento:", code);
    }
  } catch (err) {
    console.error("Erro ao gerar pairing code:", err.message);
  }
});