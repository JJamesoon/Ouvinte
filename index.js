const express = require('express');
const axios = require('axios'); // Vamos usar o axios para enviar a resposta
const app = express();
app.use(express.json());

// CONFIGURAÇÕES DA SUA EVOLUTION API
const EVO_URL = "SUA_URL_DA_EVOLUTION_AQUI"; // Ex: https://api-evolution.up.railway.app
const INSTANCE_NAME = "NOME_DA_SUA_INSTANCIA";
const API_KEY = "SUA_API_KEY_GLOBAL";

app.post('/webhook-whatsapp', async (req, res) => {
    const data = req.body;

    if (data.event === "messages.upsert") {
        const isGroup = data.data.key.remoteJid.includes('@g.us');
        const fromMe = data.data.key.fromMe;
        const remoteJid = data.data.key.remoteJid;

        // Só responde se: não for grupo, não for mensagem enviada por você e tiver texto
        if (!isGroup && !fromMe) {
            console.log(`📩 Mensagem recebida de ${remoteJid}. Enviando resposta de teste...`);

            try {
                await axios.post(`${EVO_URL}/message/sendText/${INSTANCE_NAME}`, {
                    number: remoteJid,
                    options: {
                        delay: 1200, // delay de 1.2 segundos para parecer humano
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
                console.error("❌ Erro ao enviar resposta:", error.response?.data || error.message);
            }
        }
    }

    res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Ouvinte rodando na porta ${PORT}`));
