const config = require('../config');
const { gmd } = require('../gift');
const axios = require('axios');

// API LINK
const apilink = 'https://ck-puwath-api.vercel.app/api/news';

// ඉලක්කගත Newsletter JID එක
const targetJid = '120363410929082905@newsletter';

// මීට පෙර යවන ලද හෝ ලොක් කළ news_id එක ගබඩා කරගැනීමට
let lastProcessedNewsId = "";

// පුවත API එකෙන් ගෙනැවිත් යවන ප්‍රධාන කාර්යය (Core Function)
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

        // 1. .testnews කමාන්ඩ් එකෙන් ඇත්නම්
        if (isTest) {
            const msg = `
📰 \`${news.title || 'Not Found'}\`

✍🏻 ${news.description || 'Not Found'}

📆\`DATE:\` *${news.date || 'Not Found'}* | ⏰\`TIME:\` *${news.time || 'Not Found'}*
🔗\`LINK:\` *${data.news_url || 'Not Found'}*

> 🪀 *ꜰᴏʟʟᴏᴡ ᴜꜱ & ꜱᴛᴀʏ ᴛᴜɴᴇᴅ* 🪀
> *https://whatsapp.com/channel/0029Vb8VOcx4tRruYzpW682W*

> *_© Sinhala News 24x7_* 🇱🇰⚡
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

        // 2. ඔටෝ ලූප් ප්‍රොසෙස් එක (බොට් ස්ටාර්ට් වූ පසු හෝ විනාඩියෙන් විනාඩියට ක්‍රියාත්මක වේ)
        // බොට් ස්ටාර්ට් වූ පළමු වතාවට lastProcessedNewsId එක හිස්ව පවතින බැවින්, එම මොහොතේ API එකේ ඇති නිව්ස් එක යවා ID එක සේව් කරගනී.
        if (lastProcessedNewsId === "") {
            lastProcessedNewsId = currentNewsId;

            const msg = `
📰 \`${news.title || 'Not Found'}\`

✍🏻 ${news.description || 'Not Found'}

📆\`DATE:\` *${news.date || 'Not Found'}* | ⏰\`TIME:\` *${news.time || 'Not Found'}*
🔗\`LINK:\` *${data.news_url || 'Not Found'}*

> 🪀 *ꜰᴏʟʟᴏᴡ ᴜꜱ & ꜱᴛᴀʏ ᴛᴜɴᴇᴅ* 🪀
> *https://whatsapp.com/channel/0029Vb8VOcx4tRruYzpW682W*

> *_© Sinhala News 24x7_* 🇱🇰⚡
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

            console.log(`🚀 Bot Connected/Restarted: Initial news sent & ID saved: ${currentNewsId} -> ${targetJid}`);
            return;
        }

        // අලුත් news_id එකක් දැයි පරීක්ෂා කිරීම (කලින් යවපු එකම නම් යවන්නේ නැත)
        if (currentNewsId !== lastProcessedNewsId) {
            lastProcessedNewsId = currentNewsId; // අලුත් ID එක save කරගනී

            const msg = `
📰 \`${news.title || 'Not Found'}\`

✍🏻 ${news.description || 'Not Found'}

📆\`DATE:\` *${news.date || 'Not Found'}* | ⏰\`TIME:\` *${news.time || 'Not Found'}*
🔗\`LINK:\` *${data.news_url || 'Not Found'}*

> 🪀 *ꜰᴏʟʟᴏᴡ ᴜꜱ & ꜱᴛᴀʏ ᴛᴜɴᴇᴅ* 🪀
> *https://whatsapp.com/channel/0029Vb8VOcx4tRruYzpW682W*

> *_© Sinhala News 24x7_* 🇱🇰⚡
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
        } else {
            console.log(`⏳ No new news. Current ID (${currentNewsId}) is same as last sent.`);
        }

    } catch (e) {
        console.error('පුවත් ගැනීමේ දෝෂය:', e);
        if (isTest && replyFunc) replyFunc(`❌ දෝෂයක් ඇතිවිය: ${e.message}`);
    }
};

// .testnews කමාන්ඩ් එක (কোඩ් එක වැඩද බලාගන්න)
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

// බොට් ඔන් වූ සැණින් ක්‍රියාත්මක වන පසුබිම් ලූප් සිස්ටම් එක (Background Worker)
const startAutoNewsFetcher = (Gifted) => {
    console.log("🔄 Auto News Background Loop Started...");

    // 1. බොට් ස්ටාර්ට් වූ වහාම පළමු වතාවට රන් කර Current News එක යැවීම සහ ID එක සේව් කිරීම
    checkAndSendLatestNews(Gifted, false, null);

    // 2. හරියටම සෑම විනාඩියකට වරක් (මිලිතත්පර 60,000) API එකට රික්වෙස්ට් යවා ලූප් එක පවත්වා ගැනීම
    setInterval(() => {
        checkAndSendLatestNews(Gifted, false, null);
    }, 60 * 1000);
};

module.exports = {
    startAutoNewsFetcher
};
