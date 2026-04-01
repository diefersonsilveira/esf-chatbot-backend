# Chatbot ESF — WhatsApp Bot para Estratégia de Saúde da Família

Bot de atendimento automatizado via WhatsApp para unidades ESF, com fluxo de triagem, identificação de usuários via CPF, integração com Firebase e fila de mensagens para ACS.

---

## Estrutura do projeto

```
chatbot-esf/
├── chatbot.js                  # Ponto de entrada — eventos do WhatsApp
├── package.json
├── data/
│   ├── config.json             # Configurações da unidade e mensagens
│   ├── intencoes.json          # Palavras-chave por intenção
│   ├── respostas.json          # Respostas por intenção
│   └── triagem.json            # Sintomas por nível de urgência
├── services/
│   ├── botService.js           # Orquestração principal do fluxo
│   ├── intentService.js        # Detecção de intenção por score
│   ├── identityService.js      # Fluxo de identificação (nome → CPF)
│   ├── triageService.js        # Classificação de sintomas
│   ├── responseService.js      # Leitura de dados e montagem de respostas
│   ├── atendimentoService.js   # Registro de mensagens e atendimentos
│   ├── firebaseService.js      # Acesso ao Firestore
│   ├── inactivityService.js    # Monitor de inatividade (5/25/30 min)
│   └── outboundQueueService.js # Fila de mensagens do painel ACS
└── utils/
    ├── cpfUtils.js             # Limpeza, validação e mascaramento de CPF
    ├── logger.js               # Logger com timestamp de Brasília
    └── textUtils.js            # Normalização e busca de texto
```

---

## Fluxo de atendimento

```
Mensagem recebida
       │
       ├─ Vazia? → Ignora
       ├─ Grupo? → Ignora
       │
       ├─ NPS pendente + nota 0-10? → Registra NPS → Fim
       │
       ├─ Em atendimento com ACS? → Registra mensagem → Silencia bot
       │
       └─ Bot processa:
             ├─ Palavra de encerramento → Encerra atendimento
             ├─ Estado aguardando_nome → Coleta nome
             ├─ Estado aguardando_cpf  → Valida CPF → Identifica usuário
             └─ Detecta intenção → Responde
```

---

## Regras de inatividade (inactivityService)

| Tempo sem mensagem | Ação                                      |
|--------------------|-------------------------------------------|
| 5 minutos          | Envia lembrete do menu                    |
| 25 minutos         | Envia aviso de encerramento próximo       |
| 30 minutos         | Encerra atendimento + envia NPS (se elegível) |

NPS é enviado se o atendimento teve ACS vinculado **ou** ≥ 3 mensagens.

---

## Configuração

### 1. Firebase

Coloque o arquivo de credenciais em `firebase-key.json` (não versionar — já está no `.gitignore`).

### 2. `data/config.json`

Edite os campos:

```json
{
  "nome_unidade": "ESF São Vicente",
  "telefone": "(55) 99999-9999",
  "endereco": "Rua Exemplo, 123 - Bairro São Vicente",
  "horario_funcionamento": "Segunda a sexta, das 07:00 às 17:00"
}
```

### 3. Instalação e execução

```bash
npm install
npm start
```

Para desenvolvimento com hot-reload:

```bash
npm run dev
```

---

## Coleções do Firestore

| Coleção               | Descrição                                              |
|-----------------------|--------------------------------------------------------|
| `usuarios`            | Dados de cada contato (nome, CPF, interações)         |
| `estado_conversas`    | Estado atual do fluxo de cada usuário                 |
| `atendimentos_abertos`| Atendimentos em andamento (1 por usuário)             |
| `atendimentos`        | Histórico de atendimentos encerrados                  |
| `mensagens`           | Todas as mensagens trocadas                           |
| `mensagens_pendentes` | Fila de mensagens enviadas pelo painel ACS            |
| `logs_eventos`        | Eventos do sistema (QR, AUTH, erros, etc.)            |

### Índice Firestore necessário

Para a consulta de NPS, criar índice composto na coleção `atendimentos`:

```
usuario_id   ASC
aguardando_nps ASC
atualizado_em  DESC
```

---

## Status de atendimento

| Status                     | Significado                                   |
|----------------------------|-----------------------------------------------|
| `bot`                      | Atendimento ativo, bot respondendo            |
| `aguardando_identificacao` | Bot aguardando nome ou CPF do usuário         |
| `aguardando_acs`           | Usuário identificado, aguardando ACS          |
| `em_atendimento`           | ACS vinculado e respondendo                   |
| `aguardando_usuario`       | ACS enviou mensagem, aguardando resposta      |
| `finalizado`               | Encerrado voluntariamente pelo usuário        |
| `encerrado_por_inatividade`| Encerrado automaticamente por inatividade     |
