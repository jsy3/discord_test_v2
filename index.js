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
  ChannelType,
  StringSelectMenuBuilder
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
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('voice_on').setLabel('🔊 음성 ON').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('voice_off').setLabel('🔇 음성 OFF').setStyle(ButtonStyle.Secondary)
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('duo').setLabel('듀오').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('trio').setLabel('트리오').setStyle(ButtonStyle.Primary)
        ),
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('forum_tags')
            .setPlaceholder('태그 선택')
            .setMinValues(0)
            .setMaxValues(4)
            .addOptions(
              { label: '시련', value: 'trial' },
              { label: '뉴비', value: 'newbie' },
              { label: 'PVE', value: 'pve' },
              { label: 'PVP', value: 'pvp' }
            )
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('confirm').setLabel('✅ 모집글 생성').setStyle(ButtonStyle.Success)
        )
      ],
      ephemeral: true
    });
  }

  /* ---------- 태그 선택 ---------- */
  if (interaction.isStringSelectMenu() && interaction.customId === 'forum_tags') {
    const data = recruitCache.get(interaction.user.id);
    if (!data) return;
    data.tags = interaction.values;
    return interaction.deferUpdate();
  }

  /* ---------- 옵션 버튼 ---------- */
  if (interaction.isButton()) {
    const data = recruitCache.get(interaction.user.id);
    if (!data) return;

    if (interaction.customId === 'voice_on') data.voice = true;
    if (interaction.customId === 'voice_off') data.voice = false;
    if (interaction.customId === 'duo') data.limit = 2;
    if (interaction.customId === 'trio') data.limit = 3;

    if (interaction.customId !== 'confirm') {
      return interaction.deferUpdate();
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
      name: data.voice
        ? `🎮 ${data.text.slice(0, 20)}\n${voiceUrl}`
        : data.text.slice(0, 30),
      appliedTags: data.tags.map(t => FORUM_TAGS[t]),
      message: {
        content: data.text
      }
    });

    recruitCache.delete(interaction.user.id);

    return interaction.reply({
      content: `✅ 모집글 생성 완료\n👉 ${thread.url}`,
      ephemeral: true
    });
  }
});

/* ===============================
   Login
================================ */
client.login(process.env.DISCORD_TOKEN);
