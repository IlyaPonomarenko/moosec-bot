import {
  type ChatInputCommandInteraction,
  type GuildMember,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { LavalinkManager, Player } from "lavalink-client";

export const commandData = [
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song or playlist. Link (YouTube, SoundCloud) or search text.")
    .addStringOption((o) => o.setName("query").setDescription("Link or search").setRequired(true)),
  new SlashCommandBuilder().setName("pause").setDescription("Pause playback"),
  new SlashCommandBuilder().setName("resume").setDescription("Resume playback"),
  new SlashCommandBuilder().setName("skip").setDescription("Skip the current song"),
  new SlashCommandBuilder().setName("nowplaying").setDescription("Show the current song"),
  new SlashCommandBuilder().setName("leave").setDescription("Stop, clear the queue, and leave the voice channel"),
].map((c) => c.toJSON());

type Handler = (i: ChatInputCommandInteraction, lavalink: LavalinkManager) => Promise<void>;

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

async function replyError(i: ChatInputCommandInteraction, text: string) {
  if (i.deferred || i.replied) await i.editReply(text);
  else await i.reply({ content: text, flags: MessageFlags.Ephemeral });
}

/** Returns the player if the user is in the same voice channel as the bot. */
async function playerForMember(
  i: ChatInputCommandInteraction,
  lavalink: LavalinkManager,
): Promise<Player | null> {
  const player = lavalink.getPlayer(i.guildId!);
  if (!player) {
    await replyError(i, "Nothing is playing.");
    return null;
  }
  const member = i.member as GuildMember;
  if (member.voice.channelId !== player.voiceChannelId) {
    await replyError(i, "Join the bot's voice channel first.");
    return null;
  }
  return player;
}

const play: Handler = async (i, lavalink) => {
  const member = i.member as GuildMember;
  const voiceChannelId = member.voice.channelId;
  if (!voiceChannelId) return replyError(i, "Join a voice channel first.");

  await i.deferReply();
  const query = i.options.getString("query", true).trim();

  let player = lavalink.getPlayer(i.guildId!);
  if (player && player.voiceChannelId !== voiceChannelId) {
    return replyError(i, "I'm already playing in another channel.");
  }
  if (!player) {
    player = lavalink.createPlayer({
      guildId: i.guildId!,
      voiceChannelId,
      textChannelId: i.channelId,
      selfDeaf: true,
      volume: 100,
      // No filters are ever sent, so Lavalink can pass audio through untouched.
      instaUpdateFiltersFix: false,
    });
  }
  if (!player.connected) await player.connect();

  const isUrl = /^https?:\/\//i.test(query);
  const result = await player.search(isUrl ? { query } : { query, source: "ytmsearch" }, i.user);

  if (result.loadType === "error") {
    return replyError(i, `Could not load that: ${result.exception?.message ?? "unknown error"}`);
  }
  if (result.loadType === "empty" || result.tracks.length === 0) {
    return replyError(i, "No results.");
  }

  if (result.loadType === "playlist") {
    await player.queue.add(result.tracks);
    await i.editReply(
      `Added playlist **${result.playlist?.name ?? "Untitled"}** (${result.tracks.length} songs).`,
    );
  } else {
    const track = result.tracks[0];
    await player.queue.add(track);
    const position = player.playing || player.paused ? ` at position ${player.queue.tracks.length}` : "";
    await i.editReply(
      `Added **${track.info.title}** by ${track.info.author} (${formatDuration(track.info.duration ?? 0)})${position}.`,
    );
  }

  if (!player.playing && !player.paused) await player.play();
};

const pause: Handler = async (i, lavalink) => {
  const player = await playerForMember(i, lavalink);
  if (!player) return;
  if (player.paused) return replyError(i, "Already paused.");
  await player.pause();
  await i.reply("Paused.");
};

const resume: Handler = async (i, lavalink) => {
  const player = await playerForMember(i, lavalink);
  if (!player) return;
  if (!player.paused) return replyError(i, "Not paused.");
  await player.resume();
  await i.reply("Resumed.");
};

const skip: Handler = async (i, lavalink) => {
  const player = await playerForMember(i, lavalink);
  if (!player) return;
  const skipped = player.queue.current?.info.title ?? "the current song";
  if (player.queue.tracks.length === 0) {
    // Nothing next: stop playback but keep the bot in the channel.
    await player.stopPlaying(false, false);
  } else {
    await player.skip();
  }
  await i.reply(`Skipped **${skipped}**.`);
};

const nowplaying: Handler = async (i, lavalink) => {
  const player = lavalink.getPlayer(i.guildId!);
  const track = player?.queue.current;
  if (!player || !track) return replyError(i, "Nothing is playing.");
  await i.reply(
    `${player.paused ? "Paused" : "Playing"}: **${track.info.title}** by ${track.info.author}\n` +
      `${formatDuration(player.position)} / ${formatDuration(track.info.duration)}` +
      ` · ${player.queue.tracks.length} up next`,
  );
};

const leave: Handler = async (i, lavalink) => {
  const player = await playerForMember(i, lavalink);
  if (!player) return;
  await player.destroy("leave command");
  await i.reply("Left the channel and cleared the queue.");
};

export const handlers: Record<string, Handler> = { play, pause, resume, skip, nowplaying, leave };
