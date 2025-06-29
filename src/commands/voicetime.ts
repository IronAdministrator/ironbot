import { SlashCommandBuilder } from "@discordjs/builders"
import { ChatInputCommandInteraction, ChannelType } from "discord.js"
import { getTotal, getTotalByChannel } from "../db.js"
import { joinTimestamps } from "../index.js"
import { startOfDay, startOfWeek, startOfMonth } from "date-fns"

export const data = new SlashCommandBuilder()
  .setName("voicetime")
  .setDescription("See your voice channel time")
  .addStringOption((opt) =>
    opt
      .setName("period")
      .setDescription("Which period to view")
      .setRequired(true)
      .addChoices(
        { name: "Current Session", value: "current" },
        { name: "Today", value: "today" },
        { name: "This Week", value: "week" },
        { name: "This Month", value: "month" },
        { name: "Overall", value: "all" }
      )
  )
  .addChannelOption((opt) =>
    opt
      .setName("channel")
      .setDescription(
        "Specific voice channel to check (ignored for Current Session)"
      )
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildVoice)
  )

export async function execute(interaction: ChatInputCommandInteraction) {
  const period = interaction.options.getString("period", true)
  const channel = interaction.options.getChannel("channel")
  const guildId = interaction.guildId!
  const userId = interaction.user.id

  // Handle current session separately (ignore channel option for current session)
  if (period === "current") {
    const key = `${guildId}:${userId}`
    const sessionStart = joinTimestamps.get(key)

    if (!sessionStart) {
      await interaction.reply({
        content:
          "❌ You're not currently in a voice channel or not being tracked.",
        flags: 64, // MessageFlags.Ephemeral
      })
      return
    }

    // Get the current channel name for display
    const member = await interaction.guild?.members
      .fetch(userId)
      .catch(() => null)
    const currentChannel = member?.voice.channel
    const channelName = currentChannel?.name || "Unknown Channel"

    const currentSessionSeconds = Math.floor((Date.now() - sessionStart) / 1000)
    const hours = Math.floor(currentSessionSeconds / 3600)
    const minutes = Math.floor((currentSessionSeconds % 3600) / 60)
    const secs = currentSessionSeconds % 60

    // Add a note if they tried to specify a channel for current session
    let response = `🎤 **Current Voice Session in #${channelName}**: ${hours}h ${minutes}m ${secs}s`
    if (channel) {
      response += `\n\n💡 *Note: Channel selection is ignored for "Current Session" - it shows your current active channel.*`
    }

    await interaction.reply(response)
    return
  }

  // Handle historical periods
  let from: number
  switch (period) {
    case "today":
      from = startOfDay(new Date()).getTime()
      break
    case "week":
      from = startOfWeek(new Date(), { weekStartsOn: 1 }).getTime()
      break
    case "month":
      from = startOfMonth(new Date()).getTime()
      break
    default:
      from = 0
  }

  // If a specific channel is selected, get time for that channel
  let seconds: number
  let responsePrefix: string

  if (channel) {
    seconds = getTotalByChannel(userId, guildId, channel.id, from)
    responsePrefix = `🎤 **Voice Time in #${channel.name} (${period})**`
  } else {
    seconds = getTotal(userId, guildId, from)
    responsePrefix = `🕒 **Voice Time (${period})**`
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  await interaction.reply(`${responsePrefix}: ${hours}h ${minutes}m ${secs}s`)
}
