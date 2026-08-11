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
        pattern: "cineck",
        category: "movie",
        aliases: ["cinesubz", "cine"],
        description: "Search movies from CineSubz with Buttons",
    },
    async (from, Gifted, conText) => {
        const { q, reply, react, botFooter } = conText;

        try {
            if (!q) {
                await react("❌");
                return reply("🎬 Please provide a movie name.\n\nExample:\n.cineck deadpool");
            }

            await react("🎬");

            const dateNow = Date.now();
            // 1. අලුත් Search API එක
            const searchUrl = `https://chethmina-kavishan-cinesubz-api-v1.vercel.app/api/search?q=${encodeURIComponent(q)}`;
            const { data } = await axios.get(searchUrl);

            if (!data.success || !data.results || !data.results.length) {
                await react("❌");
                return reply("❌ No movies found.");
            }

            const moviesSlice = data.results.slice(0, 50);
            
            // Carousel වෙනුවට Interactive List එකක් සකස් කිරීම
            const buttonRows = moviesSlice.map((movie, index) => ({
                header: `🎬 Result ${index + 1}`,
                title: movie.title.substring(0, 50), // Title එක දිග වැඩි වුණොත් කපා හැරීමට
                description: `Click to view options`,
                id: `cine_dl_${index}_${dateNow}`
            }));

            const buttonParams = {
                title: '🔍 Select a Movie',
                sections: [
                    {
                        title: '🎬 Available Movies',
                        rows: buttonRows
                    }
                ]
            };

            await sendInteractiveMessage(Gifted, from, {
                text: `🔍 *𝗖𝗞 𝗖𝗜𝗡𝗘𝗦𝗨𝗕𝗭 𝗦𝗘𝗔𝗥𝗖𝗛* \n\nResults for: *${q}*`,
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

            // 2. DOWNLOAD බටන් ලිස්නර් එක
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

                    // අලුත් Movie Info API එක
                    const infoUrl = `https://chethmina-kavishan-cinesubz-api-v1.vercel.app/api/minfo?url=${encodeURIComponent(selectedMovie.link)}`;
                    const infoResponse = await axios.get(infoUrl);

                    if (!infoResponse.data.success) {
                        await react("❌");
                        return reply("❌ Failed to fetch movie details.", msg);
                    }

                    const movie = infoResponse.data.data;

                    let caption = `🎬 \`${movie.title}\`\n\n`;
                    caption += `📅 \`YEAR:\` *${movie.year || "N/A"}*\n`;
                    caption += `⭐ \`IMDB:\` *${movie.imdb || "N/A"}*\n`;
                    caption += `⏳ \`TIME:\` *${movie.time || "N/A"}*\n`;
                    caption += `🌍 \`COUNTRY:\` *${movie.country || "N/A"}*\n`;
                    caption += `🎭 \`CAST:\` ${movie.cast?.slice(1, 5).map(c => `*• ${c}*`).join('\n') || "N/A"}\n\n`;
                    caption += `📝 \`DESC:\` _${movie.description?.slice(0, 150)}..._\n\n`;
                    caption += `> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`;

                    await Gifted.sendMessage(from, {
                        image: { url: movie.poster || selectedMovie.image },
                        caption: caption
                    }, { quoted: ck });

                    const dlDateNow = Date.now();

                    // 3. Quality Interactive List එක සකස් කිරීම
                    const qualityButtonRows = movie.downloads.map((dl, i) => ({
                        header: `${dl.quality}`,
                        title: `Download ${dl.quality}`,
                        description: `Size: ${dl.size}`,
                        id: `cine_link_${movieIndex}_${i}_${dlDateNow}`
                    }));

                    const qualityButtonParams = {
                        title: '🟢 Select Video Quality',
                        sections: [
                            {
                                title: '📥 Available Download Links',
                                rows: qualityButtonRows
                            }
                        ]
                    };

                    activeQualitySessions.set(dlDateNow, { movie, downloads: movie.downloads });

                    await sendInteractiveMessage(Gifted, from, {
                        text: '🔽 *Please select your preferred movie quality below:*',
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

            // 4. Quality බටන් එක ක්ලික් කළ පසු ඩොකියුමන්ට් එකක් ලෙස යැවීමේ ලිස්නර් එක
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

                    const dlUrl = `https://chethmina-kavishan-cinesubz-api-v1.vercel.app/api/dl?url=${encodeURIComponent(finalQuality.download_link)}`;
                    const dlResponse = await axios.get(dlUrl);

                    if (!dlResponse.data.success || !dlResponse.data.data?.download_url) {
                        await react("❌");
                        return reply("❌ First stage download link not found.", msg2);
                    }

                    const initialDlUrl = dlResponse.data.data.download_url;

                    const finalSadasUrl = `https://apis.sadas.dev/api/v1/movie/cinesubz/dl?q=${encodeURIComponent(initialDlUrl)}&apiKey=aef6578e9d6927ee27b0a62e8f284e75`;
                    const sadasResponse = await axios.get(finalSadasUrl);

                    if (!sadasResponse.data.status || !sadasResponse.data.data?.links) {
                        await react("❌");
                        return reply("❌ Direct download link could not be generated.", msg2);
                    }

                    const links = sadasResponse.data.data.links || [];
                    const directLink = links.find(link => !link.includes("t.me") && !link.includes("telegram"));

                    if (!directLink) {
                        await react("❌");
                        return reply("❌ Direct download link not found (Filtered Telegram out).", msg2);
                    }

                    await react("⬆️");
                    const thumb = await createThumbnail(session.movie.poster);

                    await Gifted.sendMessage(from, {
                        document: { url: directLink },
                        mimetype: "video/mp4",
                        fileName: `${sadasResponse.data.data.title || session.movie.title}.mp4`,
                        jpegThumbnail: thumb,
                        caption: `🎬 \`${session.movie.title}\`\n\n🎞️ \`Quality:\` *${finalQuality.quality}*\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
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

