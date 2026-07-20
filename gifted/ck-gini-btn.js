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

/* ================= HELPER FUNCTIONS ================= */

// Interactive Message වලින් Button ID extract කරගැනීම
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

// Thumbnail නිර්මාණය කිරීම
async function createThumbnail(imageUrl) {
    try {
        const res = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 5000 });
        return await sharp(res.data)
            .resize(300, 300)
            .jpeg({ quality: 80 })
            .toBuffer();
    } catch (e) {
        return null;
    }
}

// Mime Type සොයා ගැනීම
function getMimeType(fileName, fallback) {
    if (!fileName) return fallback || "video/mp4";
    const ext = fileName.split('.').pop().toLowerCase();
    const map = {
        mp4: "video/mp4", mkv: "video/x-matroska", avi: "video/x-msvideo",
        webm: "video/webm", mp3: "audio/mpeg", pdf: "application/pdf"
    };
    return map[ext] || fallback || "video/mp4";
}

// Google Drive Downloader (ckg logic)
async function fetchGDrive(url) {
    try {
        if (typeof fg.gdrive === 'function') {
            const res = await fg.gdrive(url);
            if (res && res.downloadUrl) return res;
        }
        if (typeof fg.GDriveDl === 'function') {
            const res = await fg.GDriveDl(url);
            if (res && res.downloadUrl) return res;
        }
    } catch (e) {}

    try {
        const apiRes = await axios.get(`https://api.vreden.my.id/api/gdrive?url=${encodeURIComponent(url)}`);
        if (apiRes.data && apiRes.data.result) {
            const data = apiRes.data.result;
            return {
                fileName: data.fileName || data.title || "video.mp4",
                downloadUrl: data.downloadUrl || data.url
            };
        }
    } catch (err) {}
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

            // 1. Search API එකෙන් Data ලබාගැනීම
            const searchUrl = `https://ck-pahe-inc-api-123xyz.vercel.app/api/search?q=${encodeURIComponent(q)}`;
            const searchRes = await axios.get(searchUrl);

            if (!searchRes.data?.status || !searchRes.data?.results || searchRes.data.results.length === 0) {
                await react("❌");
                return reply("❌ *කිසිදු ප්‍රතිඵලයක් හමු වූයේ නැත.*");
            }

            const results = searchRes.data.results.slice(0, 15);

            // 2. Select List Buttons සැකසීම
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

            // Interactive List Message යැවීම
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

            // 3. Selection Event Listener (Multiple selection support)
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

                    // Movie Info API Fetch කිරීම
                    const infoUrl = `https://ck-pahe-inc-api-123xyz.vercel.app/api/info?url=${encodeURIComponent(selectedMovie.link)}`;
                    const infoRes = await axios.get(infoUrl);

                    if (!infoRes.data?.status || !infoRes.data?.result) {
                        await react("❌");
                        return reply("❌ *තොරතුරු ලබා ගැනීමට අපොහොසත් විය.*", msg);
                    }

                    const info = infoRes.data.result;

                    // Title & Image Message යැවීම
                    await Gifted.sendMessage(from, {
                        image: { url: info.image_link || selectedMovie.image_link },
                        caption: `🎬 *${info.title}*\n\n> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
                    }, { quoted: ck });

                    // Download start message යැවීම
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

                    /* ================= STREAM LINK HANDLERS ================= */

                    // 1. RUMBLE DOMAIN HANDLER
                    if (streamLink.includes("rumble.com")) {
                        await react("⬇️");
                        const rumRes = await axios.get(`https://ck-pahe-inc-api-123xyz.vercel.app/api/rumdl?url=${encodeURIComponent(streamLink)}`);

                        if (rumRes.data?.status && rumRes.data?.downloads?.length > 0) {
                            const videoUrl = rumRes.data.downloads[0].url; // පළමු Quality URL එක

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

                    // 2. GOOGLE DRIVE DOMAIN HANDLER
                    else if (streamLink.includes("drive.google.com") || streamLink.includes("docs.google.com")) {
                        await react("⬇️");
                        const gdData = await fetchGDrive(streamLink);

                        if (gdData && gdData.downloadUrl) {
                            await react("⬆️");
                            await Gifted.sendMessage(from, {
                                document: { url: gdData.downloadUrl },
                                mimetype: getMimeType(gdData.fileName, "video/mp4"),
                                fileName: `${gdData.fileName || info.title}.mp4`,
                                jpegThumbnail: mainThumb,
                                caption: `🎬 *${info.title}*\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
                            }, { quoted: ck });
                            await react("✅");
                        } else {
                            await react("❌");
                            reply("❌ *Google Drive ෆයිල් එක ලබා ගැනීමට අපොහොසත් විය.*", msg);
                        }
                    }

                    // 3. YOUTUBE DOMAIN HANDLER
                    else if (streamLink.includes("youtube.com") || streamLink.includes("youtu.be")) {
                        await react("⬇️");
                        const ytApiUrl = `https://suhasbro-ytdl-api.vercel.app/api/ytmp4?url=${encodeURIComponent(streamLink)}&quality=720&apikey=SuhasBroYTDL-api`;
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
                        return reply("⚠️ *මෙම site එක තාම downloader එකට add කරලා නෑ.*", msg);
                    }

                } catch (err) {
                    console.error(err);
                    await react("❌");
                }
            };

            // Listener Register කිරීම
            Gifted.ev.on("messages.upsert", selectionListener);

            // විනාඩි 15කින් Listener එක Expire කර දැමීම (15 * 60 * 1000 ms)
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

