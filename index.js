import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { fileURLToPath } from "url";
import path from "path";

import pairRouter from "./pair.js";
import qrRouter from "./qr.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8000;

import("events").then((events) => {
    events.EventEmitter.defaultMaxListeners = 500;
});

app.use(cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "pair.html"));
});

app.use("/pair", pairRouter);
app.use("/qr", qrRouter);

// ✅ Global error handlers — server NEVER crashes on unhandled errors
process.on("uncaughtException", (err) => {
    const e = String(err);
    // Ignore known Baileys non-fatal errors
    if (
        e.includes("conflict") ||
        e.includes("not-authorized") ||
        e.includes("Timed Out") ||
        e.includes("Connection Closed") ||
        e.includes("Socket connection timeout") ||
        e.includes("rate-overlimit") ||
        e.includes("Value not found") ||
        e.includes("Stream Errored") ||
        e.includes("statusCode: 515") ||
        e.includes("statusCode: 503")
    ) return;
    console.error("⚠️ Uncaught Exception (server kept alive):", err);
});

process.on("unhandledRejection", (err) => {
    const e = String(err);
    if (
        e.includes("conflict") ||
        e.includes("not-authorized") ||
        e.includes("Timed Out") ||
        e.includes("Connection Closed")
    ) return;
    console.error("⚠️ Unhandled Rejection (server kept alive):", err);
});

app.listen(PORT, () => {
    console.log(`✅ JERRY-MD Session Server running on port ${PORT}`);
});

export default app;
