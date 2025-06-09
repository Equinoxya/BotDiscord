require('dotenv').config();
// This code initializes a Discord bot that allows users to set their birthdays using slash commands.
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');
const { Birthday } = require('./Models/Birthday');
const cron = require('node-cron');
const { Config } = require('./Models/Config'); // Assurez-vous que ce modèle est défini pour stocker la configuration du serveur


const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });


// Connexion MongoDB
mongoose.connect(process.env.MONGO_URI).then(() => {
  console.log('🟢 Connecté à MongoDB');
}).catch(err => console.error('🔴 Erreur MongoDB:', err));


// Commandes slash
const commands = [
  new SlashCommandBuilder()
    .setName('set-birthday')
    .setDescription("Enregistre ta date d'anniversaire (format YYYY-MM-DD)")
    .addStringOption(opt =>
      opt.setName('date').setDescription('Ta date').setRequired(true)), 
  
  new SlashCommandBuilder()
    .setName('change-birthday')
    .setDescription("Change ta date d'anniversaire (format YYYY-MM-DD)")
    .addStringOption(opt =>
      opt.setName('date').setDescription('Ta nouvelle date').setRequired(true)),
   
  new SlashCommandBuilder()
    .setName('get-birthday')
    .setDescription("Affiche la date d'anniversaire de l'utilisateur")
    .addUserOption(opt =>
      opt.setName('user').setDescription('L\'utilisateur dont tu veux voir l\'anniversaire').setRequired(true)),

  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configuration du bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('set-channel')
        .setDescription('Définit le salon pour les anniversaires')
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Le salon à définir').setRequired(true))),
    
  new SlashCommandBuilder()
      .setName('test')
      .setDescription('Test d\'anniversaire : envoie un message dans le salon configuré')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  ];


    
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands })
  .then(() => console.log('🟢 Commandes slash enregistrées'))
  .catch(err => console.error('🔴 Erreur lors de l\'enregistrement des commandes:', err)) ;

// Gestion des commandes  

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return; // Vérifie si l'interaction est une commande
  if (!interaction.guild) return; // Ignore les interactions en dehors des serveurs 

  const { commandName } = interaction;

  if (commandName === 'set-birthday') {
    try {
      await interaction.deferReply({ ephemeral: true }); // ✅ évite expiration

      const date = interaction.options.getString('date');
      const [year, month, day] = date.split('-').map(Number);
      const birthdayDate = new Date(Date.UTC(year, month -1, day));

      if (isNaN(birthdayDate.getTime())) {
        return await interaction.editReply({
          content: '❌ Date invalide. Utilisez le format YYYY-MM-DD.'
        });
      }

      const newBirthday = new Birthday({
        userId: interaction.user.id,
        birthday: birthdayDate, // Utilise la date correctement parsée
        guildId: interaction.guild.id
      });

      await newBirthday.save();

      await interaction.editReply({
        content: '🎉 Votre anniversaire a été enregistré avec succès !'
      });

    } catch (err) {
      console.error('🔴 Erreur lors de l\'enregistrement de l\'anniversaire:', err);

      // ⚠️ Utilise editReply ici aussi car interaction est déjà "acknowledged"
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: '❌ Une erreur est survenue lors de l\'enregistrement.'
        });
      } else {
        await interaction.reply({
          content: '❌ Une erreur est survenue lors de l\'enregistrement.',
          ephemeral: true
        });
      }
    }
  }

if (commandName === 'change-birthday') {
    try {await interaction.deferReply({ ephemeral: true }); // ✅ évite expiration
      const date = interaction.options.getString('date'); 
      const [year, month, day] = date.split('-').map(Number);
      const birthdayDate = new Date(Date.UTC(year, month - 1, day));
      if (isNaN(birthdayDate.getTime())) {
        return await interaction.editReply({
          content: '❌ Date invalide. Utilisez le format YYYY-MM-DD.'
        });
      }
      const birthday = await Birthday.findOneAndUpdate(
        { userId: interaction.user.id, guildId: interaction.guild.id }, 
        { birthday: birthdayDate },
        { new: true } // Retourne le document mis à jour
      );
      if (!birthday) { 
        return await interaction.editReply({
          content: '❌ Aucune date d\'anniversaire trouvée. Utilisez `/set-birthday` pour enregistrer votre anniversaire.'  
        });
      }
      await interaction.editReply({
        content: '🎉 Votre anniversaire a été mis à jour avec succès !'
      });
    } catch (err) {
      console.error('🔴 Erreur lors de la mise à jour de l\'anniversaire:', err);
      // ⚠️ Utilise editReply ici aussi car interaction est déjà "acknowledged"
      if (interaction.deferred || interaction.replied) {  
        await interaction.editReply({
          content: '❌ Une erreur est survenue lors de la mise à jour de l\'anniversaire.'
        });
      } else {
        await interaction.reply({
          content: '❌ Une erreur est survenue lors de la mise à jour de l\'anniversaire.',
          ephemeral: true
        });
      }
    }
  }


  if(commandName === 'get-birthday') {
    try {
      await interaction.deferReply({ ephemeral: true }); // ✅ évite expiration

      const user = interaction.options.getUser('user');
      const birthday = await Birthday.findOne({ userId: user.id, guildId: interaction.guild.id });

      if (!birthday) {
        return await interaction.editReply({
          content: `❌ Aucune date d'anniversaire trouvée pour ${user.username}.`
        });
      }

      const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
      const formattedDate = birthday.birthday.toLocaleDateString('fr-FR', options);

      await interaction.editReply({
        content: `<@${user.username}>a son anniversaire le ${formattedDate}.`
      });

    } catch (err) {
      console.error('🔴 Erreur lors de la récupération de l\'anniversaire:', err);

      // ⚠️ Utilise editReply ici aussi car interaction est déjà "acknowledged"
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: '❌ Une erreur est survenue lors de la récupération de l\'anniversaire.'
        });
      } else {
        await interaction.reply({
          content: '❌ Une erreur est survenue lors de la récupération de l\'anniversaire.',
          ephemeral: true
        });
      }
    }
  }

  if (commandName === 'config') {
    const subCommand = interaction.options.getSubcommand();

    if (subCommand === 'set-channel') {
      try {
        await interaction.deferReply({ ephemeral: true }); // <-- Ajouté ici
        const channel = interaction.options.getChannel('channel');

        // Enregistre ou met à jour le salon dans la base de données via le modèle Config
        await Config.findOneAndUpdate(
          { guildId: interaction.guild.id },
          { birthdayChannelId: channel.id },
          { upsert: true, new: true }
        );

        await interaction.editReply({
          content: `✅ Le salon ${channel.name} a été défini pour les anniversaires.`
        });

      } catch (err) {
        console.error('🔴 Erreur lors de la configuration du salon:', err);

        // N'essaye de répondre que si l'interaction n'est pas déjà terminée
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
              content: '❌ Une erreur est survenue lors de la configuration du salon.'
            });
          }
        } catch (e) {
          // Ignore l'erreur si l'interaction est déjà terminée ou inconnue
        }
      }
    } else {
      // Vérifie si l'interaction n'est pas déjà reconnue avant de répondre
      try {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.reply({
            content: '❌ Sous-commande inconnue pour la configuration.',
            ephemeral: true
          });
        }
      } catch (e) {
        // Ignore l'erreur si l'interaction est déjà terminée ou inconnue
      }
    }
  }
  




  if (commandName === 'test') {
    try {
      await interaction.deferReply({ ephemeral: true });

      // Récupère la config du serveur
      const config = await Config.findOne({ guildId: interaction.guild.id });
      if (!config || !config.birthdayChannelId) {
        return await interaction.editReply({
          content: '❌ Aucun salon d\'anniversaire n\'est configuré pour ce serveur.'
        });
      }

      const guild = interaction.guild;
      const channel = guild.channels.cache.get(config.birthdayChannelId);
      if (!channel) {
        return await interaction.editReply({
          content: '❌ Le salon configuré n\'existe plus ou je n\'ai pas accès.'
        });
      }

      // Envoi d'un message factice
      await channel.send(`🎉 Ceci est un test : le bot peut envoyer des messages d'anniversaire ici !`);

      await interaction.editReply({
        content: `✅ Message de test envoyé dans ${channel.name}.`
      });
    } catch (err) {
      console.error('🔴 Erreur lors du test d\'anniversaire:', err);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: '❌ Une erreur est survenue lors du test.'
        });
      } else {
        await interaction.reply({
          content: '❌ Une erreur est survenue lors du test.',
          ephemeral: true
        });
      }
    }
  }
});

// Tâche cron pour vérifier les anniversaires tous les jours à 00:00
// On suppose que vous avez un modèle Config pour stocker le salon d'anniversaire par serveur

cron.schedule('0 0 * * *', async () => {
  // On veut la date du jour à Paris (UTC+1 ou UTC+2 selon l'heure d'été)
  const now = new Date();
  // Décalage horaire de Paris en minutes
  const parisOffsetMinutes = -now.getTimezoneOffset() + (now.isDST ? 120 : 60);
  // Crée une date à Paris
  const parisDate = new Date(now.getTime() + (parisOffsetMinutes * 60 * 1000));
  const month = parisDate.getMonth() + 1; // 1-12
  const day = parisDate.getDate(); // 1-31

  try {
    console.log('🔄 Vérification des anniversaires du jour...');
    // On cherche tous les anniversaires dont le mois et le jour correspondent
    const birthdays = await Birthday.find({
      $expr: {
        $and: [
          { $eq: [{ $dayOfMonth: "$birthday" }, day] },
          { $eq: [{ $month: "$birthday" }, month] }
        ]
      }
    });

    if (birthdays.length > 0) {
      console.log(
        `🎉 Anniversaires trouvés pour le ${day}/${month}: ${birthdays.map(b => b.userId).join(', ')}`
      )
      for (const birthday of birthdays) {
        const config = await Config.findOne({ guildId: birthday.guildId });
        if (!config || !config.birthdayChannelId) continue;

        let guild = client.guilds.cache.get(birthday.guildId);
        if (!guild) {
          try {
            guild = await client.guilds.fetch(birthday.guildId);
          } catch {
            continue;
          }
        }

        let channel = guild.channels.cache.get(config.birthdayChannelId);
        if (!channel) {
          try {
            channel = await guild.channels.fetch(config.birthdayChannelId);
          } catch {
            continue;
          }
        }

        const member = await guild.members.fetch(birthday.userId).catch(() => null);
        const username = member ? member.user.username : 'Utilisateur inconnu';

        try {
            await channel.send({
            content: `Chers citoyens, chères citoyennes\n\n> **Voyez donc ce jour béni, où le destin lui-même s’est arrêté pour tisser la venue de <@${birthday.userId}> dans la trame du monde.**\n> Un anniversaire… non, un rappel que même les étoiles, un instant, ont brillé pour toi.\n> Profite de cette gloire, car rares sont ceux que le temps célèbre sans regret.\n\n🎉 **Joyeux anniversaire, <@${birthday.userId}> !** 🎉\nQue ta grandeur égale la mienne… ou du moins, qu’elle essaie.`,
            allowedMentions: { users: [birthday.userId], everyone: true }
            });
        } catch (sendErr) {
          console.error(`🔴 Impossible d'envoyer le message d'anniversaire dans le salon ${channel.id}:`, sendErr);
        }
      }
    }
  } catch (err) {
    console.error('🔴 Erreur lors de la vérification des anniversaires:', err);
  }
});

client.login(process.env.TOKEN);