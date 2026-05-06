const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// CONFIGURAÇÕES DA EVOLUTION API
const EVO_URL = "https://evolution-api-production-bc74.up.railway.app"; 
const INSTANCE_NAME = "Barbearia";
const API_KEY = "D34185BFF8C0-4FBE-BC0E-CCD640245900";

// CONFIGURAÇÕES DO SUPABASE
const SUPABASE_URL = "https://bmkeegwjvtfwiobcptqq.supabase.co/rest/v1";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJta2VlZ3dqdnRmd2lvYmNwdHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MDAwMTcsImV4cCI6MjA5MzE3NjAxN30.8oIqYcQ8252nndgyZZIRjxeKKk-P8TR2L91fr-q0-LE";

// URL DO WEBHOOK
const WEBHOOK_URL = "https://ouvinte-production.up.railway.app/webhook-whatsapp";

app.post('/webhook-whatsapp', async (req, res) => {
  const data = req.body;
  
  console.log('📨 Webhook recebido:', JSON.stringify(data, null, 2));
  
  // --- 1. LÓGICA DE RESPOSTA DO BARBEIRO ---
  if (data.event === "messages.upsert") {
    const key = data.data.key || (data.data[0]?.key);
    const msg = data.data.message || (data.data[0]?.message);
    
    if (!key || key.fromMe) return res.sendStatus(200);
    
    const remoteJid = key.remoteJid;
    const cleanNumber = remoteJid.split('@')[0];
    const textReceived = (msg?.conversation || msg?.extendedTextMessage?.text || "").trim();
    
    console.log(`📱 Mensagem recebida de ${cleanNumber}: ${textReceived}`);
    
    // Verifica se quem respondeu foi um Barbeiro (busca agendamento pendente pelo barbeiro_numero)
    console.log(`🔍 [BARBEIRO] Verificando se ${cleanNumber} é um barbeiro com agendamento pendente...`);

    let novoStatus = null;
    if (textReceived === "1") novoStatus = "confirmado";
    else if (textReceived === "0") novoStatus = "cancelado";

    if (novoStatus) {
      try {
        const queryUrl = `${SUPABASE_URL}/appointments?status=eq.pendente&barbeiro_numero=eq.${cleanNumber}&order=created_at.desc&limit=1`;
        console.log(`🔍 [SUPABASE] Buscando agendamento pendente para barbeiro_numero=${cleanNumber}. URL: ${queryUrl}`);

        // Busca o agendamento mais recente pendente para este barbeiro
        const getResponse = await axios.get(
          queryUrl,
          { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
        );
        const agendamentos = getResponse.data;

        console.log(`🔍 [SUPABASE] Resposta recebida. HTTP ${getResponse.status}. Agendamentos encontrados: ${agendamentos ? agendamentos.length : 0}`);
        console.log(`🔍 [SUPABASE] Dados retornados:`, JSON.stringify(agendamentos, null, 2));

        if (!agendamentos || agendamentos.length === 0) {
          console.log(`⚠️ [SUPABASE] Nenhum agendamento pendente encontrado para barbeiro_numero=${cleanNumber}. Nada a atualizar.`);
        } else {
          const agendamento = agendamentos[0];
          const agendamentoId = agendamento.id;
          const clienteNumero = agendamento.cliente_numero;
          const barbeiroNumero = agendamento.barbeiro_numero;

          console.log(`✏️ [SUPABASE] Agendamento encontrado. ID: ${agendamentoId} | cliente_numero: ${clienteNumero} | barbeiro_numero: ${barbeiroNumero}`);
          console.log(`✏️ [SUPABASE] Iniciando PATCH para status="${novoStatus}"...`);

          // Atualiza o status no Supabase
          const patchResponse = await axios.patch(
            `${SUPABASE_URL}/appointments?id=eq.${agendamentoId}`,
            { status: novoStatus },
            {
              headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json"
              }
            }
          );

          console.log(`✏️ [SUPABASE] PATCH concluído. HTTP ${patchResponse.status}. Resposta:`, JSON.stringify(patchResponse.data, null, 2));

          // Confirmação para o Cliente
          console.log(`📤 [WHATSAPP] Enviando confirmação ao cliente. Número: ${clienteNumero}`);
          const msgCliente = novoStatus === "confirmado"
            ? `✅ Seu agendamento foi CONFIRMADO! O barbeiro confirmou seu corte.\n\n⏰ Horário: ${agendamento.horario}\n💇‍♂️ Serviço: ${agendamento.servico}\n\nTe esperamos! 😊`
            : `❌ Infelizmente seu agendamento foi CANCELADO pelo barbeiro.\n\n⏰ Horário: ${agendamento.horario}\n💇‍♂️ Serviço: ${agendamento.servico}\n\nPor favor, entre em contato para reagendar.`;
          await axios.post(`${EVO_URL}/message/sendText/${INSTANCE_NAME}`, {
            number: clienteNumero,
            text: msgCliente
          }, { headers: { "apikey": API_KEY } });
          console.log(`📤 [WHATSAPP] Mensagem enviada ao cliente ${clienteNumero}: "${msgCliente.split('\n')[0]}"`);

          // Confirmação para o Barbeiro
          console.log(`📤 [WHATSAPP] Enviando confirmação ao barbeiro. Número: ${barbeiroNumero}`);
          await axios.post(`${EVO_URL}/message/sendText/${INSTANCE_NAME}`, {
            number: barbeiroNumero,
            text: `✅ O agendamento de ${agendamento.cliente_nome} foi ${novoStatus.toUpperCase()} no sistema.`
          }, { headers: { "apikey": API_KEY } });
          console.log(`📤 [WHATSAPP] Mensagem enviada ao barbeiro ${barbeiroNumero}.`);

          console.log(`✅ [CONCLUÍDO] Agendamento ${agendamentoId} atualizado para: ${novoStatus} | cliente: ${clienteNumero} | barbeiro: ${barbeiroNumero}`);
        }
      } catch (e) {
        console.error(`❌ [ERRO] Falha ao processar resposta do barbeiro.`);
        console.error(`❌ [ERRO] Mensagem:`, e.message);
        console.error(`❌ [ERRO] HTTP Status:`, e.response?.status);
        console.error(`❌ [ERRO] Resposta do servidor:`, JSON.stringify(e.response?.data, null, 2));
        console.error(`❌ [ERRO] Stack:`, e.stack);
      }
    } else {
      console.log(`⚠️ [BARBEIRO] Texto "${textReceived}" de ${cleanNumber} não é "1" nem "0". Nenhuma ação tomada.`);
    }
    
    return res.sendStatus(200);
  }
  
  // --- 2. LÓGICA DE AVISO AO BARBEIRO (Webhook do Supabase) ---
  if (data.table === "appointments" && data.type === "INSERT") {
    const novoAgendamento = data.record;
    
    const msgBarbeiro = `✂️ *NOVO AGENDAMENTO!*\n\n` +
      `👤 Cliente: ${novoAgendamento.cliente_nome}\n` +
      `⏰ Horário: ${novoAgendamento.horario}\n` +
      `💇‍♂️ Serviço: ${novoAgendamento.servico}\n\n` +
      `*Responda:*\n*1* para Confirmar\n*0* para Cancelar`;
    
    try {
      console.log(`📤 [WHATSAPP] Enviando notificação de novo agendamento ao barbeiro. Número: ${novoAgendamento.barbeiro_numero}`);
      await axios.post(`${EVO_URL}/message/sendText/${INSTANCE_NAME}`, {
        number: novoAgendamento.barbeiro_numero,
        text: msgBarbeiro
      }, { headers: { "apikey": API_KEY } });
      
      console.log(`🚀 Notificação enviada ao barbeiro ${novoAgendamento.barbeiro_numero} para o agendamento do cliente ${novoAgendamento.cliente_nome} (cliente_numero: ${novoAgendamento.cliente_numero}).`);
    } catch (e) {
      console.error("❌ Erro ao notificar barbeiro:", e.response?.data || e.message);
    }
  }
  
  res.status(200).send('OK');
});

// Rota de teste
app.get('/', (req, res) => {
  res.json({ 
    status: 'online',
    webhook_url: WEBHOOK_URL,
    message: 'Ouvinte WhatsApp ativo'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serviço ativo na porta ${PORT}`);
  console.log(`📍 Webhook URL: ${WEBHOOK_URL}`);
});
