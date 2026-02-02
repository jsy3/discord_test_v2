/**
 * index.js
 * Node.js v24 / discord.js v14
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require('discord.js');

/* ===============================
   상수
================================ */
const FORUM_CHANNEL_ID = '1462720250704433336';
const VOICE_CATEGORY_ID = '1462740011387715615';
const ENTRY_CHANNEL_ID = '1462999658899968070';

const FORUM_TAGS = {
  trial: '1462732371433619665',
  newbie: '1462732385002197046',
  pve: '1462732410738311168',
  pvp: '1462732421563945004'
};

const recruitCache = new Map();

/* ===============================
   Client
================================ */
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

/* ===============================
   Slash Commands
================================ */
const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('봇 확인'),
  new SlashCommandBuilder().setName('recruit').setDescription('모집글 작성')
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );
})();

/* ===============================
   옵션 버튼 UI
================================ */
function buildOptionComponents(data) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('voice_on').setLabel('🔊 음성 ON').setStyle(data.voice ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('voice_off').setLabel('🔇 음성 OFF').setStyle(!data.voice ? ButtonStyle.Primary : ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('duo').setLabel('듀오').setStyle(data.limit === 2 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('trio').setLabel('트리오').setStyle(data.limit === 3 ? ButtonStyle.Primary : ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('tag_trial').setLabel('시련').setStyle(data.tags.includes('trial') ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('tag_newbie').setLabel('뉴비').setStyle(data.tags.includes('newbie') ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('tag_pve').setLabel('PVE').setStyle(data.tags.includes('pve') ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('tag_pvp').setLabel('PVP').setStyle(data.tags.includes('pvp') ? ButtonStyle.Primary : ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm').setLabel('✅ 모집글 생성').setStyle(ButtonStyle.Success)
    )
  ];
}

/* ===============================
   상시 모집 버튼 메시지
================================ */
async function sendRecruitEntryMessage() {
  const channel = await client.channels.fetch(ENTRY_CHANNEL_ID);
  if (!channel) return;

  const messages = await channel.messages.fetch({ limit: 10 });
  const exists = messages.some(
    m => m.author.id === client.user.id &&
    m.components.length > 0 &&
    m.components[0].components.some(c => c.customId === 'open_recruit_modal')
  );

  if (exists) return;

  await channel.send({
    content: '📝 **모집글을 작성하려면 아래 버튼을 눌러주세요**',
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('open_recruit_modal')
          .setLabel('➕ 모집글 작성')
          .setStyle(ButtonStyle.Primary)
      )
    ]
  });
}

/* ===============================
   Ready
================================ */
client.once('ready', async () => {
  console.log(`🤖 로그인 성공: ${client.user.tag}`);
  await sendRecruitEntryMessage();
});

/* ===============================
   Interaction
================================ */
client.on('interactionCreate', async interaction => {

  /* Slash */
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'ping') return interaction.reply('🏓 Pong!');

    if (interaction.commandName === 'recruit') {
      recruitCache.set(interaction.user.id, { voice: true, limit: 0, tags: [] });

      return interaction.reply({
        content: '옵션을 선택해주세요.',
        components: buildOptionComponents(recruitCache.get(interaction.user.id)),
        ephemeral: true
      });
    }
  }

  /* 모집 시작 버튼 */
  if (interaction.isButton() && interaction.customId === 'open_recruit_modal') {
    recruitCache.set(interaction.user.id, { voice: true, limit: 0, tags: [] });

    return interaction.reply({
      content: '옵션을 선택해주세요.',
      components: buildOptionComponents(recruitCache.get(interaction.user.id)),
      ephemeral: true
    });
  }

  /* 옵션 버튼 처리 */
  if (interaction.isButton()) {
    const data = recruitCache.get(interaction.user.id);
    if (!data) return;

    const id = interaction.customId;

    if (id === 'voice_on') data.voice = true;
    if (id === 'voice_off') data.voice = false;
    if (id === 'duo') data.limit = 2;
    if (id === 'trio') data.limit = 3;

    if (id.startsWith('tag_')) {
      const tag = id.replace('tag_', '');
      data.tags = data.tags.includes(tag) ? data.tags.filter(t => t !== tag) : [...data.tags, tag];
    }

    if (id !== 'confirm') {
      return interaction.update({
        content: '옵션을 선택해주세요.',
        components: buildOptionComponents(data)
      });
    }

    /* ===== 모집글 생성 ===== */
    const guild = interaction.guild;
    const forum = await guild.channels.fetch(FORUM_CHANNEL_ID);

    const voiceText = data.voice ? '음성ON' : '음성OFF';
    const partyText = data.limit === 2 ? '듀오' : data.limit === 3 ? '트리오' : '인원자유';
    const tagText = data.tags.length ? data.tags.map(t => t.toUpperCase()).join('/') : '일반';
    const title = `🎮 ${voiceText} · ${partyText} · ${tagText}`;

    let voiceUrl = '';
    if (data.voice) {
      const vc = await guild.channels.create({
        name: title.slice(0, 30),
        type: ChannelType.GuildVoice,
        parent: VOICE_CATEGORY_ID,
        userLimit: data.limit
      });
      voiceUrl = `https://discord.com/channels/${guild.id}/${vc.id}`;
    }

    const content =
`📌 모집 정보  
• 음성채널 : ${voiceUrl ? voiceUrl : '음성채널 없음'}  
• 파티형태 : ${partyText}  
• 목적태그 : ${tagText}`;

    const thread = await forum.threads.create({
      name: title,
      appliedTags: data.tags.map(t => FORUM_TAGS[t]),
      message: { content }
    });

    recruitCache.delete(interaction.user.id);

    return interaction.update({
      content: `✅ 모집글 생성 완료\n👉 ${thread.url}`,
      components: []
    });
  }
});

/* ===============================
   Login
================================ */
client.login(process.env.DISCORD_TOKEN);
