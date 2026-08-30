const config = require('../config');
const { gmd } = require('../gift'); // ගිෆ්ට් ස්ට්‍රක්චර් එක
const axios = require('axios');

// අලුත් API එක
const apilink = 'https://ck-puwath-api.vercel.app/api/news';

// ඉලක්කගත Newsletter JID එක
const targetJid = '120363410929082905@newsletter';

// මීට පෙර යවන ලද පුවත්වල URL ට්‍රැක් කර ඩබල් යැවීම වැළැක්වීමට
let lastProcessedNewsUrl = "";

// 1. පුවත ගෙනැවිත් යවන පොදු ෆන්ක්ෂන් එක
const fetchAndSendNews = async (Gifted, isTest = false, replyFunc = null) => {
    try {
        const response = await axios.get(apilink);
        const data = response.data;

        if (!data || !data.status || !data.result) {
            const errMsg = "API එකෙන් නිවැරදි දත්ත ලැබී නැත!";
            if (isTest && replyFunc) return replyFunc(errMsg);
            console.error(errMsg, data);
            return;
        }

        const news = data.result;
        const currentNewsUrl = data.news_url;

        // Test කමාන්ඩ් එකෙන් ඇත්නම් දැන් තියෙන නිව්ස් එක යවයි
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

        // සාමාන්‍ය ඔටෝ ප්‍රොසෙස් එක සඳහා
        if (currentNewsUrl && currentNewsUrl !== lastProcessedNewsUrl) {
            if (lastProcessedNewsUrl === "") {
                lastProcessedNewsUrl = currentNewsUrl;
                console.log("📰 Auto News System Initialized. Current latest news locked:", news.title);
                return;
            }

            lastProcessedNewsUrl = currentNewsUrl;

            const msg = `
\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\`
*📰 \`${news.title || 'Not Found'}\` 📰*
\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\`

✍🏻 ${news.description || 'Not Found'}

📆 \`DATE:\` *${news.date || 'Not Found'}* | \`TIME:\` *${news.time || 'Not Found'}*
🔗 \`LINK:\` *${data.news_url || 'Not Found'}*

> ━━━━━━━━━━━━━━━━━━━━━
> \`© 𝗖𝗛𝗘𝗧𝗛𝗠𝗜𝗡𝗔 𝗞𝗔𝗩𝗜ꜱ𝗛𝗔𝗡 🇱🇰⚡\`
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

            console.log(`අලුත් පුවත ඔටෝ යැව්වා: ${news.title} -> ${targetJid}`);
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
        const { reply, isOwner } = conText;

        try {
            // අවශ්‍ය නම් පමණක් isOwner චෙක් කරන්න (අවශ්‍ය නැත්නම් මෙම ලයින් එක ඉවත් කළ හැක)
            // if (!isOwner) return reply("❌ Owner only command!");

            await reply("🔄 පුවත පරීක්ෂා කරමින් පවතී...");
            await fetchAndSendNews(Gifted, true, reply);

        } catch (err) {
            console.error(err);
            reply(`❌ Error: ${err.message || err}`);
        }
    }
);

// 3. බොට් ස්ටාර්ට් වූ පසු පසුබිමින් ඔටෝ ක්‍රියාත්මක වන ප්‍රධාන කොටස (Background Worker)
// මෙය බාහිරින් Gifted bot එකට connect කිරීමට module.exports ලෙස ලබා දේ
const startAutoNewsFetcher = (Gifted) => {
    // මුල් වතාවට ලෝඩ් වූ විට දැනට තියෙන නිව්ස් එකේ URL එක ලොක් කරගැනීම (පැරණි ඒවා ස්팸 වීම වැළැක්වීමට)
    axios.get(apilink).then(res => {
        if (res.data && res.data.news_url) {
            lastProcessedNewsUrl = res.data.news_url;
        }
    }).catch(() => {});

    // සෑම විනාඩි 5කට වරක් (තත්පර 300) ඔටෝ චෙක් කරයි
    setInterval(() => {
        fetchAndSendNews(Gifted, false, null);
    }, 300 * 1000);
};

module.exports = {
    startAutoNewsFetcher
};
