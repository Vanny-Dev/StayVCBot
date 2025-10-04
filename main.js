const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const dotenv = require('dotenv');
const express = require('express');

// Load environment variables from .env file
dotenv.config();

// Bot configurations - Array of bot configs
const botConfigs = [
  {
    token: process.env.BOT_TOKEN_1,
    guildId: process.env.GUILD_ID,
    channelId: process.env.CHANNEL_ID_1,
    name: 'Wahuhu Bot'
  },
  {
    token: process.env.BOT_TOKEN_2,
    guildId: process.env.GUILD_ID,
    channelId: process.env.CHANNEL_ID_2,
    name: 'Dev Bot'
  },
  // Add more bots as needed
].filter(config => config.token); // Only keep configs with tokens

// Store bot instances
const botInstances = [];

// Function to create and setup a bot
function createBot(config) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  // Function to join voice channel for this bot
  function joinVC() {
    try {
      const guild = client.guilds.cache.get(config.guildId);
      if (!guild) {
        console.error(`❌ [${config.name}] Guild not found!`);
        return;
      }

      const channel = guild.channels.cache.get(config.channelId);
      if (!channel) {
        console.error(`❌ [${config.name}] Voice channel not found!`);
        return;
      }

      if (channel.type !== 2) { // 2 = GUILD_VOICE
        console.error(`❌ [${config.name}] Channel is not a voice channel!`);
        return;
      }

      // Join the voice channel
      const connection = joinVoiceChannel({
        channelId: config.channelId,
        guildId: config.guildId,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: true
      });

      console.log(`🎤 [${config.name}] Joined voice channel: ${channel.name}`);

      // Handle connection state changes
      connection.on('stateChange', (oldState, newState) => {
        console.log(`[${config.name}] Connection state: ${oldState.status} -> ${newState.status}`);
      });

      // Handle disconnection
      connection.on('error', (error) => {
        console.error(`❌ [${config.name}] Connection error:`, error);
        setTimeout(() => joinVC(), 5000);
      });

    } catch (error) {
      console.error(`❌ [${config.name}] Error joining voice channel:`, error);
    }
  }

  // When the bot is ready
  client.once('ready', () => {
    console.log(`✅ [${config.name}] Ready! Logged in as ${client.user.tag}`);
    joinVC();
  });

  // Handle messages (optional - for manual control)
  client.on('messageCreate', (message) => {
    if (message.author.bot) return;

    // Command to join VC
    if (message.content.toLowerCase() === '!join') {
      joinVC();
      message.reply(`[${config.name}] Joining voice channel...`);
    }

    // Command to leave VC
    if (message.content.toLowerCase() === '!leave') {
      const connection = getVoiceConnection(config.guildId);
      if (connection) {
        connection.destroy();
        message.reply(`[${config.name}] Left voice channel!`);
        console.log(`👋 [${config.name}] Left voice channel`);
      } else {
        message.reply(`[${config.name}] Not in a voice channel!`);
      }
    }
  });

  // Handle bot disconnection from voice
  client.on('voiceStateUpdate', (oldState, newState) => {
    if (oldState.member?.id === client.user.id && !newState.channelId) {
      console.log(`⚠️ [${config.name}] Disconnected from voice. Rejoining in 5 seconds...`);
      setTimeout(() => joinVC(), 5000);
    }
  });

  // Login to Discord
  client.login(config.token).catch(error => {
    console.error(`❌ [${config.name}] Failed to login:`, error);
  });

  return { client, config, joinVC };
}

// Initialize all bots
console.log(`🚀 Starting ${botConfigs.length} bot(s)...`);
botConfigs.forEach(config => {
  const botInstance = createBot(config);
  botInstances.push(botInstance);
});

// ------------------ Express Web Server ------------------ //
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  const status = botInstances.map(bot => ({
    name: bot.config.name,
    ready: bot.client.isReady(),
    user: bot.client.user?.tag || 'Not logged in',
    guildId: bot.config.guildId,
    channelId: bot.config.channelId
  }));

  res.json({
    message: "✅ Multi-bot Discord system is running!",
    bots: status,
    totalBots: botInstances.length
  });
});

// Endpoint to check specific bot status
app.get("/bot/:index", (req, res) => {
  const index = parseInt(req.params.index);
  if (index < 0 || index >= botInstances.length) {
    return res.status(404).json({ error: "Bot not found" });
  }

  const bot = botInstances[index];
  const connection = getVoiceConnection(bot.config.guildId);

  res.json({
    name: bot.config.name,
    ready: bot.client.isReady(),
    user: bot.client.user?.tag,
    guildId: bot.config.guildId,
    channelId: bot.config.channelId,
    voiceConnected: !!connection,
    voiceState: connection?.state?.status || 'disconnected'
  });
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});
