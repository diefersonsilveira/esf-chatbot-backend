const removerAcentos = (texto = "") =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const normalizarTexto = (texto = "") =>
  removerAcentos(texto).toLowerCase().trim().replace(/\s+/g, " ");

const contemFrase = (texto, frase) =>
  normalizarTexto(texto).includes(normalizarTexto(frase));

module.exports = {
  normalizarTexto,
  contemFrase,
};
