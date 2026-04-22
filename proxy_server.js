// ============================================================
//   DISCORD WEBHOOK PROXY SERVER
//   Diperlukan karena Roblox tidak bisa langsung POST ke Discord
//
//   CARA PAKAI:
//   1. Install Node.js
//   2. npm install express axios cors
//   3. Isi DISCORD_WEBHOOK_URL di bawah
//   4. node proxy_server.js
//   5. Deploy ke Replit / Railway / VPS
//   6. Salin URL server ke CONFIG.WEBHOOK_PROXY_URL di script Lua
// ============================================================

const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// ============================================================
// KONFIGURASI - ISI DI SINI
// ============================================================
const CONFIG = {
    // Ganti dengan Discord Webhook URL kamu
    // Cara dapat: Discord Server > Channel Settings > Integrations > Webhooks
    DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/1496175634379182303/RTjJCx7CaDjawr_WtpvqCDyqyKz6R5C5YnLXNPtoALT_oox-YduH0_fkxCjJyWO9ur4X",

    // Port server (Replit otomatis pakai process.env.PORT)
    PORT: process.env.PORT || 3000,

    // Secret key untuk keamanan (isi bebas, samakan dengan Lua jika mau)
    // Kosongkan string jika tidak ingin pakai auth
    SECRET_KEY: "",

    // Rate limit: max request per menit per IP
    RATE_LIMIT_PER_MINUTE: 20,
};

// ============================================================
// SIMPLE RATE LIMITER
// ============================================================
const requestCounts = {};

function isRateLimited(ip) {
    const now = Date.now();
    if (!requestCounts[ip]) {
        requestCounts[ip] = [];
    }
    // Hapus request yang sudah lebih dari 1 menit
    requestCounts[ip] = requestCounts[ip].filter((t) => now - t < 60000);
    if (requestCounts[ip].length >= CONFIG.RATE_LIMIT_PER_MINUTE) {
        return true;
    }
    requestCounts[ip].push(now);
    return false;
}

// ============================================================
// ENDPOINT HEALTH CHECK
// ============================================================
app.get("/", (req, res) => {
    res.json({
        status: "online",
        message: "Anti-Exploit Proxy Server aktif 🛡️",
        timestamp: new Date().toISOString(),
    });
});

// ============================================================
// ENDPOINT WEBHOOK - menerima dari Roblox & forward ke Discord
// ============================================================
app.post("/webhook", async (req, res) => {
    const clientIP = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // --- Rate Limit Check ---
    if (isRateLimited(clientIP)) {
        console.warn(`[RATE LIMIT] IP: ${clientIP}`);
        return res.status(429).json({ error: "Too many requests" });
    }

    // --- Secret Key Check (opsional) ---
    if (CONFIG.SECRET_KEY) {
        const authHeader = req.headers["x-secret-key"];
        if (authHeader !== CONFIG.SECRET_KEY) {
            console.warn(`[AUTH FAILED] IP: ${clientIP}`);
            return res.status(403).json({ error: "Unauthorized" });
        }
    }

    // --- Validasi body ---
    const body = req.body;
    if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "Invalid body" });
    }

    // --- Kirim ke Discord ---
    try {
        const response = await axios.post(CONFIG.DISCORD_WEBHOOK_URL, body, {
            headers: { "Content-Type": "application/json" },
            timeout: 5000,
        });

        console.log(`[OK] Notif dikirim ke Discord | IP: ${clientIP} | Status: ${response.status}`);
        return res.status(200).json({ success: true, discord_status: response.status });
    } catch (error) {
        const errMsg = error.response?.data || error.message;
        console.error(`[ERROR] Gagal kirim ke Discord:`, errMsg);
        return res.status(500).json({ error: "Failed to forward to Discord", detail: errMsg });
    }
});

// ============================================================
// ENDPOINT TEST - untuk cek apakah webhook Discord valid
// ============================================================
app.get("/test", async (req, res) => {
    try {
        await axios.post(CONFIG.DISCORD_WEBHOOK_URL, {
            username: "Anti-Exploit Bot 🛡️",
            content: "✅ **Test berhasil!** Proxy server terhubung ke Discord.",
        });
        res.json({ success: true, message: "Test notif berhasil dikirim ke Discord!" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ============================================================
// START SERVER
// ============================================================
app.listen(CONFIG.PORT, () => {
    console.log(`🛡️  Anti-Exploit Proxy Server berjalan di port ${CONFIG.PORT}`);
    console.log(`📡  Webhook URL: ${CONFIG.DISCORD_WEBHOOK_URL.substring(0, 50)}...`);
    console.log(`🔒  Secret Key: ${CONFIG.SECRET_KEY ? "Aktif" : "Tidak aktif"}`);
    console.log(`⚡  Rate Limit: ${CONFIG.RATE_LIMIT_PER_MINUTE} req/menit`);
});
