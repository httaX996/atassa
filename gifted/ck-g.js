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
        return null; // Thumbnail බැරි වුනොත් error නොදී null යවයි
    }
}

/* ================= GDRIVE LINK CLEANER ================= */

function cleanGDriveUrl(url) {
    try {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://drive.google.com/uc?id=${match[1]}&export=download`;
        }
        return url;
    } catch (e) {
        return url;
    }
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

            // URL එක Clean කරගැනීම
            const cleanedUrl = cleanGDriveUrl(q.trim());

            // GDrive Dl Fetch
            const gdriveData = await fg.GDriveDl(cleanedUrl).catch(() => null);

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
                caption: `🍿 \`${gdriveData.fileName} - සිංහල උපසිරැසි සමඟ\`\n\n> ⚡ ᴘᴏᴡᴇʀᴇڊ ʙʏ *CK CineMAX*`
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

