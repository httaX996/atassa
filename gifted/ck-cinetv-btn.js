let { gmd } = require("../gift");
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

// ග්ලෝබල් සෙශන්ස්
const tvSearchSessions = new Map();
const tvEpisodeSessions = new Map();

const SESSION_TIMEOUT = 15 * 60 * 1000; // විනාඩි 15

function isSessionExpired(session) {
    if (!session) return true;
    return (Date.now() - session.createdAt) > SESSION_TIMEOUT;
}

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

// Helper to safely fetch image as Buffer to avoid WA URL download errors
async function getImageBuffer(url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
        return Buffer.from(response.data);
    } catch (e) {
        console.error("Image Fetch Error:", e.message);
        return null;
    }
}

// 1. ප්‍රධාන CINETV කමාන්ඩ් එක
gmd(
    {
        pattern: "cinetv",
        category: "movie",
        aliases: ["tvshow", "cinesubztv"],
        description: "Search TV Series from CineSubz",
    },
    async (from, Gifted, conText) => {
        const { q, reply, react, botFooter } = conText;

        try {
            if (!q) {
                await react("❌");
                return reply("🎬 Please provide a TV Series name.");
            }

            await react("🎬");

            const searchUrl = `https://chethmina-kavishan-cinesubz-api-v1.vercel.app/api/search?q=${encodeURIComponent(q)}`;
            const { data } = await axios.get(searchUrl);

            if (!data.success || !data.results || !data.results.length) {
                await react("❌");
                return reply("❌ No TV Series found.");
            }

            const moviesSlice = data.results.slice(0, 20);
            const sessionId = Date.now().toString();

            tvSearchSessions.set(sessionId, {
                moviesSlice,
                from,
                botFooter,
                createdAt: Date.now()
            });

            setTimeout(() => {
                tvSearchSessions.delete(sessionId);
            }, SESSION_TIMEOUT);

            // Carousel වෙනුවට single_select (List message / Button style) එක සඳහා rows සකස් කිරීම
            const sections = [{
                title: `🔍 Search Results for: ${q}`,
                rows: moviesSlice.map((movie, index) => ({
                    header: `🎬 ${movie.year || "N/A"}`,
                    title: movie.title,
                    description: `Click to fetch seasons`,
                    id: `tv_seasons_${sessionId}_${index}`
                }))
            }];

            await sendInteractiveMessage(Gifted, from, {
                text: `🔍 *𝗖𝗞 𝗖𝗜𝗡𝗘𝗦𝗨𝗕𝗭 𝗧𝗩 𝗦𝗘𝗔𝗥𝗖𝗛*\n\nResults found for: *${q}*\n\n🔽 *පහතින් අවශ්‍ය TV Series එක තෝරා ගන්න:*`,
                footer: `👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`,
                interactiveButtons: [{
                    name: 'single_select',
                    buttonParamsJson: JSON.stringify({ title: '🎬 Select TV Series', sections })
                }]
            }, { quoted: ck });

            await react("✅");

            // ----------------------------------------------------
            // 2. Dynamic Listener
            // ----------------------------------------------------
            const tvButtonHandler = async (update) => {
                try {
                    const msg = update.messages[0];
                    if (!msg || !msg.message) return;

                    const selectedButtonId = extractButtonId(msg.message);
                    if (!selectedButtonId) return;

                    const currentJid = msg.key.remoteJid;
                    if (currentJid !== from) return;

                    // A. Seasons බටන් එක ක්ලික් කළ විට
                    if (selectedButtonId.startsWith(`tv_seasons_${sessionId}_`)) {
                        const movieIndex = parseInt(selectedButtonId.replace(`tv_seasons_${sessionId}_`, ""));
                        const session = tvSearchSessions.get(sessionId);

                        if (isSessionExpired(session)) {
                            Gifted.ev.off("messages.upsert", tvButtonHandler);
                            return Gifted.sendMessage(from, { text: "❌ ඔබ යොමු කල request එක expire විය. නැවත request කරන්න." }, { quoted: ck });
                        }

                        await react("⏳");
                        const infoUrl = `https://chethmina-kavishan-cinesubz-api-v1.vercel.app/api/tvinfo?url=${encodeURIComponent(session.moviesSlice[movieIndex].link)}`;
                        const { data } = await axios.get(infoUrl);

                        if (!data.success || !data.data) {
                            await react("❌");
                            return Gifted.sendMessage(from, { text: "❌ Failed to fetch details." }, { quoted: ck });
                        }

                        const tvInfo = data.data;
                        session.tvInfo = tvInfo;
                        session.seasonKeys = Object.keys(tvInfo.seasons);
                        tvSearchSessions.set(sessionId, session);

                        // Variables සැකසීම
                        const tvTitle = tvInfo.title || "Unknown Title";
                        const tvYear = tvInfo.year || "N/A";
                        const tvImdb = tvInfo.imdb || "N/A";
                        const tvCountry = tvInfo.country || "N/A";
                        const tvPosterUrl = tvInfo.poster || tvInfo.image || config.IMG_URL;
                        
                        // Cast formatting
                        let tvCast = "N/A";
                        if (tvInfo.cast && Array.isArray(tvInfo.cast)) {
                            const filteredCast = tvInfo.cast.filter(c => c !== "Cast Collection");
                            if (filteredCast.length > 0) {
                                tvCast = filteredCast.slice(0, 5).map(c => `*• ${c}*`).join('\n');
                            }
                        }

                        let tvDesc = "No description available.";
                        if (tvInfo.description) {
                            tvDesc = tvInfo.description.length > 250 ? tvInfo.description.slice(0, 250) + "..." : tvInfo.description;
                        }

                        let detailsCaption = `🎬 *${tvTitle}*\n\n`;
                        detailsCaption += `📅 \`YEAR:\` *${tvYear}*\n`;
                        detailsCaption += `⭐ \`IMDB:\` *${tvImdb}*\n`;
                        detailsCaption += `🌍 \`COUNTRY:\` *${tvCountry}*\n`;
                        detailsCaption += `🎭 \`CAST:\` \n${tvCast}\n\n`;
                        detailsCaption += `📝 \`DESC:\` _${tvDesc}_\n\n`;
                        detailsCaption += `> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`;

                        // 1. මුලින්ම Poster එක සහ Details යවනවා (Buffer ක්‍රමයට)
                        try {
                            const posterBuffer = await getImageBuffer(tvPosterUrl);
                            if (posterBuffer) {
                                await Gifted.sendMessage(from, {
                                    image: posterBuffer,
                                    caption: detailsCaption
                                }, { quoted: ck });
                            } else {
                                // Buffer එක ගන්න බැරි වුනොත් Default image එක url එකක් විදියට ට්‍රයි කරයි
                                await Gifted.sendMessage(from, {
                                    image: { url: config.IMG_URL },
                                    caption: detailsCaption
                                }, { quoted: ck });
                            }
                        } catch (e) {
                            console.log("Image send failed, sending text details instead:", e);
                            await Gifted.sendMessage(from, { text: detailsCaption }, { quoted: ck });
                        }

                        // 2. Episode Selector එක සකසනවා
                        const sections = session.seasonKeys.map((seasonName, sIdx) => ({
                            title: `⭐ ${seasonName}`,
                            rows: tvInfo.seasons[seasonName].map((ep, epIdx) => ({
                                header: `${ep.episode_number}`,
                                title: ep.episode_name || `${ep.episode_number}`,
                                id: `tv_ep_${sessionId}_${sIdx}_${epIdx}`
                            }))
                        }));

                        // Selector එක යවනවා
                        await sendInteractiveMessage(Gifted, from, {
                            text: `📺 *${tvTitle}*\n\n🔽 *පහතින් ඔබට අවශ්‍ය Episode එකක් තෝරා ගන්න:*`,
                            footer: session.botFooter,
                            interactiveButtons: [{
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify({ title: '📺 Select Episode', sections })
                            }]
                        }, { quoted: ck });
                        await react("✅");
                    }

                    // B. Episode එක තෝරාගත් විට
                    if (selectedButtonId.startsWith(`tv_ep_${sessionId}_`)) {
                        const parts = selectedButtonId.split("_");
                        const sIdx = parseInt(parts[3]);
                        const epIdx = parseInt(parts[4]);

                        const session = tvSearchSessions.get(sessionId);
                        if (isSessionExpired(session)) {
                            Gifted.ev.off("messages.upsert", tvButtonHandler);
                            return Gifted.sendMessage(from, { text: "❌ ඔබ යොමු කල request එක expire විය. නැවත request කරන්න." }, { quoted: ck });
                        }

                        await react("⏳");
                        const episode = session.tvInfo.seasons[session.seasonKeys[sIdx]][epIdx];
                        const { data } = await axios.get(`https://chethmina-kavishan-cinesubz-api-v1.vercel.app/api/episode?url=${encodeURIComponent(episode.episode_url)}`);

                        if (!data.success) {
                            await react("❌");
                            return Gifted.sendMessage(from, { text: "❌ Failed to fetch quality options." }, { quoted: ck });
                        }

                        const epSessionId = `${sessionId}_${sIdx}_${epIdx}`;
                        tvEpisodeSessions.set(epSessionId, {
                            title: data.data.title,
                            downloads: data.data.downloads,
                            poster: session.tvInfo.poster,
                            seriesTitle: session.tvInfo.title,
                            createdAt: Date.now()
                        });

                        setTimeout(() => { tvEpisodeSessions.delete(epSessionId); }, SESSION_TIMEOUT);

                        const buttonRows = data.data.downloads.map((dl, qIdx) => ({
                            header: dl.quality,
                            title: dl.quality,
                            description: dl.size,
                            id: `tv_dl_${epSessionId}_${qIdx}`
                        }));

                        await sendInteractiveMessage(Gifted, from, {
                            text: `📌 *${data.data.title}*\n\n🔽 *Please select your preferred quality below:*`,
                            footer: session.botFooter,
                            interactiveButtons: [{
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify({
                                    title: '🟢 Select Quality',
                                    sections: [{ title: 'Available Qualities', rows: buttonRows }]
                                })
                            }]
                        }, { quoted: ck });
                        await react("✅");
                    }

                    // C. Quality එකක් තෝරාගෙන Download Link ලබා ගන්නා විට
                    if (selectedButtonId.startsWith(`tv_dl_${sessionId}_`)) {
                        const parts = selectedButtonId.split("_");
                        const epSessionId = `${parts[2]}_${parts[3]}_${parts[4]}`;
                        const qIdx = parseInt(parts[5]);

                        const epSession = tvEpisodeSessions.get(epSessionId);
                        if (isSessionExpired(epSession)) {
                            return Gifted.sendMessage(from, { text: "❌ ඔබ යොමු කල request එක expire විය. නැවත request කරන්න." }, { quoted: ck });
                        }

                        await react("⬇️");
                        const finalQuality = epSession.downloads[qIdx];

                        const { data: dlData } = await axios.get(`https://chethmina-kavishan-cinesubz-api-v1.vercel.app/api/dl?url=${encodeURIComponent(finalQuality.download_link)}`);
                        if (!dlData.success || !dlData.data?.download_url) {
                            await react("❌");
                            return Gifted.sendMessage(from, { text: "❌ First stage link generation failed." }, { quoted: ck });
                        }

                        const { data: sadasData } = await axios.get(`https://apis.sadas.dev/api/v1/movie/cinesubz/dl?q=${encodeURIComponent(dlData.data.download_url)}&apiKey=aef6578e9d6927ee27b0a62e8f284e75`);
                        if (!sadasData.status || !sadasData.data?.links) {
                            await react("❌");
                            return Gifted.sendMessage(from, { text: "❌ Direct download link generation failed." }, { quoted: ck });
                        }

                        const directLink = sadasData.data.links.find(l => !l.includes("t.me") && !l.includes("telegram"));
                        if (!directLink) {
                            await react("❌");
                            return Gifted.sendMessage(from, { text: "❌ Direct download link not found." }, { quoted: ck });
                        }

                        await react("⬆️");
                        const thumb = await createThumbnail(epSession.poster);

                        await Gifted.sendMessage(from, {
                            document: { url: directLink },
                            mimetype: "video/mp4",
                            fileName: `${sadasData.data.title || epSession.title}.mp4`,
                            jpegThumbnail: thumb,
                            caption: `🎬 *${epSession.seriesTitle}*\n📌 *${epSession.title}*\n\n🎞️ \`Quality:\` *${finalQuality.quality}*\n📦 \`Size:\` *${finalQuality.size}*\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
                        }, { quoted: ck });
                        await react("✅");
                    }

                } catch (err) {
                    console.error("Listener Error: ", err);
                }
            };

            // බටන් ලිස්නර් එක රෙජිස්ටර් කිරීම
            Gifted.ev.on("messages.upsert", tvButtonHandler);

            // විනාඩි 15කින් සෙශන් එක වසා දමයි
            setTimeout(() => {
                Gifted.ev.off("messages.upsert", tvButtonHandler);
                tvSearchSessions.delete(sessionId);
            }, SESSION_TIMEOUT);

        } catch (err) {
            console.error(err);
            await react("❌");
            reply(`❌ Error: ${err.message || err}`);
        }
    }
);

