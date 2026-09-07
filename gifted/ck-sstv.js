let { gmd } = require("../gift");
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

// Global Sessions & Timeout Management
const sstvSearchSessions = new Map();
const sstvEpisodeSessions = new Map();
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

// Pixeldrain direct download link converter
function processDirectDownloadUrl(url) {
    if (!url) return url;
    
    const pixeldrainRegex = /pixeldrain\.com\/u\/([a-zA-Z0-9]+)/;
    const match = url.match(pixeldrainRegex);
    if (match && match[1]) {
        return `https://pixeldrain.com/api/file/${match[1]}?download`;
    }
    
    return url;
}

// ----------------------------------------------------
// 1. Main SSTV Command
// ----------------------------------------------------
gmd(
    {
        pattern: "sstv",
        category: "movie",
        aliases: ["sinhalasubtv", "sstvshow"],
        description: "Search TV Series from SinhalaSub",
    },
    async (from, Gifted, conText) => {
        const { q, reply, react, botFooter } = conText;

        try {
            if (!q) {
                await react("❌");
                return reply("🎬 Please provide a TV Series name to search on SinhalaSub.");
            }

            await react("🔍");

            const searchUrl = `https://ck-sinhalasub-api-1a2b3c4d5e.vercel.app/api/search?q=${encodeURIComponent(q)}`;
            const { data } = await axios.get(searchUrl);

            if (!data.status || !data.result || !data.result.length) {
                await react("❌");
                return reply("❌ No TV Series found.");
            }

            const searchResults = data.result.filter(item => item.type === "tvshows" || item.type === "movies").slice(0, 20);

            if (searchResults.length === 0) {
                await react("❌");
                return reply("❌ No TV Series found matching your query.");
            }

            const sessionId = Date.now().toString();

            sstvSearchSessions.set(sessionId, {
                searchResults,
                from,
                botFooter,
                createdAt: Date.now()
            });

            setTimeout(() => {
                sstvSearchSessions.delete(sessionId);
            }, SESSION_TIMEOUT);

            const sections = [{
                title: `🔍 SinhalaSub Search: ${q}`,
                rows: searchResults.map((item, index) => ({
                    header: item.type === "tvshows" ? "📺 TV Series" : "🎬 Movie",
                    title: item.title.replace(" | සිංහල උපසිරසි සමඟ", ""),
                    description: `Click to fetch seasons & details`,
                    id: `sstv_seasons_${sessionId}_${index}`
                }))
            }];

            await sendInteractiveMessage(Gifted, from, {
                text: `🔍 *𝗦𝗜𝗡𝗛𝗔𝗟𝗔𝗦𝗨𝗕 𝗧𝗩 𝗦𝗘𝗔𝗥𝗖𝗛*\n\nResults found for: *${q}*\n\n🔽 *පහතින් ඔබට අවශ්‍ය TV Series එක තෝරා ගන්න:*`,
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
            const sstvButtonHandler = async (update) => {
                try {
                    const msg = update.messages[0];
                    if (!msg || !msg.message) return;

                    const selectedButtonId = extractButtonId(msg.message);
                    if (!selectedButtonId) return;

                    const currentJid = msg.key.remoteJid;
                    if (currentJid !== from) return;

                    // A. Seasons & Details Fetching
                    if (selectedButtonId.startsWith(`sstv_seasons_${sessionId}_`)) {
                        const itemIndex = parseInt(selectedButtonId.replace(`sstv_seasons_${sessionId}_`, ""));
                        const session = sstvSearchSessions.get(sessionId);

                        if (isSessionExpired(session)) {
                            Gifted.ev.off("messages.upsert", sstvButtonHandler);
                            return Gifted.sendMessage(from, { text: "❌ ඔබ යොමු කල request එක expire විය. නැවත request කරන්න." }, { quoted: ck });
                        }

                        await react("⏳");
                        const tvInfoUrl = `https://ck-sinhalasub-api-1a2b3c4d5e.vercel.app/api/tvinfo?url=${encodeURIComponent(session.searchResults[itemIndex].url)}`;
                        const { data } = await axios.get(tvInfoUrl);

                        if (!data.status || !data.result) {
                            await react("❌");
                            return Gifted.sendMessage(from, { text: "❌ Failed to fetch series details." }, { quoted: ck });
                        }

                        const tvData = data.result;
                        session.tvData = tvData;
                        sstvSearchSessions.set(sessionId, session);

                        const title = tvData.title || "Unknown Series";
                        const details = tvData.details || {};
                        const posterUrl = tvData.image || config.IMG_URL;

                        const rating = details.rating || "N/A";
                        const views = details.views || "N/A";
                        const year = details.year || "N/A";
                        const country = details.country || "N/A";
                        const genres = Array.isArray(details.genres) ? details.genres.join(", ") : "N/A";
                        const stars = Array.isArray(details.stars) ? details.stars.slice(0, 5).map(s => `*• ${s}*`).join("\n") : "N/A";

                        let detailsCaption = `🎬 *${title}*\n\n`;
                        detailsCaption += `📅 \`YEAR:\` *${year}*\n`;
                        detailsCaption += `⭐ \`RATING:\` *${rating}*\n`;
                        detailsCaption += `👁️ \`VIEWS:\` *${views}*\n`;
                        detailsCaption += `🌍 \`COUNTRY:\` *${country}*\n`;
                        detailsCaption += `🎭 \`GENRES:\` *${genres}*\n\n`;
                        detailsCaption += `🌟 \`STARS:\` \n${stars}\n\n`;
                        detailsCaption += `> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`;

                        try {
                            const posterBuffer = await getImageBuffer(posterUrl);
                            if (posterBuffer) {
                                await Gifted.sendMessage(from, { image: posterBuffer, caption: detailsCaption }, { quoted: ck });
                            } else {
                                await Gifted.sendMessage(from, { image: { url: config.IMG_URL }, caption: detailsCaption }, { quoted: ck });
                            }
                        } catch (e) {
                            await Gifted.sendMessage(from, { text: detailsCaption }, { quoted: ck });
                        }

                        const sections = (tvData.seasons || []).map((s, sIdx) => ({
                            title: `⭐ ${s.season} (${s.episodes_count} Episodes)`,
                            rows: s.episodes.map((ep, epIdx) => ({
                                header: `📌 Episode ${epIdx + 1}`,
                                title: ep.name ? ep.name.toUpperCase() : `EPISODE ${epIdx + 1}`,
                                description: `📅 Date: ${ep.date || 'N/A'}`,
                                id: `sstv_ep_${sessionId}_${sIdx}_${epIdx}`
                            }))
                        }));

                        await sendInteractiveMessage(Gifted, from, {
                            text: `📺 *${title}*\n\n🔽 *පහතින් ඔබට අවශ්‍ය Season & Episode එක තෝරා ගන්න:*`,
                            footer: session.botFooter,
                            interactiveButtons: [{
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify({ title: '📺 Select Episode', sections })
                            }]
                        }, { quoted: ck });
                        await react("✅");
                    }

                    // B. Episode Qualities Fetching (Categories)
                    if (selectedButtonId.startsWith(`sstv_ep_${sessionId}_`)) {
                        const parts = selectedButtonId.split("_");
                        const sIdx = parseInt(parts[3]);
                        const epIdx = parseInt(parts[4]);

                        const session = sstvSearchSessions.get(sessionId);
                        if (isSessionExpired(session)) {
                            Gifted.ev.off("messages.upsert", sstvButtonHandler);
                            return Gifted.sendMessage(from, { text: "❌ ඔබ යොමු කල request එක expire විය. නැවත request කරන්න." }, { quoted: ck });
                        }

                        await react("⏳");
                        const epObj = session.tvData.seasons[sIdx].episodes[epIdx];
                        const epInfoUrl = `https://ck-sinhalasub-api-1a2b3c4d5e.vercel.app/api/epinfo?url=${encodeURIComponent(epObj.url)}`;
                        
                        const { data } = await axios.get(epInfoUrl);

                        if (!data.status || !data.result || !data.result.length) {
                            await react("❌");
                            return Gifted.sendMessage(from, { text: "❌ Failed to fetch episode quality links." }, { quoted: ck });
                        }

                        // Telegram links ඉවත් කිරීම
                        const filteredLinks = data.result.filter(item => 
                            item.host && !item.host.toLowerCase().includes("telegram") && !item.host.toLowerCase().includes("telagram")
                        );

                        if (filteredLinks.length === 0) {
                            await react("❌");
                            return Gifted.sendMessage(from, { text: "❌ No direct download links found for this episode." }, { quoted: ck });
                        }

                        const epSessionId = `${sessionId}_${sIdx}_${epIdx}`;
                        sstvEpisodeSessions.set(epSessionId, {
                            links: filteredLinks,
                            seriesTitle: session.tvData.title,
                            epName: epObj.name,
                            poster: session.tvData.image,
                            createdAt: Date.now()
                        });

                        setTimeout(() => { sstvEpisodeSessions.delete(epSessionId); }, SESSION_TIMEOUT);

                        // Category අනුව Group කිරීම (DLSERVER-01, DLSERVER-02, PIXELDRAIN)
                        const groupedByHost = {};
                        filteredLinks.forEach((item, index) => {
                            const hostName = item.host.toUpperCase();
                            if (!groupedByHost[hostName]) {
                                groupedByHost[hostName] = [];
                            }
                            groupedByHost[hostName].push({ ...item, originalIndex: index });
                        });

                        const sections = Object.keys(groupedByHost).map(host => ({
                            title: `🌐 Category: ${host}`,
                            rows: groupedByHost[host].map(link => ({
                                header: `🎞️ ${link.quality}`,
                                title: `${host} - ${link.quality}`,
                                description: `📦 Size: ${link.size || 'N/A'}`,
                                id: `sstv_dl_${epSessionId}_${link.originalIndex}`
                            }))
                        }));

                        await sendInteractiveMessage(Gifted, from, {
                            text: `📌 *${session.tvData.title}*\n📺 *${epObj.name.toUpperCase()}*\n\n🔽 *පහත Server Categories වලින් අවශ්‍ය Quality එක තෝරා ගන්න:*`,
                            footer: session.botFooter,
                            interactiveButtons: [{
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify({
                                    title: '🟢 Select Quality / Server',
                                    sections
                                })
                            }]
                        }, { quoted: ck });
                        await react("✅");
                    }

                    // C. Direct Download Link Generation & File Delivery
                    if (selectedButtonId.startsWith(`sstv_dl_${sessionId}_`)) {
                        const parts = selectedButtonId.split("_");
                        const epSessionId = `${parts[2]}_${parts[3]}_${parts[4]}`;
                        const linkIndex = parseInt(parts[5]);

                        const epSession = sstvEpisodeSessions.get(epSessionId);
                        if (isSessionExpired(epSession)) {
                            return Gifted.sendMessage(from, { text: "❌ ඔබ යොමු කල request එක expire විය. නැවත request කරන්න." }, { quoted: ck });
                        }

                        await react("⬇️");
                        const selectedLinkObj = epSession.links[linkIndex];

                        const dlApiUrl = `https://ck-sinhalasub-api-1a2b3c4d5e.vercel.app/api/dl?url=${encodeURIComponent(selectedLinkObj.url)}`;
                        const { data: dlData } = await axios.get(dlApiUrl);

                        if (!dlData.status || !dlData.result || !dlData.result.url) {
                            await react("❌");
                            return Gifted.sendMessage(from, { text: "❌ Download URL generation failed." }, { quoted: ck });
                        }

                        const finalDownloadUrl = processDirectDownloadUrl(dlData.result.url);

                        await react("⬆️");
                        const thumb = await createThumbnail(epSession.poster);
                        const fileName = `${dlData.result.name || epSession.seriesTitle}.mp4`;

                        await Gifted.sendMessage(from, {
                            document: { url: finalDownloadUrl },
                            mimetype: "video/mp4",
                            fileName: fileName,
                            jpegThumbnail: thumb,
                            caption: `🎬 *${epSession.seriesTitle}*\n📌 *${dlData.result.name || epSession.epName}*\n\n🎞️ \`Quality:\` *${dlData.result.quality || selectedLinkObj.quality}*\n📦 \`Size:\` *${selectedLinkObj.size || 'N/A'}*\n🌐 \`Server:\` *${selectedLinkObj.host}*\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
                        }, { quoted: ck });

                        await react("✅");
                    }

                } catch (err) {
                    console.error("SSTV Listener Error: ", err);
                }
            };

            Gifted.ev.on("messages.upsert", sstvButtonHandler);

            setTimeout(() => {
                Gifted.ev.off("messages.upsert", sstvButtonHandler);
                sstvSearchSessions.delete(sessionId);
            }, SESSION_TIMEOUT);

        } catch (err) {
            console.error(err);
            await react("❌");
            reply(`❌ Error: ${err.message || err}`);
        }
    }
);

