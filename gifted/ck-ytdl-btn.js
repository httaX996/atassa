const { gmd } = require("../gift"); // බොට්ගේ structure එක අනුව වෙනස් කරගන්න[span_0](start_span)[span_0](end_span)
const yts = require("ytsearch-venom"); //[span_1](start_span)[span_1](end_span)
const axios = require("axios"); //[span_2](start_span)[span_2](end_span)
const { sendInteractiveMessage } = require('gifted-btns'); //[span_3](start_span)[span_3](end_span)

function extractButtonId(msg) { //[span_4](start_span)[span_4](end_span)
    if (!msg) return null; //[span_5](start_span)[span_5](end_span)
    if (msg.templateButtonReplyMessage?.selectedId) return msg.templateButtonReplyMessage.selectedId; //[span_6](start_span)[span_6](end_span)
    if (msg.buttonsResponseMessage?.selectedButtonId) return msg.buttonsResponseMessage.selectedButtonId; //[span_7](start_span)[span_7](end_span)
    if (msg.listResponseMessage?.singleSelectReply?.selectedRowId) return msg.listResponseMessage.singleSelectReply.selectedRowId; //[span_8](start_span)[span_8](end_span)
    if (msg.interactiveResponseMessage) { //[span_9](start_span)[span_9](end_span)
        const nf = msg.interactiveResponseMessage.nativeFlowResponseMessage; //[span_10](start_span)[span_10](end_span)
        if (nf?.paramsJson) { //[span_11](start_span)[span_11](end_span)
            try { const p = JSON.parse(nf.paramsJson); if (p.id) return p.id; } catch {} //[span_12](start_span)[span_12](end_span)
        } //[span_13](start_span)[span_13](end_span)
        return msg.interactiveResponseMessage.buttonId || null; //[span_14](start_span)[span_14](end_span)
    } //[span_15](start_span)[span_15](end_span)
    return null; //[span_16](start_span)[span_16](end_span)
} //[span_17](start_span)[span_17](end_span)

gmd( //[span_18](start_span)[span_18](end_span)
    {
        pattern: "yt",
        category: "downloader",
        react: "📥",
        aliases: ["ytdl", "youtube"],
        description: "Search and download YouTube videos/audio",
    },
    async (from, Gifted, conText) => {
        const { q, reply, react, botFooter } = conText; //[span_19](start_span)[span_19](end_span)

        // Custom Quoted Context (Fake Meta AI context)
        const ck = { //[span_20](start_span)[span_20](end_span)
            key: { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: "status@broadcast" }, //[span_21](start_span)[span_21](end_span)
            message: { //[span_22](start_span)[span_22](end_span)
                contactMessage: { //[span_23](start_span)[span_23](end_span)
                    displayName: "〴ᴄʜᴇᴛʜᴍɪɴᴀ ×͜×", //[span_24](start_span)[span_24](end_span)
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:Meta\nORG:META AI;\nTEL;type=CELL;type=VOICE;waid=13135550002:+13135550002\nEND:VCARD` //[span_25](start_span)[span_25](end_span)
                } //[span_26](start_span)[span_26](end_span)
            } //[span_27](start_span)[span_27](end_span)
        }; //[span_28](start_span)[span_28](end_span)

        if (!q) return await reply('🔎 *Please provide a song name or YouTube link!*'); //[span_29](start_span)[span_29](end_span)

        await react("⚡"); //[span_30](start_span)[span_30](end_span)

        try {
            // URL එක පිරිසිදු කිරීම[span_31](start_span)[span_31](end_span)
            const url = q.replace(/\?si=[^&]*/, ''); //[span_32](start_span)[span_32](end_span)
            const results = await yts(url); //[span_33](start_span)[span_33](end_span)
            
            if (!results || !results.videos || results.videos.length === 0) { //[span_34](start_span)[span_34](end_span)
                await react("❌"); //[span_35](start_span)[span_35](end_span)
                return reply("❌ No results found."); //[span_36](start_span)[span_36](end_span)
            }

            const result = results.videos[0]; //[span_37](start_span)[span_37](end_span)
            const videoUrl = result.url; //[span_38](start_span)[span_38](end_span)
            const dateNow = Date.now(); //[span_39](start_span)[span_39](end_span)

            let caption = `*🎶 \`𝗖𝗞 𝗬𝗧 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥\` 🎶*\n\n` + //[span_40](start_span)[span_40](end_span)
                          `*☘️ Title :* *${result.title}*\n` + //[span_41](start_span)[span_41](end_span)
                          `*👁️ Views :* *${result.views}*\n` + //[span_42](start_span)[span_42](end_span)
                          `*⏰ Duration :* *${result.duration}*\n` + //[span_43](start_span)[span_43](end_span)
                          `*💃 Url :* *${videoUrl}*\n\n` +//[span_44](start_span)[span_44](end_span)
                          `> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`;
 
            // 1. මුලින්ම Image එකයි Details ටිකයි සෙන්ඩ් කරනවා[span_45](start_span)[span_45](end_span)
            await Gifted.sendMessage(from, {
                image: { url: result.thumbnail || "https://i.imgur.com/vE7vW6G.png" },
                caption: caption
            }, { quoted: ck });

            // Interactive Buttons Setup
            const buttonParams = { //[span_46](start_span)[span_46](end_span)
                title: 'Select Quality', //[span_47](start_span)[span_47](end_span)
                sections: [ //[span_48](start_span)[span_48](end_span)
                    {
                        title: '🎬 Video Download', //[span_49](start_span)[span_49](end_span)
                        rows: [ //[span_50](start_span)[span_50](end_span)
                            { header: '1080p', title: 'Video 1080p', description: 'High Definition', id: `yt_mp4_1080p_${dateNow}` }, //[span_51](start_span)[span_51](end_span)
                            { header: '720p', title: 'Video 720p', description: 'Standard HD', id: `yt_mp4_720p_${dateNow}` }, //[span_52](start_span)[span_52](end_span)
                            { header: '480p', title: 'Video 480p', description: 'Medium Quality', id: `yt_mp4_480p_${dateNow}` }, //[span_53](start_span)[span_53](end_span)
                            { header: '360p', title: 'Video 360p', description: 'Low Quality', id: `yt_mp4_360p_${dateNow}` } //[span_54](start_span)[span_54](end_span)
                        ]
                    },
                    {
                        title: '🎵 Audio Download', //[span_55](start_span)[span_55](end_span)
                        rows: [ //[span_56](start_span)[span_56](end_span)
                            { header: '320kbps', title: 'Audio 320k', description: 'Highest Audio Quality', id: `yt_mp3_320k_${dateNow}` }, //[span_57](start_span)[span_57](end_span)
                            { header: '128kbps', title: 'Audio 128k', description: 'Standard Audio Quality', id: `yt_mp3_128k_${dateNow}` } //[span_58](start_span)[span_58](end_span)
                        ]
                    }
                ]
            }; //[span_59](start_span)[span_59](end_span)

            // 2. ඊට පස්සේ වෙනම මැසේජ් එකක් විදියට Buttons ටික විතරක් සෙන්ඩ් කරනවා
            await sendInteractiveMessage(Gifted, from, {
                text: '🔽 *Please select your preferred quality below:*',
                footer: botFooter, //[span_60](start_span)[span_60](end_span)
                interactiveButtons: [ //[span_61](start_span)[span_61](end_span)
                    {
                        name: 'single_select', //[span_62](start_span)[span_62](end_span)
                        buttonParamsJson: JSON.stringify(buttonParams) //[span_63](start_span)[span_63](end_span)
                    }
                ]
            }, { quoted: ck }); //[span_64](start_span)[span_64](end_span)

            await react("✅"); //[span_65](start_span)[span_65](end_span)

            // Response Button Handler
            const handleResponse = async (event) => { //[span_66](start_span)[span_66](end_span)
                const messageData = event.messages[0]; //[span_67](start_span)[span_67](end_span)
                if (!messageData.message) return; //[span_68](start_span)[span_68](end_span)

                const selectedButtonId = extractButtonId(messageData.message); //[span_69](start_span)[span_69](end_span)
                if (!selectedButtonId || !selectedButtonId.includes(`_${dateNow}`)) return; //[span_70](start_span)[span_70](end_span)

                const isFromSameChat = messageData.key?.remoteJid === from; //[span_71](start_span)[span_71](end_span)
                if (!isFromSameChat) return; //[span_72](start_span)[span_72](end_span)

                // 💡 බටන් එක ක්ලික් කරාට Gifted.ev.off කරන්නේ නෑ! 
                // ඒ නිසා විනාඩි 5 යනකම් යූසර්ට ඕනෑම බටන් එකක් ආයෙ ආයෙත් ක්ලික් කරන්න පුළුවන්.

                await react("⬇️"); //[span_73](start_span)[span_73](end_span)

                try {
                    const parts = selectedButtonId.split("_"); //[span_74](start_span)[span_74](end_span)
                    const format = parts[1]; // mp3 හෝ mp4[span_75](start_span)[span_75](end_span)
                    const quality = parts[2]; // quality එක[span_76](start_span)[span_76](end_span)

                    const apiUrl = `https://ck-yt-api.vercel.app/download?q=${encodeURIComponent(videoUrl)}&format=${format}&apikey=CHETHA06&quality=${quality}`; //[span_77](start_span)[span_77](end_span)
                    
                    const apiResponse = await axios.get(apiUrl); //[span_78](start_span)[span_78](end_span)
                    const downloadUrl = apiResponse.data?.download || apiResponse.data?.result?.download || apiResponse.data?.url; //[span_79](start_span)[span_79](end_span)

                    if (!downloadUrl) { //[span_80](start_span)[span_80](end_span)
                        await react("❌"); //[span_81](start_span)[span_81](end_span)
                        return reply("❌ Failed to fetch download link from API.", messageData); //[span_82](start_span)[span_82](end_span)
                    }

                    await react("⬆️"); //[span_83](start_span)[span_83](end_span)

                    if (format === "mp3") { //[span_84](start_span)[span_84](end_span)
                        await Gifted.sendMessage(from, { //[span_85](start_span)[span_85](end_span)
                            audio: { url: downloadUrl }, //[span_86](start_span)[span_86](end_span)
                            mimetype: "audio/mpeg" //[span_87](start_span)[span_87](end_span)
                        }, { quoted: ck }); //[span_88](start_span)[span_88](end_span)
                    } else {
                        await Gifted.sendMessage(from, { //[span_89](start_span)[span_89](end_span)
                            video: { url: downloadUrl }, //[span_90](start_span)[span_90](end_span)
                            mimetype: "video/mp4", //[span_91](start_span)[span_91](end_span)
                            caption: "> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*" //[span_92](start_span)[span_92](end_span)
                        }, { quoted: ck }); //[span_93](start_span)[span_93](end_span)
                    }

                    await react("✅"); //[span_94](start_span)[span_94](end_span)
                } catch (error) { //[span_95](start_span)[span_95](end_span)
                    console.error("YT Download Error:", error); //[span_96](start_span)[span_96](end_span)
                    await react("❌"); //[span_97](start_span)[span_97](end_span)
                    await reply("❌ Error processing your download. Please try again.", messageData); //[span_98](start_span)[span_98](end_span)
                }
            };

            // Listener එක active කරලා තියනවා විනාඩි 5කට. විනාඩි 5න් පස්සේ සම්පූර්ණයෙන්ම වසා දමයි.[span_99](start_span)[span_99](end_span)
            Gifted.ev.on("messages.upsert", handleResponse); //[span_100](start_span)[span_100](end_span)
            setTimeout(() => Gifted.ev.off("messages.upsert", handleResponse), 300000); //[span_101](start_span)[span_101](end_span)

        } catch (e) { //[span_102](start_span)[span_102](end_span)
            console.error(e); //[span_103](start_span)[span_103](end_span)
            await react("❌"); //[span_104](start_span)[span_104](end_span)
            reply(`❌ Error: ${e.message || e}`); //[span_105](start_span)[span_105](end_span)
        }
    }
);
