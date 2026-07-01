const config = require('../config')
const { gmd, commands, monospace, formatBytes } = require("../gift");
const getFBInfo = require("@xaviabot/fb-downloader");
const { sendInteractiveMessage } = require('gifted-btns');


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
    return conn.sendMessage(from, { text: "❌ Please provide a valid URL." }, { quoted: mek });
}

await Gifted.sendMessage(from, { react: { text: "💡", key: mek.key } });

const result = await getFBInfo(q);

    const captionHeader = `🧩 \`𝗖𝗞 𝗙𝗕 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥\` 🧩

🔖 \`TITLE:\` *${result.title}*
🔗 \`URL:\` *${q}*

🔢 \`ʀᴇᴘʟʏ ʙᴇʟᴏᴡ ɴᴜᴍʙᴇʀ\`

\`1\` *|* ❭❭◦ *SD QULITY* 🪫
\`2\` *|* ❭❭◦ *HD QULITY* 🔋
\`3\` *|* ❭❭◦ *AUDIO* 🎶

> 👨🏻‍💻 ᴍᴀᴅᴇ ʙʏ *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*
`;

await sendButtons(Gifted, from, {
text: captionHeader,
  interactiveButtons: [
    // Single select picker (list inside a button)
    {
      name: 'single_select',
      buttonParamsJson: JSON.stringify({
        title: 'Pick One',
        sections: [
          {
            title: 'Video Download',
            rows: [
              { header: 'SD QUALITY', title: '', description: 'SD_QUALITY', id: 'opt_hello' },
              { header: 'HD QUALITY', title: '', description: 'HD_QUALITY', id: 'opt_bye' }
            ]
          },
          {
            title: 'Audio Download',
            rows: [
              { header: 'T', title: 'Testing', description: 'Just a test', id: 'opt_test' },
              { header: 'C', title: 'Cancel', description: 'Nevermind', id: 'opt_cancel' }
            ]
          }
        ]
      })
    }
  ]
});


const messageID = sentMsg.key.id; // Save the message ID for later reference


// Listen for the user's response
conn.ev.on('messages.upsert', async (messageUpdate) => {
    const mek = messageUpdate.messages[0];
    if (!mek.message) return;
    const messageType = mek.message.conversation || mek.message.extendedTextMessage?.text;
    const from = mek.key.remoteJid;
    const sender = mek.key.participant || mek.key.remoteJid;

    // Check if the message is a reply to the previously sent message
    const isReplyToSentMsg = mek.message.extendedTextMessage && mek.message.extendedTextMessage.contextInfo.stanzaId === messageID;

    if (isReplyToSentMsg) {
        // React to the user's reply (the "1" or "2" message)
        await conn.sendMessage(from, { react: { text: '⬇️', key: mek.key } });
        
        

        // React to the upload (sending the file)
        await Gifted.sendMessage(from, { react: { text: '⬆️', key: mek.key } });

        if (messageType === 'SD_QUALITY') {
            // Handle option 1 (sd File)
            await Gifted.sendMessage(from, {
              video: { url: result.sd}, // Ensure `img.allmenu` is a valid image URL or base64 encoded image
              caption: "> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*",
            },
                                   { quoted: ck }
              
            );
          }

          else if (messageType === 'HD_QUALITY') {
            // Handle option 2 (hd File)
            await Gifted.sendMessage(from, {
              video: { url: result.hd}, // Ensure `img.allmenu` is a valid image URL or base64 en",
              caption: "> 👨🏻‍💻 *ᴄʜᴇᴛʜᴍɪɴᴀ ᴋᴀᴠɪꜱʜᴀɴ*",
            },
                                   { quoted: ck }
            );
          }
           
          else if (messageType === '3') {
            //Handle option 3 (audio File)  
          await Gifted.sendMessage(from, { audio: { url: result.sd }, mimetype: "audio/mpeg" }, { quoted: ck })
          }
          
          
        // React to the successful completion of the task
        await Gifted.sendMessage(from, { react: { text: '✅', key: mek.key } });

        console.log("Response sent successfully");
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

