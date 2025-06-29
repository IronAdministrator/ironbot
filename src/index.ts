import {
  Client,
  GatewayIntentBits,
  TextChannel,
  User,
  Collection,
  ChatInputCommandInteraction,
} from "discord.js"
import { REST } from "@discordjs/rest"
import { Routes } from "discord-api-types/v10"
import { recordSession, getTotal } from "./db.js"
import * as voicetimeCommand from "./commands/voicetime.js"

// Define command interface
interface Command {
  data: {
    name: string
    toJSON(): any
  }
  execute(interaction: ChatInputCommandInteraction): Promise<void>
}

// Command collection
const commands = new Collection<string, Command>()
commands.set(voicetimeCommand.data.name, voicetimeCommand)

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
})

// Register slash commands
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN!)

  const commandsData = Array.from(commands.values()).map((command) =>
    command.data.toJSON()
  )

  try {
    console.log("Started refreshing application (/) commands.")

    // For guild-specific commands (faster deployment during development)
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(
          process.env.CLIENT_ID!,
          process.env.GUILD_ID
        ),
        { body: commandsData }
      )
      console.log("Successfully reloaded guild application (/) commands.")
    } else {
      // For global commands (takes up to 1 hour to deploy)
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
        body: commandsData,
      })
      console.log("Successfully reloaded global application (/) commands.")
    }
  } catch (error) {
    console.error("Error registering commands:", error)
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user?.tag}`)
  await registerCommands()

  // Track users already in voice channels when bot starts
  console.log("🔍 Checking for users already in voice channels...")
  client.guilds.cache.forEach((guild) => {
    guild.channels.cache
      .filter((channel) => channel.isVoiceBased())
      .forEach((channel) => {
        channel.members?.forEach((member) => {
          const key = `${guild.id}:${member.id}`
          const timestamp = Date.now()
          joinTimestamps.set(key, timestamp)
          userChannels.set(key, channel.id)
          console.log(
            `🎯 Found ${member.user.username} already in ${
              channel.name
            } - started tracking at ${new Date(timestamp).toLocaleTimeString()}`
          )
        })
      })
  })
})

// Handle slash command interactions
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  const command = commands.get(interaction.commandName)
  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`)
    return
  }

  try {
    await command.execute(interaction)
  } catch (error) {
    console.error("Error executing command:", error)
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this command!",
        ephemeral: true,
      })
    } else {
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      })
    }
  }
})

client.on("messageCreate", (message) => {
  if (message.content === "!hello") {
    message.reply("Hello!")
  } else if (message.content === "!debug") {
    const guildId = message.guildId!
    const userId = message.author.id
    const key = `${guildId}:${userId}`

    // Check current tracking status
    const isTracked = joinTimestamps.has(key)
    const trackingStartTime = joinTimestamps.get(key)

    // Get total from database
    const totalSeconds = getTotal(userId, guildId, 0)

    let debugInfo = `🔧 **Debug Info for ${message.author.username}:**\n`
    debugInfo += `• Currently being tracked: ${
      isTracked ? "✅ Yes" : "❌ No"
    }\n`
    if (trackingStartTime) {
      const currentDuration = Math.floor(
        (Date.now() - trackingStartTime) / 1000
      )
      debugInfo += `• Current session duration: ${currentDuration}s\n`
    }
    debugInfo += `• Total recorded time: ${Math.floor(
      totalSeconds / 3600
    )}h ${Math.floor((totalSeconds % 3600) / 60)}m ${Math.floor(
      totalSeconds % 60
    )}s\n`
    debugInfo += `• User ID: ${userId}\n`
    debugInfo += `• Guild ID: ${guildId}`

    message.reply(debugInfo)
  } else {
    console.log(message)
  }
})

export const joinTimestamps = new Map<string, number>() // key = `${guildId}:${userId}`
const userChannels = new Map<string, string>() // key = `${guildId}:${userId}`, value = channelId

client.on("voiceStateUpdate", (oldState, newState) => {
  const key = `${newState.guild.id}:${newState.id}`
  const username = newState.member?.user.username || "Unknown"

  console.log(`🎤 Voice update for ${username}:`, {
    oldChannel: oldState.channel?.name || null,
    newChannel: newState.channel?.name || null,
    userId: newState.id,
    guildId: newState.guild.id,
  })

  // User joined a channel
  if (!oldState.channel && newState.channel) {
    const timestamp = Date.now()
    joinTimestamps.set(key, timestamp)
    userChannels.set(key, newState.channel.id)
    console.log(
      `✅ ${username} joined ${newState.channel.name} at ${new Date(
        timestamp
      ).toLocaleTimeString()}`
    )
  }

  // User left a channel
  if (oldState.channel && !newState.channel) {
    const start = joinTimestamps.get(key)
    const channelId = userChannels.get(key)
    if (start && channelId) {
      const duration = Date.now() - start
      recordSession(
        newState.id,
        newState.guild.id,
        channelId,
        start,
        Date.now()
      )
      joinTimestamps.delete(key)
      userChannels.delete(key)
      console.log(
        `❌ ${username} left ${
          oldState.channel.name
        }, session duration: ${Math.floor(duration / 1000)}s`
      )
    }
  }

  // (Optional) Moving channels: treat as a leave & join
  if (
    oldState.channel &&
    newState.channel &&
    oldState.channel.id !== newState.channel.id
  ) {
    const start = joinTimestamps.get(key)
    const oldChannelId = userChannels.get(key)
    if (start && oldChannelId) {
      const duration = Date.now() - start
      recordSession(
        newState.id,
        newState.guild.id,
        oldChannelId,
        start,
        Date.now()
      )
      console.log(
        `🔄 ${username} moved from ${oldState.channel.name} to ${
          newState.channel.name
        }, previous session: ${Math.floor(duration / 1000)}s`
      )
    }
    joinTimestamps.set(key, Date.now())
    userChannels.set(key, newState.channel.id)
  }
})

// --- Start bot ---
client.login(process.env.BOT_TOKEN)
