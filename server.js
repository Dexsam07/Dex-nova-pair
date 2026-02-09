// server.js - Express server for Dex Pairing Site

const express = require('express');
const path = require('path');
const { makeWASocket } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 3000;

const logger = pino({ level: 'silent' });

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Pairing page
app.get('/pair', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pair.html'));
});

// API to generate pairing code
app.get('/api/pair', async (req, res) => {
  let phone = req.query.phone?.trim().replace(/\D/g, '');

  if (!phone || phone.length < 10) {
    return res.status(400).json({ error: 'Invalid phone number. Use format: 919876543210' });
  }

  // Add India code if missing
  if (!phone.startsWith('91')) phone = '91' + phone;

  try {
    const sock = makeWASocket({
      logger,
      printQRInTerminal: false,
      syncFullHistory: false
    });

    const pairingCode = await sock.requestPairingCode(phone);

    console.log(`Pairing code generated for ${phone}: ${pairingCode}`);

    res.json({
      success: true,
      code: pairingCode,
      message: "Paste this code in WhatsApp → Linked Devices → Link with phone number"
    });
  } catch (err) {
    console.error('Pairing error:', err.message);
    res.status(500).json({ error: 'Failed to generate code: ' + err.message });
  }
});

app.listen(port, () => {
  console.log(`Dex Pairing Site running on port ${port}`);
});