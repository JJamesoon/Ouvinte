const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// CONFIGURAÇÕES DA SUA EVOLUTION API
const EVO_URL = "https://evolution-api-production-bc74.up.railway.app"; 
const INSTANCE_NAME = "Barbearia";
const API_KEY = "D34185BFF8C0-4FBE-BC0E-CCD640245900";

app.post('/webhook-whatsapp', async (req, res) => {
    const data = req.body;

    // Verifica se é uma mensagem recebida
    if (data.event === "messages.upsert") {
        // Na v2, os dados da mensagem ficam dentro de data.data[0] ou data.data
        // Vamos garantir que pegamos o remoteJid corretamente
        const msgData = data.data.message || data.data[0]?.message || data.data;
        const remoteJid = data.data.key?.remoteJid || data.data[0]?.key?.remoteJid;
        const fromMe = data.data.key?.fromMe || data.data[0]?.key?.fromMe;

        if (remoteJid && !fromMe && !remoteJid.includes('@g.us')) {
            console.log(`📩 Mensagem de ${remoteJid}. Enviando teste...`);

            try {
                // Padrão exato para Evolution v2
                await axios.post(`${EVO_URL}/message/sendText/${INSTANCE_NAME}`, {
                    number: remoteJid,
                    text: "isso e apena test" 
                }, {
                    headers: { 
                        "apikey": API_KEY,
                        "Content-Type": "application/json"
                    }
                });

                console.log("✅ Resposta enviada com sucesso!");
            } catch (error) {
                // Mostra o erro real se a API rejeitar
                console.error("❌ Erro detalhado:", error.response?.data || error.message);
            }
        }
    }

    res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Ouvinte rodando na porta ${PORT}`));
