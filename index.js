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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType
} = require('discord.js');

/* ===============================
   상수
================================ */
const FORUM_CHANNEL_ID = '1462720250704433336';
const VOICE_CATEGORY_ID = '1462740011387715615';
const ENTRY_CHANNEL_ID = '1462720250704433336'; // 모집 버튼 상시 노출 채널

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
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

/* ===============================
   Slash Command (선택사항)
================================ */
const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('봇 확인'),
  new SlashCommandBuilder().setName('recruit').setDescription('모집글 작성')
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands }
  );
})();

/* ===============================
   UI 빌더
================================ */
function buildOptionComponents(data) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('voice_on')
        .setLabel('🔊 음성 ON')
        .setStyle(data.voice ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('voice_off')
        .setLabel('🔇 음성 OFF')
        .setStyle(!data.voice ? ButtonStyle.Primary : ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('duo')
        .setLabel('듀오')
        .setStyle(data.limit === 2 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('trio')
        .setLabel('트리오')
        .setStyle(data.limit === 3 ? ButtonStyle.Primary : ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('tag_trial')
        .setLabel('시련')
        .setStyle(data.tags.includes('trial') ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('tag_newbie')
        .setLabel('뉴비')
        .setStyle(data.tags.includes('newbie') ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('tag_pve')
        .setLabel('PVE')
        .setStyle(data.tags.includes('pve') ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('tag_pvp')
        .setLabel('PVP')
        .setStyle(data.tags.includes('pvp') ? ButtonStyle.Primary : ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm')
        .setLabel('✅ 모집글 생성')
        .setStyle(ButtonStyle.Success)
    )
  ];
}

/* ===============================
   상시 모집 버튼 생성
================================ */
async function sendRecruitEntryMessage() {
  const channel = await client.channels.fetch(ENTRY_CHANNEL_ID);
  if (!channel) return;

  const messages = await channel.messages.fetch({ limit: 10 });
  const exists = messages.some(
    m =>
      m.author.id === client.user.id &&
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
  await sendRecruitEntryMessage(); // ✅ 항상 버튼 생성
});

/* ===============================
   Interaction
================================ */
client.on('interactionCreate', async interaction => {

  /* ---------- Slash ---------- */
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'ping') {
      return interaction.reply('🏓 Pong!');
    }

    if (interaction.commandName === 'recruit') {
      return interaction.reply({
        content: '모집글을 작성해주세요.',
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('open_recruit_modal')
              .setLabel('모집글 작성')
              .setStyle(ButtonStyle.Primary)
          )
        ],
        ephemeral: true
      });
    }
  }

  /* ---------- Modal Open ---------- */
  if (interaction.isButton() && interaction.customId === 'open_recruit_modal') {
    const modal = new ModalBuilder()
      .setCustomId('recruit_modal')
      .setTitle('모집글 작성');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('recruit_text')
          .setLabel('모집글 내용')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  /* ---------- Modal Submit ---------- */
  if (interaction.isModalSubmit() && interaction.customId === 'recruit_modal') {
    const text = interaction.fields.getTextInputValue('recruit_text');

    recruitCache.set(interaction.user.id, {
      text,
      voice: true,
      limit: 0,
      tags: []
    });

    return interaction.reply({
      content: '옵션을 선택해주세요.',
      components: buildOptionComponents(recruitCache.get(interaction.user.id)),
      ephemeral: true
    });
  }

  /* ---------- Option Buttons ---------- */
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
      data.tags = data.tags.includes(tag)
        ? data.tags.filter(t => t !== tag)
        : [...data.tags, tag];
    }

    if (id !== 'confirm') {
      return interaction.update({
        content: '옵션을 선택해주세요.',
        components: buildOptionComponents(data)
      });
    }

    /* ---------- 최종 생성 ---------- */
    const guild = interaction.guild;
    const forum = await guild.channels.fetch(FORUM_CHANNEL_ID);

    let voiceUrl = '';
    if (data.voice) {
      const vc = await guild.channels.create({
        name: `🎮 ${data.text.slice(0, 30)}`,
        type: ChannelType.GuildVoice,
        parent: VOICE_CATEGORY_ID,
        userLimit: data.limit
      });

      voiceUrl = `https://discord.com/channels/${guild.id}/${vc.id}`;
    }

    const thread = await forum.threads.create({
      name: `🎮 ${data.text.slice(0, 30)}`,
      appliedTags: data.tags.map(t => FORUM_TAGS[t]),
      message: {
        content: `${data.text}${voiceUrl ? `\n🔊 ${voiceUrl}` : ''}`
      }
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
