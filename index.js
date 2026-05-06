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

// SEU NÚMERO (Como aparece nos logs)
const TELEFONE_DO_BARBEIRO = "555199875692";

app.post('/webhook-whatsapp', async (req, res) => {
  const data = req.body;
  
  console.log('📨 Webhook recebido:', JSON.stringify(data, null, 2));

  // --- 1. LÓGICA PARA CAPTURAR O CLIQUE NA ENQUETE ---
  // Verifica se é um evento de voto ou uma mensagem comum (upsert)
  if (data.event === "poll.vote" || data.event === "messages.upsert") {
    
    const key = data.data.key || (data.data[0]?.key);
    if (!key || key.fromMe) return res.sendStatus(200);

    const cleanNumber = key.remoteJid.split('@')[0];

    // Tenta extrair o texto do voto de várias formas possíveis na Evolution API
    const voto = data.data.pollVotes?.[0]?.optionName || 
                 data.data.message?.pollUpdateMessage?.vote?.optionNames?.[0] ||
                 data.data[0]?.message?.pollUpdateMessage?.vote?.optionNames?.[0] || 
                 "";

    console.log(`🗳️ Voto detectado de ${cleanNumber}: "${voto}"`);

    if (cleanNumber === TELEFONE_DO_BARBEIRO && voto !== "") {
      let novoStatus = null;
      if (voto === "Sim") novoStatus = "confirmado";
      if (voto === "Não") novoStatus = "cancelado";

      if (novoStatus) {
        try {
          // Busca o último pendente
          const queryUrl = `${SUPABASE_URL}/appointments?status=eq.pendente&order=created_at.desc&limit=1`;
          const getResponse = await axios.get(queryUrl, {
            headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
          });
          
          if (getResponse.data.length > 0) {
            const agendamento = getResponse.data[0];
            
            // Atualiza o banco
            await axios.patch(`${SUPABASE_URL}/appointments?id=eq.${agendamento.id}`, 
              { status: novoStatus },
              { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" } }
            );

            // Avisa no Zap que deu certo
            await axios.post(`${EVO_URL}/message/sendText/${INSTANCE_NAME}`, {
              number: TELEFONE_DO_BARBEIRO,
              text: `✅ Agendamento de *${agendamento.cliente_nome}* foi ${novoStatus.toUpperCase()}!`
            }, { headers: { "apikey": API_KEY } });
            
            console.log(`✅ Sucesso: ${agendamento.id} movido para ${novoStatus}`);
          }
        } catch (e) {
          console.error("❌ Erro ao processar voto:", e.message);
        }
      }
    }
    return res.sendStatus(200);
  }

  // --- 2. LÓGICA DE ENVIO DA ENQUETE (Quando entra novo agendamento) ---
  if (data.table === "appointments" && data.type === "INSERT") {
    const novo = data.record;
    
    const pergunta = `✂️ *NOVO AGENDAMENTO*\n\n` +
                     `👤 Cliente: ${novo.cliente_nome}\n` +
                     `⏰ Horário: ${novo.horario}\n` +
                     `💇‍♂️ Serviço: ${novo.servico}\n\n` +
                     `Deseja aceitar?`;
    
    try {
      // Envia como Enquete (Poll)
      await axios.post(`${EVO_URL}/message/sendPoll/${INSTANCE_NAME}`, {
        number: TELEFONE_DO_BARBEIRO,
        name: pergunta,
        options: ["Sim", "Não"],
        selectableOptionsCount: 1
      }, { headers: { "apikey": API_KEY } });
      
      console.log("🚀 Enquete enviada para o barbeiro.");
    } catch (e) {
      console.error("❌ Erro ao enviar enquete:", e.response?.data || e.message);
    }
  }
  
  res.sendStatus(200);
});

app.get('/', (req, res) => res.json({ status: 'online', type: 'poll-collector' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor de Enquetes na porta ${PORT}`));
