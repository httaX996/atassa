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

// Global Map එක හරහා Active Sessions පාලනය කිරීම
const activeQualitySessions = new Map();

gmd(
    {
        pattern: "am",
        category: "movie",
        aliases: ["animost", "animostlk"],
        description: "Search movies from AnimostLK with Carousel and Buttons",
    },
    async (from, Gifted, conText) => {
        const { q, reply, react, botFooter } = conText;

        try {
            if (!q) {
                await react("❌");
                return reply("🎬 Please provide a movie name.\n\nExample:\n.am monster");
            }

            await react("🎬");

            const dateNow = Date.now();
            // 1. Search API Fetching
            const searchUrl = `https://ck-animostlk-api-abcxyz.vercel.app/api/search?q=${encodeURIComponent(q)}`;
            const { data } = await axios.get(searchUrl);

            if (!data.status || !data.results || !data.results.length) {
                await react("❌");
                return reply("❌ No movies found on AnimostLK.");
            }

            const moviesSlice = data.results.slice(0, 10);
            
            // Carousel Cards සකස් කිරීම
            const cards = await Promise.all(
                moviesSlice.map(async (movie, index) => {
                    const mediaContent = await generateWAMessageContent(
                        { image: { url: movie.image_link || config.IMG_URL } },
                        { upload: Gifted.waUploadToServer }
                    );

                    return {
                        header: {
                            title: `🎬 *${movie.title}*`,
                            hasMediaAttachment: true,
                            imageMessage: mediaContent.imageMessage,
                        },
                        body: {
                            text: `✨ Click the button below to fetch details & options.`,
                        },
                        footer: { text: `> ${botFooter}` },
                        nativeFlowMessage: {
                            buttons: [
                                {
                                    name: "quick_reply",
                                    buttonParamsJson: JSON.stringify({
                                        display_text: "📥 DOWNLOAD",
                                        id: `am_dl_${index}_${dateNow}`
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
                                body: { text: `🔍 𝗔𝗡𝗜𝗠𝗢𝗦𝗧 𝗦𝗘𝗔𝗥𝗖𝗛 \n\nResults for: *${q}*` },
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

            // 2. DOWNLOAD Button Click Listener
            const movieSelectionListener = async (update) => {
                try {
                    const msg = update.messages[0];
                    if (!msg.message) return;

                    const selectedButtonId = extractButtonId(msg.message);
                    if (!selectedButtonId || !selectedButtonId.includes(`_${dateNow}`) || !selectedButtonId.startsWith("am_dl_")) return;
                    if (msg.key?.remoteJid !== from) return;

                    const movieIndex = parseInt(selectedButtonId.split("_")[2]);
                    const selectedMovie = moviesSlice[movieIndex];

                    await react("⏳");

                    // Movie Info Fetching
                    const infoUrl = `https://ck-animostlk-api-abcxyz.vercel.app/api/info?url=${encodeURIComponent(selectedMovie.link)}`;
                    const infoResponse = await axios.get(infoUrl);

                    if (!infoResponse.data.status) {
                        await react("❌");
                        return reply("❌ Failed to fetch movie details from AnimostLK.", msg);
                    }

                    const movie = infoResponse.data;
                    const details = movie.details || {};

                    // Caption එක සැකසීම
                    let caption = `🎬 \`${movie.title}\`\n\n`;
                    caption += `📅 \`RELEASE DATE:\` *${details.release_date || "N/A"}*\n`;
                    caption += `🎬 \`DIRECTOR:\` *${details.director || "N/A"}*\n`;
                    caption += `🏢 \`DISTRIBUTED BY:\` *${details.distributed_by || "N/A"}*\n`;
                    caption += `💰 \`BOX OFFICE:\` *${details.box_office || "N/A"}*\n\n`;
                    caption += `> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`;

                    // Poster එක සහ විස්තර යැවීම
                    await Gifted.sendMessage(from, {
                        image: { url: movie.image_link || selectedMovie.image_link },
                        caption: caption
                    }, { quoted: ck });

                    const dlDateNow = Date.now();

                    // 3. Quality Selection Interactive List සකස් කිරීම
                    const buttonRows = (movie.download_links || []).map((dl, i) => ({
                        header: `${dl.quality}`,
                        title: `Download ${dl.quality}`,
                        description: `Size: ${dl.size}`,
                        id: `am_link_${movieIndex}_${i}_${dlDateNow}`
                    }));

                    if (buttonRows.length === 0) {
                        await react("❌");
                        return reply("❌ No download links available for this movie.", msg);
                    }

                    const buttonParams = {
                        title: '🟢 Select Video Quality',
                        sections: [
                            {
                                title: '📥 Available Download Links',
                                rows: buttonRows
                            }
                        ]
                    };

                    // Session Data Save කිරීම
                    activeQualitySessions.set(dlDateNow, { movie, downloads: movie.download_links });

                    await sendInteractiveMessage(Gifted, from, {
                        text: '🔽 *Please select your preferred video quality below:*',
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

            // 4. Document එකක් ලෙස Video එක යැවීමේ Listener
            const qualityListener = async (update2) => {
                try {
                    const msg2 = update2.messages[0];
                    if (!msg2.message) return;

                    const selectedQualityId = extractButtonId(msg2.message);
                    if (!selectedQualityId || !selectedQualityId.startsWith("am_link_")) return;
                    if (msg2.key?.remoteJid !== from) return;

                    const parts = selectedQualityId.split("_");
                    const dlTimestamp = parseInt(parts[4]);

                    if (!activeQualitySessions.has(dlTimestamp)) return;
                    const session = activeQualitySessions.get(dlTimestamp);

                    const qIndex = parseInt(parts[3]);
                    const finalQuality = session.downloads[qIndex];

                    await react("⬇️");

                    // Direct worker/cloud link එක ලබා ගැනීම
                    const directLink = finalQuality.link;

                    if (!directLink) {
                        await react("❌");
                        return reply("❌ Direct download link not found.", msg2);
                    }

                    await react("⬆️");
                    const thumb = await createThumbnail(session.movie.image_link);

                    // Video File එක Document එකක් ලෙස යැවීම
                    await Gifted.sendMessage(from, {
                        document: { url: directLink },
                        mimetype: "video/mp4",
                        fileName: `${session.movie.title}.mp4`,
                        jpegThumbnail: thumb,
                        caption: `🎬 \`${session.movie.title}\`\n\n🎞️ \`Quality:\` *${finalQuality.quality}*\n📦 \`Size:\` *${finalQuality.size}*\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
                    }, { quoted: ck });

                    await react("✅");

                } catch (err) {
                    console.error(err);
                    await react("❌");
                }
            };

            // Event Listeners Register කිරීම
            Gifted.ev.on("messages.upsert", movieSelectionListener);
            Gifted.ev.on("messages.upsert", qualityListener);

            // ⏱️ විනාඩි 5කට (මිලිතත්පර 300,000) පසු Listeners & Active Sessions Clear කර දැමීම
            setTimeout(() => {
                Gifted.ev.off("messages.upsert", movieSelectionListener);
                Gifted.ev.off("messages.upsert", qualityListener);
                activeQualitySessions.clear();
            }, 300000);

        } catch (err) {
            console.error(err);
            await react("❌");
            reply(`❌ Error: ${err.message || err}`);
        }
    }
);

