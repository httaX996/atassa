// මෙතන const වෙනුවට let දැම්මා. එතකොට පහළින් re-assign කරන්න පුළුවන්.
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

// ග්ලෝබල් සෙශන් කළමනාකරණය
const tvSearchSessions = new Map();
const tvEpisodeSessions = new Map();

// විනාඩි 15ක සීමාව (15 * 60 * 1000 = 900,000ms)
const SESSION_TIMEOUT = 15 * 60 * 1000; 

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
                                    display_text: "📥 SELECT SEASONS",
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
        } catch (err) {
            console.error(err);
            await react("❌");
            reply(`❌ Error: ${err.message || err}`);
        }
    }
);

// 2. ග්ලෝබල් ලිස්නර් (සෙශන් කළමනාකරණය)
let globalListenerRegistered = false;
const registerTvGlobalListener = (Gifted) => {
    if (globalListenerRegistered) return;
    globalListenerRegistered = true;

    Gifted.ev.on("messages.upsert", async (update) => {
        try {
            const msg = update.messages[0];
            if (!msg || !msg.message) return;

            const selectedButtonId = extractButtonId(msg.message);
            if (!selectedButtonId) return;

            const from = msg.key.remoteJid;

            if (selectedButtonId.startsWith("tv_seasons_")) {
                const parts = selectedButtonId.split("_");
                const sessionId = parts[2];
                const movieIndex = parseInt(parts[3]);

                const session = tvSearchSessions.get(sessionId);
                if (isSessionExpired(session)) return Gifted.sendMessage(from, { text: "❌ Session expired. Please search again." }, { quoted: ck });

                const infoUrl = `https://chethmina-kavishan-cinesubz-api-v1.vercel.app/api/tvinfo?url=${encodeURIComponent(session.moviesSlice[movieIndex].link)}`;
                const { data } = await axios.get(infoUrl);

                if (!data.success) return Gifted.sendMessage(from, { text: "❌ Failed." }, { quoted: ck });

                session.tvInfo = data.data;
                session.seasonKeys = Object.keys(data.data.seasons);
                tvSearchSessions.set(sessionId, session);

                const sections = session.seasonKeys.map((seasonName, sIdx) => ({
                    title: `⭐ ${seasonName}`,
                    rows: data.data.seasons[seasonName].map((ep, epIdx) => ({
                        header: `${ep.episode_number}`,
                        title: ep.episode_name || `${ep.episode_number}`,
                        id: `tv_ep_${sessionId}_${sIdx}_${epIdx}`
                    }))
                }));

                await sendInteractiveMessage(Gifted, from, {
                    text: `🎬 *${data.data.title}*\n\nSelect episode:`,
                    footer: session.botFooter,
                    interactiveButtons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: 'Select Episode', sections }) }]
                }, { quoted: ck });
            }

            if (selectedButtonId.startsWith("tv_ep_")) {
                const parts = selectedButtonId.split("_");
                const sessionId = parts[2];
                const sIdx = parts[3];
                const epIdx = parts[4];

                const session = tvSearchSessions.get(sessionId);
                if (isSessionExpired(session)) return Gifted.sendMessage(from, { text: "❌ Session expired." }, { quoted: ck });

                const episode = session.tvInfo.seasons[session.seasonKeys[sIdx]][epIdx];
                const { data } = await axios.get(`https://chethmina-kavishan-cinesubz-api-v1.vercel.app/api/episode?url=${encodeURIComponent(episode.episode_url)}`);
                
                if (!data.success) return Gifted.sendMessage(from, { text: "❌ Failed." }, { quoted: ck });

                const epSessionId = `${sessionId}_${sIdx}_${epIdx}`;
                tvEpisodeSessions.set(epSessionId, {
                    title: data.data.title,
                    downloads: data.data.downloads,
                    poster: session.tvInfo.poster,
                    seriesTitle: session.tvInfo.title,
                    createdAt: Date.now()
                });

                setTimeout(() => { tvEpisodeSessions.delete(epSessionId); }, SESSION_TIMEOUT);

                await sendInteractiveMessage(Gifted, from, {
                    text: `📌 *${data.data.title}*\n\nSelect quality:`,
                    footer: session.botFooter,
                    interactiveButtons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: 'Select Quality', sections: [{ title: 'Qualities', rows: data.data.downloads.map((dl, qIdx) => ({ header: dl.quality, title: dl.quality, description: dl.size, id: `tv_dl_${epSessionId}_${qIdx}` })) }] }) }]
                }, { quoted: ck });
            }

            if (selectedButtonId.startsWith("tv_dl_")) {
                const parts = selectedButtonId.split("_");
                const epSession = tvEpisodeSessions.get(`${parts[2]}_${parts[3]}_${parts[4]}`);
                if (isSessionExpired(epSession)) return Gifted.sendMessage(from, { text: "❌ Session expired." }, { quoted: ck });

                const finalQuality = epSession.downloads[parseInt(parts[5])];
                const { data: dlData } = await axios.get(`https://chethmina-kavishan-cinesubz-api-v1.vercel.app/api/dl?url=${encodeURIComponent(finalQuality.download_link)}`);
                const { data: sadasData } = await axios.get(`https://apis.sadas.dev/api/v1/movie/cinesubz/dl?q=${encodeURIComponent(dlData.data.download_url)}&apiKey=ea4d57a2a2db72e0bb3ba58f56b1ff9b`);

                const directLink = sadasData.data.links.find(l => !l.includes("t.me"));
                const thumb = await createThumbnail(epSession.poster);

                await Gifted.sendMessage(from, {
                    document: { url: directLink },
                    mimetype: "video/mp4",
                    fileName: `${sadasData.data.title}.mp4`,
                    jpegThumbnail: thumb,
                    caption: `🎬 ${epSession.seriesTitle}\n📌 ${epSession.title}\n📦 ${finalQuality.size}\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
                }, { quoted: ck });
            }
        } catch (err) { console.error(err); }
    });
};

const originalFunc = gmd;
gmd = function(config, func) {
    const wrappedFunc = async (from, Gifted, conText) => {
        registerTvGlobalListener(Gifted);
        return func(from, Gifted, conText);
    };
    return originalFunc(config, wrappedFunc);
};

