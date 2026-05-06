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
const MINHA_URL_RAILWAY = "https://ouvinte-production.up.railway.app";

// --- ROTA PARA O WHATSAPP (Aviso de novo agendamento) ---
app.post('/webhook-whatsapp', async (req, res) => {
  const data = req.body;
  
  if (data.table === "appointments" && data.type === "INSERT") {
    const novo = data.record;
    
    // Geramos os links que o barbeiro vai clicar
    const linkSim = `${MINHA_URL_RAILWAY}/decisao?id=${novo.id}&status=confirmado`;
    const linkNao = `${MINHA_URL_RAILWAY}/decisao?id=${novo.id}&status=cancelado`;

    const texto = `✂️ *NOVO AGENDAMENTO*\n\n` +
                  `👤 Cliente: ${novo.cliente_nome}\n` +
                  `⏰ Horário: ${novo.horario}\n\n` +
                  `✅ *ACEITAR:* ${linkSim}\n\n` +
                  `❌ *RECUSAR:* ${linkNao}`;

    try {
      await axios.post(`${EVO_URL}/message/sendText/${INSTANCE_NAME}`, {
        number: TELEFONE_DO_BARBEIRO,
        text: texto
      }, { headers: { "apikey": API_KEY } });
    } catch (e) {
      console.error("Erro ao avisar barbeiro:", e.message);
    }
  }
  res.sendStatus(200);
});

// --- ROTA DE DECISÃO (Onde o link do Zap joga o barbeiro) ---
app.get('/decisao', async (req, res) => {
  const { id, status } = req.query;

  try {
    // Atualiza o Supabase
    await axios.patch(
      `${SUPABASE_URL}/appointments?id=eq.${id}`,
      { status: status },
      { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" } }
    );

    // Envia uma resposta visual bonitinha no navegador do barbeiro
    res.send(`
      <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
        <h1>✅ Agendamento ${status === 'confirmado' ? 'Confirmado' : 'Cancelado'}!</h1>
        <p>Pode fechar esta aba e voltar para o WhatsApp.</p>
      </div>
    `);

    // Opcional: Manda uma confirmação no Zap também
    await axios.post(`${EVO_URL}/message/sendText/${INSTANCE_NAME}`, {
      number: TELEFONE_DO_BARBEIRO,
      text: `O agendamento #${id} foi atualizado para: *${status.toUpperCase()}*`
    }, { headers: { "apikey": API_KEY } });

  } catch (e) {
    res.status(500).send("Erro ao processar. Tente novamente.");
  }
});

app.get('/', (req, res) => res.send("Servidor Online 🚀"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Rodando na porta ${PORT}`));
