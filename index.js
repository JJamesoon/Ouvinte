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

    // Verifica se é uma mensagem recebida (padrão v2)
    if (data.event === "messages.upsert") {
        
        // Puxa os dados da mensagem (compatível com Array ou Objeto)
        const msg = data.data.message || (data.data[0] && data.data[0].message) || data.data;
        const key = data.data.key || (data.data[0] && data.data[0].key);

        if (key && !key.fromMe) {
            const remoteJid = key.remoteJid;
            
            // Ignora grupos
            if (remoteJid.includes('@g.us')) return res.status(200).send('Group ignored');

            // Limpa o número (remove o @s.whatsapp.net)
            const cleanNumber = remoteJid.split('@')[0];

            console.log(`📩 Mensagem de ${cleanNumber}. Enviando resposta de teste...`);

            try {
                // Requisição exata para Evolution v2
                await axios.post(`${EVO_URL}/message/sendText/${INSTANCE_NAME}`, {
                    number: cleanNumber,
                    text: "isso e apena test",
                    delay: 1200,
                    linkPreview: false
                }, {
                    headers: { 
                        "apikey": API_KEY,
                        "Content-Type": "application/json"
                    }
                });

                console.log("✅ Resposta enviada com sucesso!");
            } catch (error) {
                // Log detalhado para capturar qualquer erro da API
                console.error("❌ Erro da API:", JSON.stringify(error.response?.data, null, 2) || error.message);
            }
        }
    }

    res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Ouvinte rodando na porta ${PORT}`));
