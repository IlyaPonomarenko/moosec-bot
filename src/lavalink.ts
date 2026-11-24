import type { Client } from "discord.js";
import { LavalinkManager } from "lavalink-client";
import { config } from "./config.js";

export function createLavalink(client: Client): LavalinkManager {
  const manager = new LavalinkManager({
    nodes: [
      {
        id: "main",
        host: config.lavalink.host,
        port: config.lavalink.port,
        authorization: config.lavalink.password,
        // Lavalink takes a while to boot and download plugins. Keep retrying.
        retryAmount: Number.MAX_SAFE_INTEGER,
        retryDelay: 5_000,
      },
    ],
    sendToShard: (guildId, payload) => {
      client.guilds.cache.get(guildId)?.shard?.send(payload);
    },
    client: { id: config.clientId, username: "MusicBot" },
    autoSkip: true,
    playerOptions: {
      // Plain searches go to YouTube Music: official audio, no video intros.
      defaultSearchPlatform: "ytmsearch",
      // Quality: volume stays at exactly 100 so Lavalink never rescales samples.
      volumeDecrementer: 1,
      applyVolumeAsFilter: false,
      onDisconnect: { autoReconnect: true, destroyPlayer: false },
      onEmptyQueue: { destroyAfterMs: 5 * 60_000 },
    },
    queueOptions: { maxPreviousTracks: 50 },
  });

  manager.nodeManager.on("connect", (node) => console.log(`[lavalink] node ${node.id} connected`));
  manager.nodeManager.on("disconnect", (node, reason) =>
    console.warn(`[lavalink] node ${node.id} disconnected`, reason),
  );
  manager.nodeManager.on("error", (node, error) =>
    console.error(`[lavalink] node ${node.id} error:`, error?.message ?? error),
  );

  manager.on("trackStart", (player, track) => {
    console.log(`[player] ${player.guildId} now playing: ${track?.info.title}`);
  });
  manager.on("trackError", (player, track, payload) => {
    console.error(`[player] track error on ${track?.info.title}:`, payload.exception?.message);
  });
  manager.on("trackStuck", (player, track) => {
    console.warn(`[player] track stuck: ${track?.info.title}`);
  });

  return manager;
}
