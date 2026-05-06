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

const TELEFONE_DO_BARBEIRO = "555199875692";

app.post('/webhook-whatsapp', async (req, res) => {
  const data = req.body;
  
  console.log('📨 Webhook recebido:', JSON.stringify(data, null, 2));

  // --- 1. LÓGICA PARA RECEBER O VOTO DA ENQUETE ---
  if (data.event === "poll.vote") {
    const voteData = data.data;
    const cleanNumber = voteData.key.remoteJid.split('@')[0];
    
    // Na enquete, o voto vem dentro de 'pollVotes'
    const voto = voteData.pollVotes[0]?.optionName; 

    console.log(`🗳️ Voto recebido de ${cleanNumber}: ${voto}`);

    if (cleanNumber === TELEFONE_DO_BARBEIRO) {
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

            // Confirmação final no Zap
            await axios.post(`${EVO_URL}/message/sendText/${INSTANCE_NAME}`, {
              number: TELEFONE_DO_BARBEIRO,
              text: `✅ Feito! Agendamento de ${agendamentos[0].cliente_nome} marcado como ${novoStatus.toUpperCase()}.`
            }, { headers: { "apikey": API_KEY } });
          }
        } catch (e) {
          console.error(`❌ Erro no Supabase:`, e.message);
        }
      }
    }
    return res.sendStatus(200);
  }

  // --- 2. LÓGICA DE AVISO AO BARBEIRO (Cria a Enquete quando houver INSERT no banco) ---
  if (data.table === "appointments" && data.type === "INSERT") {
    const novo = data.record;
    
    const pergunta = `✂️ *NOVO AGENDAMENTO*\n\n` +
                     `👤 Cliente: ${novo.cliente_nome}\n` +
                     `⏰ Horário: ${novo.horario}\n` +
                     `💇‍♂️ Serviço: ${novo.servico}\n\n` +
                     `Deseja aceitar?`;
    
    try {
      // Usando o endpoint de Poll (Enquete)
      await axios.post(`${EVO_URL}/message/sendPoll/${INSTANCE_NAME}`, {
        number: TELEFONE_DO_BARBEIRO,
        name: pergunta,
        options: ["Sim", "Não"],
        selectableOptionsCount: 1 // Só pode escolher uma opção
      }, { headers: { "apikey": API_KEY } });
      
      console.log("🚀 Enquete de confirmação enviada.");
    } catch (e) {
      console.error("❌ Erro ao enviar enquete:", e.response?.data || e.message);
    }
  }
  
  res.status(200).send('OK');
});

app.get('/', (req, res) => res.json({ status: 'online', mode: 'poll' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Ouvinte (Modo Enquete) na porta ${PORT}`));
