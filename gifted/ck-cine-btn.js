const { gmd } = require("../gift");
const axios = require('axios');
const sharp = require('sharp');
const config = require('../config');
const {
    generateWAMessageContent,
    generateWAMessageFromContent,
} = require("gifted-baileys");
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
        description: "Search movies from CineSubz with Carousel and Buttons",
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

            const moviesSlice = data.results.slice(0, 10);
            const cards = await Promise.all(
                moviesSlice.map(async (movie, index) => {
                    const mediaContent = await generateWAMessageContent(
                        { image: { url: movie.image || config.IMG_URL } },
                        { upload: Gifted.waUploadToServer }
                    );

                    return {
                        header: {
                            title: `🎬 *${movie.title}*`,
                            hasMediaAttachment: true,
                            imageMessage: mediaContent.imageMessage,
                        },
                        body: {
                            text: `✨ Click the button below to fetch available options.`,
                        },
                        footer: { text: `> ${botFooter}` },
                        nativeFlowMessage: {
                            buttons: [
                                {
                                    name: "quick_reply",
                                    buttonParamsJson: JSON.stringify({
                                        display_text: "📥 DOWNLOAD",
                                        id: `cine_dl_${index}_${dateNow}`
                                    }),
                                }
                            ],
                        },
                    };
                })
            );

            const carouselMessage = generateWAMessageFromContent(
                from,
                {
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                            interactiveMessage: {
                                body: { text: `🔍 𝗖𝗞 𝗖𝗜𝗡𝗘𝗦𝗨𝗕𝗭 𝗦𝗘𝗔𝗥𝗖𝗛 \n\nResults for: *${q}*` },
                                footer: { text: `👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍිනා ᴋᴀᴠɪꜱʜᴀɴ*` },
                                carouselMessage: { cards },
                            },
                        },
                    },
                },
                { quoted: ck }
            );

            await Gifted.relayMessage(from, carouselMessage.message, { messageId: carouselMessage.key.id });
            await react("✅");

            // Global/Session tracking Maps (Nested Listeners වල Memory Leaks මඟ හැරීමට)
            const activeQualitySessions = new Map();

            // 2. DOWNLOAD බටන් ලිස්නර් එක (විනාඩි 10ක් පුරා ක්‍රියාත්මක වන පරිදි 'off' නොකර තබා ගනී)
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
                    const buttonRows = movie.downloads.map((dl, i) => ({
                        header: `${dl.quality}`,
                        title: `Download ${dl.quality}`,
                        description: `Size: ${dl.size}`,
                        id: `cine_link_${movieIndex}_${i}_${dlDateNow}`
                    }));

                    const buttonParams = {
                        title: '🟢 Select Video Quality',
                        sections: [
                            {
                                title: '📥 Available Download Links',
                                rows: buttonRows
                            }
                        ]
                    };

                    // මෙම නිශ්චිත Quality list එකට අදාළ දත්ත Save කර ගැනීම
                    activeQualitySessions.set(dlDateNow, { movie, downloads: movie.downloads });

                    await sendInteractiveMessage(Gifted, from, {
                        text: '🔽 *Please select your preferred movie quality below:*',
                        footer: botFooter,
                        interactiveButtons: [
                            {
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify(buttonParams)
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
                    const dlTimestamp = parseInt(parts[4]); // dlDateNow එක ලබා ගැනීම

                    // Session එක වලංගු එකක්දැයි බැලීම
                    if (!activeQualitySessions.has(dlTimestamp)) return;
                    const session = activeQualitySessions.get(dlTimestamp);

                    const qIndex = parseInt(parts[3]);
                    const finalQuality = session.downloads[qIndex];

                    await react("⬇️");

                    // අලුත් dl API එකට යැවීම
                    const dlUrl = `https://chethmina-kavishan-cinesubz-api-v1.vercel.app/api/dl?url=${encodeURIComponent(finalQuality.download_link)}`;
                    const dlResponse = await axios.get(dlUrl);

                    if (!dlResponse.data.success || !dlResponse.data.data?.download_url) {
                        await react("❌");
                        return reply("❌ First stage download link not found.", msg2);
                    }

                    const initialDlUrl = dlResponse.data.data.download_url;

                    // sadas dev api එකට download_url එක දැමීම
                    const finalSadasUrl = `https://apis.sadas.dev/api/v1/movie/cinesubz/dl?q=${encodeURIComponent(initialDlUrl)}&apiKey=ea4d57a2a2db72e0bb3ba58f56b1ff9b`;
                    const sadasResponse = await axios.get(finalSadasUrl);

                    if (!sadasResponse.data.status || !sadasResponse.data.data?.links) {
                        await react("❌");
                        return reply("❌ Direct download link could not be generated.", msg2);
                    }

                    const links = sadasResponse.data.data.links || [];
                    // ටෙලිග්‍රෑම් නැති ලින්ක් එක පෙරීම
                    const directLink = links.find(link => !link.includes("t.me") && !link.includes("telegram"));

                    if (!directLink) {
                        await react("❌");
                        return reply("❌ Direct download link not found (Filtered Telegram out).", msg2);
                    }

                    await react("⬆️");
                    const thumb = await createThumbnail(session.movie.poster);

                    // Document එකක් ලෙස වීඩියෝව යැවීම
                    await Gifted.sendMessage(from, {
                        document: { url: directLink },
                        mimetype: "video/mp4",
                        fileName: `${sadasResponse.data.data.title || session.movie.title}.mp4`,
                        jpegThumbnail: thumb,
                        caption: `🎬 \`${session.movie.title}\`\n\n🎞️ \`Quality:\` *${finalQuality.quality}*\n📦 \`Size:\` *${finalQuality.size}*\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
                    }, { quoted: ck });

                    await react("✅");

                } catch (err) {
                    console.error(err);
                    await react("❌");
                }
            };

            // Listeners දෙකම Register කිරීම
            Gifted.ev.on("messages.upsert", movieSelectionListener);
            Gifted.ev.on("messages.upsert", qualityListener);

            // විනාඩි 10කට (මිලිතත්පර 600,000) පසු Listeners දෙකම සම්පූර්ණයෙන් Clear කර දැමීම
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

