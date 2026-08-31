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

        if (!data || !data.status || !data.result || !data.news_id) {
            const errMsg = "API එකෙන් නිවැරදි දත්ත ලැබී නැත!";
            if (isTest && replyFunc) return replyFunc(errMsg);
            console.error(errMsg);
            return;
        }

        const news = data.result;
        const currentNewsId = data.news_id;

        // Test Mode (.testnews)
        if (isTest) {
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
            lastProcessedNewsId = currentNewsId;
            console.log(`🚀 Initial News ID Locked: ${currentNewsId}`);
            return; // බොට් ස්ටාර්ට් වූ වහාම පරණ නිව්ස් එක ස්පෑම් වීම වැළැක්වීමට ID එක පමණක් ලොක් කර ගනී.
        }

        if (currentNewsId !== lastProcessedNewsId) {
            lastProcessedNewsId = currentNewsId;

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
                console.log(`✨ New news detected and sent successfully! ID: ${currentNewsId} -> ${targetJid}`);
            } catch (sendErr) {
                console.error("News send error (Connection closed/Failed):", sendErr.message);
                // කනෙක්ෂන් ප්‍රශ්නයක් නිසා පින්තූරය සමඟ යැවීම ఫේල් වුණොත් ටෙක්ස්ට් එක විතරක් යවන්න ට්‍රයි කරයි
                try {
                    await Gifted.sendMessage(targetJid, { text: msg });
                } catch (e) {}
            }
        } else {
            console.log(`⏳ No new news. Current ID (${currentNewsId}) is same as last sent.`);
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
    
    // බොට් ඔන් වූ වහාම API එකේ දැනට ඇති ID එක සේව් කරගනී (ස්පෑම් වීම වැළැක්වීමට)
    axios.get(apilink).then(res => {
        if (res.data && res.data.news_id) {
            lastProcessedNewsId = res.data.news_id;
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

