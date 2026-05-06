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

// SEU NÚMERO (Para onde o bot envia os avisos)
const TELEFONE_DO_BARBEIRO = "555199875692";

app.post('/webhook-whatsapp', async (req, res) => {
  const data = req.body;
  
  console.log('📨 Webhook recebido:', JSON.stringify(data, null, 2));

  // --- 1. LÓGICA DE RESPOSTA (Ouvindo o SIM ou NÃO) ---
  if (data.event === "messages.upsert") {
    const messageData = data.data.message || (data.data[0]?.message);
    const key = data.data.key || (data.data[0]?.key);
    
    if (!key || key.fromMe) return res.sendStatus(200);

    const cleanNumber = key.remoteJid.split('@')[0];
    const textReceived = (messageData?.conversation || messageData?.extendedTextMessage?.text || "").trim().toUpperCase();

    console.log(`📱 Resposta de ${cleanNumber}: ${textReceived}`);

    if (cleanNumber === TELEFONE_DO_BARBEIRO) {
      let novoStatus = null;
      if (textReceived === "SIM") novoStatus = "confirmado";
      else if (textReceived === "NÃO" || textReceived === "NAO") novoStatus = "cancelado";

      if (novoStatus) {
        try {
          // Busca o agendamento pendente mais recente
          const resSupabase = await axios.get(`${SUPABASE_URL}/appointments?status=eq.pendente&order=created_at.desc&limit=1`, {
            headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
          });

          if (resSupabase.data.length > 0) {
            const agendamentoId = resSupabase.data[0].id;
            
            // Atualiza no Supabase
            await axios.patch(`${SUPABASE_URL}/appointments?id=eq.${agendamentoId}`, 
              { status: novoStatus },
              { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" } }
            );

            // Confirmação para o barbeiro
            await axios.post(`${EVO_URL}/message/sendText/${INSTANCE_NAME}`, {
              number: TELEFONE_DO_BARBEIRO,
              text: `✅ O agendamento de *${resSupabase.data[0].cliente_nome}* foi ${novoStatus.toUpperCase()} no sistema.`
            }, { headers: { "apikey": API_KEY } });
          }
        } catch (e) {
          console.error("Erro ao atualizar banco:", e.message);
        }
      }
    }
    return res.sendStatus(200);
  }

  // --- 2. LÓGICA DE ENVIO (Formato que você pediu) ---
  if (data.table === "appointments" && data.type === "INSERT") {
    const n = data.record;
    
  const textoMensagem = 
            `🔔 NOVO PEDIDO!
            
            Cliente: ${n.cliente_nome}
            
            numero: ${n.cliente_contato || 'Não informado'}
            
            Serviço: ${n.servico}
            
            Data: *${n.data || 'Não informada'}*
            
            Hora: ${n.horario}
            
            Deseja aceitar?
            
            Responda SIM ou NÃO`;

    try {
      await axios.post(`${EVO_URL}/message/sendText/${INSTANCE_NAME}`, {
        number: TELEFONE_DO_BARBEIRO,
        text: textoMensagem
      }, { headers: { "apikey": API_KEY } });
      
      console.log("🚀 Notificação enviada ao barbeiro.");
    } catch (e) {
      console.error("Erro ao enviar mensagem:", e.message);
    }
  }
  
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Ouvinte ativo na porta ${PORT}`));
