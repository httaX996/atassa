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
        pattern: "newmv",
        category: "movie",
        aliases: ["stagatv", "mvsearch"],
        description: "Search movies/series from Stagatv with Buttons",
    },
    async (from, Gifted, conText) => {
        const { q, reply, react, botFooter } = conText;

        try {
            if (!q) {
                await react("❌");
                return reply("🎬 Please provide a movie or series name.\n\nExample:\n.newmv The 100");
            }

            await react("🎬");

            const dateNow = Date.now();
            // 1. Search API
            const searchUrl = `https://ck-stagatv-api-alutheka.vercel.app/api/search?q=${encodeURIComponent(q)}`;
            const { data } = await axios.get(searchUrl);

            if (!data.results || !data.results.length) {
                await react("❌");
                return reply("❌ No results found.");
            }

            const moviesSlice = data.results.slice(0, 50);
            
            // Interactive List for Search Results
            const buttonRows = moviesSlice.map((movie, index) => ({
                header: `🎬 Result ${index + 1}`,
                title: movie.title.substring(0, 50),
                description: `Year: ${movie.year || "N/A"}`,
                id: `newmv_sel_${index}_${dateNow}`
            }));

            const buttonParams = {
                title: '🔍 Select a Title',
                sections: [
                    {
                        title: '🎬 Available Results',
                        rows: buttonRows
                    }
                ]
            };

            await sendInteractiveMessage(Gifted, from, {
                text: `🔍 𝗖𝗞 𝗦𝗧𝗔𝗚𝗔𝗧𝗩 𝗦𝗘𝗔𝗥𝗖𝗛\n\nResults for: *${q}*`,
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

            // 2. Selection Listener
            const movieSelectionListener = async (update) => {
                try {
                    const msg = update.messages[0];
                    if (!msg.message) return;

                    const selectedButtonId = extractButtonId(msg.message);
                    if (!selectedButtonId || !selectedButtonId.includes(`_${dateNow}`) || !selectedButtonId.startsWith("newmv_sel_")) return;
                    if (msg.key?.remoteJid !== from) return;

                    const movieIndex = parseInt(selectedButtonId.split("_")[2]);
                    const selectedMovie = moviesSlice[movieIndex];

                    await react("⏳");

                    // Info API
                    const infoUrl = `https://ck-stagatv-api-alutheka.vercel.app/api/info?url=${encodeURIComponent(selectedMovie.url)}`;
                    const infoResponse = await axios.get(infoUrl);

                    const movie = infoResponse.data;

                    let caption = `🎬 \`${movie.title}\`\n\n`;
                    caption += `📅 \`RELEASE:\` *${movie.release || "N/A"}*\n`;
                    caption += `⏱️ \`DURATION:\` *${movie.duration || "N/A"}*\n`;
                    caption += `🌐 \`NETWORK:\` *${movie.network || "N/A"}*\n`;
                    caption += `⭐ \`GENRE:\` _${movie.genre || "N/A"}_\n`;
                    caption += `👥 \`STARS:\` _${movie.stars?.slice(0, 100)}..._\n\n`;
                    caption += `📝 \`DESC:\` _${movie.description?.slice(0, 150)}..._\n\n`;
                    caption += `> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`;

                    await Gifted.sendMessage(from, {
                        image: { url: movie.image || selectedMovie.image },
                        caption: caption
                    }, { quoted: ck });

                    const dlDateNow = Date.now();

                    // 3. Download/Episode Links Interactive List
                    const qualityButtonRows = movie.download_links.map((dl, i) => ({
                        header: `📥 Option ${i + 1}`,
                        title: dl.name.substring(0, 50),
                        description: `Tap to download this file`,
                        id: `newmv_link_${movieIndex}_${i}_${dlDateNow}`
                    }));

                    const qualityButtonParams = {
                        title: '🟢 Select Episode / Quality',
                        sections: [
                            {
                                title: '📥 Available Files',
                                rows: qualityButtonRows
                            }
                        ]
                    };

                    activeQualitySessions.set(dlDateNow, { movie, download_links: movie.download_links });

                    await sendInteractiveMessage(Gifted, from, {
                        text: '🔽 *Please select your preferred episode or file below:*',
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

            // 4. Download and Document Sender Listener
            const qualityListener = async (update2) => {
                try {
                    const msg2 = update2.messages[0];
                    if (!msg2.message) return;

                    const selectedQualityId = extractButtonId(msg2.message);
                    if (!selectedQualityId || !selectedQualityId.startsWith("newmv_link_")) return;
                    if (msg2.key?.remoteJid !== from) return;

                    const parts = selectedQualityId.split("_");
                    const dlTimestamp = parseInt(parts[4]);

                    if (!activeQualitySessions.has(dlTimestamp)) return;
                    const session = activeQualitySessions.get(dlTimestamp);

                    const qIndex = parseInt(parts[3]);
                    const finalDownloadItem = session.download_links[qIndex];

                    await react("⬇️");

                    // Download API
                    const dlUrl = `https://ck-stagatv-api-alutheka.vercel.app/api/dl?url=${encodeURIComponent(finalDownloadItem.url)}`;
                    const dlResponse = await axios.get(dlUrl);

                    const dlData = dlResponse.data;
                    if (!dlData || !dlData.dl_link) {
                        await react("❌");
                        return reply("❌ Direct download link could not be generated.", msg2);
                    }

                    await react("⬆️");
                    const thumb = await createThumbnail(session.movie.image);
                    const fileExtension = dlData.type || "mkv";
                    const fileName = `${dlData.title || session.movie.title}.${fileExtension}`;
                    const mimeType = fileExtension === "mp4" ? "video/mp4" : `video/${fileExtension}`;

                    await Gifted.sendMessage(from, {
                        document: { url: dlData.dl_link },
                        mimetype: mimeType,
                        fileName: fileName,
                        jpegThumbnail: thumb,
                        caption: `🎬 \`${fileName}\`\n🎞️ \`Quality:\` *${dlData.quality || "N/A"}\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
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

