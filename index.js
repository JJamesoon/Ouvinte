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

// ATENÇÃO: COLOQUE O SEU NÚMERO DE WHATSAPP AQUI (FORMATO: 55519... OU 5548...)
const TELEFONE_DO_BARBEIRO = "554896156188";

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
    
    // Verifica se quem respondeu foi o Barbeiro
    if (cleanNumber === TELEFONE_DO_BARBEIRO) {
      let novoStatus = null;
      if (textReceived === "1") novoStatus = "confirmado";
      else if (textReceived === "0") novoStatus = "cancelado";
      
      if (novoStatus) {
        try {
          // Busca o agendamento mais recente que ainda está 'pendente'
          const { data: agendamentos } = await axios.get(
            `${SUPABASE_URL}/appointments?status=eq.pendente&order=created_at.desc&limit=1`, 
            { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
          );
          
          if (agendamentos && agendamentos.length > 0) {
            const agendamentoId = agendamentos[0].id;
            
            // Atualiza o status no Supabase
            await axios.patch(
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
            
            // Confirmação para o Barbeiro
            await axios.post(`${EVO_URL}/message/sendText/${INSTANCE_NAME}`, {
              number: TELEFONE_DO_BARBEIRO,
              text: `✅ O agendamento de ${agendamentos[0].cliente_nome} foi ${novoStatus.toUpperCase()} no sistema.`
            }, { headers: { "apikey": API_KEY } });
            
            console.log(`✅ Agendamento ${agendamentoId} atualizado para: ${novoStatus}`);
          }
        } catch (e) {
          console.error("❌ Erro ao processar resposta do barbeiro:", e.response?.data || e.message);
        }
      }
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
      await axios.post(`${EVO_URL}/message/sendText/${INSTANCE_NAME}`, {
        number: TELEFONE_DO_BARBEIRO,
        text: msgBarbeiro
      }, { headers: { "apikey": API_KEY } });
      
      console.log("🚀 Notificação enviada ao barbeiro.");
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
