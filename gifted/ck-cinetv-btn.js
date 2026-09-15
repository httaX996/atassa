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
                return reply("🎬 *Please provide a TV Series name to search!*");
            }

            await react("🎬");

            const searchUrl = `https://chethmina-kavishan-cinesubz-api-v1.vercel.app/api/search?q=${encodeURIComponent(q)}`;
            const { data } = await axios.get(searchUrl);

            if (!data.success || !data.results || !data.results.length) {
                await react("❌");
                return reply("❌ *No TV Series found for your search query!*");
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

            const sections = [{
                title: `🔍 Search Results for: ${q}`,
                rows: moviesSlice.map((movie, index) => ({
                    header: `🎬 ${movie.year || "N/A"}`,
                    title: movie.title,
                    description: `✨ Tap to view details & select quality`,
                    id: `tv_select_${sessionId}_${index}`
                }))
            }];

            await sendInteractiveMessage(Gifted, from, {
                text: `🔍 𝗖𝗜𝗡𝗘𝗦𝗨𝗕𝗭 𝗧𝗩 𝗦𝗘𝗥𝗜𝗘𝗦\n\n✨ Results found for: *${q}*\n\n🔽 *පහත ලැයිස්තුවෙන් ඔබට අවශ්‍ය TV Series එක තෝරා ගන්න:*`,
                footer: `👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`,
                interactiveButtons: [{
                    name: 'single_select',
                    buttonParamsJson: JSON.stringify({ title: '🎬 Select TV Series', sections })
                }]
            }, { quoted: ck });

            await react("✅");

            // ----------------------------------------------------
            // Dynamic Listener
            // ----------------------------------------------------
            const tvButtonHandler = async (update) => {
                try {
                    const msg = update.messages[0];
                    if (!msg || !msg.message) return;

                    const selectedButtonId = extractButtonId(msg.message);
                    if (!selectedButtonId) return;

                    const currentJid = msg.key.remoteJid;
                    if (currentJid !== from) return;

                    // A. TV Series එකක් තෝරාගත් විට (Quality Selection යැවීම)
                    if (selectedButtonId.startsWith(`tv_select_${sessionId}_`)) {
                        const movieIndex = parseInt(selectedButtonId.replace(`tv_select_${sessionId}_`, ""));
                        const session = tvSearchSessions.get(sessionId);

                        if (isSessionExpired(session)) {
                            Gifted.ev.off("messages.upsert", tvButtonHandler);
                            return Gifted.sendMessage(from, { text: "❌ *ඔබ යොමුකළ ඉල්ලීම කල් ඉකුත් වී ඇත (Session Expired). කරුණාකර නැවත උත්සාහ කරන්න.*" }, { quoted: ck });
                        }

                        await react("⏳");
                        const selectedMovie = session.moviesSlice[movieIndex];
                        session.selectedMovieLink = selectedMovie.link;
                        tvSearchSessions.set(sessionId, session);

                        // Basic info fetch කරගැනීමට පරණ endpoint එක හෝ සරලව තොරතුරු පෙන්වීම
                        const infoUrl = `https://chethmina-kavishan-cinesubz-api-v1.vercel.app/api/tvinfo?url=${encodeURIComponent(selectedMovie.link)}`;
                        const { data } = await axios.get(infoUrl);

                        if (data.success && data.data) {
                            const tvInfo = data.data;
                            session.tvPoster = tvInfo.poster || tvInfo.image || config.IMG_URL;
                            session.tvTitle = tvInfo.title || selectedMovie.title;
                            tvSearchSessions.set(sessionId, session);

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

                            let detailsCaption = `🎬 *${tvInfo.title || "Unknown"}*\n\n`;
                            detailsCaption += `📅 \`YEAR:\` *${tvInfo.year || "N/A"}*\n`;
                            detailsCaption += `⭐ \`IMDB:\` *${tvInfo.imdb || "N/A"}*\n`;
                            detailsCaption += `🌍 \`COUNTRY:\` *${tvInfo.country || "N/A"}*\n`;
                            detailsCaption += `🎭 \`CAST:\` \n${tvCast}\n\n`;
                            detailsCaption += `📝 \`DESC:\` _${tvDesc}_\n\n`;
                            detailsCaption += `> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`;

                            try {
                                const posterBuffer = await getImageBuffer(session.tvPoster);
                                if (posterBuffer) {
                                    await Gifted.sendMessage(from, { image: posterBuffer, caption: detailsCaption }, { quoted: ck });
                                } else {
                                    await Gifted.sendMessage(from, { image: { url: config.IMG_URL }, caption: detailsCaption }, { quoted: ck });
                                }
                            } catch (e) {
                                await Gifted.sendMessage(from, { text: detailsCaption }, { quoted: ck });
                            }
                        }

                        // SELECT QUALITY Buttons යැවීම
                        const qualitySections = [{
                            title: `⚡ Available Qualities`,
                            rows: [
                                { header: `🎞️ Resolution`, title: `480P`, description: `🔽 Select 480p Quality`, id: `tv_ext_${sessionId}_480p` },
                                { header: `🎞️ Resolution`, title: `720P`, description: `🔽 Select 720p Quality`, id: `tv_ext_${sessionId}_720p` },
                                { header: `🎞️ Resolution`, title: `1080P`, description: `🔽 Select 1080p Quality`, id: `tv_ext_${sessionId}_1080p` }
                            ]
                        }];

                        await sendInteractiveMessage(Gifted, from, {
                            text: `🌟 *SELECT QUALITY*\n\n🔽 *ඔබට අවශ්‍ය වීඩියෝ Quality තෝරා ගන්න:*`,
                            footer: `👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`,
                            interactiveButtons: [{
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify({ title: '⚙️ Select Quality', sections: qualitySections })
                            }]
                        }, { quoted: ck });
                        await react("✅");
                    }

                    // B. Quality එකක් තෝරාගත් විට (tvinfo2 API එක ඇමතීම සහ Episodes බටන් සකස් කිරීම)
                    if (selectedButtonId.startsWith(`tv_ext_${sessionId}_`)) {
                        const qualityExt = selectedButtonId.replace(`tv_ext_${sessionId}_`, "");
                        const session = tvSearchSessions.get(sessionId);

                        if (isSessionExpired(session)) {
                            Gifted.ev.off("messages.upsert", tvButtonHandler);
                            return Gifted.sendMessage(from, { text: "❌ *Session expired. Please search again.*" }, { quoted: ck });
                        }

                        await react("⏳");
                        await Gifted.sendMessage(from, { text: "🔄 *Episodes url generating... Please wait a moment!* ⏳" }, { quoted: ck });

                        const info2Url = `https://chethmina-kavishan-cinesubz-api-v1.vercel.app/api/tvinfo2?url=${encodeURIComponent(session.selectedMovieLink)}&ext=${qualityExt}`;
                        const { data } = await axios.get(info2Url);

                        if (!data.success || !data.data || !data.data.seasons) {
                            await react("❌");
                            return Gifted.sendMessage(from, { text: "❌ *Failed to fetch episodes for this quality.*" }, { quoted: ck });
                        }

                        const tvInfo2Data = data.data;
                        session.seasonsData = tvInfo2Data.seasons;
                        session.seasonKeys = Object.keys(tvInfo2Data.seasons);
                        tvSearchSessions.set(sessionId, session);

                        // Season අනුව Category කර ලස්සනට Emojis දමා Sections සකස් කිරීම[span_0](start_span)[span_0](end_span)
                        const seasonSections = session.seasonKeys.map((seasonName, sIdx) => ({
                            title: `📂 ⭐ ${seasonName}`,
                            rows: tvInfo2Data.seasons[seasonName].map((ep, epIdx) => ({
                                header: `📺 ${ep.episode_number}`,
                                title: ep.episode_name ? `${ep.episode_number}: ${ep.episode_name}` : `${ep.episode_number}`,
                                description: `📦 Size: ${ep.downloads?.[0]?.size || 'N/A'} | 🎬 Tap to Download`,
                                id: `tv_ep_${sessionId}_${sIdx}_${epIdx}`
                            }))
                        }));

                        await sendInteractiveMessage(Gifted, from, {
                            text: `📺 *${session.tvTitle || "TV Series"}*\n✨ *Quality:* \`${qualityExt.toUpperCase()}\`\n\n🔽 *පහතින් ඔබට අවශ්‍ය Episode එක තෝරා ගන්න:*`,
                            footer: `👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`,
                            interactiveButtons: [{
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify({ title: '🍿 Select Episode', sections: seasonSections })
                            }]
                        }, { quoted: ck });
                        await react("✅");
                    }

                    // C. Episode එක තෝරාගත් විට (dl API එක හරහා Direct Link ලබාගෙන Document එක යැවීම)
                    if (selectedButtonId.startsWith(`tv_ep_${sessionId}_`)) {
                        const parts = selectedButtonId.split("_");
                        const sIdx = parseInt(parts[3]);
                        const epIdx = parseInt(parts[4]);

                        const session = tvSearchSessions.get(sessionId);
                        if (isSessionExpired(session)) {
                            Gifted.ev.off("messages.upsert", tvButtonHandler);
                            return Gifted.sendMessage(from, { text: "❌ *Session expired. Please try again.*" }, { quoted: ck });
                        }

                        await react("⬇️");
                        const seasonName = session.seasonKeys[sIdx];
                        const episode = session.seasonsData[seasonName][epIdx];
                        const downloadLinkObj = episode.downloads?.[0];

                        if (!downloadLinkObj || !downloadLinkObj.download_link) {
                            await react("❌");
                            return Gifted.sendMessage(from, { text: "❌ *Download link not available for this episode.*" }, { quoted: ck });
                        }

                        await Gifted.sendMessage(from, { text: "📥 *Generating direct download link... Please wait!* 🚀" }, { quoted: ck });

                        // ඉල්ලා ඇති පරිදි /api/dl?url= භාවිතා කිරීම[span_1](start_span)[span_1](end_span)
                        const dlApiUrl = `https://chethmina-kavishan-cinesubz-api-v1.vercel.app/api/dl?url=${encodeURIComponent(downloadLinkObj.download_link)}`;
                        const { data: dlData } = await axios.get(dlApiUrl);

                        if (!dlData.status || !dlData.direct_link) {
                            await react("❌");
                            return Gifted.sendMessage(from, { text: "❌ *Direct download link generation failed!*" }, { quoted: ck });
                        }

                        await react("⬆️");
                        const thumb = await createThumbnail(session.tvPoster);

                        // Direct link එක භාවිතයෙන් Document එක යැවීම[span_2](start_span)[span_2](end_span)
                        await Gifted.sendMessage(from, {
                            document: { url: dlData.direct_link },
                            mimetype: "video/mp4",
                            fileName: `${dlData.title || episode.episode_name || "Video"}.mp4`,
                            jpegThumbnail: thumb,
                            caption: `🎬 *${session.tvTitle || "TV Series"}*\n📌 *${seasonName} - ${episode.episode_number}* (${episode.episode_name || ""})\n\n🎞️ \`Quality:\` *${dlData.quality || downloadLinkObj.quality || "N/A"}*\n📦 \`Size:\` *${downloadLinkObj.size || "N/A"}*\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
                        }, { quoted: ck });
                        await react("✅");
                    }

                } catch (err) {
                    console.error("Listener Error: ", err);
                }
            };

            Gifted.ev.on("messages.upsert", tvButtonHandler);

            setTimeout(() => {
                Gifted.ev.off("messages.upsert", tvButtonHandler);
                tvSearchSessions.delete(sessionId);
            }, SESSION_TIMEOUT);

        } catch (err) {
            console.error(err);
            await react("❌");
            reply(`❌ *Error:* ${err.message || err}`);
        }
    }
);
