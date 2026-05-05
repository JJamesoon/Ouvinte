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
        const remoteJid = data.data.key.remoteJid;
        const fromMe = data.data.key.fromMe;
        const isGroup = remoteJid.includes('@g.us');

        // Só responde se: não for grupo e não for mensagem enviada por você
        if (!isGroup && !fromMe) {
            console.log(`📩 Mensagem de ${remoteJid}. Enviando teste...`);

            try {
                await axios.post(`${EVO_URL}/message/sendText/${INSTANCE_NAME}`, {
                    number: remoteJid,
                    options: {
                        delay: 1200,
                        presence: "composing"
                    },
                    textMessage: {
                        text: "isso e apena test"
                    }
                }, {
                    headers: { "apikey": API_KEY }
                });

                console.log("✅ Resposta enviada com sucesso!");
            } catch (error) {
                console.error("❌ Erro ao enviar:", error.response?.data || error.message);
            }
        }
    }

    res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Ouvinte rodando na porta ${PORT}`));
