const { gmd, commands, monospace, formatBytes } = require("../gift");
const { sendInteractiveMessage } = require('gifted-btns');
const getFBInfo = require("@xaviabot/fb-downloader");

gmd(
  {
    pattern: "ckfb",
    aliases: ["mainmenu", "mainmens"],
    description: "Display Bot's Uptime, Date, Time, and Other Stats",
    react: "📜",
    category: "general",
  },
  async (from, Gifted, conText) => {
    const {
      mek,
      sender,
      react,
      pushName,
      botPic,
      botMode,
      botVersion,
      botName,
      botFooter,
      timeZone,
      botPrefix,
      newsletterJid,
      reply,
      ownerNumber,
    } = conText;
    try {

  if (!q || !q.startsWith("https://")) {
    return Gifted.sendMessage(from, { text: "❌ Please provide a valid URL." }, { quoted: mek });
}

await Gifted.sendMessage(from, { react: { text: "💡", key: mek.key } });

const result = await getFBInfo(q);

    const captionHeader = `🧩 \`𝗖𝗞 𝗙𝗕 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥\` 🧩

🔖 \`TITLE:\` *${result.title}*
🔗 \`URL:\` *${q}*

🔢 \`ʀᴇᴘʟʏ ʙᴇʟᴏᴡ ᴄᴏᴍᴍᴀɴᴅ\`

\`fbsd\` *|* ❭❭◦ *SD QUALITY* 🪫
\`fbhd\` *|* ❭❭◦ *HD QUALITY* 🔋
\`fbad\` *|* ❭❭◦ *AUDIO* 🎶

> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*
`;

const sentMsg = await Gifted.sendMessage(from, {
  image: { url: result.thumbnail}, 
  caption: captionHeader
},
  { quoted: ck }
);
const messageID = sentMsg.key.id; // Save the message ID for later reference


// Listen for the user's response
conn.ev.on('messages.upsert', async (messageUpdate) => {
    const mek = messageUpdate.messages[0];
    if (!mek.message) return;
    
    // Get text from conversation, extended text, or context info if available
    const messageType = mek.message.conversation || mek.message.extendedTextMessage?.text || "";
    const cleanMessage = messageType.trim().toLowerCase(); // Normalize input
    
    const from = mek.key.remoteJid;

    // Check if the message is a reply to the previously sent message
    const isReplyToSentMsg = mek.message.extendedTextMessage && mek.message.extendedTextMessage.contextInfo.stanzaId === messageID;

    if (isReplyToSentMsg) {
        
        if (cleanMessage === 'fbsd') {
            if (!result.sd) return Gifted.sendMessage(from, { text: "❌ SD quality not available." }, { quoted: mek });
            
            await Gifted.sendMessage(from, { react: { text: '⬇️', key: mek.key } });
            await Gifted.sendMessage(from, { react: { text: '⬆️', key: mek.key } });
            
            await Gifted.sendMessage(from, {
              video: { url: result.sd}, 
              caption: "> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*",
            }, { quoted: ck });
            
            await Gifted.sendMessage(from, { react: { text: '✅', key: mek.key } });
        }

        else if (cleanMessage === 'fbhd') {
            if (!result.hd) return Gifted.sendMessage(from, { text: "❌ HD quality not available." }, { quoted: mek });
            
            await Gifted.sendMessage(from, { react: { text: '⬇️', key: mek.key } });
            await Gifted.sendMessage(from, { react: { text: '⬆️', key: mek.key } });
            
            await Gifted.sendMessage(from, {
              video: { url: result.hd}, 
              caption: "> 👨🏻‍💻 *ᴄʜᴇᴛʜ🏻ᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*",
            }, { quoted: ck });
            
            await Gifted.sendMessage(from, { react: { text: '✅', key: mek.key } });
        }
           
        else if (cleanMessage === 'fbad') {
            await Gifted.sendMessage(from, { react: { text: '⬇️', key: mek.key } });
            await Gifted.sendMessage(from, { react: { text: '⬆️', key: mek.key } });
            
            await Gifted.sendMessage(from, { 
              audio: { url: result.sd }, 
              mimetype: "audio/mpeg" 
            }, { quoted: ck });
            
            await Gifted.sendMessage(from, { react: { text: '✅', key: mek.key } });
        }
    }
  });
} catch (e) {
console.log(e);
reply(`${e}`);
}
})

const ck = {
    key: {
        fromMe: false,
        participant: "0@s.whatsapp.net",
        remoteJid: "status@broadcast"
    },
    message: {
        contactMessage: {
            displayName: "〴ᴄʜᴇᴛʜᴍɪɴᴀ ×͜×",
            vcard: `BEGIN:VCARD
VERSION:3.0
FN:Meta
ORG:META AI;
TEL;type=CELL;type=VOICE;waid=13135550002:+13135550002
END:VCARD`
        }
    }
};

