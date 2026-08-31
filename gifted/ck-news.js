const config = require('../config');
const { gmd } = require('../gift');
const axios = require('axios');

// අලුත් API එක
const apilink = 'https://ck-puwath-api.vercel.app/api/news';

// ඉලක්කගත Newsletter JID එක
const targetJid = '120363410929082905@newsletter';

// ඩබල් යැවීම වැළැක්වීමට අලුත්ම news_id එක ට්‍රැක් කිරීම
let lastProcessedNewsId = "";

// 1. පුවත ගෙනැවිත් යවන පොදු ෆන්ක්ෂන් එක
const fetchAndSendNews = async (Gifted, isTest = false, replyFunc = null) => {
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
        const currentNewsId = data.news_id; // දැන් කෙලින්ම API එකෙන් එන ID එක පාවිච්චි කරයි[span_1](start_span)[span_1](end_span)

        // Test කමාන්ඩ් එකෙන් ඇත්නම්
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

        // සාමාන්‍ය ඔටෝ ප්‍රොසෙස් එක (ID එක වෙනස් වුණොත් පමණක් ක්‍රියාත්මක වේ)
        if (currentNewsId !== lastProcessedNewsId) {
            // බොට් මුල් වතාවට ස්ටාර්ට් වෙද්දී දැනට තියෙන නිව්ස් එක එකවර යැවීම වැළැක්වීමට ID එක ලොක් කරගනී
            if (lastProcessedNewsId === "") {
                lastProcessedNewsId = currentNewsId;
                console.log("📰 Auto News System Initialized. Latest News ID Locked:", currentNewsId);
                return;
            }

            lastProcessedNewsId = currentNewsId; // අලුත් ID එක සේව් කරගනී

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

            console.log(`අලුත් පුවත ඔටෝ යැව්වා: ${news.title} (ID: ${currentNewsId}) -> ${targetJid}`);
        }
    } catch (e) {
        console.error('පුවත් ගැනීමේ දෝෂය:', e);
        if (isTest && replyFunc) replyFunc(`❌ දෝෂයක් ඇතිවිය: ${e.message}`);
    }
};

// 2. `.testnews` සඳහා gmd කමාන්ඩ් එක
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
            await fetchAndSendNews(Gifted, true, reply);
        } catch (err) {
            console.error(err);
            reply(`❌ Error: ${err.message || err}`);
        }
    }
);

// 3. බොට් ස්ටාර්ට් වූ පසු පසුබිමින් ඔටෝ ක්‍රියාත්මක වන ප්‍රධාන කොටස (Background Worker)
const startAutoNewsFetcher = (Gifted) => {
    // බොට් ඔන් වන මොහොතේම දැනට තියෙන නිව්ස් එකේ ID එක ලබාගෙන ලොක් කර තබයි
    axios.get(apilink).then(res => {
        if (res.data && res.data.news_id) {
            lastProcessedNewsId = res.data.news_id;
            console.log("🔒 Initial News ID Locked for Auto News:", lastProcessedNewsId);
        }
    }).catch(() => {});

    // සෑම විනාඩි 5කට වරක් (තත්පර 300) API එක චෙක් කරයි
    setInterval(() => {
        fetchAndSendNews(Gifted, false, null);
    }, 300 * 1000);
};

module.exports = {
    startAutoNewsFetcher
};

