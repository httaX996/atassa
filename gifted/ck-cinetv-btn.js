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

            const moviesSlice = data.results.slice(0, 10);
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
                        body: { text: `✨ Click below to fetch seasons.` },
                        footer: { text: `> ${botFooter}` },
                        nativeFlowMessage: {
                            buttons: [{
                                name: "quick_reply",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "📥 DOWNLOAD",
                                    id: `tv_seasons_${sessionId}_${index}`
                                }),
                            }],
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
                                body: { text: `🔍 𝗖𝗞 𝗖𝗜𝗡𝗘𝗦𝗨𝗕𝗭 𝗧𝗩 𝗦𝗘𝗔𝗥𝗖𝗛 \n\nResults for: *${q}*` },
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

            // ----------------------------------------------------
            // 2. Safe Dynamic Listener (No Crash, Auto-fallback)
            // ----------------------------------------------------
            const tvButtonHandler = async (update) => {
                try {
                    const msg = update.messages[0];
                    if (!msg || !msg.message) return;

                    const selectedButtonId = extractButtonId(msg.message);
                    if (!selectedButtonId) return;

                    const currentJid = msg.key.remoteJid;
                    if (currentJid !== from) return;

                    // A. DOWNLOAD බටන් එක ක්ලික් කළ විට
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

                        // Debugging සදහා: API Response එක console එකට ගන්නවා.
                        console.log("CINETV INFO API RESPONSE:", JSON.stringify(data, null, 2));

                        if (!data || (!data.success && !data.data)) {
                            await react("❌");
                            return Gifted.sendMessage(from, { text: "❌ Failed to fetch details from server." }, { quoted: ck });
                        }

                        // API Response එකේ data තියෙන තැන හරියට ගමු (data.data හෝ කෙලින්ම data)
                        const movieData = data.data || data;
                        session.tvInfo = movieData;
                        
                        // සේසන්ස් ලිස්ට් එකක් තියෙනවද කියලා බලනවා
                        const seasonsObj = movieData.seasons || {};
                        session.seasonKeys = Object.keys(seasonsObj);
                        tvSearchSessions.set(sessionId, session);

                        if (session.seasonKeys.length === 0) {
                            await react("❌");
                            return Gifted.sendMessage(from, { text: "❌ No seasons found for this TV series." }, { quoted: ck });
                        }

                        // Safe Values assign කිරීම (API එකෙන් missing data ආවොත් crash වීම වැලැක්වීමට)
                        const tvTitle = movieData.title || session.moviesSlice[movieIndex].title || "Unknown Title";
                        const tvYear = movieData.year || "N/A";
                        const tvImdb = movieData.imdb || "N/A";
                        const tvCountry = movieData.country || "N/A";
                        const tvPoster = movieData.poster || movieData.image || session.moviesSlice[movieIndex].image || config.IMG_URL;
                        
                        let tvCast = "N/A";
                        if (movieData.cast && Array.isArray(movieData.cast)) {
                            tvCast = movieData.cast.slice(0, 4).map(c => `*• ${c}*`).join('\n');
                        } else if (typeof movieData.cast === 'string') {
                            tvCast = movieData.cast;
                        }

                        let tvDesc = "No description available.";
                        if (movieData.description) {
                            tvDesc = movieData.description.length > 200 ? movieData.description.slice(0, 200) + "..." : movieData.description;
                        }

                        // Details Caption එක සකස් කිරීම
                        let detailsCaption = `🎬 *${tvTitle}*\n\n`;
                        detailsCaption += `📅 \`YEAR:\` *${tvYear}*\n`;
                        detailsCaption += `⭐ \`IMDB:\` *${tvImdb}*\n`;
                        detailsCaption += `🌍 \`COUNTRY:\` *${tvCountry}*\n`;
                        detailsCaption += `🎭 \`CAST:\` \n${tvCast}\n\n`;
                        detailsCaption += `📝 \`DESC:\` _${tvDesc}_\n\n`;
                        detailsCaption += `> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`;

                        // 1. මුලින්ම Poster එක සහ Details යවනවා (Error Safe)
                        try {
                            await Gifted.sendMessage(from, {
                                image: { url: tvPoster },
                                caption: detailsCaption
                            }, { quoted: ck });
                        } catch (imgErr) {
                            console.error("Poster sending failed, falling back to text only:", imgErr);
                            // Poster එක යවන්න බැරි වුනොත් (Invalid URL) Text එක විතරක් යවනවා
                            await Gifted.sendMessage(from, { text: detailsCaption }, { quoted: ck });
                        }

                        // 2. Seasons & Episodes තෝරන්න ලිස්ට් එක සකසනවා
                        const sections = session.seasonKeys.map((seasonName, sIdx) => ({
                            title: `⭐ ${seasonName}`,
                            rows: (seasonsObj[seasonName] || []).map((ep, epIdx) => ({
                                header: `${ep.episode_number || epIdx + 1}`,
                                title: ep.episode_name || `Episode ${ep.episode_number || epIdx + 1}`,
                                id: `tv_ep_${sessionId}_${sIdx}_${epIdx}`
                            }))
                        }));

                        // 3. ලිස්ට් මැසේජ් එක යවනවා
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

                    // B. Episode එකක් තෝරාගත් විට Quality List එක යැවීම
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
                        const currentSeason = session.seasonKeys[sIdx];
                        const episode = session.tvInfo.seasons[currentSeason][epIdx];
                        
                        const { data } = await axios.get(`https://chethmina-kavishan-cinesubz-api-v1.vercel.app/api/episode?url=${encodeURIComponent(episode.episode_url)}`);

                        if (!data || (!data.success && !data.data)) {
                            await react("❌");
                            return Gifted.sendMessage(from, { text: "❌ Failed to fetch quality options." }, { quoted: ck });
                        }

                        const epData = data.data || data;
                        const epSessionId = `${sessionId}_${sIdx}_${epIdx}`;
                        
                        tvEpisodeSessions.set(epSessionId, {
                            title: epData.title || `Episode ${episode.episode_number}`,
                            downloads: epData.downloads || [],
                            poster: session.tvInfo.poster || session.tvInfo.image || config.IMG_URL,
                            seriesTitle: session.tvInfo.title || "TV Series",
                            createdAt: Date.now()
                        });

                        setTimeout(() => { tvEpisodeSessions.delete(epSessionId); }, SESSION_TIMEOUT);

                        const downloadList = epData.downloads || [];
                        if (downloadList.length === 0) {
                            await react("❌");
                            return Gifted.sendMessage(from, { text: "❌ No download links found for this episode." }, { quoted: ck });
                        }

                        const buttonRows = downloadList.map((dl, qIdx) => ({
                            header: dl.quality || "Unknown Quality",
                            title: dl.quality || "Download Link",
                            description: dl.size || "N/A",
                            id: `tv_dl_${epSessionId}_${qIdx}`
                        }));

                        await sendInteractiveMessage(Gifted, from, {
                            text: `📌 *${epData.title || "Episode Details"}*\n\n🔽 *Please select your preferred quality below:*`,
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

                    // C. Quality සිලෙක්ට් කර ඩවුන්ලෝඩ් ලබා ගැනීම
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
                        if (!dlData || !dlData.success || !dlData.data?.download_url) {
                            await react("❌");
                            return Gifted.sendMessage(from, { text: "❌ First stage link generation failed." }, { quoted: ck });
                        }

                        const { data: sadasData } = await axios.get(`https://apis.sadas.dev/api/v1/movie/cinesubz/dl?q=${encodeURIComponent(dlData.data.download_url)}&apiKey=ea4d57a2a2db72e0bb3ba58f56b1ff9b`);
                        if (!sadasData || !sadasData.status || !sadasData.data?.links) {
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
                            caption: `🎬 *${epSession.seriesTitle}*\n📌 *${epSession.title}*\n\n🎞️ \`Quality:\` *${finalQuality.quality || "N/A"}*\n📦 \`Size:\` *${finalQuality.size || "N/A"}*\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
                        }, { quoted: ck });
                        await react("✅");
                    }

                } catch (err) {
                    console.error("Listener Error: ", err);
                }
            };

            // බටන් ලිස්නර් එක රෙජිස්ටර් කිරීම
            Gifted.ev.on("messages.upsert", tvButtonHandler);

            // විනාඩි 15කින් ලිස්නර් එක Clear කිරීම
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
