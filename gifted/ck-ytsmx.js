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
            displayName: "〴ᴄʜᴇᴛʜᴍɪɴᱟ ×͜×",
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
        pattern: "ytsmx",
        category: "movie",
        aliases: ["yts", "ytsmovie"],
        description: "Search movies from YTS.MX with Interactive Lists & Magnets",
    },
    async (from, Gifted, conText) => {
        const { q, reply, react, botFooter } = conText;

        try {
            if (!q) {
                await react("❌");
                return reply("🍿 Please provide a movie name to search on YTS.\n\nExample:\n.ytsmx avatar");
            }

            await react("🍿");

            const dateNow = Date.now();
            // 1. YTS Search API
            const searchUrl = `https://ck-yts-mx-api-123abc456def.vercel.app/api/search?q=${encodeURIComponent(q)}`;
            const { data } = await axios.get(searchUrl);

            if (!data.status || !data.data || !data.data.length) {
                await react("❌");
                return reply("❌ No movies found on YTS.");
            }

            const moviesSlice = data.data.slice(0, 50);
            
            // Interactive List එක සකස් කිරීම
            const buttonRows = moviesSlice.map((movie, index) => ({
                header: `🎬 Result ${index + 1}`,
                title: movie.title.substring(0, 50),
                description: `📅 Year: ${movie.year} | ⭐ Rating: ${movie.rating}`,
                id: `yts_dl_${index}_${dateNow}`
            }));

            const buttonParams = {
                title: '🔍 Select YTS Movie',
                sections: [
                    {
                        title: '🍿 Available Movies',
                        rows: buttonRows
                    }
                ]
            };

            await sendInteractiveMessage(Gifted, from, {
                text: `🍿 *𝗖𝗞 𝗬𝗧𝗦.𝗠𝗫 𝗦𝗘𝗔𝗥𝗖𝗛* \n\nResults for: *${q}*`,
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

            // 2. Movie Selection Listener
            const movieSelectionListener = async (update) => {
                try {
                    const msg = update.messages[0];
                    if (!msg.message) return;

                    const selectedButtonId = extractButtonId(msg.message);
                    if (!selectedButtonId || !selectedButtonId.includes(`_${dateNow}`) || !selectedButtonId.startsWith("yts_dl_")) return;
                    if (msg.key?.remoteJid !== from) return;

                    const movieIndex = parseInt(selectedButtonId.split("_")[2]);
                    const selectedMovie = moviesSlice[movieIndex];

                    await react("⏳");

                    // YTS Info API
                    const infoUrl = `https://ck-yts-mx-api-123abc456def.vercel.app/api/info?url=${encodeURIComponent(selectedMovie.url)}`;
                    const infoResponse = await axios.get(infoUrl);

                    if (!infoResponse.data.status) {
                        await react("❌");
                        return reply("❌ Failed to fetch movie details from YTS.", msg);
                    }

                    const movie = infoResponse.data.result;

                    let caption = `🎬 \`${movie.title}\`\n\n`;
                    caption += `📅 \`YEAR:\` *${movie.year || "N/A"}*\n`;
                    caption += `🎭 \`GENRE:\` *${movie.genre || "N/A"}*\n`;
                    caption += `⭐ \`IMDB:\` *${movie.imdb || "N/A"}*\n`;
                    caption += `📝 \`PLOT:\` _${movie.plot?.slice(0, 180)}..._\n\n`;
                    caption += `> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᱟ ᴋᴀᴠɪꜱʜᴀɴ*`;

                    await Gifted.sendMessage(from, {
                        image: { url: movie.image },
                        caption: caption
                    }, { quoted: ck });

                    const dlDateNow = Date.now();

                    // 3. Quality Selection List (Quality, Type, Size සමඟ)
                    const qualityButtonRows = movie.downloads.map((dl, i) => ({
                        header: `🎥 ${dl.quality} - ${dl.type}`,
                        title: `${dl.quality} (${dl.type})`,
                        description: `💾 Size: ${dl.size}`,
                        id: `yts_link_${movieIndex}_${i}_${dlDateNow}`
                    }));

                    const qualityButtonParams = {
                        title: '🟢 Select Video Quality',
                        sections: [
                            {
                                title: '📥 Available Downloads',
                                rows: qualityButtonRows
                            }
                        ]
                    };

                    activeQualitySessions.set(dlDateNow, { movie, downloads: movie.downloads });

                    await sendInteractiveMessage(Gifted, from, {
                        text: '🔽 *Please select your preferred movie quality & format below:*',
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

            // 4. Quality & Magnet Download Listener (Fixed with timeout & wait message)
            const qualityListener = async (update2) => {
                try {
                    const msg2 = update2.messages[0];
                    if (!msg2.message) return;

                    const selectedQualityId = extractButtonId(msg2.message);
                    if (!selectedQualityId || !selectedQualityId.startsWith("yts_link_")) return;
                    if (msg2.key?.remoteJid !== from) return;

                    const parts = selectedQualityId.split("_");
                    const dlTimestamp = parseInt(parts[4]);

                    if (!activeQualitySessions.has(dlTimestamp)) return;
                    const session = activeQualitySessions.get(dlTimestamp);

                    const qIndex = parseInt(parts[3]);
                    const finalQuality = session.downloads[qIndex];

                    await react("⏳");
                    await reply("⏳ *Generating direct link... This may take a few seconds, please wait!*");

                    // Magnet Convert API (Timeout වැඩි කර ඇත - තත්පර 120 / 120000ms)
                    const magnetApiUrl = `https://ck-pahe-inc-api-123xyz.vercel.app/api/magnet?url=${encodeURIComponent(finalQuality.url)}`;
                    
                    let magnetResponse;
                    try {
                        magnetResponse = await axios.get(magnetApiUrl, { timeout: 120000 });
                    } catch (apiErr) {
                        await react("❌");
                        return reply("❌ The server took too long to generate the link or encountered an error. Please try again later.", msg2);
                    }

                    if (!magnetResponse.data.success || !magnetResponse.data.download_url) {
                        await react("❌");
                        return reply("❌ Direct download link could not be generated from magnet.", msg2);
                    }

                    const directLink = magnetResponse.data.download_url;

                    await react("⬆️");
                    const thumb = await createThumbnail(session.movie.image);

                    // File caption with quality & type
                    const fileCaption = `🎬 \`${session.movie.title}\`\n\n🎞️ \`Quality:\` *${finalQuality.quality} - ${finalQuality.type}*\n💾 \`Size:\` *${finalQuality.size}*\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᱟ ᴋᴀᴠɪꜱʜᴀɴ*`;

                    await Gifted.sendMessage(from, {
                        document: { url: directLink },
                        mimetype: "video/mp4",
                        fileName: `${magnetResponse.data.title || session.movie.title + ' ' + finalQuality.quality}.mp4`,
                        jpegThumbnail: thumb,
                        caption: fileCaption
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

