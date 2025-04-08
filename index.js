require("./server");
const {
  Client,
  GatewayIntentBits,
  Partials,
  Routes,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  InteractionType,
} = require("discord.js");
const { REST } = require("@discordjs/rest");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = "1359143202937901066";
const GUILD_ID = "1304762872059920444";
const MOD_CHANNEL_ID = "1359136396043878441";
const VERIFY_CHANNEL_ID = "1358111968241778708";
const MEMBER_ROLE_ID = "1359154109873262773";

const ROLE_IDS = {
  "1st Year": "1359157953118077001",
  "2nd Year": "1359158142822256861",
  "3rd Year": "1359158298632257684",
};

const commands = [
  {
    name: "verify",
    description: "Start the verification process",
  },
];

const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log("✅ Slash command registered");
  } catch (error) {
    console.error("❌ Error registering command:", error);
  }
})();

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    const verifyChannel = await client.channels.fetch(VERIFY_CHANNEL_ID);
    const button = new ButtonBuilder()
      .setCustomId("startVerification")
      .setLabel("Click here to verify")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    const sentMsg = await verifyChannel.send({
      content: "Verification Panel:",
      components: [row],
    });

    await sentMsg.pin();
    console.log("📌 Pinned verification button in verify channel");
  } catch (err) {
    console.error("❌ Could not pin message in verify channel:", err);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "verify"
  ) {
    const button = new ButtonBuilder()
      .setCustomId("startVerification")
      .setLabel("Click here to verify")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    await interaction.reply({
      content: "Start verification:",
      components: [row],
      ephemeral: true,
    });
  }

  if (interaction.isButton() && interaction.customId === "startVerification") {
    const modal = new ModalBuilder()
      .setCustomId("nameModal")
      .setTitle("Verification Step 1");

    const nameInput = new TextInputBuilder()
      .setCustomId("nameInput")
      .setLabel("Enter your full name")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
    await interaction.showModal(modal);
  }

  if (
    interaction.type === InteractionType.ModalSubmit &&
    interaction.customId === "nameModal"
  ) {
    const name = interaction.fields.getTextInputValue("nameInput");

    const yearSelect = new StringSelectMenuBuilder()
      .setCustomId(`yearSelect-${name}`)
      .setPlaceholder("Select your year")
      .addOptions(
        { label: "1st Year", value: "1st Year" },
        { label: "2nd Year", value: "2nd Year" },
        { label: "3rd Year", value: "3rd Year" }
      );

    await interaction.reply({
      content: "📚 Select your year of study:",
      components: [new ActionRowBuilder().addComponents(yearSelect)],
      ephemeral: true,
    });
  }

  if (
    interaction.isStringSelectMenu() &&
    interaction.customId.startsWith("yearSelect-")
  ) {
    const name = interaction.customId.split("-")[1];
    const year = interaction.values[0];

    const modal = new ModalBuilder()
      .setCustomId(`collegeIdModal-${name}-${year}`)
      .setTitle("Verification Step 2");

    const collegeIdInput = new TextInputBuilder()
      .setCustomId("collegeIdInput")
      .setLabel("Enter your college ID number")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(collegeIdInput));
    await interaction.showModal(modal);
  }

  if (
    interaction.type === InteractionType.ModalSubmit &&
    interaction.customId.startsWith("collegeIdModal-")
  ) {
    const [_, name, year] = interaction.customId.split("-");
    const collegeId = interaction.fields.getTextInputValue("collegeIdInput");

    await interaction.reply({
      content: "✅ Submitted! Please check your DMs to upload your college ID photo.",
      ephemeral: true,
    });

    try {
      const dm = await interaction.user.createDM();
      await dm.send("📸 Please upload a **photo of your college ID** here. You have 2 minutes.");

      const collected = await dm.awaitMessages({
        filter: (msg) =>
          msg.author.id === interaction.user.id &&
          msg.attachments.size > 0 &&
          msg.attachments.first().contentType?.startsWith("image/"),
        max: 1,
        time: 120000,
        errors: ["time"],
      });

      const imageUrl = collected.first().attachments.first().url;

      const embed = new EmbedBuilder()
        .setTitle("New Verification Request")
        .setDescription(`<@${interaction.user.id}> has submitted a verification request.`)
        .addFields(
          { name: "Full Name", value: name },
          { name: "Year of Study", value: year },
          { name: "College ID", value: collegeId }
        )
        .setImage(imageUrl)
        .setColor(0x00ae86)
        .setTimestamp();

      const approveButton = new ButtonBuilder()
        .setCustomId(`approve-${interaction.user.id}-${year}`)
        .setLabel("Approve")
        .setStyle(ButtonStyle.Success);

      const rejectButton = new ButtonBuilder()
        .setCustomId(`reject-${interaction.user.id}`)
        .setLabel("Reject")
        .setStyle(ButtonStyle.Danger);

      const actionRow = new ActionRowBuilder().addComponents(
        approveButton,
        rejectButton
      );

      const modChannel = await client.channels.fetch(MOD_CHANNEL_ID);
      const modMsg = await modChannel.send({
        content: `New verification request from <@${interaction.user.id}>`,
        embeds: [embed],
        components: [actionRow],
      });

      console.log("✅ Sent embed to mod channel");
    } catch (err) {
      console.error("❌ Error during DM/image process:", err);
      await interaction.followUp({
        content: "❌ Could not receive your image. Try again.",
        ephemeral: true,
      });
    }
  }

  if (interaction.isButton()) {
    const [action, userId, year] = interaction.customId.split("-");
    const member = await interaction.guild.members.fetch(userId);

    if (action === "approve") {
      await member.roles.add(MEMBER_ROLE_ID);
      await member.roles.add(ROLE_IDS[year]);
      await interaction.update({
        content: `✅ <@${userId}> has been **approved** and assigned roles.`,
        components: [],
      });
    }

    if (action === "reject") {
      const modal = new ModalBuilder()
        .setCustomId(`rejectReason-${userId}-${interaction.message.id}`)
        .setTitle("Rejection Reason");

      const reasonInput = new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("Why are you rejecting this request?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      await interaction.showModal(modal);
    }
  }

  if (
    interaction.type === InteractionType.ModalSubmit &&
    interaction.customId.startsWith("rejectReason-")
  ) {
    const [_, userId, messageId] = interaction.customId.split("-");
    const reason = interaction.fields.getTextInputValue("reason");

    try {
      const user = await client.users.fetch(userId);
      await user.send(
        `❌ Your verification request was rejected for the following reason:\n\n**${reason}**`
      );
    } catch (err) {
      console.error("❌ Failed to DM user:", err);
    }

    try {
      const modChannel = await client.channels.fetch(MOD_CHANNEL_ID);
      const msg = await modChannel.messages.fetch(messageId);
      await msg.edit({ components: [] });
    } catch (err) {
      console.error("❌ Failed to edit mod message:", err);
    }

    await interaction.reply({
      content: `❌ <@${userId}>'s verification was rejected.`,
      ephemeral: true,
    });
  }
});

client.login(TOKEN);
