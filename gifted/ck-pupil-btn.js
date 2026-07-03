const { gmd } = require("../gift"); // Gifted MD ව්‍යුහයට අනුව වෙනස් කරන ලදි
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
        pattern: "pupil",
        category: "movie",
        aliases: ["pupilvideo", "pvideo"],
        description: "Search movies from PupilVideo with Carousel and Buttons",
    },
    async (from, Gifted, conText) => {
        const { q, reply, react, botFooter } = conText;

        try {
            if (!q) {
                await react("❌");
                return reply("🎬 Please provide a movie name.\n\nExample:\n.pupil tentigo");
            }

            await react("🎬");

            const dateNow = Date.now();
            const searchUrl = `https://ck-api-v1.vercel.app/movie/pupil/search?q=${encodeURIComponent(q)}`;
            const { data } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });

            const results = data.result || data.data || [];
            if (!results.length) {
                await react("❌");
                return reply("❌ No movies found.");
            }

            // 1. සර්ච් රිසල්ට් වලින් මුල් කාඩ් 10 සකස් කිරීම (Carousel Style)
            const moviesSlice = results.slice(0, 10);
            const cards = await Promise.all(
                moviesSlice.map(async (movie, index) => {
                    const mediaContent = await generateWAMessageContent(
                        { image: { url: movie.image || config.IMG_URL || "https://i.ibb.co/689v0p7/movie-default.jpg" } },
                        { upload: Gifted.waUploadToServer }
                    );

                    return {
                        header: {
                            title: `🎬 *${movie.title}*`,
                            hasMediaAttachment: true,
                            imageMessage: mediaContent.imageMessage,
                        },
                        body: {
                            text: `🎭 Title: ${movie.title}\n🔗 Source: PupilVideo`,
                        },
                        footer: { text: `> ${botFooter}` },
                        nativeFlowMessage: {
                            buttons: [
                                {
                                    name: "quick_reply",
                                    buttonParamsJson: JSON.stringify({
                                        display_text: "📥 DOWNLOAD",
                                        id: `pupil_dl_${index}_${dateNow}`
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
                                body: { text: `🔍 𝗣𝗨𝗣𝗜𝗟 𝗠𝗢𝗩𝗜𝗘 𝗦𝗘𝗔𝗥𝗖𝗛 \n\nResults for: *${q}*` },
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
                    if (!selectedButtonId || !selectedButtonId.includes(`_${dateNow}`) || !selectedButtonId.startsWith("pupil_dl_")) return;

                    if (msg.key?.remoteJid !== from) return;

                    const movieIndex = parseInt(selectedButtonId.split("_")[2]);
                    const selectedMovie = moviesSlice[movieIndex];

                    await react("⏳");

                    // Movie Info ලබාගැනීම
                    const infoUrl = `https://ck-api-v1.vercel.app/movie/pupil/info?url=${encodeURIComponent(selectedMovie.link)}`;
                    const infoResponse = await axios.get(infoUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                    
                    const apiResponse = infoResponse.data;
                    const movieInfo = apiResponse.data || apiResponse.result || apiResponse;

                    if (!movieInfo) {
                        await react("❌");
                        return reply("❌ Failed to fetch movie details.", msg);
                    }

                    const directLinks = movieInfo.direct_links || [];
                    const telegramLinks = movieInfo.telegram_links || [];

                    const mappedDirect = directLinks.map((dl, i) => ({ ...dl, type: 'Direct', subIndex: i }));
                    const mappedTelegram = telegramLinks.map((tl, i) => ({ ...tl, type: 'Telegram', subIndex: i }));

                    let caption = `🎬 \`${movieInfo.title || selectedMovie.title}\`\n\n`;
                    caption += `> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`;

                    const moviePoster = movieInfo.image || selectedMovie.image || config.IMG_URL;

                    // Image සහ Details යැවීම
                    await Gifted.sendMessage(from, {
                        image: { url: moviePoster },
                        caption: caption
                    }, { quoted: ck });

                    const dlDateNow = Date.now();
                    const sections = [];

                    // Direct Links Section
                    if (directLinks.length > 0) {
                        sections.push({
                            title: '🌐 Direct Download Links',
                            rows: mappedDirect.map((dl) => ({
                                header: `🟢 ${dl.quality}`,
                                title: `Direct Download - ${dl.quality}`,
                                description: `Size: ${dl.size || "N/A"}`,
                                id: `pupil_link_Direct_${movieIndex}_${dl.subIndex}_${dlDateNow}`
                            }))
                        });
                    }

                    // Telegram Links Section
                    if (telegramLinks.length > 0) {
                        sections.push({
                            title: '🔹 Telegram Download Links',
                            rows: mappedTelegram.map((tl) => ({
                                header: `🔵 ${tl.quality}`,
                                title: `Telegram Download - ${tl.quality}`,
                                description: `Size: ${tl.size || "N/A"}`,
                                id: `pupil_link_Telegram_${movieIndex}_${tl.subIndex}_${dlDateNow}`
                            }))
                        });
                    }

                    if (sections.length === 0) {
                        await react("❌");
                        return reply("❌ No download links found for this movie.", msg);
                    }

                    const buttonParams = {
                        title: '🟢 Select Video Link Type & Quality',
                        sections: sections
                    };

                    // 3. Quality Interactive List බටන් එක යැවීම
                    await sendInteractiveMessage(Gifted, from, {
                        text: '🔽 *Please select your preferred download method and quality below:*',
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
                            if (!selectedQualityId || !selectedQualityId.includes(`_${dlDateNow}`) || !selectedQualityId.startsWith("pupil_link_")) return;

                            if (msg2.key?.remoteJid !== from) return;

                            const parts = selectedQualityId.split("_");
                            const linkType = parts[2]; // Direct or Telegram
                            const qIndex = parseInt(parts[4]);

                            let selectedLinkObj = null;
                            if (linkType === 'Direct') {
                                selectedLinkObj = directLinks[qIndex];
                            } else {
                                selectedLinkObj = telegramLinks[qIndex];
                            }

                            if (!selectedLinkObj) return reply("❌ Link details not found.", msg2);

                            let rawLink = selectedLinkObj.link || selectedLinkObj.direct_link || selectedLinkObj.url;
                            if (!rawLink) return reply("❌ Download link URL not found.", msg2);

                            await react("⬇️");

                            let finalDownloadLink = rawLink;

                            if (linkType === 'Telegram') {
                                finalDownloadLink = `https://chetha06-ck-tg-dl.hf.space/download?link=${encodeURIComponent(rawLink)}`;
                            } else if (linkType === 'Direct' && !finalDownloadLink.includes('&download=true')) {
                                finalDownloadLink = `${finalDownloadLink}&download=true`;
                            }

                            await react("⬆️");
                            const thumb = await createThumbnail(moviePoster);
                            const cleanTitle = (movieInfo.title || "Movie").replace(/[\\/:*?"<>|]/g, "");
                            const fileName = `${cleanTitle} [${selectedLinkObj.quality}].mp4`;

                            // Document Message (video/mp4)
                            await Gifted.sendMessage(from, {
                                document: { url: finalDownloadLink },
                                mimetype: "video/mp4",
                                fileName: fileName,
                                jpegThumbnail: thumb,
                                caption: `🎬 \`${movieInfo.title || selectedMovie.title}\`\n\n🎞️ \`Quality:\` *${selectedLinkObj.quality}*\n📦 \`Type:\` *${linkType}*\n📦 \`Size:\` *${selectedLinkObj.size || "N/A"}*\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
                            }, { quoted: ck });

                            await react("✅");
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
