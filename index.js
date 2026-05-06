'use strict';

const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// CONFIGURAÇÕES DA EVOLUTION API
// ---------------------------------------------------------------------------
const EVO_URL = 'https://evolution-api-production-bc74.up.railway.app';
const INSTANCE_NAME = 'Barbearia';
const API_KEY = 'D34185BFF8C0-4FBE-BC0E-CCD640245900';

// ---------------------------------------------------------------------------
// CONFIGURAÇÕES DO SUPABASE
// ---------------------------------------------------------------------------
const SUPABASE_URL = 'https://bmkeegwjvtfwiobcptqq.supabase.co/rest/v1';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJta2VlZ3dqdnRmd2lvYmNwdHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MDAwMTcsImV4cCI6MjA5MzE3NjAxN30.' +
  '8oIqYcQ8252nndgyZZIRjxeKKk-P8TR2L91fr-q0-LE';

// ---------------------------------------------------------------------------
// CONSTANTES DO NEGÓCIO
// ---------------------------------------------------------------------------
const TELEFONE_DO_BARBEIRO = '554896156188';
const WEBHOOK_URL = 'https://ouvinte-production.up.railway.app/webhook-whatsapp';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Envia uma mensagem de texto via Evolution API.
 * @param {string} number  Número de destino (somente dígitos, ex: 554896156188)
 * @param {string} text    Corpo da mensagem
 */
async function sendText(number, text) {
  await axios.post(
    `${EVO_URL}/message/sendText/${INSTANCE_NAME}`,
    { number, text },
    { headers: { apikey: API_KEY } }
  );
}

/**
 * Retorna os headers padrão para chamadas ao Supabase REST API.
 */
function supabaseHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
}

// ---------------------------------------------------------------------------
// POST /webhook-whatsapp
// Recebe eventos da Evolution API (messages.upsert) e do Supabase (INSERT).
// ---------------------------------------------------------------------------
app.post('/webhook-whatsapp', async (req, res) => {
  const data = req.body;

  console.log('📨 Webhook recebido:', JSON.stringify(data, null, 2));

  // -------------------------------------------------------------------------
  // 1. RESPOSTA DO BARBEIRO — evento messages.upsert da Evolution API
  // -------------------------------------------------------------------------
  if (data.event === 'messages.upsert') {
    // A Evolution API pode entregar um objeto único ou um array em data.data
    const key = data.data?.key || data.data?.[0]?.key;
    const msg = data.data?.message || data.data?.[0]?.message;

    // Ignora mensagens enviadas pelo próprio bot ou sem chave
    if (!key || key.fromMe) {
      return res.sendStatus(200);
    }

    const remoteJid = key.remoteJid || '';
    const cleanNumber = remoteJid.split('@')[0];
    const textReceived = (
      msg?.conversation ||
      msg?.extendedTextMessage?.text ||
      ''
    ).trim();

    console.log(`📱 Mensagem recebida de ${cleanNumber}: "${textReceived}"`);

    // Processa somente mensagens vindas do barbeiro
    if (cleanNumber === TELEFONE_DO_BARBEIRO) {
      let novoStatus = null;
      if (textReceived === '1') novoStatus = 'confirmado';
      else if (textReceived === '0') novoStatus = 'cancelado';

      if (novoStatus) {
        try {
          // Busca o agendamento pendente mais recente
          const { data: agendamentos } = await axios.get(
            `${SUPABASE_URL}/appointments?status=eq.pendente&order=created_at.desc&limit=1`,
            { headers: supabaseHeaders() }
          );

          if (agendamentos && agendamentos.length > 0) {
            const agendamento = agendamentos[0];
            const agendamentoId = agendamento.id;

            // Atualiza o status no Supabase
            await axios.patch(
              `${SUPABASE_URL}/appointments?id=eq.${agendamentoId}`,
              { status: novoStatus },
              { headers: supabaseHeaders() }
            );

            // Confirma a ação de volta para o barbeiro
            await sendText(
              TELEFONE_DO_BARBEIRO,
              `✅ O agendamento de ${agendamento.cliente_nome} foi ${novoStatus.toUpperCase()} no sistema.`
            );

            console.log(`✅ Agendamento ${agendamentoId} atualizado para: ${novoStatus}`);
          } else {
            console.log('ℹ️ Nenhum agendamento pendente encontrado.');
          }
        } catch (e) {
          console.error(
            '❌ Erro ao processar resposta do barbeiro:',
            e.response?.data || e.message
          );
        }
      }
    }

    return res.sendStatus(200);
  }

  // -------------------------------------------------------------------------
  // 2. NOVO AGENDAMENTO — webhook do Supabase (INSERT em appointments)
  // -------------------------------------------------------------------------
  if (data.table === 'appointments' && data.type === 'INSERT') {
    const novoAgendamento = data.record;

    const msgBarbeiro =
      `✂️ *NOVO AGENDAMENTO!*\n\n` +
      `👤 Cliente: ${novoAgendamento.cliente_nome}\n` +
      `⏰ Horário: ${novoAgendamento.horario}\n` +
      `💇‍♂️ Serviço: ${novoAgendamento.servico}\n\n` +
      `*Responda:*\n*1* para Confirmar\n*0* para Cancelar`;

    try {
      await sendText(TELEFONE_DO_BARBEIRO, msgBarbeiro);
      console.log('🚀 Notificação de novo agendamento enviada ao barbeiro.');
    } catch (e) {
      console.error(
        '❌ Erro ao notificar barbeiro:',
        e.response?.data || e.message
      );
    }
  }

  res.status(200).send('OK');
});

// ---------------------------------------------------------------------------
// GET / — health-check / status
// ---------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    webhook_url: WEBHOOK_URL,
    message: 'Ouvinte WhatsApp ativo',
  });
});

// ---------------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serviço ativo na porta ${PORT}`);
  console.log(`📍 Webhook URL: ${WEBHOOK_URL}`);
});
