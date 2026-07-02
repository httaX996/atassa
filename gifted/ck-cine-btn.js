const { gmd } = require("../gift"); // Gifted MD structure එකට අනුව වෙනස් කරන ලදි
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
       // react: "🎬",
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
            const searchUrl = `https://apis.sadas.dev/api/v1/movie/cinesubz/search?q=${encodeURIComponent(q)}&apiKey=ea4d57a2a2db72e0bb3ba58f56b1ff9b`;
            const { data } = await axios.get(searchUrl);

            if (!data.status || !data.data || !data.data.length) {
                await react("❌");
                return reply("❌ No movies found.");
            }

            // 1. සර්ච් රිසල්ට් වලින් මුල් කාඩ් 10 සකස් කිරීම (yts Carousel Style)
            const moviesSlice = data.data.slice(0, 10);
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
                            text: `⭐ Rating: ${movie.rating || "N/A"}\n💿 Quality: ${movie.quality || "N/A"}\n🎭 Type: ${movie.type || "movies"}`,
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
                    if (!selectedButtonId || !selectedButtonId.includes(`_${dateNow}`) || !selectedButtonId.startsWith("cine_dl_")) return;

                    if (msg.key?.remoteJid !== from) return;

                    const movieIndex = parseInt(selectedButtonId.split("_")[2]);
                    const selectedMovie = moviesSlice[movieIndex];

                    await react("⏳");

                    // Movie Info ලබාගැනීම
                    const infoUrl = `https://apis.sadas.dev/api/v1/movie/cinesubz/info?q=${encodeURIComponent(selectedMovie.link)}&apiKey=ea4d57a2a2db72e0bb3ba58f56b1ff9b`;
                    const infoResponse = await axios.get(infoUrl);

                    if (!infoResponse.data.status) {
                        await react("❌");
                        return reply("❌ Failed to fetch movie details.", msg);
                    }

                    const movie = infoResponse.data.data;

                    // Details Caption එක හැදීම
                    let caption = `🎬 \`${movie.title}\`\n\n`;
                    caption += `📅 \`YEAR:\` *${movie.year || "N/A"}*\n`;
                    caption += `⭐ \`RATING:\` *${movie.imdb_rating || "N/A"}*\n`;
                    caption += `💿 \`QUALITY:\` *${movie.quality || "N/A"}*\n`;
                    caption += `🎭 \`CAST:\` ${movie.cast?.slice(0, 5).map(c => `*• ${c.name} (${c.role})*`).join('\n') || "N/A"}\n\n`;
                    caption += `> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`;

                    // Image එක සහ Details යැවීම (fb style)
                    await Gifted.sendMessage(from, {
                        image: { url: movie.poster || selectedMovie.image },
                        caption: caption
                    }, { quoted: ck });

                    const dlDateNow = Date.now();

                    // 3. Quality Interactive List බටන් සකස් කිරීම (ytdl style)
                    const buttonRows = movie.download_links.map((dl, i) => ({
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

                    // 4. අවසාන Quality බටන් එක ක්ලික් කල පසු ඩොකියුමන්ට් එකක් ලෙස යැවීම
                    const qualityListener = async (update2) => {
                        try {
                            const msg2 = update2.messages[0];
                            if (!msg2.message) return;

                            const selectedQualityId = extractButtonId(msg2.message);
                            if (!selectedQualityId || !selectedQualityId.includes(`_${dlDateNow}`) || !selectedQualityId.startsWith("cine_link_")) return;

                            if (msg2.key?.remoteJid !== from) return;

                            const parts = selectedQualityId.split("_");
                            const qIndex = parseInt(parts[3]);
                            const finalQuality = movie.download_links[qIndex];

                            await react("⬇️");

                            const downloadUrl = `https://apis.sadas.dev/api/v1/movie/cinesubz/dl?q=${encodeURIComponent(finalQuality.final_link)}&apiKey=ea4d57a2a2db72e0bb3ba58f56b1ff9b`;
                            const downloadResponse = await axios.get(downloadUrl);

                            if (!downloadResponse.data.status) {
                                await react("❌");
                                return reply("❌ Download link not found.", msg2);
                            }

                            const links = downloadResponse.data.data?.links || [];
                            const directLink = links.find(link => !link.includes("t.me") && !link.includes("telegram"));

                            if (!directLink) {
                                await react("❌");
                                return reply("❌ Direct download link not found.", msg2);
                            }

                            await react("⬆️");
                            const thumb = await createThumbnail(movie.poster || selectedMovie.image);

                            // Document Message (video/mp4)
                            await Gifted.sendMessage(from, {
                                document: { url: directLink },
                                mimetype: "video/mp4",
                                fileName: `${movie.title} [${finalQuality.quality}].mp4`,
                                jpegThumbnail: thumb,
                                caption: `🎬 \`${movie.title}\`\n\n🎞️ \`Quality:\` *${finalQuality.quality}*\n📦 \`Size:\` *${finalQuality.size}*\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
                            }, { quoted: ck });

                            await react("✅");
                            
                            // වැඩේ සාර්ථකව අවසන් වූ නිසා ලිස්නර් එක අයින් කිරීම
                            Gifted.ev.off("messages.upsert", qualityListener);

                        } catch (err) {
                            console.error(err);
                            await react("❌");
                            reply("❌ Error while downloading document.", update2.messages[0]);
                        }
                    };

                    Gifted.ev.on("messages.upsert", qualityListener);
                    setTimeout(() => Gifted.ev.off("messages.upsert", qualityListener), 300000);

                } catch (err) {
                    console.error(err);
                    await react("❌");
                    reply("❌ Error while processing selection.");
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
