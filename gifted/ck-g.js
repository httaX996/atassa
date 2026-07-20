const { gmd } = require("../gift");
const fg = require("api-dylux");
const axios = require("axios");
const sharp = require("sharp");

/* ================= MIME TYPE AUTO DETECT ================= */

function getMimeType(fileName, fallback) {
    if (!fileName) return fallback || "application/octet-stream";
    const ext = fileName.split('.').pop().toLowerCase();

    const map = {
        mp4: "video/mp4",
        mkv: "video/x-matroska",
        avi: "video/x-msvideo",
        mov: "video/quicktime",
        webm: "video/webm",

        mp3: "audio/mpeg",
        m4a: "audio/mp4",
        wav: "audio/wav",

        pdf: "application/pdf",
        zip: "application/zip",
        rar: "application/x-rar-compressed",
        "7z": "application/x-7z-compressed",

        apk: "application/vnd.android.package-archive",

        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp"
    };

    return map[ext] || fallback || "application/octet-stream";
}

/* ================= THUMBNAIL FUNCTION ================= */

async function createThumbnail(imageUrl) {
    try {
        const res = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 5000 });
        return await sharp(res.data)
            .resize(150, 150)
            .jpeg({ quality: 60 })
            .toBuffer();
    } catch (e) {
        return null;
    }
}

/* ================= GDRIVE SCRAPER FALLBACK ================= */

async function fetchGDrive(url) {
    // 1. Try api-dylux methods safely
    try {
        if (typeof fg.gdrive === 'function') {
            const res = await fg.gdrive(url);
            if (res && res.downloadUrl) return res;
        }
        if (typeof fg.GDriveDl === 'function') {
            const res = await fg.GDriveDl(url);
            if (res && res.downloadUrl) return res;
        }
    } catch (e) {
        console.log("api-dylux error, trying direct API...");
    }

    // 2. Direct External API Fallback
    try {
        const apiRes = await axios.get(`https://api.vreden.my.id/api/gdrive?url=${encodeURIComponent(url)}`);
        if (apiRes.data && apiRes.data.result) {
            const data = apiRes.data.result;
            return {
                fileName: data.fileName || data.title || "gdrive_file",
                fileSize: data.fileSize || data.size || "Unknown",
                mimetype: data.mimetype || "application/octet-stream",
                downloadUrl: data.downloadUrl || data.url
            };
        }
    } catch (err) {
        console.log("Direct API error:", err.message);
    }

    return null;
}

/* ================= GIFTED COMMAND ================= */

gmd(
    {
        pattern: "ckg",
        category: "download",
        aliases: ["googledrive", "gd", "cyber_gd"],
        description: "Download Google Drive files",
    },
    async (from, Gifted, conText) => {
        const { q, reply, react, m } = conText;

        try {
            if (!q) {
                await react("❌");
                return reply("*Please give me a Google Drive URL...!*");
            }

            await react("📥");

            // Fetch GDrive Data
            const gdriveData = await fetchGDrive(q.trim());

            if (!gdriveData || !gdriveData.downloadUrl) {
                await react("❌");
                return reply("*Error..! Your URL is Private, Invalid, or File is too large.*");
            }

            // Auto mimetype detect
            const mime = getMimeType(
                gdriveData.fileName,
                gdriveData.mimetype
            );

            // Generate thumbnail
            const thumb = await createThumbnail(
                "https://i.ibb.co/zd34Xnr/20251021-154215.jpg"
            );

            // Info message
            await Gifted.sendMessage(from, {
                text: `🎬 \`CK CineMAX DOWNLOADER\` 🎬\n\n` +
                      `📃 \`File name:\` *${gdriveData.fileName}*\n` +
                      `💈 \`File Size:\` *${gdriveData.fileSize}*\n` +
                      `🕹️ \`File type:\` *${mime}*\n\n` +
                      `> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
            }, { quoted: m });

            await react("⬆️");

            // Build Message Payload
            const docPayload = {
                document: { url: gdriveData.downloadUrl },
                fileName: `🎬 CK CineMAX 🎬 ${gdriveData.fileName}`,
                mimetype: mime,
                caption: `🍿 \`${gdriveData.fileName} - සිංහල උපසිරැසි සමඟ\`\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ *CK CineMAX*`
            };

            if (thumb) {
                docPayload.jpegThumbnail = thumb;
            }

            // Send file as Document
            await Gifted.sendMessage(from, docPayload, { quoted: m });

            await react("✅");

        } catch (err) {
            console.error("CKG Command Error:", err);
            await react("❌");
            reply(`*Error..! ${err.message || "Something went wrong"}*`);
        }
    }
);
