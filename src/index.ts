import { Client, Events, GatewayIntentBits, MessageFlags, REST, Routes } from "discord.js";
import { commandData, handlers } from "./commands.js";
import { config } from "./config.js";
import { createLavalink } from "./lavalink.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});
const lavalink = createLavalink(client);

// Lavalink needs Discord's raw voice events to join voice channels.
client.on("raw", (d) => lavalink.sendRawData(d));

client.once(Events.ClientReady, async (c) => {
  console.log(`[discord] logged in as ${c.user.tag}`);

  // Guild commands update instantly. Fine for a single private server.
  const rest = new REST().setToken(config.discordToken);
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commandData });
  console.log(`[discord] registered ${commandData.length} slash commands`);

  await lavalink.init({ id: c.user.id, username: c.user.username });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || !interaction.inGuild()) return;
  const handler = handlers[interaction.commandName];
  if (!handler) return;

  if (!lavalink.useable) {
    await interaction.reply({
      content: "The audio server is still starting. Try again in a few seconds.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await handler(interaction, lavalink);
  } catch (err) {
    console.error(`[command] /${interaction.commandName} failed:`, err);
    const content = "Something went wrong. Check the bot logs.";
    if (interaction.deferred || interaction.replied) await interaction.editReply(content).catch(() => {});
    else await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    console.log(`[process] ${signal}, shutting down`);
    await client.destroy();
    process.exit(0);
  });
}

client.login(config.discordToken);
