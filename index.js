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

// SEU NÚMERO (Deve ser o mesmo que aparece nos logs: 555199875692)
const TELEFONE_DO_BARBEIRO = "555199875692";

app.post('/webhook-whatsapp', async (req, res) => {
  const data = req.body;
  
  console.log('📨 Webhook recebido:', JSON.stringify(data, null, 2));
  
  // --- 1. LÓGICA DE RESPOSTA DO BARBEIRO (Trata o clique no botão ou texto) ---
  if (data.event === "messages.upsert") {
    const messageData = data.data.message || (data.data[0]?.message);
    const key = data.data.key || (data.data[0]?.key);
    
    if (!key || key.fromMe) return res.sendStatus(200);
    
    const remoteJid = key.remoteJid;
    const cleanNumber = remoteJid.split('@')[0];

    // Captura o ID do botão clicado OU o texto digitado
    const textReceived = (
      messageData?.buttonsResponseMessage?.selectedButtonId || 
      messageData?.conversation || 
      messageData?.extendedTextMessage?.text || 
      ""
    ).trim();
    
    console.log(`📱 Mensagem de ${cleanNumber}: ${textReceived}`);
    
    if (cleanNumber === TELEFONE_DO_BARBEIRO) {
      let novoStatus = null;
      if (textReceived === "1") novoStatus = "confirmado";
      else if (textReceived === "0") novoStatus = "cancelado";

      if (novoStatus) {
        try {
          // Busca o agendamento pendente mais recente
          const queryUrl = `${SUPABASE_URL}/appointments?status=eq.pendente&order=created_at.desc&limit=1`;
          const getResponse = await axios.get(queryUrl, {
            headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
          });
          
          const agendamentos = getResponse.data;

          if (agendamentos && agendamentos.length > 0) {
            const agendamentoId = agendamentos[0].id;
            
            // Atualiza no Supabase
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

            // Confirmação para você no WhatsApp
            await axios.post(`${EVO_URL}/message/sendText/${INSTANCE_NAME}`, {
              number: TELEFONE_DO_BARBEIRO,
              text: `✅ Agendamento de ${agendamentos[0].cliente_nome} foi ${novoStatus.toUpperCase()}.`
            }, { headers: { "apikey": API_KEY } });

            console.log(`✅ Sucesso: Agendamento ${agendamentoId} ${novoStatus}`);
          }
        } catch (e) {
          console.error(`❌ Erro ao atualizar banco:`, e.message);
        }
      }
    }
    return res.sendStatus(200);
  }
  
  // --- 2. LÓGICA DE AVISO AO BARBEIRO (Novo agendamento com BOTÕES) ---
  if (data.table === "appointments" && data.type === "INSERT") {
    const novo = data.record;
    
    const msgCorpo = `✂️ *NOVO CLIENTE!*\n\n` +
                     `👤 Nome: ${novo.cliente_nome}\n` +
                     `⏰ Horário: ${novo.horario}\n` +
                     `💇‍♂️ Serviço: ${novo.servico}`;
    
    try {
      await axios.post(`${EVO_URL}/message/sendButtons/${INSTANCE_NAME}`, {
        number: TELEFONE_DO_BARBEIRO,
        title: "Novo Agendamento",
        description: msgCorpo,
        footer: "Selecione uma opção:",
        buttons: [
          { buttonId: "1", buttonText: { displayText: "✅ Confirmar" }, type: 1 },
          { buttonId: "0", buttonText: { displayText: "❌ Cancelar" }, type: 1 }
        ]
      }, { headers: { "apikey": API_KEY } });
      
      console.log("🚀 Botões de confirmação enviados.");
    } catch (e) {
      console.error("❌ Erro ao enviar botões:", e.response?.data || e.message);
    }
  }
  
  res.status(200).send('OK');
});

app.get('/', (req, res) => res.json({ status: 'online' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Ouvinte rodando na porta ${PORT}`));
