import express from "express";
import fs from "fs";
import pino from "pino";
import {
    makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import pn from "awesome-phonenumber";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

async function generateShortSession(credsPath) {
    try {
        const credsData = fs.readFileSync(credsPath, 'utf-8');
        const base64Creds = Buffer.from(credsData).toString('base64');
        const sessionId = `JERY-MD~`;
        return { sessionId, encodedData: base64Creds };
    } catch (error) {
        console.error("Error generating short session:", error);
        return null;
    }
}

function rm(p) {
    try { 
        if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); 
    } catch(e) {
        console.log("Cleanup error:", e);
    }
}

router.get("/", async (req, res) => {
    let num = (req.query.number || "").replace(/[^0-9]/g, "");
    if (!num) return res.status(400).send({ code: "Number required" });

    const phone = pn("+" + num);
    if (!phone.isValid()) return res.status(400).send({ code: "Invalid number" });
    num = phone.getNumber("e164").replace("+", "");

    const dir = "./session" + num;
    rm(dir);

    async function start() {
        const { state, saveCreds } = await useMultiFileAuthState(dir);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
            },
            logger: pino({ level: "fatal" }),
            browser: Browsers.windows("Chrome"),
            printQRInTerminal: false,
            markOnlineOnConnect: false,
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
            if (connection === "open") {
                try {
                    await delay(3000);
                    const credsPath = join(dir, 'creds.json');
                    const sessionInfo = await generateShortSession(credsPath);
                    
                    if (!sessionInfo) throw new Error("Failed to generate session");

                    const jid = jidNormalizedUser(num + "@s.whatsapp.net");
                    const completeSession = `${sessionInfo.sessionId}${sessionInfo.encodedData}`;
                    
                    await sock.sendMessage(jid, { text: completeSession });
                    await delay(2000);

                    const fakeVCardQuoted = {
                        key: { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: "status@broadcast" },
                        message: {
                            contactMessage: {
                                displayName: "© JERRY-MD",
                                vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:© JERRY-MD\nORG:JERRY XD;\nTEL;type=CELL;type=VOICE;waid=13135550002:+13135550002\nEND:VCARD`
                            }
                        }
                    };

                    const caption = `
╭━〔 *ᴊᴇʀʀʏ-xᴍᴅ* 〕━··๏
┃▶ ╭──────────────
┃▶ │ 👑 Owner : *JERRY KING*
┃▶ │ 🤖 Baileys : *Multi Device*
┃▶ │ 💻 Type : *NodeJs*
┃▶ │ 🚀 Platform : *Railway*
┃▶ │ ⚙️ Mode : *Public*
┃▶ │ 🔣 Prefix : *[ . ]*
┃▶ │ 🏷️ Version : *8.0.0*
┃▶ ╰──────────────
╰━━━━━━━━━━━━━━┈⊷`;

                    await sock.sendMessage(
                        jid,
                        {
                            image: { url: "https://files.catbox.moe/v6u3rr.jpg" },
                            caption,
                            contextInfo: {
                                mentionedJid: [jid],
                                forwardingScore: 999,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: "120363406741941705@newsletter",
                                    newsletterName: "✧༒★[ᴊᴇʀʀʏ-ᴍᴅ]★༒✧",
                                    serverMessageId: 143
                                }
                            }
                        },
                        { quoted: fakeVCardQuoted }
                    );

                    await delay(2000);
                    // ✅ FIX: sock.end() instead of process.exit()
                    try { sock.end(); } catch(e) {}
                    rm(dir);
                    console.log(`✅ Pair done for ${num} — server still running.`);

                } catch (err) {
                    console.error("❌ Pairing process error:", err);
                    try { sock.end(); } catch(e) {}
                    rm(dir);
                }
            }

            if (connection === "close") {
                const c = lastDisconnect?.error?.output?.statusCode;
                if (c === 401) {
                    rm(dir);
                }
                // ✅ FIX: No restart loop — each HTTP request is independent
            }
        });

        if (!sock.authState.creds.registered) {
            await delay(3000);
            try {
                let code = await sock.requestPairingCode(num);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                if (!res.headersSent) {
                    res.send({ success: true, code: code, message: "Pairing code generated" });
                }
            } catch(err) {
                console.error("Pairing code error:", err);
                if (!res.headersSent) {
                    res.status(503).send({ code: "PAIR_FAIL", error: err.message });
                }
                try { sock.end(); } catch(e) {}
                rm(dir);
            }
        }
    }

    start();
});

export default router;
