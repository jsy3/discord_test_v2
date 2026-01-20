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
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

/* ===============================
   Slash Command
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
   Ready
================================ */
client.once('ready', () => {
  console.log(`🤖 로그인 성공: ${client.user.tag}`);
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
      recruitCache.set(interaction.user.id, {
        step: 'WAIT_TEXT',
        text: '',
        voice: true,
        limit: 0,
        tags: new Set()
      });

      return interaction.reply({
        content: '✏️ **모집글 내용을 채팅으로 입력해주세요.**',
        ephemeral: true
      });
    }
  }

  /* ---------- 모집글 내용 입력 ---------- */
  if (interaction.isMessageCreate && interaction.author) return;
});

/* ===============================
   Message Create (모집글 입력)
================================ */
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const data = recruitCache.get(message.author.id);
  if (!data || data.step !== 'WAIT_TEXT') return;

  data.text = message.content;
  data.step = 'OPTIONS';

  await message.reply({
    content: '옵션을 선택해주세요.',
    components: buildOptionComponents(data)
  });
});

/* ===============================
   Button Interaction
================================ */
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const data = recruitCache.get(interaction.user.id);
  if (!data) return;

  const id = interaction.customId;

  /* 음성 토글 */
  if (id === 'voice_on') data.voice = true;
  if (id === 'voice_off') data.voice = false;

  /* 인원 */
  if (id === 'duo') data.limit = 2;
  if (id === 'trio') data.limit = 3;

  /* 태그 토글 */
  if (id.startsWith('tag_')) {
    const tag = id.replace('tag_', '');
    data.tags.has(tag) ? data.tags.delete(tag) : data.tags.add(tag);
  }

  /* 최종 생성 */
  if (id === 'confirm') {
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
      name: data.voice
        ? `🎮 ${data.text.slice(0, 20)}\n${voiceUrl}`
        : data.text.slice(0, 30),
      appliedTags: [...data.tags].map(t => FORUM_TAGS[t]),
      message: { content: data.text }
    });

    recruitCache.delete(interaction.user.id);

    return interaction.reply({
      content: `✅ 모집글 생성 완료\n👉 ${thread.url}`,
      ephemeral: true
    });
  }

  return interaction.update({
    components: buildOptionComponents(data)
  });
});

/* ===============================
   UI Builder
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
      ...['trial', 'newbie', 'pve', 'pvp'].map(t =>
        new ButtonBuilder()
          .setCustomId(`tag_${t}`)
          .setLabel(t.toUpperCase())
          .setStyle(data.tags.has(t) ? ButtonStyle.Primary : ButtonStyle.Secondary)
      )
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
   Login
================================ */
client.login(process.env.DISCORD_TOKEN);
