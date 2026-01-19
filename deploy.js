require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { REST, Routes, SlashCommandBuilder } = require('discord.js');

// 환경변수에서 가져오기
const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

// 방어 코드 (안 있으면 또 헤맴)
if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('❌ 환경변수가 누락되었습니다 (.env 확인)');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('recruit')
    .setDescription('모집글 작성 버튼을 생성합니다')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log('슬래시 명령어 등록 중...');

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log('✅ 슬래시 명령어 등록 완료');
  } catch (error) {
    console.error(error);
  }
})();
