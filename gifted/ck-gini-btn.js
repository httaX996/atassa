const { gmd } = require("../gift");
const axios = require("axios");
const sharp = require("sharp");
const fg = require("api-dylux");
const { sendInteractiveMessage } = require("gifted-btns");

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
    if (!fileName) return fallback || "video/mp4";
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

    return map[ext] || fallback || "video/mp4";
}

/* ================= HELPER FUNCTIONS ================= */

function extractButtonId(msg) {
    if (!msg) return null;
    if (msg.templateButtonReplyMessage?.selectedId) return msg.templateButtonReplyMessage.selectedId;
    if (msg.buttonsResponseMessage?.selectedButtonId) return msg.buttonsResponseMessage.selectedButtonId;
    if (msg.listResponseMessage?.singleSelectReply?.selectedRowId) return msg.listResponseMessage.singleSelectReply.selectedRowId;
    if (msg.interactiveResponseMessage) {
        const nf = msg.interactiveResponseMessage.nativeFlowResponseMessage;
        if (nf?.paramsJson) {
            try { const p = JSON.parse(nf.paramsJson); if (p.id) return p.id; } catch {}
        }
        return msg.interactiveResponseMessage.buttonId || null;
    }
    return null;
}

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

/* ================= GDRIVE SCRAPER (from ck-g.js) ================= */

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

/* ================= MAIN GINISISILA COMMAND ================= */

gmd(
    {
        pattern: "gs",
        category: "movie",
        aliases: ["ginisisila"],
        description: "Search and download movies from Ginisisila",
    },
    async (from, Gifted, conText) => {
        const { q, reply, react, botFooter } = conText;

        try {
            if (!q) {
                await react("❌");
                return reply("🎬 *කරුණාකර චිත්‍රපටයේ හෝ ටෙලිනාට්‍යයේ නම ලබාදෙන්න!*\n\nExample:\n.gs garfield");
            }

            await react("🔍");

            const dateNow = Date.now();

            // 1. Search API
            const searchUrl = `https://ck-pahe-inc-api-123xyz.vercel.app/api/search?q=${encodeURIComponent(q)}`;
            const searchRes = await axios.get(searchUrl);

            if (!searchRes.data?.status || !searchRes.data?.results || searchRes.data.results.length === 0) {
                await react("❌");
                return reply("❌ *කිසිදු ප්‍රතිඵලයක් හමු වූයේ නැත.*");
            }

            const results = searchRes.data.results.slice(0, 100);

            // 2. Interactive Select List Buttons
            const buttonRows = results.map((item, index) => ({
                header: `🎬 Result ${index + 1}`,
                title: item.title.slice(0, 50),
                description: `Click to fetch download options`,
                id: `gs_select_${index}_${dateNow}`
            }));

            const buttonParams = {
                title: '🎬 Select Movie / Episode',
                sections: [
                    {
                        title: `🔍 Search Results for: ${q}`,
                        rows: buttonRows
                    }
                ]
            };

            await sendInteractiveMessage(Gifted, from, {
                text: `🔥 *GINISISILA MOVIE SEARCH* 🔥\n\n🔎 Results found for: *${q}*\n👇 කරුණාකර පහත ලැයිස්තුවෙන් ඔබට අවශ්‍ය එක තෝරන්න:`,
                footer: `👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`,
                interactiveButtons: [
                    {
                        name: 'single_select',
                        buttonParamsJson: JSON.stringify(buttonParams)
                    }
                ]
            }, { quoted: ck });

            await react("✅");

            // 3. Selection Event Listener (Expire නොවී වැඩ කරන ලෙස)
            const selectionListener = async (update) => {
                try {
                    const msg = update.messages[0];
                    if (!msg.message) return;

                    const selectedId = extractButtonId(msg.message);
                    if (!selectedId || !selectedId.startsWith("gs_select_") || !selectedId.includes(`_${dateNow}`)) return;
                    if (msg.key?.remoteJid !== from) return;

                    const parts = selectedId.split("_");
                    const selectedIndex = parseInt(parts[2]);
                    const selectedMovie = results[selectedIndex];

                    await react("⏳");

                    // Fetch Movie Info API
                    const infoUrl = `https://ck-pahe-inc-api-123xyz.vercel.app/api/info?url=${encodeURIComponent(selectedMovie.link)}`;
                    const infoRes = await axios.get(infoUrl);

                    if (!infoRes.data?.status || !infoRes.data?.result) {
                        await react("❌");
                        return reply("❌ *තොරතුරු ලබා ගැනීමට අපොහොසත් විය.*", msg);
                    }

                    const info = infoRes.data.result;

                    // Send Title & Image Message
                    await Gifted.sendMessage(from, {
                        image: { url: info.image_link || selectedMovie.image_link },
                        caption: `🎬 *${info.title}*\n\n> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
                    }, { quoted: ck });

                    // Send Download Start Message
                    await Gifted.sendMessage(from, { text: "📥 *Your downloading start...*" }, { quoted: ck });

                    // Fetch DL Link API
                    const dlApiUrl = `https://ck-pahe-inc-api-123xyz.vercel.app/api/dl?url=${encodeURIComponent(info.dl_link)}`;
                    const dlRes = await axios.get(dlApiUrl);

                    if (!dlRes.data?.status || !dlRes.data?.stream_link) {
                        await react("❌");
                        return reply("❌ *Download link එක ලබා ගැනීමට නොහැකි විය.*", msg);
                    }

                    const streamLink = dlRes.data.stream_link;
                    const mainThumb = await createThumbnail(info.image_link || selectedMovie.image_link);

                    /* ================= DOMAIN HANDLERS ================= */

                    // 1. RUMBLE HANDLER
                    if (streamLink.includes("rumble.com")) {
                        await react("⬇️");
                        const rumRes = await axios.get(`https://ck-pahe-inc-api-123xyz.vercel.app/api/rumdl?url=${encodeURIComponent(streamLink)}`);

                        if (rumRes.data?.status && rumRes.data?.downloads?.length > 0) {
                            const videoUrl = rumRes.data.downloads[0].url;

                            await react("⬆️");
                            await Gifted.sendMessage(from, {
                                document: { url: videoUrl },
                                mimetype: "video/mp4",
                                fileName: `${rumRes.data.title || info.title}.mp4`,
                                jpegThumbnail: mainThumb,
                                caption: `🎬 *${rumRes.data.title || info.title}*\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
                            }, { quoted: ck });
                            await react("✅");
                        } else {
                            await react("❌");
                            reply("❌ *Rumble video ලබා ගැනීමට අපොහොසත් විය.*", msg);
                        }
                    }

                    // 2. GOOGLE DRIVE HANDLER
                    else if (streamLink.includes("drive.google.com") || streamLink.includes("docs.google.com")) {
                        await react("⬇️");

                        // Fetch GDrive Direct URL
                        const gdriveData = await fetchGDrive(streamLink.trim());

                        if (!gdriveData || !gdriveData.downloadUrl) {
                            await react("❌");
                            return reply("❌ *Google Drive ෆයිල් එක ලබා ගැනීමට අපොහොසත් විය.*", msg);
                        }

                        // Auto mimetype detect
                        const mime = getMimeType(
                            gdriveData.fileName,
                            gdriveData.mimetype
                        );

                        await react("⬆️");

                        // Build Document Payload
                        const docPayload = {
                            document: { url: gdriveData.downloadUrl },
                            fileName: `${gdriveData.fileName || info.title}.mp4`,
                            mimetype: mime,
                            caption: `🎬 *${info.title}*\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
                        };

                        if (mainThumb) {
                            docPayload.jpegThumbnail = mainThumb;
                        }

                        // Send file as Document
                        await Gifted.sendMessage(from, docPayload, { quoted: ck });
                        await react("✅");
                    }

                    // 3. YOUTUBE HANDLER
else if (streamLink.includes("youtube.com") || streamLink.includes("youtu.be")) {
    await react("⬇️");

    // Embed URL එක Standard YouTube URL එකක් බවට Convert කිරීම
    let cleanYtUrl = streamLink;
    if (streamLink.includes("/embed/")) {
        const videoId = streamLink.split("/embed/")[1]?.split("?")[0];
        if (videoId) {
            cleanYtUrl = `https://www.youtube.com/watch?v=${videoId}`;
        }
    }

    const ytApiUrl = `https://suhasbro-ytdl-api.vercel.app/api/ytmp4?url=${encodeURIComponent(cleanYtUrl)}&quality=720&apikey=SuhasBroYTDL-api`;
    const ytRes = await axios.get(ytApiUrl);

    if (ytRes.data?.status && ytRes.data?.download?.url) {
        await react("⬆️");
        await Gifted.sendMessage(from, {
            document: { url: ytRes.data.download.url },
            mimetype: "video/mp4",
            fileName: `${ytRes.data.metadata?.title || info.title}.mp4`,
            jpegThumbnail: mainThumb,
            caption: `🎬 *${ytRes.data.metadata?.title || info.title}*\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
        }, { quoted: ck });
        await react("✅");
    } else {
        await react("❌");
        reply("❌ *YouTube Video එක ලබා ගැනීමට අපොහොසත් විය.*", msg);
    }
}


                    // 4. UNSUPPORTED DOMAINS
                    else {
                        await react("❌");
                        return reply("⚠️ *මේ site එක තාම downloader එකට add කරලා නෑ*", msg);
                    }

                } catch (err) {
                    console.error(err);
                    await react("❌");
                }
            };

            // Listener Register කිරීම
            Gifted.ev.on("messages.upsert", selectionListener);

            // විනාඩි 15කින් Listener එක Expire කිරීම
            setTimeout(() => {
                Gifted.ev.off("messages.upsert", selectionListener);
            }, 900000);

        } catch (err) {
            console.error(err);
            await react("❌");
            reply(`❌ Error: ${err.message || err}`);
        }
    }
);

