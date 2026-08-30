const config = require('../config');
const axios = require('axios');

// අලුත් API එක
const apilink = 'https://ck-puwath-api.vercel.app/api/news';

// ඉලක්කගත Newsletter JID එක
const targetJid = '120363410929082905@newsletter';

// මීට පෙර යවන ලද පුවත්වල URL හෝ Title ට්‍රැක් කර ඩබල් යැවීම වැළැක්වීමට
let lastProcessedNewsUrl = "";

// පුවත් පරීක්ෂා කර යවන අඛණ්ඩ ක්‍රියාවලිය (Background Job)
const startAutoNewsFetcher = (conn) => {
    const checkAndSendNews = async () => {
        try {
            const response = await axios.get(apilink);
            const data = response.data;

            // API එක සාර්ථකද සහ result එකක් තිබේදැයි පරීක්ෂා කිරීම
            if (!data || !data.status || !data.result) {
                console.error("API එකෙන් නිවැරදි දත්ත ලැබී නැත:", data);
                return;
            }

            const news = data.result;
            const currentNewsUrl = data.news_url; // පුවතේ මුල් ලින්ක් එක unique හැඳින්වීමක් ලෙස ගත හැක

            // මෙය අලුත් පුවතක් දැයි පරීක්ෂා කිරීම (පරණ පුවතම නැවත ඒම වැළැක්වීමට)
            if (currentNewsUrl && currentNewsUrl !== lastProcessedNewsUrl) {
                
                // බොට් මුල් වරට ඔන් වන අවස්ථාවේදී පැරණි පුවතක් එකවර ස්팸 වීම වැළැක්වීමට
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
> \`© 𝗖𝗛𝗘𝗧𝗛𝗠𝗜𝗡𝗔 𝗞𝗔𝗩𝗜𝗦𝗛𝗔𝗡 🇱🇰⚡\`
> *🪀 News Broadcast*
> ━━━━━━━━━━━━━━━━━━━━━
                `;

                if (news.image) {
                    await conn.sendMessage(targetJid, { 
                        image: { url: news.image }, 
                        caption: msg 
                    });
                } else {
                    await conn.sendMessage(targetJid, { 
                        text: msg 
                    });
                }

                console.log(`අලුත් පුවත ඔටෝ යැව්වා: ${news.title} -> ${targetJid}`);
            }
        } catch (e) {
            console.error('පුවත් ගැනීමේ දෝෂය:', e);
        }
    };

    // බොට් ආරම්භ වූ වහාම පළමු වතාවට API එක චෙක් කිරීම
    checkAndSendNews();

    // සෑම තත්පර 300කට වරක් (විනාඩි 5කට වරක්) API එක අලුත් පුවත් සඳහා පරික්ෂා කරයි
    setInterval(checkAndSendNews, 300 * 1000);
};

module.exports = {
    startAutoNewsFetcher
};

