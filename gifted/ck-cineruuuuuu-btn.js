const { gmd } = require("../gift");
const axios = require('axios');
const sharp = require('sharp');
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

async function createThumbnail(url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 5000 });
        return await sharp(response.data)
            .resize(300, 300)
            .jpeg({ quality: 80 })
            .toBuffer();
    } catch (e) {
        return null;
    }
}

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
        "7z": "application/x-7z-compressed"
    };
    return map[ext] || fallback || "application/octet-stream";
}

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
                fileName: data.fileName || data.title || "gdrive_file.mp4",
                fileSize: data.fileSize || data.size || "Unknown",
                mimetype: data.mimetype || "video/mp4",
                downloadUrl: data.downloadUrl || data.url
            };
        }
    } catch (err) {}
    return null;
}

gmd(
    {
        pattern: "cineru",
        category: "movie",
        aliases: ["cinx", "cinerulk"],
        description: "Search movies from Cineru.lk with Buttons",
    },
    async (from, Gifted, conText) => {
        const { q, reply, react, botFooter } = conText;

        try {
            if (!q) {
                await react("❌");
                return reply("🎬 Please provide a movie name.\n\nExample:\n.cineru avengers");
            }

            await react("🎬");
            const dateNow = Date.now();

            const searchUrl = `https://ck-cimneru-api-20241103.vercel.app/api/search?q=${encodeURIComponent(q)}`;
            const { data } = await axios.get(searchUrl);

            if (!data.results || !data.results.length) {
                await react("❌");
                return reply("❌ No movies found on Cineru.");
            }

            const moviesSlice = data.results.slice(0, 50);

            const buttonRows = moviesSlice.map((movie, index) => ({
                header: `🎬 Result ${index + 1}`,
                title: movie.title.substring(0, 50),
                description: `Date: ${movie.date || "N/A"}`,
                id: `cin_dl_${index}_${dateNow}`
            }));

            const buttonParams = {
                title: '🔍 Select a Cineru Movie',
                sections: [
                    {
                        title: '🎬 Available Movies',
                        rows: buttonRows
                    }
                ]
            };

            await sendInteractiveMessage(Gifted, from, {
                text: `🔍 *𝗖𝗜𝗡𝗘𝗥𝗨 𝗦𝗘𝗔𝗥𝗖𝗛* \n\nResults for: *${q}*`,
                footer: botFooter,
                interactiveButtons: [
                    {
                        name: 'single_select',
                        buttonParamsJson: JSON.stringify(buttonParams)
                    }
                ]
            }, { quoted: ck });

            await react("✅");

            const activeQualitySessions = new Map();

            const movieSelectionListener = async (update) => {
                try {
                    const msg = update.messages[0];
                    if (!msg.message) return;

                    const selectedButtonId = extractButtonId(msg.message);
                    if (!selectedButtonId || !selectedButtonId.includes(`_${dateNow}`) || !selectedButtonId.startsWith("cin_dl_")) return;
                    if (msg.key?.remoteJid !== from) return;

                    const movieIndex = parseInt(selectedButtonId.split("_")[2]);
                    const selectedMovie = moviesSlice[movieIndex];

                    await react("⏳");

                    const infoUrl = `https://ck-cimneru-api-20241103.vercel.app/api/info?url=${encodeURIComponent(selectedMovie.link)}`;
                    const infoResponse = await axios.get(infoUrl);

                    if (!infoResponse.data || infoResponse.data.status !== "success") {
                        await react("❌");
                        return reply("❌ Failed to fetch movie details from Cineru API.", msg);
                    }

                    const mInfo = infoResponse.data.movie_info;
                    const downloads = infoResponse.data.downloads || {};

                    let caption = `🎬 \`${mInfo.title}\`\n\n`;
                    caption += `⭐ \`IMDB Rating:\` *${mInfo.imdb_rating || "N/A"}*\n`;
                    caption += `🆔 \`Post ID:\` *${mInfo.post_id || "N/A"}*\n\n`;
                    caption += `📝 \`DESC:\` _${mInfo.description?.slice(0, 150) || "N/A"}_\n\n`;
                    caption += `> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`;

                    await Gifted.sendMessage(from, {
                        image: { url: mInfo.image_url || selectedMovie.image_url || "https://i.ibb.co/zd34Xnr/20251021-154215.jpg" },
                        caption: caption
                    }, { quoted: ck });

                    const dlDateNow = Date.now();
                    
                    const subRows = [];
                    const hcRows = [];
                    const videoRows = [];

                    // 1. Subtitle Section Rows
                    if (mInfo.subtitle_link) {
                        subRows.push({
                            header: `💬 SUBTITLE`,
                            title: `Download Sinhala Subtitle`,
                            description: `Get official .srt/.zip subtitle`,
                            id: `cin_sub_${dlDateNow}`
                        });
                    }

                    // Helper to parse links and push into respective rows
                    const parseCategoryLinks = (items, targetArray, categoryPrefix) => {
                        if (!items || !Array.isArray(items)) return;
                        items.forEach((item, catIdx) => {
                            if (!item.links) return;
                            item.links.forEach((lnk, lIdx) => {
                                const hostUpper = lnk.host.toUpperCase();
                                if (["PIXELDRAIN", "GDRIVE", "MEGA"].includes(hostUpper)) {
                                    targetArray.push({
                                        header: `📥 ${categoryPrefix} | ${hostUpper}`,
                                        title: `${item.quality.substring(0, 40)}`,
                                        description: `Host: ${hostUpper}`,
                                        id: `cin_link_${dlDateNow}_${catIdx}_${lIdx}_${hostUpper}_${categoryPrefix}`
                                    });
                                }
                            });
                        });
                    };

                    parseCategoryLinks(downloads.subtitle_copy, subRows, "SUB");
                    parseCategoryLinks(downloads.hc_video_copy, hcRows, "HC");
                    parseCategoryLinks(downloads.video_copy, videoRows, "VIDEO");

                    const sectionsList = [];
                    if (subRows.length > 0) {
                        sectionsList.push({ title: '⭐ SUBTITLE', rows: subRows });
                    }
                    if (hcRows.length > 0) {
                        sectionsList.push({ title: '⭐ HC COPY (උපසිරැසි සහිත)', rows: hcRows });
                    }
                    if (videoRows.length > 0) {
                        sectionsList.push({ title: '⭐ VIDEO COPY (උපසිරැසි රහිත)', rows: videoRows });
                    }

                    if (sectionsList.length === 0) {
                        await react("❌");
                        return reply("❌ No supported download links (Pixeldrain/GDrive/Mega) found.");
                    }

                    const qualityButtonParams = {
                        title: '🟢 Select Quality & Host',
                        sections: sectionsList
                    };

                    activeQualitySessions.set(dlDateNow, { mInfo, downloads });

                    await sendInteractiveMessage(Gifted, from, {
                        text: '🔽 *Please select your preferred download option below:*',
                        footer: botFooter,
                        interactiveButtons: [
                            {
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify(qualityButtonParams)
                            }
                        ]
                    }, { quoted: ck });

                    await react("✅");

                } catch (err) {
                    console.error(err);
                    await react("❌");
                }
            };

            const qualityListener = async (update2) => {
                try {
                    const msg2 = update2.messages[0];
                    if (!msg2.message) return;

                    const selectedQualityId = extractButtonId(msg2.message);
                    if (!selectedQualityId || (!selectedQualityId.startsWith("cin_link_") && !selectedQualityId.startsWith("cin_sub_"))) return;
                    if (msg2.key?.remoteJid !== from) return;

                    await react("⬇️");

                    // Subtitle handler
                    if (selectedQualityId.startsWith("cin_sub_")) {
                        const dlTimestamp = parseInt(selectedQualityId.split("_")[2]);
                        const session = activeQualitySessions.get(dlTimestamp);
                        if (!session || !session.mInfo.subtitle_link) {
                            await react("❌");
                            return reply("❌ Subtitle link expired or not found.", msg2);
                        }

                        await Gifted.sendMessage(from, {
                            document: { url: session.mInfo.subtitle_link },
                            mimetype: "application/zip",
                            fileName: `${session.mInfo.title} - Sinhala Subtitles.zip`,
                            caption: `💬 \`Sinhala Subtitle File\`\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
                        }, { quoted: ck });
                        await react("✅");
                        return;
                    }

                    // Media download handler (ID format: cin_link_{timestamp}_{catIdx}_{lIdx}_{hostType}_{categoryPrefix})
                    const parts = selectedQualityId.split("_");
                    const dlTimestamp = parseInt(parts[2]);
                    const catIdx = parseInt(parts[3]);
                    const lIdx = parseInt(parts[4]);
                    const hostType = parts[5];
                    const categoryPrefix = parts[6];

                    if (!activeQualitySessions.has(dlTimestamp)) return;
                    const session = activeQualitySessions.get(dlTimestamp);

                    let targetLinkObj = null;
                    let targetQuality = "Movie File";

                    let targetSourceArray = [];
                    if (categoryPrefix === "SUB") targetSourceArray = session.downloads.subtitle_copy || [];
                    else if (categoryPrefix === "HC") targetSourceArray = session.downloads.hc_video_copy || [];
                    else if (categoryPrefix === "VIDEO") targetSourceArray = session.downloads.video_copy || [];

                    if (targetSourceArray[catIdx] && targetSourceArray[catIdx].links[lIdx]) {
                        targetLinkObj = targetSourceArray[catIdx].links[lIdx];
                        targetQuality = targetSourceArray[catIdx].quality;
                    }

                    if (!targetLinkObj) {
                        await react("❌");
                        return reply("❌ Selected download link not found.", msg2);
                    }

                    let finalUrl = targetLinkObj.url;

                    // Pixeldrain Direct Link Format
                    if (hostType === "PIXELDRAIN") {
                        const matchId = finalUrl.match(/\/u\/([a-zA-Z0-9_-]+)/);
                        if (matchId && matchId[1]) {
                            finalUrl = `https://pixeldrain.com/api/file/${matchId[1]}?download`;
                        }
                    }

                    // Mega API Integration
                    if (hostType === "MEGA") {
                        try {
                            const megaApiUrl = `https://apis.sadas.dev/api/v1/download/mega?q=${encodeURIComponent(finalUrl)}&apiKey=aef6578e9d6927ee27b0a62e8f284e75`;
                            const megaRes = await axios.get(megaApiUrl);
                            if (megaRes.data && megaRes.data.status && megaRes.data.data?.result?.download) {
                                finalUrl = megaRes.data.data.result.download;
                            } else {
                                await react("❌");
                                return reply("❌ Failed to fetch Mega direct download link.");
                            }
                        } catch (megaErr) {
                            console.error("Mega API Error:", megaErr);
                            await react("❌");
                            return reply("❌ Error connecting to Mega API.");
                        }
                    }

                    await react("⬆️");
                    const thumb = await createThumbnail(session.mInfo.image_url);

                    // Google Drive Handler
                    if (hostType === "GDRIVE") {
                        const gdriveData = await fetchGDrive(finalUrl);
                        if (!gdriveData || !gdriveData.downloadUrl) {
                            await react("❌");
                            return reply("❌ Google Drive link is private, invalid, or file is too large.");
                        }

                        const mime = getMimeType(gdriveData.fileName, gdriveData.mimetype);
                        const docPayload = {
                            document: { url: gdriveData.downloadUrl },
                            fileName: `${session.mInfo.title} [${targetQuality}].mp4`,
                            mimetype: mime,
                            caption: `🎬 \`${session.mInfo.title}\`\n🎞️ \`Quality:\` *${targetQuality}*\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
                        };
                        if (thumb) docPayload.jpegThumbnail = thumb;
                        await Gifted.sendMessage(from, docPayload, { quoted: ck });

                    } else {
                        // Pixeldrain / Mega / Direct downloads
                        const fileName = `${session.mInfo.title} [${targetQuality}].mp4`;
                        const docPayload = {
                            document: { url: finalUrl },
                            fileName: fileName,
                            mimetype: "video/mp4",
                            caption: `🎬 \`${session.mInfo.title}\`\n🎞️ \`Quality:\` *${targetQuality}*\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
                        };
                        if (thumb) docPayload.jpegThumbnail = thumb;
                        await Gifted.sendMessage(from, docPayload, { quoted: ck });
                    }

                    await react("✅");

                } catch (err) {
                    console.error(err);
                    await react("❌");
                }
            };

            Gifted.ev.on("messages.upsert", movieSelectionListener);
            Gifted.ev.on("messages.upsert", qualityListener);

    } catch (err) {
        console.error(err);
        await react("❌");
        reply(`❌ Error: ${err.message || err}`);
    }
  }
);
