import { Database } from "bun:sqlite"

// Create database with proper error handling
const db = new Database("voiceTime.db", {
  strict: true,
  create: true,
})

// Enable WAL mode for better concurrent access
db.exec("PRAGMA journal_mode = WAL;")
db.exec("PRAGMA synchronous = NORMAL;")
db.exec("PRAGMA temp_store = memory;")
db.exec("PRAGMA mmap_size = 268435456;") // 256MB

// Create table if not exists
db.exec(`
CREATE TABLE IF NOT EXISTS voice_records (
  user_id TEXT,
  guild_id TEXT,
  channel_id TEXT,
  start_ts INTEGER,
  end_ts INTEGER
);
`)

// Add channel_id column if it doesn't exist (for existing databases)
try {
  db.exec("ALTER TABLE voice_records ADD COLUMN channel_id TEXT;")
} catch (error) {
  // Column already exists, ignore error
}

// Prepare statements once for better performance
const insertStmt = db.prepare(
  "INSERT INTO voice_records (user_id, guild_id, channel_id, start_ts, end_ts) VALUES (?, ?, ?, ?, ?)"
)

const selectStmt = db.prepare(`
  SELECT SUM(end_ts - start_ts) as total
  FROM voice_records
  WHERE user_id = ? AND guild_id = ? AND start_ts >= ?
`)

const selectByChannelStmt = db.prepare(`
  SELECT SUM(end_ts - start_ts) as total
  FROM voice_records
  WHERE user_id = ? AND guild_id = ? AND channel_id = ? AND start_ts >= ?
`)

export function recordSession(
  userId: string,
  guildId: string,
  channelId: string,
  start: number,
  end: number
) {
  try {
    insertStmt.run(userId, guildId, channelId, start, end)
    console.log(
      `💾 Recorded session for user ${userId} in channel ${channelId}: ${Math.floor(
        (end - start) / 1000
      )}s`
    )
  } catch (error) {
    console.error("❌ Error recording session:", error)
  }
}

export function getTotal(userId: string, guildId: string, fromTs: number) {
  try {
    const row = selectStmt.get(userId, guildId, fromTs) as {
      total: number | null
    }
    return (row.total ?? 0) / 1000 // return seconds
  } catch (error) {
    console.error("❌ Error getting total:", error)
    return 0
  }
}

export function getTotalByChannel(
  userId: string,
  guildId: string,
  channelId: string,
  fromTs: number
) {
  try {
    const row = selectByChannelStmt.get(userId, guildId, channelId, fromTs) as {
      total: number | null
    }
    return (row.total ?? 0) / 1000 // return seconds
  } catch (error) {
    console.error("❌ Error getting channel total:", error)
    return 0
  }
}
