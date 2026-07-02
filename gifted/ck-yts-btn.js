const { gmd } = require("../gift");
const yts = require("ytsearch-venom");
const axios = require("axios");
const { sendInteractiveMessage } = require('gifted-btns');

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

gmd(
    {
        pattern: "yt",
        category: "downloader",
        react: "📥",
        aliases: ["ytdl", "youtube"],
        description: "Search and download YouTube videos/audio",
    },
    async (from, Gifted, conText) => {
        const { q, reply, react, botFooter } = conText;

        const ck = {
            key: { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: "status@broadcast" },
            message: {
                contactMessage: {
                    displayName: "〴ᴄʜᴇᴛʜᴍɪɴᴀ ×͜×",
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:Meta\nORG:META AI;\nTEL;type=CELL;type=VOICE;waid=13135550002:+13135550002\nEND:VCARD`
                }
            }
        };

        if (!q) return await reply('🔎 *Please provide a song name or YouTube link!*');

        await react("⚡");

        try {
            const url = q.replace(/\?si=[^&]*/, '');
            const results = await yts(url);
            
            if (!results || !results.videos || results.videos.length === 0) {
                await react("❌");
                return reply("❌ No results found.");
            }

            const result = results.videos[0];
            const videoUrl = result.url;
            const dateNow = Date.now();

            let caption = `*🎶 \`𝗖𝗞 𝗬𝗧 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥\` 🎶*\n\n` +
                          `*☘️ Title :* *${result.title}*\n` +
                          `*👁️ Views :* *${result.views}*\n` +
                          `*⏰ Duration :* *${result.duration}*\n` +
                          `*💃 Url :* *${videoUrl}*\n\n` +
                          `> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`;

            // Image and Details
            await Gifted.sendMessage(from, {
                image: { url: result.thumbnail || "https://i.imgur.com/vE7vW6G.png" },
                caption: caption
            }, { quoted: ck });

            // Buttons Menu
            const buttonParams = {
                title: 'Select Quality',
                sections: [
                    {
                        title: '🎬 Video Download',
                        rows: [
                            { header: '1080p', title: 'Video 1080p', description: 'High Definition', id: `yt_mp4_1080p_${dateNow}` },
                            { header: '720p', title: 'Video 720p', description: 'Standard HD', id: `yt_mp4_720p_${dateNow}` },
                            { header: '480p', title: 'Video 480p', description: 'Medium Quality', id: `yt_mp4_480p_${dateNow}` },
                            { header: '360p', title: 'Video 360p', description: 'Low Quality', id: `yt_mp4_360p_${dateNow}` }
                        ]
                    },
                    {
                        title: '🎵 Audio Download',
                        rows: [
                            { header: '320kbps', title: 'Audio 320k', description: 'Highest Audio Quality', id: `yt_mp3_320k_${dateNow}` },
                            { header: '128kbps', title: 'Audio 128k', description: 'Standard Audio Quality', id: `yt_mp3_128k_${dateNow}` }
                        ]
                    }
                ]
            };

            await sendInteractiveMessage(Gifted, from, {
                text: '🔽 *Please select your preferred quality below:*',
                footer: botFooter,
                interactiveButtons: [
                    {
                        name: 'single_select',
                        buttonParamsJson: JSON.stringify(buttonParams)
                    }
                ]
            }, { quoted: ck });

            await react("✅");

            // Modified Button Handler (Non-blocking)
            const handleResponse = async (event) => {
                const messageData = event.messages[0];
                if (!messageData.message) return;

                const selectedButtonId = extractButtonId(messageData.message);
                if (!selectedButtonId || !selectedButtonId.includes(`_${dateNow}`)) return;

                const isFromSameChat = messageData.key?.remoteJid === from;
                if (!isFromSameChat) return;

                // 💡 බූට් එකක් නොවී, හැම බටන් ක්ලික් එකක්ම සැනින් ස්වාධීනව Run වෙන්න සෙට් කලා
                (async () => {
                    await react("⬇️");
                    try {
                        const parts = selectedButtonId.split("_");
                        const format = parts[1]; 
                        const quality = parts[2]; 

                        const apiUrl = `https://ck-yt-api.vercel.app/download?q=${encodeURIComponent(videoUrl)}&format=${format}&apikey=CHETHA06&quality=${quality}`;
                        
                        const apiResponse = await axios.get(apiUrl);
                        const downloadUrl = apiResponse.data?.download || apiResponse.data?.result?.download || apiResponse.data?.url;

                        if (!downloadUrl) {
                            await react("❌");
                            return reply("❌ Failed to fetch download link from API.", messageData);
                        }

                        await react("⬆️");

                        if (format === "mp3") {
                            await Gifted.sendMessage(from, {
                                audio: { url: downloadUrl },
                                mimetype: "audio/mpeg"
                            }, { quoted: ck });
                        } else {
                            await Gifted.sendMessage(from, {
                                video: { url: downloadUrl },
                                mimetype: "video/mp4",
                                caption: "> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*"
                            }, { quoted: ck });
                        }
                        await react("✅");
                    } catch (error) {
                        console.error("YT Download Error:", error);
                        await react("❌");
                        await reply("❌ Error processing your download.", messageData);
                    }
                })(); // IIFE Block (Non-blocking execution)
            };

            Gifted.ev.on("messages.upsert", handleResponse);
            setTimeout(() => Gifted.ev.off("messages.upsert", handleResponse), 300000);

        } catch (e) {
            console.error(e);
            await react("❌");
            reply(`❌ Error: ${e.message || e}`);
        }
    }
);

