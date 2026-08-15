const { gmd } = require("../gift");
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

// Fixed Thumbnail & Image converter function for WebP/JPG support
async function createThumbnail(url) {
    try {
        if (!url) return null;
        const response = await axios.get(url, { 
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });
        
        // Sharp මගින් WebP හෝ ඕනෑම format එකක් JPEG thumbnail එකක් බවට convert කරයි
        return await sharp(response.data)
            .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
    } catch (e) {
        console.log('Thumbnail Error:', e.message);
        return null;
    }
}

gmd(
    {
        pattern: "cartoon",
        category: "download",
        aliases: ["cartoons"],
        description: "Search cartoons with List/Buttons selection",
    },
    async (from, Gifted, conText) => {
        const { q, reply, react, botFooter } = conText;

        const safeFooter = (botFooter && typeof botFooter === 'string') ? botFooter : "👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ";

        try {
            if (!q) {
                await react("❌");
                return reply("🧸 Please provide a cartoon name.\n\nExample:\n.cartoon garfield");
            }

            await react("🧸");

            const dateNow = Date.now();

            // 1. Search Request
            const searchUrl = `https://ck-api-v1.vercel.app/movie/cartoon/search?q=${encodeURIComponent(q)}`;
            const { data: searchData } = await axios.get(searchUrl);

            // API Response Data Validation
            const resultsList = searchData?.data || searchData?.results;

            if (!searchData || !searchData.success || !resultsList || !resultsList.length) {
                await react("❌");
                return reply("❌ No cartoons found.");
            }

            const cartoonsSlice = resultsList.slice(0, 50);

            // 2. Build Interactive List Rows for Search Results
            const searchRows = cartoonsSlice.map((cartoon, index) => ({
                header: `Result ${index + 1}`,
                title: (cartoon.title || `Cartoon ${index + 1}`).substring(0, 24),
                description: `Click to view details & download`,
                id: `cartoon_dl_${index}_${dateNow}`
            }));

            const searchListParams = {
                title: '🎬 Select Cartoon Result',
                sections: [
                    {
                        title: `🔍 Search Results for: ${q}`,
                        rows: searchRows
                    }
                ]
            };

            // Session tracking Map
            const activeCartoonSessions = new Map();
            activeCartoonSessions.set(dateNow, { cartoonsSlice });

            await sendInteractiveMessage(Gifted, from, {
                text: `🔍 *𝗖𝗞 𝗖𝗔𝗥𝗧𝗢𝗢𝗡 𝗦𝗘𝗔𝗥𝗖𝗛*\n\nResults found for: *${q}*. Please select one below:`,
                footer: safeFooter,
                interactiveButtons: [
                    {
                        name: 'single_select',
                        buttonParamsJson: JSON.stringify(searchListParams)
                    }
                ]
            }, { quoted: ck });

            await react("✅");

            // 3. Cartoon Selection Listener (List Selection Listener)
            const cartoonSelectionListener = async (update) => {
                try {
                    const msg = update.messages[0];
                    if (!msg || !msg.message) return;

                    const selectedButtonId = extractButtonId(msg.message);
                    if (!selectedButtonId || !selectedButtonId.startsWith("cartoon_dl_")) return;
                    if (msg.key?.remoteJid !== from) return;

                    const parts = selectedButtonId.split("_");
                    const searchTimestamp = parseInt(parts[3]);
                    const cartoonIndex = parseInt(parts[2]);

                    const sessionData = activeCartoonSessions.get(searchTimestamp) || activeCartoonSessions.get(dateNow);
                    if (!sessionData || !sessionData.cartoonsSlice) return;

                    const selectedCartoon = sessionData.cartoonsSlice[cartoonIndex];
                    if (!selectedCartoon) return;

                    await react("⏳");

                    // Info Fetch
                    const infoUrl = `https://ck-api-v1.vercel.app/movie/cartoon/info?url=${encodeURIComponent(selectedCartoon.url)}`;
                    const { data: infoResponse } = await axios.get(infoUrl);

                    const cartoonInfo = infoResponse?.results || infoResponse?.data || infoResponse;

                    if (!cartoonInfo) {
                        await react("❌");
                        return reply("❌ Failed to fetch cartoon details.", msg);
                    }

                    let caption = `🎬 \`${cartoonInfo.title || selectedCartoon.title || "Cartoon"}\`\n\n`;
                    caption += `📅 \`YEAR:\` *${cartoonInfo.year || "N/A"}*\n`;
                    caption += `⭐ \`IMDB:\` *${cartoonInfo.imdb_rating || "N/A"}*\n`;
                    caption += `💿 \`QUALITY:\` *${cartoonInfo.quality || "N/A"}*\n\n`;
                    caption += `> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`;

                    const imgUrl = cartoonInfo.image || selectedCartoon.image || config.IMG_URL;

                    // WebP හෝ ඕනෑම image එකක් WhatsApp වලට සරලව යැවීමට buffer එකක් ලෙස convert කර යැවීම වඩාත් ආරක්ෂිතයි
                    if (imgUrl) {
                        try {
                            const imgResponse = await axios.get(imgUrl, { 
                                responseType: 'arraybuffer',
                                headers: { 'User-Agent': 'Mozilla/5.0' }
                            });
                            
                            // WebP එකක් වුණත් WhatsApp වෙත image එකක් ලෙස යැවීමට JPEG කර გაැවීම හෝ buffer එක යැවීම
                            const processedImage = await sharp(imgResponse.data)
                                .jpeg({ quality: 90 })
                                .toBuffer();

                            await Gifted.sendMessage(from, {
                                image: processedImage,
                                caption: caption
                            }, { quoted: ck });
                        } catch (imgErr) {
                            console.log('Image Send Error, falling back to URL:', imgErr.message);
                            await Gifted.sendMessage(from, {
                                image: { url: imgUrl },
                                caption: caption
                            }, { quoted: ck });
                        }
                    } else {
                        await Gifted.sendMessage(from, { text: caption }, { quoted: ck });
                    }

                    // Download Links Fetch
                    let cartoonLink = selectedCartoon.url;
                    if (cartoonInfo.links && cartoonInfo.links.length > 0) {
                        cartoonLink = cartoonInfo.links[0].url || cartoonInfo.links[0];
                    } else if (cartoonInfo.url) {
                        cartoonLink = cartoonInfo.url;
                    }

                    const dlUrl = `https://ck-api-v1.vercel.app/movie/cartoon/dl?url=${encodeURIComponent(cartoonLink)}`;
                    const { data: dlResponse } = await axios.get(dlUrl);

                    const dlData = dlResponse?.results || dlResponse?.data || dlResponse;

                    if (!dlData || !dlData.direct_links || !dlData.direct_links.length) {
                        await react("❌");
                        return reply("❌ Download links not found for this cartoon.", msg);
                    }

                    const directLinks = dlData.direct_links;
                    const dlDateNow = Date.now();

                    const linkRows = directLinks.map((linkObj, i) => ({
                        header: `Option ${i + 1}`,
                        title: (linkObj.name || `Link ${i + 1}`).substring(0, 24),
                        description: `Click to download file`,
                        id: `cartoon_link_${cartoonIndex}_${i}_${dlDateNow}`
                    }));

                    const linkButtonParams = {
                        title: '🟢 Select Cartoon / Episode',
                        sections: [
                            {
                                title: '📥 Available Download Links',
                                rows: linkRows
                            }
                        ]
                    };

                    activeCartoonSessions.set(dlDateNow, { cartoonInfo, directLinks });

                    await sendInteractiveMessage(Gifted, from, {
                        text: '🔽 *Please select your preferred cartoon file/episode below:*',
                        footer: safeFooter,
                        interactiveButtons: [
                            {
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify(linkButtonParams)
                            }
                        ]
                    }, { quoted: ck });

                    await react("✅");

                } catch (err) {
                    console.error(err);
                    await react("❌");
                }
            };

            // 4. Link Selection Listener
            const linkSelectionListener = async (update2) => {
                try {
                    const msg2 = update2.messages[0];
                    if (!msg2 || !msg2.message) return;

                    const selectedLinkId = extractButtonId(msg2.message);
                    if (!selectedLinkId || !selectedLinkId.startsWith("cartoon_link_")) return;
                    if (msg2.key?.remoteJid !== from) return;

                    const parts = selectedLinkId.split("_");
                    const dlTimestamp = parseInt(parts[4]);

                    if (!activeCartoonSessions.has(dlTimestamp)) return;
                    const session = activeCartoonSessions.get(dlTimestamp);

                    const linkIndex = parseInt(parts[3]);
                    const finalSelectedLink = session.directLinks[linkIndex];
                    const finalDownloadUrl = finalSelectedLink?.url || finalSelectedLink?.link;

                    if (!finalDownloadUrl) {
                        await react("❌");
                        return reply("❌ Download URL not found.", msg2);
                    }

                    await react("⬇️");

                    const thumb = session.cartoonInfo?.image ? await createThumbnail(session.cartoonInfo.image) : null;

                    await react("⬆️");

                    const docOptions = {
                        document: { url: finalDownloadUrl },
                        mimetype: "video/mp4",
                        fileName: `${finalSelectedLink.name || session.cartoonInfo.title || "Cartoon"}.mp4`,
                        caption: `🎬 \`${finalSelectedLink.name || session.cartoonInfo.title}\`\n\n> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*`
                    };

                    if (thumb) {
                        docOptions.jpegThumbnail = thumb;
                    }

                    await Gifted.sendMessage(from, docOptions, { quoted: ck });

                    await react("✅");

                } catch (err) {
                    console.error(err);
                    await react("❌");
                }
            };

            Gifted.ev.on("messages.upsert", cartoonSelectionListener);
            Gifted.ev.on("messages.upsert", linkSelectionListener);

            setTimeout(() => {
                Gifted.ev.off("messages.upsert", cartoonSelectionListener);
                Gifted.ev.off("messages.upsert", linkSelectionListener);
                activeCartoonSessions.clear();
            }, 600000);

        } catch (err) {
            console.error(err);
            await react("❌");
            reply(`❌ Error: ${err.message || err}`);
        }
    }
);
