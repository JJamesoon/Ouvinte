const express = require('express');
const app = express();
app.use(express.json());

// Rota que a Evolution API vai chamar
app.post('/webhook-whatsapp', (req, res) => {
    const data = req.body;

    // Verifica se é uma mensagem recebida
    if (data.event === "messages.upsert") {
        const mensagem = data.data.message?.conversation || data.data.message?.extendedTextMessage?.text;
        const de = data.data.key.remoteJid;

        console.log(`📩 Nova mensagem de ${de}: ${mensagem}`);
        
        // AQUI você coloca sua lógica: salvar no banco, responder, etc.
    }

    res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Ouvinte rodando na porta ${PORT}`));
