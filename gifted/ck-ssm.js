const { gmd } = require("../gift");
const axios = require('axios');
const sharp = require('sharp');
const config = require('../config');
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
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return await sharp(response.data)
            .resize(300, 300)
            .jpeg({ quality: 80 })
            .toBuffer();
    } catch (e) {
        console.log('Thumbnail Error:', e);
        return null;
    }
}

gmd(
    {
        pattern: "ssm",
        category: "movie",
        aliases: ["sinhalasub", "ssmovie"],
        description: "Search movies from SinhalaSub.lk with Buttons",
    },
    async (from, Gifted, conText) => {
        const { q, reply, react, botFooter } = conText;

        try {
            if (!q) {
                await react("❌");
                return reply("🎬 Please provide a movie or TV show name.\n\nExample:\n.ssm stranger things");
            }

            await react("🎬");

            const dateNow = Date.now();
            // 1. Search API
            const searchUrl = `https://ck-sinhalasub-api-1a2b3c4d5e.vercel.app/api/search?q=${encodeURIComponent(q)}`;
            const { data } = await axios.get(searchUrl);

            if (!data.status || !data.result || !data.result.length) {
                await react("❌");
                return reply("❌ No movies or TV shows found.");
            }

            const moviesSlice = data.result.slice(0, 50);
            
            // Search Results සඳහා Interactive List එක සැකසීම
            const buttonRows = moviesSlice.map((item, index) => ({
                header: `🎬 Result ${index + 1} • [${item.type?.toUpperCase() || 'MOVIE'}]`,
                title: `🎥 ${item.title.substring(0, 45)}`,
                description: `🌐 Lang: ${item.language || "N/A"} | Click to view`,
                id: `ssm_dl_${index}_${dateNow}`
            }));

            const buttonParams = {
                title: '🔍 Select Movie / Show',
                sections: [
                    {
                        title: '🎬 Available Results',
                        rows: buttonRows
                    }
                ]
            };

            await sendInteractiveMessage(Gifted, from, {
                text: `🔍 *𝗖𝗞 𝗦𝗜𝗡𝗛𝗔𝗟𝗔𝗦𝗨𝗕 𝗦𝗘𝗔𝗥𝗖𝗛* \n\nResults for: *${q}*`,
                footer: botFooter,
                interactiveButtons: [
                    {
                        name: 'single_select',
                        buttonParamsJson: JSON.stringify(buttonParams)
                    }
                ]
            }, { quoted: ck });

            await react("✅");

            // Global/Session tracking Maps
            const activeQualitySessions = new Map();

            // 2. Movie Selection Listener
            const movieSelectionListener = async (update) => {
                try {
                    const msg = update.messages[0];
                    if (!msg.message) return;

                    const selectedButtonId = extractButtonId(msg.message);
                    if (!selectedButtonId || !selectedButtonId.includes(`_${dateNow}`) || !selectedButtonId.startsWith("ssm_dl_")) return;
                    if (msg.key?.remoteJid !== from) return;

                    const movieIndex = parseInt(selectedButtonId.split("_")[2]);
                    const selectedMovie = moviesSlice[movieIndex];

                    await react("⏳");

                    // 2. Movie Info API
                    const infoUrl = `https://ck-sinhalasub-api-1a2b3c4d5e.vercel.app/api/minfo?url=${encodeURIComponent(selectedMovie.url)}`;
                    const infoResponse = await axios.get(infoUrl);

                    if (!infoResponse.data.status) {
                        await react("❌");
                        return reply("❌ Failed to fetch movie details.", msg);
                    }

                    const movie = infoResponse.data.result;
                    const details = movie.details || {};

                    let caption = `🎬 \`${movie.title}\`\n\n`;
                    caption += `📅 \`YEAR:\` *${details.year || "N/A"}*\n`;
                    caption += `⭐ \`IMDB:\` *${details.imdb || "N/A"}*\n`;
                    caption += `⏳ \`TIME:\` *${details.duration || "N/A"}*\n`;
                    caption += `🌐 \`LANGUAGE:\` *${details.language || "N/A"}*\n`;
                    caption += `🎞️ \`QUALITY:\` *${details.quality || "N/A"}*\n`;
                    caption += `🌍 \`COUNTRY:\` *${Array.isArray(details.country) ? details.country.join(', ') : details.country || "N/A"}*\n`;
                    caption += `✍️ \`SUB AUTHOR:\` *${details["subtitle author"] || "N/A"}*\n`;
                    caption += `🎭 \`CAST:\` ${Array.isArray(details.stars) ? details.stars.slice(0, 5).map(c => `*• ${c}*`).join('\n') : "N/A"}\n\n`;
                    caption += `> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`;

                    await Gifted.sendMessage(from, {
                        image: { url: movie.image || selectedMovie.image },
                        caption: caption
                    }, { quoted: ck });

                    const dlDateNow = Date.now();

                    // Downloads Grouping / Categorize කිරීම (Host එක අනුව)
                    const downloadsList = movie.downloads || [];
                    const groupedDownloads = {};

                    downloadsList.forEach((dl) => {
                        // Telegram Links ඉවත් කිරීම
                        if (dl.url && (dl.url.includes("t.me") || dl.url.includes("telegram"))) return;

                        const hostName = (dl.host || 'SERVER').toUpperCase();
                        if (!groupedDownloads[hostName]) {
                            groupedDownloads[hostName] = [];
                        }
                        groupedDownloads[hostName].push(dl);
                    });

                    // Interactive List එකට අදාළ Sections සෑදීම
                    const sections = [];
                    // Flat Array එකක් ලෙස පසුබිමේ තබා ගැනීම (Index මගින් හඳුනා ගැනීමට)
                    const flatDownloads = [];

                    Object.keys(groupedDownloads).forEach((host) => {
                        const rows = groupedDownloads[host].map((dl) => {
                            const globalIndex = flatDownloads.length;
                            flatDownloads.push(dl);

                            return {
                                header: `⚡ ${host}`,
                                title: `📥 ${dl.quality}`,
                                description: `📦 Size: ${dl.size}`,
                                id: `ssm_link_${movieIndex}_${globalIndex}_${dlDateNow}`
                            };
                        });

                        sections.push({
                            title: `📁 ${host} DOWNLOADS`,
                            rows: rows
                        });
                    });

                    if (sections.length === 0) {
                        await react("❌");
                        return reply("❌ No valid download links available.", msg);
                    }

                    const qualityButtonParams = {
                        title: '🟢 Select Download Server & Quality',
                        sections: sections
                    };

                    activeQualitySessions.set(dlDateNow, { movie, downloads: flatDownloads });

                    await sendInteractiveMessage(Gifted, from, {
                        text: '🔽 *Please select your preferred Server and Quality below:*',
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

            // 3. Download Quality Listener
            const qualityListener = async (update2) => {
                try {
                    const msg2 = update2.messages[0];
                    if (!msg2.message) return;

                    const selectedQualityId = extractButtonId(msg2.message);
                    if (!selectedQualityId || !selectedQualityId.startsWith("ssm_link_")) return;
                    if (msg2.key?.remoteJid !== from) return;

                    const parts = selectedQualityId.split("_");
                    const dlTimestamp = parseInt(parts[4]);

                    if (!activeQualitySessions.has(dlTimestamp)) return;
                    const session = activeQualitySessions.get(dlTimestamp);

                    const qIndex = parseInt(parts[3]);
                    const finalQuality = session.downloads[qIndex];

                    await react("⬇️");

                    // DL API call
                    const dlUrl = `https://ck-sinhalasub-api-1a2b3c4d5e.vercel.app/api/dl?url=${encodeURIComponent(finalQuality.url)}`;
                    const dlResponse = await axios.get(dlUrl);

                    if (!dlResponse.data.status || !dlResponse.data.result?.url) {
                        await react("❌");
                        return reply("❌ Direct download link could not be fetched.", msg2);
                    }

                    let directDownloadUrl = dlResponse.data.result.url;
                    const fileName = dlResponse.data.result.name || session.movie.title;

                    // Telegram Check (ආරක්ෂිත පියවරක් ලෙස)
                    if (directDownloadUrl.includes("t.me") || directDownloadUrl.includes("telegram")) {
                        await react("❌");
                        return reply("❌ Telegram links are not supported.", msg2);
                    }

                    // Pixeldrain URL එක Direct API Download Link එකක් බවට මාරු කිරීම
                    if (directDownloadUrl.includes("pixeldrain.com/u/")) {
                        const fileId = directDownloadUrl.split("/u/")[1]?.split("?")[0]?.trim();
                        if (fileId) {
                            directDownloadUrl = `https://pixeldrain.com/api/file/${fileId}?download`;
                        }
                    }

                    await react("⬆️");
                    const thumb = await createThumbnail(session.movie.image);

                    await Gifted.sendMessage(from, {
                        document: { url: directDownloadUrl },
                        mimetype: "video/mp4",
                        fileName: `${fileName}.mp4`,
                        jpegThumbnail: thumb,
                        caption: `🎬 \`${fileName}\`\n\n🎞️ \`Quality:\` *${finalQuality.quality}*\n📦 \`Size:\` *${finalQuality.size}*\n🖥️ \`Server:\` *${finalQuality.host || 'N/A'}*\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
                    }, { quoted: ck });

                    await react("✅");

                } catch (err) {
                    console.error(err);
                    await react("❌");
                }
            };

            Gifted.ev.on("messages.upsert", movieSelectionListener);
            Gifted.ev.on("messages.upsert", qualityListener);

            setTimeout(() => {
                Gifted.ev.off("messages.upsert", movieSelectionListener);
                Gifted.ev.off("messages.upsert", qualityListener);
                activeQualitySessions.clear();
            }, 600000);

        } catch (err) {
            console.error(err);
            await react("❌");
            reply(`❌ Error: ${err.message || err}`);
        }
    }
);
