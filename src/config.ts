import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}. See .env.example.`);
  return value;
}

export const config = {
  discordToken: required("DISCORD_TOKEN"),
  clientId: required("CLIENT_ID"),
  guildId: required("GUILD_ID"),
  lavalink: {
    host: process.env.LAVALINK_HOST ?? "localhost",
    port: Number(process.env.LAVALINK_PORT ?? 2333),
    password: required("LAVALINK_PASSWORD"),
  },
};
