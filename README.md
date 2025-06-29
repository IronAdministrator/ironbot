# IronBot - Discord Voice Time Tracker

A Discord bot that tracks voice channel time with detailed analytics and slash commands.

## Features

- 🎤 **Real-time Voice Tracking** - Automatically tracks when users join/leave voice channels
- 📊 **Flexible Time Periods** - View voice time for today, this week, this month, or overall
- 🎯 **Channel-Specific Stats** - Get voice time for specific channels
- ⏱️ **Current Session Tracking** - See live time for your current voice session
- 💾 **Persistent Storage** - SQLite database stores all voice session data

## Commands

### `/voicetime`
Main command with the following options:

**Period (Required):**
- `Current Session` - Shows live time in your current voice channel
- `Today` - Voice time for today
- `This Week` - Voice time for this week
- `This Month` - Voice time for this month  
- `Overall` - Total voice time ever

**Channel (Optional):**
- Select a specific voice channel to filter results
- Ignored for "Current Session" (shows helpful note)

**Examples:**
- `/voicetime period:Current Session` - Current session time
- `/voicetime period:Today` - Today's total across all channels
- `/voicetime period:Week channel:#Gaming` - This week's time in #Gaming only

### Text Commands
- `!debug` - Shows tracking status and database information
- `!hello` - Simple test command

## Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript
- **Database:** SQLite (Bun's built-in)
- **Discord Library:** Discord.js v14
- **Date Handling:** date-fns

## Setup

1. Clone the repository
2. Install dependencies: `bun install`
3. Create `.env` file with your bot credentials:
   ```env
   BOT_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   GUILD_ID=your_guild_id_here
   ```
4. Run the bot: `bun run start`

## Development

- `bun run dev` - Run with hot reload
- `bun run start` - Run in production mode

## Database Schema

The bot creates a SQLite database with the following table:

```sql
CREATE TABLE voice_records (
  user_id TEXT,
  guild_id TEXT,
  channel_id TEXT,
  start_ts INTEGER,
  end_ts INTEGER
);
```

## License

MIT License
