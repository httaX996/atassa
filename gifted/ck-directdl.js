const { gmd } = require("../gift");
const axios = require("axios");
const sharp = require("sharp");
const path = require("path");

const ck = {
    key: {
        fromMe: false,
        participant: "0@s.whatsapp.net",
        remoteJid: "status@broadcast"
    },
    message: {
        contactMessage: {
            displayName: "〴ᴄʜᴇᴛʜᴍɪɴᴀ ×͜×",
            vcard: `BEGIN:VCARD
VERSION:3.0
FN:Meta
ORG:META AI;
TEL;type=CELL;type=VOICE;waid=13135550002:+13135550002
END:VCARD`
        }
    }
};


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

/* ================= BYTES TO HUMAN READABLE SIZE ================= */

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return "Unknown Size";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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

/* ================= DIRECT LINK METADATA FETCH ================= */

async function fetchDirectLinkInfo(fileUrl) {
    try {
        // Send HEAD request to get file metadata without downloading whole file
        const res = await axios.head(fileUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });

        const headers = res.headers;
        
        // 1. Extract File Size
        const contentLength = headers['content-length'];
        const fileSize = contentLength ? formatBytes(parseInt(contentLength)) : "Unknown Size";

        // 2. Extract MimeType
        const headerMime = headers['content-type'] ? headers['content-type'].split(';')[0].trim() : null;

        // 3. Extract File Name from Content-Disposition header if available
        let fileName = null;
        const contentDisposition = headers['content-disposition'];
        if (contentDisposition && contentDisposition.includes('filename=')) {
            const match = contentDisposition.match(/filename=["']?([^"';]+)["']?/);
            if (match && match[1]) {
                fileName = match[1];
            }
        }

        // Fallback: Extract File Name from URL path
        if (!fileName) {
            const parsedUrl = new URL(fileUrl);
            const pathname = parsedUrl.pathname;
            fileName = path.basename(pathname) || "downloaded_file";
        }

        // Refine MimeType using extension
        const finalMime = getMimeType(fileName, headerMime);

        return {
            fileName,
            fileSize,
            mimetype: finalMime,
            downloadUrl: fileUrl
        };
    } catch (err) {
        console.error("Direct Link Error:", err.message);
        
        // Basic Fallback if HEAD request fails (e.g. server blocks HEAD request)
        try {
            const parsedUrl = new URL(fileUrl);
            const fileName = path.basename(parsedUrl.pathname) || "downloaded_file";
            return {
                fileName,
                fileSize: "Unknown Size",
                mimetype: getMimeType(fileName, "application/octet-stream"),
                downloadUrl: fileUrl
            };
        } catch (e) {
            return null;
        }
    }
}

/* ================= DIRECT DOWNLOAD COMMAND ================= */

gmd(
    {
        pattern: "ckdl",
        category: "download",
        aliases: ["dl", "direct", "fetch"],
        description: "Download any direct file link",
    },
    async (from, Gifted, conText) => {
        const { q, reply, react, m } = conText;

        try {
            if (!q) {
                await react("❌");
                return reply("*Please provide a valid Direct Download URL...!*");
            }

            const urlInput = q.trim();

            if (!urlInput.startsWith("http://") && !urlInput.startsWith("https://")) {
                await react("❌");
                return reply("*Invalid URL! Please make sure it starts with http:// or https://*");
            }

            await react("📥");

            // Fetch File Data
            const fileData = await fetchDirectLinkInfo(urlInput);

            if (!fileData || !fileData.downloadUrl) {
                await react("❌");
                return reply("*Error..! Unable to fetch file information from the URL.*");
            }

            // Generate thumbnail
            const thumb = await createThumbnail(
                "https://i.ibb.co/zd34Xnr/20251021-154215.jpg"
            );

            // Info message
            await Gifted.sendMessage(from, {
                text: `📥 \`CK DIRECT DOWNLOADER\` 📥\n\n` +
                      `📃 \`NAME:\` *${fileData.fileName}*\n` +
                      `💈 \`SIZE:\` *${fileData.fileSize}*\n` +
                      `🕹️ \`TYPE:\` *${fileData.mimetype}*\n\n` +
                      `> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
            }, { quoted: ck });

            await react("⬆️");

            // Build Message Payload
            const docPayload = {
                document: { url: fileData.downloadUrl },
                fileName: `${fileData.fileName}`,
                mimetype: fileData.mimetype,
                caption: `\`${fileData.fileName}\`\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
            };

           // if (thumb) {
            //    docPayload.jpegThumbnail = thumb;
         //   }

            // Send file as Document
            await Gifted.sendMessage(from, docPayload, { quoted: ck });

            await react("✅");

        } catch (err) {
            console.error("DirectDL Command Error:", err);
            await react("❌");
            reply(`*Error..! ${err.message || "Something went wrong"}*`);
        }
    }
);
