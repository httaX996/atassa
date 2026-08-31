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
            console.error(errMsg, data);
            return;
        }

        const news = data.result;
        const currentNewsId = data.news_id;

        // Test Mode (.testnews දැමූ විට)
        if (isTest) {
            const msg = `
\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\`
*📰 \`${news.title || 'Not Found'}\` 📰* (TEST MODE)
\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\`

✍🏻 ${news.description || 'Not Found'}

📆 \`DATE:\` *${news.date || 'Not Found'}* | \`TIME:\` *${news.time || 'Not Found'}*
🔗 \`LINK:\` *${data.news_url || 'Not Found'}*

> ━━━━━━━━━━━━━━━━━━━━━
> \`© 𝗖𝗛𝗘𝗧𝗛𝗠𝗜𝗡𝗔 𝗞𝗔𝗩𝗜𝗦𝗛𝗔𝗡 🇱🇰⚡\`
> *🪀 News Broadcast*
> ━━━━━━━━━━━━━━━━━━━━━
            `;

            if (news.image) {
                await Gifted.sendMessage(targetJid, { 
                    image: { url: news.image }, 
                    caption: msg 
                });
            } else {
                await Gifted.sendMessage(targetJid, { 
                    text: msg 
                });
            }

            if (replyFunc) await replyFunc("✅ පුවත සාර්ථකව Test Newsletter වෙත යවන ලදී!");
            return;
        }

        // Auto Loop Process (বොට් ඔන් වූ වහාම හෝ විනාඩියෙන් විනාඩියට)
        if (lastProcessedNewsId === "") {
            lastProcessedNewsId = currentNewsId;

            const msg = `
\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\`
*📰 \`${news.title || 'Not Found'}\` 📰*
\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\`

✍🏻 ${news.description || 'Not Found'}

📆 \`DATE:\` *${news.date || 'Not Found'}* | \`TIME:\` *${news.time || 'Not Found'}*
🔗 \`LINK:\` *${data.news_url || 'Not Found'}*

> ━━━━━━━━━━━━━━━━━━━━━
> \`© 𝗖𝗛Ե𝗛𝗠𝗜𝗡𝗔 𝗞𝗔𝗩𝗜𝗦𝗛𝗔𝗡 🇱🇰⚡\`
> *🪀 News Broadcast*
> ━━━━━━━━━━━━━━━━━━━━━
            `;

            if (news.image) {
                await Gifted.sendMessage(targetJid, { 
                    image: { url: news.image }, 
                    caption: msg 
                });
            } else {
                await Gifted.sendMessage(targetJid, { 
                    text: msg 
                });
            }

            console.log(`🚀 Bot Restarted / Started: Initial news sent & ID saved: ${currentNewsId} -> ${targetJid}`);
            return;
        }

        if (currentNewsId !== lastProcessedNewsId) {
            lastProcessedNewsId = currentNewsId;

            const msg = `
\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\`
*📰 \`${news.title || 'Not Found'}\` 📰*
\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\`

✍🏻 ${news.description || 'Not Found'}

📆 \`DATE:\` *${news.date || 'Not Found'}* | \`TIME:\` *${news.time || 'Not Found'}*
🔗 \`LINK:\` *${data.news_url || 'Not Found'}*

> ━━━━━━━━━━━━━━━━━━━━━
> \`© 𝗖𝗛𝗘𝗧𝗛𝗠𝗜𝗡𝗔 𝗞𝗔𝗩𝗜𝗦𝗛𝗔𝗡 🇱🇰⚡\`
> *🪀 News Broadcast*
> ━━━━━━━━━━━━━━━━━━━━━
            `;

            if (news.image) {
                await Gifted.sendMessage(targetJid, { 
                    image: { url: news.image }, 
                    caption: msg 
                });
            } else {
                await Gifted.sendMessage(targetJid, { 
                    text: msg 
                });
            }

            console.log(`✨ New news detected and sent! ID: ${currentNewsId} -> ${targetJid}`);
        }

    } catch (e) {
        console.error('පුවත් ගැනීමේ දෝෂය:', e);
        if (isTest && replyFunc) replyFunc(`❌ දෝෂයක් ඇතිවිය: ${e.message}`);
    }
};

// Test Command එක
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

// බොට් ස්ටාර්ට් වූ වහාම ලූප් එක ක්‍රියාත්මක කරන ප්‍රධාන ෆන්ක්ෂන් එක
const startAutoNewsFetcher = (Gifted) => {
    console.log("🔄 Auto News Background Loop Started...");
    
    // බොට් ඔන් වූ වහාම පළමු වතාවට රන් වීම
    checkAndSendLatestNews(Gifted, false, null);

    // විනාඩියෙන් විනාඩියට ලූප් වීම
    setInterval(() => {
        checkAndSendLatestNews(Gifted, false, null);
    }, 60 * 1000);
};

// මෙන්න මේක අනිවාර්යයෙන්ම අවශ්‍යයි (Export කිරීම)
module.exports = {
    startAutoNewsFetcher
};
