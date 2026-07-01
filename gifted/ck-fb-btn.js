const {
        gmd,
        gitRepoRegex,
        MAX_MEDIA_SIZE,
        getFileSize,
        getMimeCategory,
        getMimeFromUrl,
    } = require("../gift"),
    GIFTED_DLS = require("gifted-dls"),
    giftedDls = new GIFTED_DLS(),
    axios = require("axios"),
    { sendButtons } = require("gifted-btns");

function extractButtonId(msg) {
    if (!msg) return null;
    if (msg.templateButtonReplyMessage?.selectedId)
        return msg.templateButtonReplyMessage.selectedId;
    if (msg.buttonsResponseMessage?.selectedButtonId)
        return msg.buttonsResponseMessage.selectedButtonId;
    if (msg.listResponseMessage?.singleSelectReply?.selectedRowId)
        return msg.listResponseMessage.singleSelectReply.selectedRowId;
    if (msg.interactiveResponseMessage) {
        const nf = msg.interactiveResponseMessage.nativeFlowResponseMessage;
        if (nf?.paramsJson) {
            try { const p = JSON.parse(nf.paramsJson); if (p.id) return p.id; } catch {}
        }
        return msg.interactiveResponseMessage.buttonId || null;
    }
    return null;
}
const { sendInteractiveMessage } = require('gifted-btns');

const getFBInfo = require("@xaviabot/fb-downloader");

gmd(
    {
        pattern: "fb",
        category: "downloader",
        react: "🧩",
        aliases: ["fbdl", "facebookdl", "facebook"],
        description: "Download Facebook videos using xaviabot package",
    },
    async (from, Gifted, conText) => {
        const {
            q,
            reply,
            react,
            botName,
            botFooter,
            gmdBuffer,
            toAudio,
        } = conText;

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

        if (!q || (!q.includes("facebook.com") && !q.includes("fb.watch"))) {
            await react("❌");
            return reply("❌ Please provide a valid Facebook URL.");
        }

        await react("💡");

        try {
            // Fetching via @xaviabot/fb-downloader package
            const result = await getFBInfo(q);

            if (!result || (!result.sd && !result.hd)) {
                await react("❌");
                return reply("Failed to fetch video. Please check the URL and try again.");
            }

            const dateNow = Date.now();

            // Set up Interactive Buttons based on package results
            const buttons = [];
            if (result.sd) buttons.push({ id: `fb_sd_${dateNow}`, text: "SD QUALITY 🪫" });
            if (result.hd) buttons.push({ id: `fb_hd_${dateNow}`, text: "HD QUALITY 🔋" });
            buttons.push({ id: `fb_audio_${dateNow}`, text: "AUDIO 🎶" });

            const captionHeader = `🧩 \`𝗖𝗞 𝗙𝗕 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥\` 🧩\n\n` +
                                  `🔖 \`TITLE:\` *${result.title || "Facebook Video"}*\n` +
                                  `🔗 \`URL:\` *${q}*\n`;

            await sendButtons(Gifted, from, {
                title: `${botName} FACEBOOK DOWNLOADER`,
                text: captionHeader,
                footer: botFooter,
                image: { url: result.thumbnail || "https://i.imgur.com/vE7vW6G.png" },
                buttons: buttons,
            }, { quoted: ck });

            // Button Click Handler
            const handleResponse = async (event) => {
                const messageData = event.messages[0];
                if (!messageData.message) return;

                const selectedButtonId = extractButtonId(messageData.message);
                if (!selectedButtonId || !selectedButtonId.includes(`_${dateNow}`)) return;

                const isFromSameChat = messageData.key?.remoteJid === from;
                if (!isFromSameChat) return;

                await react("⬇️");

                try {
                    if (selectedButtonId.startsWith("fb_audio")) {
                        const sourceVideo = result.sd || result.hd;
                        if (!sourceVideo) {
                            await react("❌");
                            return reply("No video available for audio extraction.", messageData);
                        }

                        // Downloading video buffer to convert it to audio
                        const videoBuffer = await gmdBuffer(sourceVideo);
                        if (!videoBuffer || videoBuffer instanceof Error || !Buffer.isBuffer(videoBuffer)) {
                            await react("❌");
                            return reply("Failed to download video for audio extraction.", messageData);
                        }

                        let audioBuffer;
                        try {
                            audioBuffer = await toAudio(videoBuffer);
                        } catch (audioErr) {
                            await react("❌");
                            return reply("Failed to convert video to audio.", messageData);
                        }

                        await react("⬆️");
                        await Gifted.sendMessage(
                            from,
                            {
                                audio: audioBuffer,
                                mimetype: "audio/mpeg",
                            },
                            { quoted: ck }
                        );
                    } else {
                        const selectedVideoUrl = selectedButtonId.startsWith("fb_hd") ? result.hd : result.sd;

                        if (!selectedVideoUrl) {
                            await react("❌");
                            return reply("Selected quality not available.", messageData);
                        }

                        await react("⬆️");
                        await Gifted.sendMessage(
                            from,
                            {
                                video: { url: selectedVideoUrl },
                                mimetype: "video/mp4",
                                caption: "> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*",
                            },
                            { quoted: ck }
                        );
                    }

                    await react("✅");
                } catch (error) {
                    console.error("Download Error:", error);
                    await react("❌");
                    await reply("Failed to download. Please try again.", messageData);
                }
            };

            Gifted.ev.on("messages.upsert", handleResponse);
            setTimeout(() => Gifted.ev.off("messages.upsert", handleResponse), 300000);

        } catch (e) {
            console.error(e);
            await react("❌");
            reply(`${e}`);
        }
    }
);
