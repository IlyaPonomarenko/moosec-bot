# Discord Music Bot

Private music bot for one Discord server. TypeScript + discord.js v14, audio through Lavalink v4.

This is milestone 1: the bot joins voice and plays YouTube, YouTube Music and SoundCloud links or searches.

Commands: `/play`, `/pause`, `/resume`, `/skip`, `/nowplaying`, `/leave`

## 1. Create the Discord application

1. Go to https://discord.com/developers/applications and click **New Application**.
2. **General Information**: copy the **Application ID**. This is `CLIENT_ID`.
3. **Bot**: click **Reset Token**, copy it. This is `DISCORD_TOKEN`. Never commit it.
4. **Bot**: turn off **Public Bot** so only you can add it.
   No privileged intents are needed.
5. **OAuth2 > URL Generator**: tick scopes `bot` and `applications.commands`.
   Bot permissions: `View Channels`, `Send Messages`, `Embed Links`, `Connect`, `Speak`.
   Open the generated URL and add the bot to your server.
6. In Discord, turn on **Developer Mode** (User Settings > Advanced), right-click your server, **Copy Server ID**. This is `GUILD_ID`.

## 2. Set the voice channel bitrate

The server is boost level 1, so the cap is 128 kbps. Boosting does not raise existing channels.
Edit the music voice channel > Overview > Bitrate > drag to **128 kbps**.

## 3. Configure

```bash
cp .env.example .env               # fill in DISCORD_TOKEN, CLIENT_ID, GUILD_ID
openssl rand -hex 24               # paste as LAVALINK_PASSWORD in .env
cp lavalink.env.example lavalink.env
mkdir -p lavalink/plugins lavalink/logs data
sudo chown -R 322:322 lavalink/plugins lavalink/logs   # Lavalink's container user
sudo chown -R 1000:1000 data                           # the bot's container user
```

## 4. First start and YouTube sign-in

Create a **spare Google account** for the bot first. Do not use your own: YouTube can flag accounts used this way.

```bash
docker compose up -d --build
docker compose logs -f lavalink
```

Wait for a log line with `google.com/device` and a code. Open the URL, enter the code, and sign in with the spare account.
A few seconds later Lavalink logs a **refresh token**. Copy it into `lavalink.env`, uncomment both lines, then:

```bash
docker compose restart lavalink
```

From now on Lavalink signs in by itself.

## 5. Test

In Discord, join a voice channel and run:

- `/play never gonna give you up` (YouTube Music search)
- `/play https://www.youtube.com/watch?v=dQw4w9WgXcQ` (direct link)
- `/play <a YouTube playlist link>`
- `/play <a SoundCloud link>`

Bot logs: `docker compose logs -f bot`

## Local development (optional)

Run Lavalink in Docker and the bot on your machine with hot reload:

```bash
docker compose run -d -p 2333:2333 lavalink
npm install
npm run dev
```

## Audio quality settings

| Where | Setting | Why |
|---|---|---|
| Discord channel | Bitrate 128 kbps | The real ceiling at boost level 1 |
| `lavalink/application.yml` | `opusEncodingQuality: 10` | Best Opus encoder quality |
| `lavalink/application.yml` | `resamplingQuality: HIGH` | Default is LOW |
| `lavalink/application.yml` | `frameBufferDurationMs: 10000` | Rides out network hiccups |
| `src/lavalink.ts` | Volume fixed at 100, no filters | Avoids rescaling and re-encoding |
| `src/lavalink.ts` | Search via `ytmsearch` | Official audio uploads |

There is no volume command on purpose. Listeners right-click the bot in Discord to change its volume for themselves.

## When YouTube stops playing

YouTube changes things every few weeks and the plugin breaks. Symptoms: every track fails to load, or errors like "This video requires login".

1. Check https://github.com/lavalink-devs/youtube-source/releases for a newer version.
2. Update the version in `lavalink/application.yml`.
3. `docker compose restart lavalink`

If the refresh token stops working, comment out the two lines in `lavalink.env`, restart, and sign in again.

## Roadmap

1. **Skeleton (this)**
2. Queue in SQLite, back, `/queue` pages
3. Spotify via LavaSrc, large playlist imports
4. Now-playing panel with buttons
5. Queue and position survive restarts, idle pause and 5 min leave
6. Autoplay
7. VPS deploy
