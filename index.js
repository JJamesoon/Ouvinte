const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// CONFIGURAÇÕES DA SUA EVOLUTION API
const EVO_URL = "https://evolution-api-production-bc74.up.railway.app"; 
const INSTANCE_NAME = "Barbearia";
const API_KEY = "D34185BFF8C0-4FBE-BC0E-CCD640245900";

// CONFIGURAÇÕES DO SUPABASE (Pegue no painel do Supabase em Project Settings > API)
const SUPABASE_URL = "SUA_URL_DO_SUPABASE";
const SUPABASE_KEY = "SUA_ANON_OR_SERVICE_ROLE_KEY";

app.post('/webhook-whatsapp', async (req, res) => {
    const data = req.body;

    if (data.event === "messages.upsert") {
        const key = data.data.key || (data.data[0] && data.data[0].key);
        const msg = data.data.message || (data.data[0] && data.data[0].message) || data.data;

        if (key && !key.fromMe) {
            const remoteJid = key.remoteJid;
            const cleanNumber = remoteJid.split('@')[0];
            
            // Pega o texto enviado (converte para texto simples)
            const textReceived = (msg.conversation || msg.extendedTextMessage?.text || "").trim();

            console.log(`📩 Cliente ${cleanNumber} respondeu: ${textReceived}`);

            let statusAgendamento = null;

            // Lógica de Confirmação ou Cancelamento
            if (textReceived === "1") {
                statusAgendamento = "confirmado";
            } else if (textReceived === "0") {
                statusAgendamento = "cancelado";
            }

            // Se for uma das opções, atualiza o Supabase
            if (statusAgendamento) {
                try {
                    // Faz o UPDATE no Supabase
                    // Exemplo: Procura na tabela 'agendamentos' onde o 'telefone' é igual ao do Zap
                    const response = await axios.patch(
                        `${SUPABASE_URL}/rest/v1/agendamentos?telefone=eq.${cleanNumber}`, 
                        { status: statusAgendamento }, // Nome da coluna que você quer mudar
                        {
                            headers: {
                                "apikey": SUPABASE_KEY,
                                "Authorization": `Bearer ${SUPABASE_KEY}`,
                                "Content-Type": "application/json",
                                "Prefer": "return=minimal"
                            }
                        }
                    );

                    console.log(`✅ Supabase atualizado: ${statusAgendamento}`);

                    // Responde ao cliente confirmando que recebeu
                    const respostaTexto = statusAgendamento === "confirmado" 
                        ? "Obrigado! Seu agendamento está confirmado. ✅" 
                        : "Entendido. Seu agendamento foi cancelado. ❌";

                    await axios.post(`${EVO_URL}/message/sendText/${INSTANCE_NAME}`, {
                        number: cleanNumber,
                        text: respostaTexto
                    }, {
                        headers: { "apikey": API_KEY }
                    });

                } catch (error) {
                    console.error("❌ Erro ao falar com Supabase:", error.response?.data || error.message);
                }
            }
        }
    }
    res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Ouvinte rodando na porta ${PORT}`));
