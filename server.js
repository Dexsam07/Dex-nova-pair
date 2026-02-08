// server.js - Simple Express server for Levanter-style pairing site

const express = require('express');
const path = require('path');
const { makeWASocket } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 3000;

// Logger
const logger = pino({ level: 'silent' });

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Home page route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Pairing page route
app.get('/pair', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pair.html'));
});

// API to generate pairing code (called from pair.html via fetch)
app.get('/api/pair', async (req, res) => {
  const phone = req.query.phone;

  if (!phone || !/^\d{10,14}$/.test(phone.replace(/\D/g, ''))) {
    return res.status(400).json({ error: 'Invalid phone number. Use format: 919876543210' });
  }

  try {
    const sock = makeWASocket({
      logger,
      printQRInTerminal: false,
      syncFullHistory: false
    });

    const pairingCode = await sock.requestPairingCode(phone);
    
    res.json({ success: true, code: pairingCode });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Failed to generate code: ' + err.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log('Open http://localhost:3000 in browser');
});