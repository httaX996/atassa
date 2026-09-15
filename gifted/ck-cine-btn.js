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
        console.log('🖼️ Thumbnail Generation Error:', e);
        return null;
    }
}

gmd(
    {
        pattern: "cineck",
        category: "movie",
        aliases: ["cinesubz", "cine"],
        description: "Search movies from CineSubz with Premium Buttons",
    },
    async (from, Gifted, conText) => {
        const { q, reply, react, botFooter } = conText;

        try {
            if (!q) {
                await react("❌");
                return reply("⚠️ *Please provide a movie name to search!*\n\n💡 *Example:* `👑 .cineck deadpool`");
            }

            await react("🎬");

            const dateNow = Date.now();
            const searchUrl = `https://chethmina-kavishan-cinesubz-api-v1.vercel.app/api/search?q=${encodeURIComponent(q)}`;
            const { data } = await axios.get(searchUrl);

            if (!data.success || !data.results || !data.results.length) {
                await react("❌");
                return reply("❌ *Oops! No movies found matching your query.* 🔍");
            }

            const moviesSlice = data.results.slice(0, 50);
            
            const buttonRows = moviesSlice.map((movie, index) => ({
                header: `🎬 Result #${index + 1}`,
                title: `🎥 ${movie.title.substring(0, 45)}`,
                description: `✨ Tap here to view full details & downloads`,
                id: `cine_dl_${index}_${dateNow}`
            }));

            const buttonParams = {
                title: '📂 SELECT A MOVIE',
                sections: [
                    {
                        title: '🌟 𝖢𝗂𝗇𝖾Subz 𝖲𝖾𝖺𝗋𝖼𝗁 𝖱𝖾𝗌𝗎𝗅𝗍𝗌',
                        rows: buttonRows
                    }
                ]
            };

            await sendInteractiveMessage(Gifted, from, {
                text: `✨ 𝗖𝗜𝗡𝗘𝗦𝗨𝗕𝗭 𝗠𝗢𝗩𝗜𝗘\n\n🎯 *Search Query:* \`${q}\`\n📂 *Total Found:* \`${moviesSlice.length} Movies\`\n\n> ⚡ *Please select your desired movie from the menu below:*`,
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

            // 1. Movie Selection Listener
            const movieSelectionListener = async (update) => {
                try {
                    const msg = update.messages[0];
                    if (!msg.message) return;

                    const selectedButtonId = extractButtonId(msg.message);
                    if (!selectedButtonId || !selectedButtonId.includes(`_${dateNow}`) || !selectedButtonId.startsWith("cine_dl_")) return;
                    if (msg.key?.remoteJid !== from) return;

                    const movieIndex = parseInt(selectedButtonId.split("_")[2]);
                    const selectedMovie = moviesSlice[movieIndex];

                    await react("⏳");

                    const infoUrl = `https://chethmina-kavishan-cinesubz-api-v1.vercel.app/api/minfo?url=${encodeURIComponent(selectedMovie.link)}`;
                    const infoResponse = await axios.get(infoUrl);

                    if (!infoResponse.data.success) {
                        await react("❌");
                        return reply("❌ *Failed to fetch cinematic details for this movie.* ⚠️", msg);
                    }

                    const movie = infoResponse.data.data;

                    let caption = `🌟 \`${movie.title}\`\n\n`;
                    caption += `📅 \`YEAR:\` *${movie.year || "N/A"}*\n`;
                    caption += `⭐ \`IMDB:\` *${movie.imdb || "N/A"}* / 10\n`;
                    caption += `⏳ \`TIME:\` *${movie.time || "N/A"}*\n`;
                    caption += `🌍 \`COUNTRY:\` *${movie.country || "N/A"}*\n`;
                    caption += `🎭 \`CAST:\` ${movie.cast?.slice(1, 5).map(c => `, *${c}*`).join(', ') || "N/A"}\n\n`;
                    caption += `📝 \`STORY:\` _${movie.description?.slice(0, 160)}..._\n\n`;
                    caption += `> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`;

                    await Gifted.sendMessage(from, {
                        image: { url: movie.poster || selectedMovie.image },
                        caption: caption
                    }, { quoted: ck });

                    const dlDateNow = Date.now();

                    const qualityButtonRows = movie.downloads.map((dl, i) => ({
                        header: `📥 Quality: ${dl.quality}`,
                        title: `🚀 [${dl.quality}]`,
                        description: `💾 File Size: ${dl.size || "Unknown"}`,
                        id: `cine_link_${movieIndex}_${i}_${dlDateNow}`
                    }));

                    const qualityButtonParams = {
                        title: '🎯 SELECT QUALITY',
                        sections: [
                            {
                                title: '⚡ ᴀᴠᴀɪʟᴀʙʟᴇ ʀᴇꜱᴏʟᴜᴛɪᴏɴꜱ',
                                rows: qualityButtonRows
                            }
                        ]
                    };

                    activeQualitySessions.set(dlDateNow, { movie, downloads: movie.downloads });

                    await sendInteractiveMessage(Gifted, from, {
                        text: `✨ *Please select quality*`,
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

            // 2. Quality Selection & Direct DL Listener (Using only provided API)
            const qualityListener = async (update2) => {
                try {
                    const msg2 = update2.messages[0];
                    if (!msg2.message) return;

                    const selectedQualityId = extractButtonId(msg2.message);
                    if (!selectedQualityId || !selectedQualityId.startsWith("cine_link_")) return;
                    if (msg2.key?.remoteJid !== from) return;

                    const parts = selectedQualityId.split("_");
                    const dlTimestamp = parseInt(parts[4]);

                    if (!activeQualitySessions.has(dlTimestamp)) return;
                    const session = activeQualitySessions.get(dlTimestamp);

                    const qIndex = parseInt(parts[3]);
                    const finalQuality = session.downloads[qIndex];

                    await react("⬇️");

                    // Using the single requested API endpoint
                    const dlUrl = `https://chethmina-kavishan-cinesubz-api-v1.vercel.app/api/dl?url=${encodeURIComponent(finalQuality.download_link)}`;
                    const dlResponse = await axios.get(dlUrl);

                    if (!dlResponse.data.status || !dlResponse.data.direct_link) {
                        await react("❌");
                        return reply("❌ *Failed to extract direct download link from API response.* ⚠️", msg2);
                    }

                    const directLink = dlResponse.data.direct_link;

                    await react("⬆️");
                    const thumb = await createThumbnail(session.movie.poster);

                    await Gifted.sendMessage(from, {
                        document: { url: directLink },
                        mimetype: "video/mp4",
                        fileName: `${dlResponse.data.title || session.movie.title} [${dlResponse.data.quality || finalQuality.quality}].mp4`,
                        jpegThumbnail: thumb,
                        caption: `🎬 \`${session.movie.title}\`\n\n🎞️ \`Resolution:\` *${dlResponse.data.quality || finalQuality.quality}*\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
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
            reply(`❌ *System Error:* \`${err.message || err}\``);
        }
    }
);
