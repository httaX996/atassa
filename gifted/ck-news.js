const config = require('../config');
const { gmd } = require('../gift');
const axios = require('axios');

const apilink = 'https://ck-puwath-api.vercel.app/api/news';
const targetJid = '120363410929082905@newsletter';

let lastProcessedNewsId = "";

const checkAndSendLatestNews = async (Gifted, isTest = false, replyFunc = null) => {
    try {
        const response = await axios.get(apilink);
        const data = response.data;

        if (!data || !data.status || !data.result || !Array.isArray(data.data)) {
            const errMsg = "API එකෙන් නිවැරදි දත්ත ලැබී නැත!";
            if (isTest && replyFunc) return replyFunc(errMsg);
            console.error(errMsg);
            return;
        }

        const newsList = data.data; // මෙහි දැන් නිව්ස් 5ක් අඩංගු වේ

        // Test Mode (.testnews) - පරීක්ෂා කිරීමට ළඟම ඇති පළමු නිව්ස් එක පෙන්වයි
        if (isTest) {
            const news = newsList[0].result;
            const msg = `
📰 \`${news.title || 'Not Found'}\`

✍🏻 ${news.description || 'Not Found'}

📆\`DATE:\` *${news.date || 'Not Found'}* | ⏰\`TIME:\` *${news.time || 'Not Found'}*
🔗\`LINK:\` *${data.news_url || 'Not Found'}*

> 🪀 *ꜰᴏʟʟᴏᴡ ᴜꜱ & ꜱᴛᴀʏ ᴛᴜɴᴇᴅ* 🪀
> *https://whatsapp.com/channel/0029Vb8VOcx4tRruYzpW682W*

> *© Sinhala News 24x7* 🇱🇰⚡
            `;

            try {
                if (news.image) {
                    await Gifted.sendMessage(targetJid, { image: { url: news.image }, caption: msg });
                } else {
                    await Gifted.sendMessage(targetJid, { text: msg });
                }
            } catch (sendErr) {
                console.log("Image send failed in test, sending text only:", sendErr.message);
                await Gifted.sendMessage(targetJid, { text: msg });
            }

            if (replyFunc) await replyFunc("✅ පුවත සාර්ථකව Test Newsletter වෙත යවන ලදී!");
            return;
        }

        // Auto Loop Process
        if (lastProcessedNewsId === "") {
            // බොට් ඔන් වූ පළමු වතාවට ලැයිස්තුවේ ඉහළින්ම ඇති අලුත්ම නිව්ස් එකේ ID එක ලොක් කර ගනී (ස්පෑම් වීම වැළැක්වීමට)
            lastProcessedNewsId = newsList[0].news_id;
            console.log(`🚀 Initial News ID Locked: ${lastProcessedNewsId}`);
            return;
        }

        // 1. lastProcessedNewsId එකට පසුව පැමිණ ඇති අලුත් නිව්ස් මොනවාදැයි සොයා ගැනීම
        let newItemsToSend = [];
        for (let item of newsList) {
            if (item.news_id === lastProcessedNewsId) {
                break; // කලින් යැවූ ID එක හමුවූ විට ලූපය නවත්වයි
            }
            newItemsToSend.push(item);
        }

        // API එකේ අනුපිළිවෙළ පරණ සිට අලුත් එකට හැරවීම සඳහා reverse කරයි (පැරණි නිව්ස් එක මුලින් යැවීමට)
        newItemsToSend.reverse();

        if (newItemsToSend.length > 0) {
            console.log(`✨ Found ${newItemsToSend.length} new news item(s) to send.`);

            for (let item of newItemsToSend) {
                const news = item.result;
                const currentNewsId = item.news_id;

                const msg = `
📰 \`${news.title || 'Not Found'}\`

✍🏻 ${news.description || 'Not Found'}

📆\`DATE:\` *${news.date || 'Not Found'}* | ⏰\`TIME:\` *${news.time || 'Not Found'}*
🔗\`LINK:\` *${data.news_url || 'Not Found'}*

> 🪀 *ꜰᴏʟʟᴏᴡ ᴜꜱ & ꜱᴛᴀʏ ᴛᴜɴᴇᴅ* 🪀
> *https://whatsapp.com/channel/0029Vb8VOcx4tRruYzpW682W*

> *© Sinhala News 24x7* 🇱🇰⚡
                `;

                let sentSuccessfully = false;

                try {
                    if (news.image) {
                        await Gifted.sendMessage(targetJid, { image: { url: news.image }, caption: msg });
                    } else {
                        await Gifted.sendMessage(targetJid, { text: msg });
                    }
                    sentSuccessfully = true;
                } catch (sendErr) {
                    console.error(`News send error for ID ${currentNewsId}:`, sendErr.message);
                    try {
                        await Gifted.sendMessage(targetJid, { text: msg });
                        sentSuccessfully = true;
                    } catch (e) {
                        console.log(`Retry failed for ID ${currentNewsId}`);
                    }
                }

                // මැසේජ් එක සාර්ථකව ගියා නම් පමණක් එම ID එක lastProcessedNewsId ලෙස සේව් කර ඉදිරියට යයි
                if (sentSuccessfully) {
                    lastProcessedNewsId = currentNewsId;
                    console.log(`✅ Successfully sent news ID: ${currentNewsId}`);
                    // WhatsApp එකට එකවර මැසේජ් වැඩිපුර ගොස් බ්ලොක් වීම වැළැක්වීමට තත්පර 3ක διάστημα (delay) එකක් තබයි
                    await new Promise(resolve => setTimeout(resolve, 3000));
                } else {
                    // යැවීම සම්පූර්ණයෙන්ම අසාර්ථක වුණොත් ලූපය නවතා ඊළඟ වාරයේදී නැවත උත්සාහ කරයි
                    break;
                }
            }
        } else {
            console.log(`⏳ No new news. All current IDs are already processed.`);
        }

    } catch (e) {
        console.error('පුවත් ගැනීමේ දෝෂය (API Error):', e.message);
        if (isTest && replyFunc) replyFunc(`❌ දෝෂයක් ඇතිවිය: ${e.message}`);
    }
};

gmd(
    {
        pattern: "testnews",
        category: "news",
        aliases: ["tnews"],
        description: "Test auto news sending to newsletter",
    },
    async (from, Gifted, conText) => {
        const { reply } = conText;
        try {
            await reply("🔄 පුවත පරීක්ෂා කරමින් පවතී...");
            await checkAndSendLatestNews(Gifted, true, reply);
        } catch (err) {
            console.error(err);
            reply(`❌ Error: ${err.message || err}`);
        }
    }
);

const startAutoNewsFetcher = (Gifted) => {
    console.log("🔄 Auto News Background Loop Started...");
    
    // බොට් ඔන් වූ වහාම API එකේ ඉහළින්ම ඇති ID එක සේව් කරගනී
    axios.get(apilink).then(res => {
        if (res.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
            lastProcessedNewsId = res.data.data[0].news_id;
            console.log(`🔒 Initial News ID set to: ${lastProcessedNewsId}`);
        }
    }).catch(err => console.log("Initial ID fetch error:", err.message));

    // විනාඩියෙන් විනාඩියට ලූප් වීම
    setInterval(() => {
        checkAndSendLatestNews(Gifted, false, null);
    }, 60 * 1000);
};

module.exports = {
    startAutoNewsFetcher
};
