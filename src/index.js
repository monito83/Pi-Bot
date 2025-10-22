const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { Pool } = require('pg');
const cron = require('node-cron');
const axios = require('axios');
const express = require('express');
require('dotenv').config();

// Crear servidor Express para healthcheck
const app = express();
const PORT = process.env.PORT || 3000;

// Endpoint de health
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    bot: 'running',
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🌐 Healthcheck server running on port ${PORT}`);
});

// Configuración
const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const DATABASE_URL = process.env.DATABASE_URL;
const MAGIC_EDEN_API_KEY = process.env.MAGIC_EDEN_API_KEY;
const MONAD_RPC_URL = process.env.MONAD_RPC_URL;

// Inicializar cliente Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Inicializar PostgreSQL
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Comandos slash
const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configurar proyecto para tracking')
    .addStringOption(option =>
      option.setName('project')
        .setDescription('Nombre del proyecto NFT')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('contract')
        .setDescription('Dirección del contrato')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Ver estado de un proyecto')
    .addStringOption(option =>
      option.setName('project')
        .setDescription('Nombre del proyecto')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('projects')
    .setDescription('Listar todos los proyectos tracked'),

  new SlashCommandBuilder()
    .setName('floor')
    .setDescription('Ver floor price de un proyecto')
    .addStringOption(option =>
      option.setName('project')
        .setDescription('Nombre del proyecto')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('period')
        .setDescription('Período de tiempo')
        .setRequired(false)
        .addChoices(
          { name: '24 horas', value: '24h' },
          { name: '7 días', value: '7d' },
          { name: '30 días', value: '30d' }
        )),

  new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Ver volumen de trading')
    .addStringOption(option =>
      option.setName('project')
        .setDescription('Nombre del proyecto')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('period')
        .setDescription('Período de tiempo')
        .setRequired(false)
        .addChoices(
          { name: '24 horas', value: '24h' },
          { name: '7 días', value: '7d' },
          { name: '30 días', value: '30d' }
        )),

  new SlashCommandBuilder()
    .setName('alerts')
    .setDescription('Gestionar alertas')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Configurar alertas para un proyecto')
        .addStringOption(option =>
          option.setName('project')
            .setDescription('Nombre del proyecto')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('types')
            .setDescription('Tipos de alertas (floor,volume,sales,listings)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Ver alertas configuradas'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Desactivar alertas')
        .addStringOption(option =>
          option.setName('project')
            .setDescription('Nombre del proyecto')
            .setRequired(true)))
];

// Registrar comandos
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔄 Registrando comandos slash...');
    
    await rest.put(
      Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
      { body: commands }
    );
    
    console.log('✅ Comandos slash registrados exitosamente');
  } catch (error) {
    console.error('❌ Error registrando comandos:', error);
  }
})();

// Evento cuando el bot está listo
client.once('ready', () => {
  console.log(`🤖 Bot conectado como ${client.user.tag}`);
  console.log(`📊 Servidores: ${client.guilds.cache.size}`);
  
  // Programar tarea de tracking cada 5 minutos
  scheduleTracking();
});

// Programar tracking automático
function scheduleTracking() {
  cron.schedule('*/5 * * * *', async () => {
    console.log('🔄 Ejecutando tracking automático...');
    await performTracking();
  }, {
    timezone: "America/New_York"
  });

  console.log('⏰ Tracking automático programado cada 5 minutos');
}

// Realizar tracking de todos los proyectos
async function performTracking() {
  try {
    const result = await pool.query('SELECT * FROM nft_projects WHERE status = $1', ['active']);
    const projects = result.rows;

    for (const project of projects) {
      await trackProject(project);
      // Esperar un poco para evitar rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('Error in performTracking:', error);
  }
}

// Trackear un proyecto específico
async function trackProject(project) {
  try {
    // Obtener datos de Magic Eden (simulado por ahora)
    const projectData = await getProjectData(project.contract_address);
    
    if (!projectData) return;

    // Guardar en historial
    await pool.query(
      'INSERT INTO price_history (project_id, floor_price, volume_24h, sales_count, listings_count, avg_sale_price) VALUES ($1, $2, $3, $4, $5, $6)',
      [project.id, projectData.floor_price, projectData.volume_24h, projectData.sales_count, projectData.listings_count, projectData.avg_sale_price]
    );

    // Actualizar proyecto
    await pool.query(
      'UPDATE nft_projects SET last_floor_price = $1, last_volume = $2, last_sales_count = $3, last_listings_count = $4, last_update = $5 WHERE id = $6',
      [projectData.floor_price, projectData.volume_24h, projectData.sales_count, projectData.listings_count, new Date().toISOString(), project.id]
    );

    // Verificar alertas
    await checkAlerts(project, projectData);

  } catch (error) {
    console.error(`Error tracking project ${project.name}:`, error);
  }
}

// Obtener datos del proyecto (simulado)
async function getProjectData(contractAddress) {
  // TODO: Implementar integración real con Magic Eden API
  // Por ahora retornamos datos simulados
  return {
    floor_price: Math.random() * 0.5 + 0.1,
    volume_24h: Math.random() * 10 + 1,
    sales_count: Math.floor(Math.random() * 20) + 1,
    listings_count: Math.floor(Math.random() * 100) + 10,
    avg_sale_price: Math.random() * 0.6 + 0.2
  };
}

// Verificar alertas
async function checkAlerts(project, newData) {
  try {
    const { data: alerts, error } = await supabase
      .from('user_alerts')
      .select('*')
      .eq('project_id', project.id)
      .eq('is_active', true);

    if (error || !alerts.length) return;

    for (const alert of alerts) {
      await processAlert(alert, project, newData);
    }
  } catch (error) {
    console.error('Error checking alerts:', error);
  }
}

// Procesar alerta individual
async function processAlert(alert, project, newData) {
  try {
    const user = await client.users.fetch(alert.discord_user_id);
    if (!user) return;

    let shouldNotify = false;
    let message = '';

    // Verificar floor price
    if (alert.alert_types.includes('floor') && alert.floor_threshold) {
      const change = ((newData.floor_price - project.last_floor_price) / project.last_floor_price) * 100;
      if (Math.abs(change) >= alert.floor_threshold) {
        shouldNotify = true;
        message += `💰 Floor: ${newData.floor_price.toFixed(3)} ETH (${change > 0 ? '+' : ''}${change.toFixed(1)}%)\n`;
      }
    }

    // Verificar volumen
    if (alert.alert_types.includes('volume') && alert.volume_threshold) {
      if (newData.volume_24h >= alert.volume_threshold) {
        shouldNotify = true;
        message += `📊 Volume: ${newData.volume_24h.toFixed(2)} ETH\n`;
      }
    }

    if (shouldNotify) {
      const embed = new EmbedBuilder()
        .setTitle(`🔥 ${project.name} - Alert`)
        .setDescription(message)
        .setColor('#FF6B6B')
        .setTimestamp();

      await user.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error processing alert:', error);
  }
}

// Manejar interacciones de comandos slash
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    switch (commandName) {
      case 'setup':
        await handleSetupCommand(interaction);
        break;
      case 'status':
        await handleStatusCommand(interaction);
        break;
      case 'projects':
        await handleProjectsCommand(interaction);
        break;
      case 'floor':
        await handleFloorCommand(interaction);
        break;
      case 'volume':
        await handleVolumeCommand(interaction);
        break;
      case 'alerts':
        await handleAlertsCommand(interaction);
        break;
    }
  } catch (error) {
    console.error(`Error handling command ${commandName}:`, error);
    await interaction.reply({ content: '❌ Error interno. Intenta de nuevo.', ephemeral: true });
  }
});

// Manejar comando setup
async function handleSetupCommand(interaction) {
  const projectName = interaction.options.getString('project');
  const contractAddress = interaction.options.getString('contract');

  try {
    const result = await pool.query(
      'INSERT INTO nft_projects (name, contract_address, marketplace, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [projectName, contractAddress, 'magic-eden', 'active']
    );

    if (result.rows.length === 0) {
      await interaction.reply({ content: '❌ Error al configurar proyecto.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('✅ Proyecto Configurado')
      .setDescription(`**${projectName}** ha sido configurado para tracking`)
      .addFields(
        { name: 'Contract', value: contractAddress, inline: true },
        { name: 'Marketplace', value: 'Magic Eden', inline: true },
        { name: 'Status', value: 'Active', inline: true }
      )
      .setColor('#10B981')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleSetupCommand:', error);
    await interaction.reply({ content: '❌ Error interno.', ephemeral: true });
  }
}

// Manejar comando status
async function handleStatusCommand(interaction) {
  const projectName = interaction.options.getString('project');

  try {
    const { data: project, error } = await supabase
      .from('nft_projects')
      .select('*')
      .eq('name', projectName)
      .single();

    if (error || !project) {
      await interaction.reply({ content: '❌ Proyecto no encontrado.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${project.name} - Status`)
      .addFields(
        { name: 'Floor Price', value: `${project.last_floor_price || 'N/A'} ETH`, inline: true },
        { name: 'Volume 24h', value: `${project.last_volume || 'N/A'} ETH`, inline: true },
        { name: 'Sales Count', value: `${project.last_sales_count || 'N/A'}`, inline: true },
        { name: 'Listings', value: `${project.last_listings_count || 'N/A'}`, inline: true },
        { name: 'Last Update', value: project.last_update ? new Date(project.last_update).toLocaleString() : 'N/A', inline: true },
        { name: 'Status', value: project.status, inline: true }
      )
      .setColor('#7C3AED')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleStatusCommand:', error);
    await interaction.reply({ content: '❌ Error interno.', ephemeral: true });
  }
}

// Manejar comando projects
async function handleProjectsCommand(interaction) {
  try {
    const { data: projects, error } = await supabase
      .from('nft_projects')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      await interaction.reply({ content: '❌ Error al obtener proyectos.', ephemeral: true });
      return;
    }

    if (!projects.length) {
      await interaction.reply({ content: '📋 No hay proyectos configurados.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Proyectos Tracked')
      .setDescription(`Total: ${projects.length} proyectos`)
      .setColor('#7C3AED')
      .setTimestamp();

    projects.forEach((project, index) => {
      embed.addFields({
        name: `${index + 1}. ${project.name}`,
        value: `Floor: ${project.last_floor_price || 'N/A'} ETH\nVolume: ${project.last_volume || 'N/A'} ETH`,
        inline: true
      });
    });

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleProjectsCommand:', error);
    await interaction.reply({ content: '❌ Error interno.', ephemeral: true });
  }
}

// Manejar comando floor
async function handleFloorCommand(interaction) {
  const projectName = interaction.options.getString('project');
  const period = interaction.options.getString('period') || '24h';

  try {
    const { data: project, error } = await supabase
      .from('nft_projects')
      .select('*')
      .eq('name', projectName)
      .single();

    if (error || !project) {
      await interaction.reply({ content: '❌ Proyecto no encontrado.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`💰 ${project.name} - Floor Price`)
      .setDescription(`Período: ${period}`)
      .addFields(
        { name: 'Current Floor', value: `${project.last_floor_price || 'N/A'} ETH`, inline: true },
        { name: 'Last Update', value: project.last_update ? new Date(project.last_update).toLocaleString() : 'N/A', inline: true }
      )
      .setColor('#10B981')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleFloorCommand:', error);
    await interaction.reply({ content: '❌ Error interno.', ephemeral: true });
  }
}

// Manejar comando volume
async function handleVolumeCommand(interaction) {
  const projectName = interaction.options.getString('project');
  const period = interaction.options.getString('period') || '24h';

  try {
    const { data: project, error } = await supabase
      .from('nft_projects')
      .select('*')
      .eq('name', projectName)
      .single();

    if (error || !project) {
      await interaction.reply({ content: '❌ Proyecto no encontrado.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${project.name} - Volume`)
      .setDescription(`Período: ${period}`)
      .addFields(
        { name: 'Volume 24h', value: `${project.last_volume || 'N/A'} ETH`, inline: true },
        { name: 'Sales Count', value: `${project.last_sales_count || 'N/A'}`, inline: true },
        { name: 'Avg Sale Price', value: `${project.last_avg_sale_price || 'N/A'} ETH`, inline: true }
      )
      .setColor('#F59E0B')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleVolumeCommand:', error);
    await interaction.reply({ content: '❌ Error interno.', ephemeral: true });
  }
}

// Manejar comando alerts
async function handleAlertsCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'setup':
      await handleAlertsSetup(interaction);
      break;
    case 'list':
      await handleAlertsList(interaction);
      break;
    case 'disable':
      await handleAlertsDisable(interaction);
      break;
  }
}

// Manejar setup de alertas
async function handleAlertsSetup(interaction) {
  const projectName = interaction.options.getString('project');
  const types = interaction.options.getString('types') || 'floor,volume';

  try {
    const { data: project, error } = await supabase
      .from('nft_projects')
      .select('*')
      .eq('name', projectName)
      .single();

    if (error || !project) {
      await interaction.reply({ content: '❌ Proyecto no encontrado.', ephemeral: true });
      return;
    }

    const alertTypes = types.split(',').map(t => t.trim());

    const { error: insertError } = await supabase
      .from('user_alerts')
      .upsert({
        discord_user_id: interaction.user.id,
        project_id: project.id,
        alert_types: alertTypes,
        floor_threshold: 5.0, // 5% por defecto
        volume_threshold: 10.0, // 10 ETH por defecto
        is_active: true
      });

    if (insertError) {
      await interaction.reply({ content: '❌ Error al configurar alertas.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('✅ Alertas Configuradas')
      .setDescription(`Alertas configuradas para **${projectName}**`)
      .addFields(
        { name: 'Tipos', value: alertTypes.join(', '), inline: true },
        { name: 'Floor Threshold', value: '5%', inline: true },
        { name: 'Volume Threshold', value: '10 ETH', inline: true }
      )
      .setColor('#10B981')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleAlertsSetup:', error);
    await interaction.reply({ content: '❌ Error interno.', ephemeral: true });
  }
}

// Manejar listado de alertas
async function handleAlertsList(interaction) {
  try {
    const { data: alerts, error } = await supabase
      .from('user_alerts')
      .select(`
        *,
        nft_projects(name)
      `)
      .eq('discord_user_id', interaction.user.id)
      .eq('is_active', true);

    if (error) {
      await interaction.reply({ content: '❌ Error al obtener alertas.', ephemeral: true });
      return;
    }

    if (!alerts.length) {
      await interaction.reply({ content: '📋 No tienes alertas configuradas.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Tus Alertas')
      .setDescription(`Total: ${alerts.length} alertas activas`)
      .setColor('#7C3AED')
      .setTimestamp();

    alerts.forEach((alert, index) => {
      embed.addFields({
        name: `${index + 1}. ${alert.nft_projects.name}`,
        value: `Tipos: ${alert.alert_types.join(', ')}\nFloor: ${alert.floor_threshold}%\nVolume: ${alert.volume_threshold} ETH`,
        inline: true
      });
    });

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleAlertsList:', error);
    await interaction.reply({ content: '❌ Error interno.', ephemeral: true });
  }
}

// Manejar desactivación de alertas
async function handleAlertsDisable(interaction) {
  const projectName = interaction.options.getString('project');

  try {
    const { error } = await supabase
      .from('user_alerts')
      .update({ is_active: false })
      .eq('discord_user_id', interaction.user.id)
      .eq('nft_projects.name', projectName);

    if (error) {
      await interaction.reply({ content: '❌ Error al desactivar alertas.', ephemeral: true });
      return;
    }

    await interaction.reply({ content: `✅ Alertas desactivadas para **${projectName}**`, ephemeral: true });
  } catch (error) {
    console.error('Error in handleAlertsDisable:', error);
    await interaction.reply({ content: '❌ Error interno.', ephemeral: true });
  }
}

// Iniciar bot
client.login(DISCORD_TOKEN).catch(console.error);

// Manejo de errores
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

