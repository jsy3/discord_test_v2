require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const FORUM_CHANNEL_ID = '1462720250704433336';
const VOICE_CATEGORY_ID = '1462740011387715615';

const TAGS = {
  trial: '1462732371433619665',
  newbie: '1462732385002197046',
  pve: '1462732410738311168',
  pvp: '1462732421563945004'
};

const cache = new Map();

/* ================= READY ================= */
client.once('ready', () => {
  console.log(`🤖 로그인 성공: ${client.user.tag}`);
});

/* ================= INTERACTION ================= */
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'recruit') {
    cache.set(interaction.user.id, {
      text: null,
      voice: true,
      limit: 0,
      tags: []
    });

    return interaction.reply({
      ephemeral: true,
      content: '👇 아래에 **모집글 내용을 채팅으로 입력**해주세요.',
      components: buildOptionButtons()
    });
  }
});

/* ================= MESSAGE INPUT ================= */
client.on('messageCreate', msg => {
  if (msg.author.bot) return;

  const data = cache.get(msg.author.id);
  if (!data || data.text) return;

  data.text = msg.content;

  msg.reply({
    content: '✅ 모집글 내용이 저장되었습니다.\n옵션을 선택 후 모집글을 생성하세요.',
    components: buildOptionButtons()
  });
});

/* ================= BUTTON ================= */
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const data = cache.get(interaction.user.id);
  if (!data) return;

  const id = interaction.customId;

  if (id === 'voice') data.voice = !data.voice;
  if (id === 'duo') data.limit = 2;
  if (id === 'trio') data.limit = 3;

  if (id.startsWith('tag_')) {
    const tag = id.replace('tag_', '');
    data.tags.includes(tag)
      ? data.tags.splice(data.tags.indexOf(tag), 1)
      : data.tags.push(tag);
  }

  if (id === 'confirm') {
    if (!data.text) {
      return interaction.reply({ content: '❗ 모집글 내용을 먼저 입력해주세요.', ephemeral: true });
    }

    const guild = interaction.guild;
    const forum = await guild.channels.fetch(FORUM_CHANNEL_ID);

    let voiceUrl = '';
    if (data.voice) {
      const vc = await guild.channels.create({
        name: `🎮 ${data.text.slice(0, 20)}`,
        type: ChannelType.GuildVoice,
        parent: VOICE_CATEGORY_ID,
        userLimit: data.limit
      });
      voiceUrl = `https://discord.com/channels/${guild.id}/${vc.id}`;
    }

    const thread = await forum.threads.create({
      name: `🎮 ${data.text.slice(0, 20)}`,
      appliedTags: data.tags.map(t => TAGS[t]),
      message: {
        content: `${data.text}\n${voiceUrl}`
      }
    });

    cache.delete(interaction.user.id);

    return interaction.reply({
      ephemeral: true,
      content: `✅ 모집글 생성 완료\n👉 ${thread.url}`
    });
  }

  return interaction.update({
    components: buildOptionButtons(data)
  });
});

/* ================= UI ================= */
function buildOptionButtons(data = {}) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('voice')
        .setLabel(data.voice === false ? '🔇 음성 OFF' : '🔊 음성 ON')
        .setStyle(data.voice === false ? ButtonStyle.Secondary : ButtonStyle.Primary),
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
      tagButton('trial', '시련', data),
      tagButton('newbie', '뉴비', data),
      tagButton('pve', 'PVE', data),
      tagButton('pvp', 'PVP', data)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm')
        .setLabel('✅ 모집글 생성')
        .setStyle(ButtonStyle.Success)
    )
  ];
}

function tagButton(id, label, data) {
  return new ButtonBuilder()
    .setCustomId(`tag_${id}`)
    .setLabel(label)
    .setStyle(data.tags?.includes(id) ? ButtonStyle.Primary : ButtonStyle.Secondary);
}

/* ================= LOGIN ================= */
client.login(process.env.DISCORD_TOKEN);
