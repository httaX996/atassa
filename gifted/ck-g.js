const { gmd } = require("../gift");
const fg = require("api-dylux");
const axios = require("axios");
const sharp = require("sharp");

// Custom Quoted Context (ck object)
const ck = {
    key: {
        fromMe: false,
        participant: "0@s.whatsapp.net",
        remoteJid: "status@broadcast"
    },
    message: {
        contactMessage: {
            displayName: "〴ᴄʜᴇᴛʜᴍɪɴᴀ ×͜×",
            vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:Meta\nORG:META AI;\nTEL;type=CELL;type=VOICE;waid=13135550002:+13135550002\nEND:VCARD`
        }
    }
};

/* ================= MIME TYPE AUTO DETECT ================= */

function getMimeType(fileName, fallback) {
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

async function createThumbnail(imageUrl, width = 150, height = 150) {
    try {
        const res = await axios.get(imageUrl, { responseType: "arraybuffer" });
        return await sharp(res.data)
            .resize(width, height)
            .jpeg({ quality: 60 })
            .toBuffer();
    } catch (e) {
        console.log("Thumbnail Error:", e);
        return null;
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
        const { q, reply, react } = conText;

        try {
            if (!q) {
                await react("❌");
                return reply("*Please give me a Google Drive URL...!*");
            }

            await react("📥");

            const gdriveData = await fg.GDriveDl(q);

            if (!gdriveData || !gdriveData.downloadUrl) {
                await react("❌");
                return reply("*Error..! Your URL is Private or Invalid*");
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
            }, { quoted: ck });

            await react("⬆️");

            // Send file as Document
            await Gifted.sendMessage(from, {
                document: { url: gdriveData.downloadUrl },
                fileName: `🎬 CK CineMAX 🎬 ${gdriveData.fileName}`,
                mimetype: mime,
                jpegThumbnail: thumb,
                caption: `🍿 \`${gdriveData.fileName} - සිංහල උපසිරැසි සමඟ\`\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ *CK CineMAX*`
            }, { quoted: ck });

            await react("✅");

        } catch (err) {
            console.error(err);
            await react("❌");
            reply("*Error..! Something went wrong*");
        }
    }
);

