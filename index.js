const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const EVO_URL = "https://evolution-api-production-bc74.up.railway.app"; 
const INSTANCE_NAME = "Barbearia";
const API_KEY = "D34185BFF8C0-4FBE-BC0E-CCD640245900";

const SUPABASE_URL = "https://bmkeegwjvtfwiobcptqq.supabase.co/rest/v1";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJta2VlZ3dqdnRmd2lvYmNwdHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MDAwMTcsImV4cCI6MjA5MzE3NjAxN30.8oIqYcQ8252nndgyZZIRjxeKKk-P8TR2L91fr-q0-LE";

const TELEFONE_DO_BARBEIRO = "555199875692";

app.post('/webhook-whatsapp', async (req, res) => {
  const data = req.body;
  
  console.log('📨 Webhook recebido:', JSON.stringify(data, null, 2));

  // --- 1. LÓGICA PARA RECEBER O VOTO (Via MESSAGES_UPSERT ou POLL_VOTE) ---
  if (data.event === "messages.upsert" || data.event === "poll.vote") {
    
    const messageContent = data.data.message || (data.data[0]?.message);
    const key = data.data.key || (data.data[0]?.key);
    
    if (!key || key.fromMe) return res.sendStatus(200);

    const cleanNumber = key.remoteJid.split('@')[0];
    
    // Tenta pegar o voto de duas formas diferentes (dependendo da versão da API)
    const voto = data.data.pollVotes?.[0]?.optionName || 
                 messageContent?.pollUpdateMessage?.vote?.optionNames?.[0] ||
                 "";

    console.log(`🗳️ Tentativa de leitura de voto de ${cleanNumber}: ${voto}`);

    if (cleanNumber === TELEFONE_DO_BARBEIRO && voto !== "") {
      let novoStatus = null;
      if (voto === "Sim") novoStatus = "confirmado";
      else if (voto === "Não") novoStatus = "cancelado";

      if (novoStatus) {
        try {
          const queryUrl = `${SUPABASE_URL}/appointments?status=eq.pendente&order=created_at.desc&limit=1`;
          const getResponse = await axios.get(queryUrl, {
            headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
          });
          
          const agendamentos = getResponse.data;

          if (agendamentos && agendamentos.length > 0) {
            const agendamentoId = agendamentos[0].id;
            
            await axios.patch(
              `${SUPABASE_URL}/appointments?id=eq.${agendamentoId}`,
              { status: novoStatus },
              { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" } }
            );

            await axios.post(`${EVO_URL}/message/sendText/${INSTANCE_NAME}`, {
              number: TELEFONE_DO_BARBEIRO,
              text: `✅ Agendamento de ${agendamentos[0].cliente_nome} foi ${novoStatus.toUpperCase()}!`
            }, { headers: { "apikey": API_KEY } });
            
            console.log(`✅ Sucesso! Banco atualizado para ${novoStatus}`);
          }
        } catch (e) {
          console.error(`❌ Erro no Supabase:`, e.message);
        }
      }
    }
    return res.sendStatus(200);
  }

  // --- 2. LÓGICA DE AVISO (CRIA A ENQUETE) ---
  if (data.table === "appointments" && data.type === "INSERT") {
    const novo = data.record;
    const pergunta = `✂️ *NOVO AGENDAMENTO*\n\n` +
                     `👤 Cliente: ${novo.cliente_nome}\n` +
                     `⏰ Horário: ${novo.horario}\n\n` +
                     `Deseja aceitar?`;
    
    try {
      await axios.post(`${EVO_URL}/message/sendPoll/${INSTANCE_NAME}`, {
        number: TELEFONE_DO_BARBEIRO,
        name: pergunta,
        options: ["Sim", "Não"],
        selectableOptionsCount: 1
      }, { headers: { "apikey": API_KEY } });
      
      console.log("🚀 Enquete enviada com sucesso.");
    } catch (e) {
      console.error("❌ Erro ao enviar enquete:", e.response?.data || e.message);
    }
  }
  
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Ouvinte rodando na porta ${PORT}`));
