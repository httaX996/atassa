const { gmd } = require("../gift");
const axios = require('axios');
const sharp = require('sharp');
const config = require('../config');
const {
    generateWAMessageContent,
    generateWAMessageFromContent,
} = require("gifted-baileys");
const { sendInteractiveMessage } = require("gifted-btns");

// Custom Quoted Context (ck object).
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

// නිවැරදි කරන ලද Bytes ප්‍රමාණය පරිවර්තනය කිරීමේ ශ්‍රිතය
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']; 
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

gmd(
    {
        pattern: "mvbox",
        category: "movie",
        aliases: ["moviebox", "mbox"],
        description: "Search movies from MovieBox with Carousel and Buttons",
    },
    async (from, Gifted, conText) => {
        const { q, reply, react, botFooter } = conText;

        try {
            if (!q) {
                await react("❌");
                return reply("🎬 Please provide a movie name.\n\nExample:\n.mvbox avatar");
            }

            await react("🎬");

            const dateNow = Date.now();
            const searchUrl = `https://movie-stream-api-nine.vercel.app/api/search?q=${encodeURIComponent(q)}`;
            
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            // API එකෙන් එන results Array එක හරියටම ලබා ගැනීම
            const moviesList = response.data?.results || [];

            if (!moviesList || !moviesList.length) {
                await react("❌");
                return reply("❌ No movies found.");
            }

            // 1. සර්ච් රිසල්ට් වලින් මුල් කාඩ් 10 සකස් කිරීම
            const moviesSlice = moviesList.slice(0, 10);
            const cards = await Promise.all(
                moviesSlice.map(async (movie, index) => {
                    const mediaContent = await generateWAMessageContent(
                        { image: { url: movie.poster || config.IMG_URL } },
                        { upload: Gifted.waUploadToServer }
                    );

                    return {
                        header: {
                            title: `🎬 *${movie.title}*`,
                            hasMediaAttachment: true,
                            imageMessage: mediaContent.imageMessage,
                        },
                        body: {
                            text: `📅 Year: ${movie.year || "N/A"}\n⭐ Rating: ${movie.rating || "N/A"}\n🎭 Type: ${movie.type || "unknown"}`,
                        },
                        footer: { text: `> ${botFooter}` },
                        nativeFlowMessage: {
                            buttons: [
                                {
                                    name: "quick_reply",
                                    buttonParamsJson: JSON.stringify({
                                        display_text: "📥 DOWNLOAD",
                                        id: `mv_dl_${index}_${dateNow}`
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
                                body: { text: `🔍 𝗖𝗞 𝗠𝗢𝗩𝗜𝗘𝗕𝗢𝗫 𝗦𝗘𝗔𝗥𝗖𝗛 \n\nResults for: *${q}*` },
                                footer: { text: `👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*` },
                                carouselMessage: { cards },
                            },
                        },
                    },
                },
                { quoted: ck }
            );

            await Gifted.relayMessage(from, carouselMessage.message, { messageId: carouselMessage.key.id });
            await react("✅");

            // 2. DOWNLOAD බටන් ක්ලික් එක හැඬ්ල් කරන ලිස්නර් එක
            const movieSelectionListener = async (update) => {
                try {
                    const msg = update.messages[0];
                    if (!msg.message) return;

                    const selectedButtonId = extractButtonId(msg.message);
                    if (!selectedButtonId || !selectedButtonId.includes(`_${dateNow}`) || !selectedButtonId.startsWith("mv_dl_")) return;

                    if (msg.key?.remoteJid !== from) return;

                    // Memory Leak වැළැක්වීමට මැච් වූ වහාම ලිස්නර් එක අයින් කිරීම
                    Gifted.ev.off("messages.upsert", movieSelectionListener);

                    const movieIndex = parseInt(selectedButtonId.split("_")[2]);
                    const selectedMovie = moviesSlice[movieIndex];

                    await react("⏳");

                    // Movie Detail API එකෙන් විස්තර ලබාගැනීම (Slug එක ඇසුරින්)
                    const detailUrl = `https://movie-stream-api-nine.vercel.app/api/detail/${encodeURIComponent(selectedMovie.slug)}`;
                    const detailResponse = await axios.get(detailUrl);

                    if (!detailResponse.data || !detailResponse.data.success) {
                        await react("❌");
                        return reply("❌ Failed to fetch movie details.", msg);
                    }

                    const movieDetails = detailResponse.data;

                    // Details Caption එක සෑදීම
                    let caption = `🎬 \`${movieDetails.title}\`\n\n`;
                    caption += `📝 \`STORY:\` _${movieDetails.description || "No description available."}_\n\n`;
                    caption += `📅 \`YEAR:\` *${movieDetails.year || "N/A"}*\n`;
                    caption += `⭐ \`RATING:\` *${movieDetails.rating || "N/A"}*\n`;
                    caption += `🌍 \`COUNTRY:\` *${movieDetails.country || "N/A"}*\n`;
                    caption += `🎭 \`GENRES:\` _${movieDetails.genres?.join(', ') || "N/A"}_\n`;
                    caption += `👥 \`CAST:\` ${movieDetails.cast?.slice(0, 4).map(c => `*• ${c.name} (${c.character})*`).join('\n') || "N/A"}\n\n`;
                    caption += `> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`;

                    await Gifted.sendMessage(from, {
                        image: { url: movieDetails.poster || selectedMovie.poster },
                        caption: caption
                    }, { quoted: ck });

                    // Stream API එකෙන් Download Quality ලබාගැනීම (ID එක ඇසුරින්)
                    const streamUrl = `https://api-moviebox.vercel.app/api/stream/${movieDetails.id}`;
                    const streamResponse = await axios.get(streamUrl);

                    if (!streamResponse.data || !streamResponse.data.list || !streamResponse.data.list.length) {
                        await react("❌");
                        return reply("❌ No download links found for this movie.", msg);
                    }

                    const downloadList = streamResponse.data.list;
                    const dlDateNow = Date.now();

                    // 3. Quality Interactive List බටන් සකස් කිරීම (TV Series විස්තර සහිතව)
                    const buttonRows = downloadList.map((dl, i) => {
                        const formattedSize = formatBytes(dl.size);
                        
                        // Season සහ Episode අගයන් බිංදුවට වඩා වැඩි නම් (Series එකක් නම්) බටන් එකේ පෙන්වීමට සකස් කිරීම[span_0](start_span)[span_0](end_span)
                        const isRowSeries = dl.se > 0 || dl.ep > 0;
                        const rowSeriesInfo = isRowSeries ? `[S${String(dl.se).padStart(2, '0')}E${String(dl.ep).padStart(2, '0')}] ` : '';

                        return {
                            header: `Quality: ${dl.resolution}p`,
                            title: `${rowSeriesInfo}Download ${dl.resolution}p`,
                            description: `Size: ${formattedSize} | Codec: ${dl.codecName || "N/A"}`,
                            id: `mv_link_${movieDetails.id}_${i}_${dlDateNow}`
                        };
                    });

                    const buttonParams = {
                        title: '🟢 Select Video Quality',
                        sections: [
                            {
                                title: '📥 Available MovieBox Links',
                                rows: buttonRows
                            }
                        ]
                    };

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

                    // 4. අවසාන Quality බටන් එක ක්ලික් කල පසු Document එකක් ලෙස යැවීම
                    const qualityListener = async (update2) => {
                        try {
                            const msg2 = update2.messages[0];
                            if (!msg2.message) return;

                            const selectedQualityId = extractButtonId(msg2.message);
                            if (!selectedQualityId || !selectedQualityId.includes(`_${dlDateNow}`) || !selectedQualityId.startsWith("mv_link_")) return;

                            if (msg2.key?.remoteJid !== from) return;

                            // ලිස්නර් එක ඉවත් කිරීම
                            Gifted.ev.off("messages.upsert", qualityListener);

                            const parts = selectedQualityId.split("_");
                            const qIndex = parseInt(parts[3]);
                            const finalQuality = downloadList[qIndex];

                            await react("📥");

                            if (!finalQuality.resourceLink) {
                                await react("❌");
                                return reply("❌ Direct download link not found.", msg2);
                            }

                            await react("📤");
                            const thumb = await createThumbnail(movieDetails.poster || selectedMovie.poster);
                            const finalSize = formatBytes(finalQuality.size);

                            // Season සහ Episode අගයන් බිංදුවට වඩා වැඩි නම් විස්තර නමට එකතු කිරීම[span_1](start_span)[span_1](end_span)
                            const isSeries = finalQuality.se > 0 || finalQuality.ep > 0;
                            const seriesInfo = isSeries ? `S${String(finalQuality.se).padStart(2, '0')}E${String(finalQuality.ep).padStart(2, '0')} ` : '';
                            const customFileName = `${movieDetails.title} ${seriesInfo}[${finalQuality.resolution}p].mp4`;

                            // Document Message (video/mp4)
                            await Gifted.sendMessage(from, {
                                document: { url: finalQuality.resourceLink },
                                mimetype: "video/mp4",
                                fileName: customFileName,
                                jpegThumbnail: thumb,
                                caption: `🎬 \`${movieDetails.title}\`\n` : ''}🎞️ \`Quality :\` *${finalQuality.resolution}p*\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
                            }, { quoted: ck });

                            await react("✅");

                        } catch (err) {
                            console.error(err);
                            await react("❌");
                            reply("❌ Error while downloading document.", update2.messages[0]);
                        }
                    };

                    Gifted.ev.on("messages.upsert", qualityListener);
                    setTimeout(() => Gifted.ev.off("messages.upsert", qualityListener), 800000);

                } catch (err) {
                    console.error(err);
                    await react("❌");
                    reply("❌ Error while processing movie selection.");
                }
            };

            Gifted.ev.on("messages.upsert", movieSelectionListener);
            setTimeout(() => Gifted.ev.off("messages.upsert", movieSelectionListener), 300000);

        } catch (err) {
            console.error(err);
            await react("❌");
            reply(`❌ Error: ${err.message || err}`);
        }
    }
);

