import express from 'express';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import crypto from 'crypto';
import { makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, Browsers, jidNormalizedUser, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pn from 'awesome-phonenumber';

const router = express.Router();

// Owner details
const OWNER_NUMBER = '+917384287404';
const OWNER_JID = jidNormalizedUser(OWNER_NUMBER.replace('+', '') + '@s.whatsapp.net');

// Helper to safely remove session folder
function removeFile(FilePath) {
    try {
        if (!fs.existsSync(FilePath)) return;
        fs.rmSync(FilePath, { recursive: true, force: true });
    } catch (e) {
        console.error('Remove file error:', e);
    }
}

// Ensure session folder + creds.json exists
function ensureSessionDir(dirs) {
    const credsPath = path.join(dirs, 'creds.json');
    if (!fs.existsSync(dirs)) {
        fs.mkdirSync(dirs, { recursive: true });
        console.log(`[INIT] Created dir: ${dirs}`);
    }
    if (!fs.existsSync(credsPath)) {
        fs.writeFileSync(credsPath, JSON.stringify({}));
        console.log(`[INIT] Created empty creds.json at ${credsPath}`);
    }
}

router.get('/', async (req, res) => {
    let num = req.query.number || '';
    let dirs = './' + (num || 'session');

    await removeFile(dirs);

    num = num.replace(/[^0-9]/g, '');

    const phone = pn('+' + num);
    if (!phone.isValid()) {
        if (!res.headersSent) {
            return res.status(400).send({ 
                code: 'Invalid phone number. Use full international format (no + or spaces)' 
            });
        }
        return;
    }

    num = phone.getNumber('e164').replace('+', '');

    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            const { version } = await fetchLatestBaileysVersion();

            // Force keys init if missing
            if (!state.keys || Object.keys(state.keys).length === 0) {
                console.log("[KEYS] No keys found - forcing initialization");
                state.keys = {};
            }

            let sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.ubuntu('Chrome'),  // Stable & undetectable
                markOnlineOnConnect: false,
                generateHighQualityLinkPreview: false,
                defaultQueryTimeoutMs: 60000,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                retryRequestDelayMs: 250,
                maxRetries: 20,
            });

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === 'open') {
                    console.log("✅ Connected successfully!");

                    try {
                        const ownerJid = jidNormalizedUser('917384287404@s.whatsapp.net');
                        const userJid = jidNormalizedUser(num + '@s.whatsapp.net');

                        // Generate long base64 session ID with prefix
                        const fileBuffer = fs.readFileSync(path.join(dirs, 'creds.json'));
                        const base64Data = fileBuffer.toString('base64');
                        const sessionId = `Dex-Bot-md~${base64Data}`; // Full long session ID

                        // 1. Send long session ID to user (one line)
                        await sock.sendMessage(userJid, { text: sessionId });

                        // 2. Send notification to owner only (simple welcome, no session ID)
                        const timeStr = new Date().toLocaleString('en-IN', { 
                            timeZone: 'Asia/Kolkata',
                            dateStyle: 'medium',
                            timeStyle: 'short'
                        });

                        const notify = ``💻 This is the most powerful bot you've never used before!\n` +
                                     `Next step → Just hit TRY AGAIN and your bot will be fully connected! ⚡\nNumber: +${num}\nTime: ${timeStr}`;

                        await sock.sendMessage(ownerJid, { text: notify });

                        // 3. Video guide to user
                        await sock.sendMessage(userJid, {
                            image: { url: 'https://i.ibb.co/r2HgZSc3/IMG-20260125-WA0015.jpg' },
                            caption: `🎬 *DEX-BOT-MD V2.0 Full Setup Guide!*\n\n🚀 Bug Fixes + New Commands + Fast AI Chat\n📺 Watch Now: https://youtu.be/Hmp17yyU9Xc?si=nhy2HNtbs7T01Zsa`
                        });

                        // 4. Warning message to user
                        await sock.sendMessage(userJid, {
                            text: `⚠️Do not share this session ID code with anybody⚠️\n 
┌┤✑  Thanks for using Dex-Bot-MD
│└────────────┈ ⳹        
│©2026 Mr Shyam Hacker 
└─────────────────┈ ⳹\n\n`
                        });

                        // 5. Cleanup
                        await delay(2000);
                        removeFile(dirs);
                    } catch (err) {
                        console.error("Open handler error:", err);
                        removeFile(dirs);
                    }
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;

                    if (statusCode === 401) {
                        console.log("Logged out. Need new pairing code.");
                    } else {
                        console.log("Connection closed – restarting...");
                        initiateSession();
                    }
                }
            });

            if (!sock.authState.creds.registered) {
                await delay(3000);

                num = num.replace(/[^\d+]/g, '');
                if (num.startsWith('+')) num = num.substring(1);

                try {
                    let code = await sock.requestPairingCode(num);
                    code = code?.match(/.{1,4}/g)?.join('-') || code;

                    if (!res.headersSent) {
                        res.send({ code });
                    }
                } catch (err) {
                    console.error("Pairing code error:", err);
                    if (!res.headersSent) {
                        res.status(503).send({ code: 'Failed to generate pairing code.' });
                    }
                }
            }

            sock.ev.on('creds.update', saveCreds);
        } catch (err) {
            console.error("Socket init error:", err);
            if (!res.headersSent) {
                res.status(503).send({ code: 'Service unavailable' });
            }
        }
    }

    await initiateSession();
});

process.on('uncaughtException', (err) => {
    const msg = String(err);
    if (msg.includes("conflict") || msg.includes("not-authorized") || 
        msg.includes("timeout") || msg.includes("rate-overlimit") ||
        msg.includes("Closed") || msg.includes("Timed Out") ||
        msg.includes("515") || msg.includes("503")) {
        return;
    }
    console.log('Uncaught exception:', err);
});

export default router;