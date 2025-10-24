console.log('🔥 LOG 1: Starting to load modules...');
console.log('🔥 ULTRA SIMPLE TEST v2: This code is definitely running!');
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
console.log('🔥 LOG 2: Discord.js loaded');
const { Pool } = require('pg');
console.log('🔥 LOG 3: PostgreSQL loaded');
const cron = require('node-cron');
console.log('🔥 LOG 4: Cron loaded');
const axios = require('axios');
console.log('🔥 LOG 5: Axios loaded');
const express = require('express');
console.log('🔥 LOG 6: Express loaded');
require('dotenv').config();
console.log('🔥 LOG 7: Dotenv loaded');

// 🚀 DEPLOYMENT VERIFICATION LOG
console.log('🚀 ===== BOT STARTING - DEPLOYMENT VERIFICATION =====');
console.log('🚀 Timestamp:', new Date().toISOString());
console.log('🚀 Node version:', process.version);
console.log('🚀 Environment:', process.env.NODE_ENV || 'development');
console.log('🚀 ================================================');

// 🔥 ULTRA SIMPLE TEST LOG
console.log('🔥 ULTRA SIMPLE TEST v1: This code is definitely running!');

console.log('🔥 LOG 8: Starting Express server setup...');
// Crear servidor Express para healthcheck
const app = express();
const PORT = process.env.PORT || 3000;
console.log('🔥 LOG 9: Express server created, PORT:', PORT);

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

console.log('🔥 LOG 10: Starting environment variables setup...');
// Configuración
const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
console.log('🔥 LOG 11: DISCORD_TOKEN loaded:', !!DISCORD_TOKEN);
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
console.log('🔥 LOG 12: DISCORD_CLIENT_ID loaded:', !!DISCORD_CLIENT_ID);
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
console.log('🔥 LOG 13: DISCORD_GUILD_ID loaded:', !!DISCORD_GUILD_ID);
const DATABASE_URL = process.env.DATABASE_URL;
console.log('🔥 LOG 14: DATABASE_URL loaded:', !!DATABASE_URL);
const MAGIC_EDEN_API_KEY = process.env.MAGIC_EDEN_API_KEY;
console.log('🔥 LOG 15: MAGIC_EDEN_API_KEY loaded:', !!MAGIC_EDEN_API_KEY);
const MONAD_RPC_URL = process.env.MONAD_RPC_URL;
console.log('🔥 LOG 16: MONAD_RPC_URL loaded:', !!MONAD_RPC_URL);

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
console.log('🔥 LOG 17: Starting PostgreSQL pool setup...');
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
console.log('🔥 LOG 18: PostgreSQL pool created');

// Crear tabla de configuración del servidor si no existe
async function initializeServerConfig() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS server_config (
        id SERIAL PRIMARY KEY,
        guild_id TEXT NOT NULL UNIQUE,
        alerts_channel_id TEXT,
        enabled_roles TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Server config table initialized');
  } catch (error) {
    console.error('Error initializing server config table:', error);
  }
}

// Inicializar configuración del servidor
initializeServerConfig();

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
        .setRequired(true)
        .setAutocomplete(true)),

  new SlashCommandBuilder()
    .setName('projects')
    .setDescription('Listar todos los proyectos tracked'),

  new SlashCommandBuilder()
    .setName('floor')
    .setDescription('Ver floor price de un proyecto')
    .addStringOption(option =>
      option.setName('project')
        .setDescription('Nombre del proyecto')
        .setRequired(true)
        .setAutocomplete(true))
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
        .setRequired(true)
        .setAutocomplete(true))
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
    .setName('test-api')
    .setDescription('Probar la API de Magic Eden'),

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
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('alert_type')
            .setDescription('Tipo de alerta')
            .setRequired(true)
            .addChoices(
              { name: 'Floor Price Change', value: 'floor_change' },
              { name: 'Floor Price Above', value: 'floor_above' },
              { name: 'Floor Price Below', value: 'floor_below' },
              { name: 'Volume Change', value: 'volume_change' },
              { name: 'Volume Above', value: 'volume_above' },
              { name: 'Volume Below', value: 'volume_below' },
              { name: 'Sales Count Change', value: 'sales_change' },
              { name: 'Listings Count Change', value: 'listings_change' }
            ))
        .addStringOption(option =>
          option.setName('timeframe')
            .setDescription('Período de tiempo para cambios')
            .setRequired(false)
            .addChoices(
              { name: '1 hora', value: '1h' },
              { name: '24 horas', value: '24h' },
              { name: '7 días', value: '7d' },
              { name: '30 días', value: '30d' }
            ))
        .addStringOption(option =>
          option.setName('threshold_type')
            .setDescription('Tipo de umbral')
            .setRequired(false)
            .addChoices(
              { name: 'Porcentaje (%)', value: 'percentage' },
              { name: 'Valor absoluto', value: 'absolute' }
            ))
        .addNumberOption(option =>
          option.setName('threshold_value')
            .setDescription('Valor del umbral')
            .setRequired(false)
            .setMinValue(0.01)))
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
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Eliminar una alerta específica')
        .addStringOption(option =>
          option.setName('project')
            .setDescription('Nombre del proyecto')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('alert_type')
            .setDescription('Tipo de alerta a eliminar')
            .setRequired(true)
            .addChoices(
              { name: 'Floor Price Change', value: 'floor_change' },
              { name: 'Floor Price Above', value: 'floor_above' },
              { name: 'Floor Price Below', value: 'floor_below' },
              { name: 'Volume Change', value: 'volume_change' },
              { name: 'Volume Above', value: 'volume_above' },
              { name: 'Volume Below', value: 'volume_below' },
              { name: 'Sales Count Change', value: 'sales_change' },
              { name: 'Listings Count Change', value: 'listings_change' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('channel')
        .setDescription('Configurar canal de alertas (Solo Admin)')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Canal donde se enviarán las alertas')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable-role')
        .setDescription('Habilitar rol para usar el bot (Solo Admin)')
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Rol a habilitar')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable-role')
        .setDescription('Deshabilitar rol para usar el bot (Solo Admin)')
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Rol a deshabilitar')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Ver configuración de alertas del servidor')),

  new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Eliminar un proyecto del tracking')
    .addStringOption(option =>
      option.setName('project')
        .setDescription('Nombre del proyecto a eliminar')
        .setRequired(true)
        .setAutocomplete(true))
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
  // Programar tracking automático cada 1 minuto (TEMPORAL PARA DEBUG)
  cron.schedule('*/1 * * * *', async () => {
    console.log('🔄 Ejecutando tracking automático...');
    await performTracking();
  }, {
    timezone: "America/New_York"
  });

  console.log('⏰ Tracking automático programado cada 1 minuto (DEBUG MODE)');
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
    console.log(`🔍 Tracking ${project.name} (${project.contract_address})`);
    
    // Obtener datos de Magic Eden
    const projectData = await getProjectData(project.contract_address);
    
    if (!projectData) {
      console.log(`❌ No data for ${project.name}`);
      return;
    }

    console.log(`📊 Data for ${project.name}:`, {
      floor_price: projectData.floor_price,
      volume_24h: projectData.volume_24h,
      sales_count: projectData.sales_count
    });

    // Guardar en historial solo si hay cambios significativos
    await savePriceHistoryIfChanged(project.id, projectData);

    // Actualizar proyecto
    await pool.query(
      'UPDATE nft_projects SET last_floor_price = $1, last_volume = $2, last_sales_count = $3, last_listings_count = $4, last_update = $5 WHERE id = $6',
      [projectData.floor_price, projectData.volume_24h, projectData.sales_count, projectData.listings_count, new Date().toISOString(), project.id]
    );

    // Verificar alertas
    console.log(`🔔 About to check alerts for ${project.name} (ID: ${project.id})`);
    console.log(`🔔 Calling checkAlerts function...`);
    try {
      await checkAlerts(project, projectData);
      console.log(`🔔 checkAlerts function completed successfully`);
    } catch (alertError) {
      console.error(`❌ Error checking alerts for ${project.name}:`, alertError);
      console.error(`❌ Error stack:`, alertError.stack);
      console.error(`❌ Error message:`, alertError.message);
      console.error(`❌ Error name:`, alertError.name);
    }

  } catch (error) {
    console.error(`Error tracking project ${project.name}:`, error);
  }
}

// Guardar historial solo si hay cambios significativos
async function savePriceHistoryIfChanged(projectId, projectData) {
  try {
    // Obtener el último registro del historial
    const lastRecord = await pool.query(
      'SELECT * FROM price_history WHERE project_id = $1 ORDER BY recorded_at DESC LIMIT 1',
      [projectId]
    );

    if (lastRecord.rows.length === 0) {
      // No hay historial previo, guardar siempre
      await pool.query(
        'INSERT INTO price_history (project_id, floor_price, volume_24h, sales_count, listings_count, avg_sale_price) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, projectData.floor_price, projectData.volume_24h, projectData.sales_count, projectData.listings_count, projectData.avg_sale_price]
      );
      console.log(`📊 First price history entry for project ${projectId}`);
      return;
    }

    const last = lastRecord.rows[0];
    
    // Calcular cambios porcentuales
    const floorChange = last.floor_price > 0 ? Math.abs((projectData.floor_price - last.floor_price) / last.floor_price) * 100 : 0;
    const volumeChange = last.volume_24h > 0 ? Math.abs((projectData.volume_24h - last.volume_24h) / last.volume_24h) * 100 : 0;
    const salesChange = last.sales_count > 0 ? Math.abs((projectData.sales_count - last.sales_count) / last.sales_count) * 100 : 0;
    
    // Guardar solo si hay cambios significativos (más del 1%)
    const significantChange = floorChange > 1 || volumeChange > 1 || salesChange > 1 || 
                            projectData.sales_count !== last.sales_count || 
                            projectData.listings_count !== last.listings_count;

    if (significantChange) {
      await pool.query(
        'INSERT INTO price_history (project_id, floor_price, volume_24h, sales_count, listings_count, avg_sale_price) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, projectData.floor_price, projectData.volume_24h, projectData.sales_count, projectData.listings_count, projectData.avg_sale_price]
      );
      console.log(`📊 Price history updated for project ${projectId} - Floor: ${floorChange.toFixed(2)}%, Volume: ${volumeChange.toFixed(2)}%, Sales: ${salesChange.toFixed(2)}%`);
    } else {
      console.log(`⏭️ Skipping price history for project ${projectId} - No significant changes`);
    }
  } catch (error) {
    console.error('Error saving price history:', error);
  }
}

// Verificar alertas (basado en el sistema de WL Manager)
async function checkAlerts(project, projectData) {
  console.log(`🔔 SIMPLE v2: Starting checkAlerts for ${project.name} (ID: ${project.id})`);
  
  try {
    console.log(`🔔 SIMPLE v2: About to query database for project ${project.id}`);
    // Obtener alertas activas para este proyecto
    const result = await pool.query(
      'SELECT * FROM user_alerts WHERE project_id = $1 AND is_active = true',
      [project.id]
    );
    
    console.log(`🔔 SIMPLE v2: Found ${result.rows.length} active alerts for project ${project.name}`);
    console.log(`🔔 SIMPLE v2: Alert data:`, result.rows);

    if (result.rows.length === 0) {
      console.log(`🔔 SIMPLE v2: No active alerts found for project ${project.name}`);
      return;
    }

    console.log(`🔔 SIMPLE: Processing ${result.rows.length} alerts`);
    for (const alert of result.rows) {
      try {
        console.log(`🔔 SIMPLE: Processing alert for user ${alert.discord_user_id}`);
        const alertConfigs = JSON.parse(alert.alert_types || '[]');
        console.log(`🔔 SIMPLE: Alert configs:`, alertConfigs);
        
        let shouldNotify = false;
        let message = '';
        let percentageChange = 0;

        // Verificar cada configuración de alerta
        for (const alertConfig of alertConfigs) {
          if (!alertConfig.enabled) {
            console.log(`🔔 Alert config disabled:`, alertConfig);
            continue;
          }
          
          console.log(`🔔 Checking alert config:`, alertConfig);
          
          switch (alertConfig.type) {
            case 'floor_change':
              if (projectData.floor_price && alertConfig.threshold_value) {
                const previousPrice = await getPreviousPrice(project.id, 'floor_price', alertConfig.timeframe);
                if (previousPrice > 0) {
                  const change = projectData.floor_price - previousPrice;
                  const percentageChange = (change / previousPrice) * 100;
                  
                  let shouldTrigger = false;
                  if (alertConfig.threshold_type === 'percentage') {
                    shouldTrigger = Math.abs(percentageChange) >= alertConfig.threshold_value;
                  } else {
                    shouldTrigger = Math.abs(change) >= alertConfig.threshold_value;
                  }
                  
                  if (shouldTrigger) {
                    shouldNotify = true;
                    percentageChange = percentageChange;
                    const changeDisplay = alertConfig.threshold_type === 'percentage' 
                      ? `${Math.abs(percentageChange).toFixed(2)}%` 
                      : `${Math.abs(change).toFixed(4)} ETH`;
                    message = `Floor price ${change > 0 ? 'increased' : 'decreased'} by ${changeDisplay} in ${getTimeframeName(alertConfig.timeframe)}`;
                  }
                }
              }
              break;
              
            case 'floor_above':
              console.log(`🔔 Checking floor_above: current=${projectData.floor_price} ${projectData.currency}, threshold=${alertConfig.threshold_value} ${projectData.currency}`);
              
              if (projectData.floor_price && alertConfig.threshold_value) {
                if (projectData.floor_price >= alertConfig.threshold_value) {
                  console.log(`🔔 FLOOR ABOVE TRIGGERED! Current: ${projectData.floor_price} ${projectData.currency} >= Threshold: ${alertConfig.threshold_value} ${projectData.currency}`);
                  shouldNotify = true;
                  message = `Floor price reached ${alertConfig.threshold_value} ${projectData.currency}`;
                } else {
                  console.log(`🔔 Floor above not triggered: ${projectData.floor_price} ${projectData.currency} < ${alertConfig.threshold_value} ${projectData.currency}`);
                }
              } else {
                console.log(`🔔 Floor above check skipped: floor_price=${projectData.floor_price}, threshold_value=${alertConfig.threshold_value}`);
              }
              break;
              
            case 'floor_below':
              if (projectData.floor_price && alertConfig.threshold_value) {
                if (projectData.floor_price <= alertConfig.threshold_value) {
                  shouldNotify = true;
                  message = `Floor price dropped to ${alertConfig.threshold_value} ETH`;
                }
              }
              break;
              
            case 'volume_change':
              if (projectData.volume_24h && alertConfig.threshold_value) {
                const previousVolume = await getPreviousPrice(project.id, 'volume_24h', alertConfig.timeframe);
                if (previousVolume > 0) {
                  const change = projectData.volume_24h - previousVolume;
                  const percentageChange = (change / previousVolume) * 100;
                  
                  let shouldTrigger = false;
                  if (alertConfig.threshold_type === 'percentage') {
                    shouldTrigger = Math.abs(percentageChange) >= alertConfig.threshold_value;
                  } else {
                    shouldTrigger = Math.abs(change) >= alertConfig.threshold_value;
                  }
                  
                  if (shouldTrigger) {
                    shouldNotify = true;
                    percentageChange = percentageChange;
                    const changeDisplay = alertConfig.threshold_type === 'percentage' 
                      ? `${Math.abs(percentageChange).toFixed(2)}%` 
                      : `${Math.abs(change).toFixed(4)} ETH`;
                    message = `Volume ${change > 0 ? 'increased' : 'decreased'} by ${changeDisplay} in ${getTimeframeName(alertConfig.timeframe)}`;
                  }
                }
              }
              break;
              
            case 'volume_above':
              if (projectData.volume_24h && alertConfig.threshold_value) {
                if (projectData.volume_24h >= alertConfig.threshold_value) {
                  shouldNotify = true;
                  message = `Volume reached ${alertConfig.threshold_value} ETH`;
                }
              }
              break;
              
            case 'volume_below':
              if (projectData.volume_24h && alertConfig.threshold_value) {
                if (projectData.volume_24h <= alertConfig.threshold_value) {
                  shouldNotify = true;
                  message = `Volume dropped to ${alertConfig.threshold_value} ETH`;
                }
              }
              break;
              
            case 'sales_change':
              if (projectData.sales_count && alertConfig.threshold_value) {
                const previousSales = await getPreviousPrice(project.id, 'sales_count', alertConfig.timeframe);
                if (previousSales > 0) {
                  const change = projectData.sales_count - previousSales;
                  const percentageChange = (change / previousSales) * 100;
                  
                  if (Math.abs(percentageChange) >= alertConfig.threshold_value) {
                    shouldNotify = true;
                    percentageChange = percentageChange;
                    message = `Sales count ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(percentageChange).toFixed(2)}% in ${getTimeframeName(alertConfig.timeframe)}`;
                  }
                }
              }
              break;
              
            case 'listings_change':
              if (projectData.listings_count && alertConfig.threshold_value) {
                const previousListings = await getPreviousPrice(project.id, 'listings_count', alertConfig.timeframe);
                if (previousListings > 0) {
                  const change = projectData.listings_count - previousListings;
                  const percentageChange = (change / previousListings) * 100;
                  
                  if (Math.abs(percentageChange) >= alertConfig.threshold_value) {
                    shouldNotify = true;
                    percentageChange = percentageChange;
                    message = `Listings count ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(percentageChange).toFixed(2)}% in ${getTimeframeName(alertConfig.timeframe)}`;
                  }
                }
              }
              break;
          }
        }

        console.log(`🔔 Alert processing result: shouldNotify=${shouldNotify}, message="${message}"`);

        if (shouldNotify) {
          // Verificar si ya se envió una alerta reciente (evitar spam)
          const recentAlert = await pool.query(
            'SELECT * FROM price_history WHERE project_id = $1 AND recorded_at > NOW() - INTERVAL \'1 hour\'',
            [project.id]
          );

          if (recentAlert.rows.length === 0) {
            console.log(`🔔 Sending alert to user ${alert.discord_user_id}: ${message}`);
            // Enviar notificación a Discord
            await sendDiscordAlert(alert, projectData, message, percentageChange);
            
            console.log(`🚨 Alert sent: ${project.name} - ${message}`);
          } else {
            console.log(`🔔 Alert not sent: recent alert found within 1 hour`);
          }
        } else {
          console.log(`🔔 No alert triggered for user ${alert.discord_user_id}`);
        }
      } catch (alertError) {
        console.error('Error processing individual alert:', alertError);
      }
    }
  } catch (error) {
    console.log(`🔔 LOG ERROR: Error in checkAlerts for ${project.name}:`, error);
    console.error('Error checking alerts:', error);
  }
  console.log(`🔔 LOG END: checkAlerts function completed for ${project.name}`);
}

// Obtener precio anterior basado en timeframe
async function getPreviousPrice(projectId, field, timeframe) {
  try {
    const now = new Date();
    let timeAgo;
    
    switch (timeframe) {
      case '1h':
        timeAgo = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '7d':
        timeAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        timeAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default: // 24h
        timeAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    
    const result = await pool.query(
      `SELECT ${field} FROM price_history WHERE project_id = $1 AND recorded_at >= $2 ORDER BY recorded_at ASC LIMIT 1`,
      [projectId, timeAgo.toISOString()]
    );
    
    return result.rows.length > 0 ? parseFloat(result.rows[0][field] || 0) : 0;
  } catch (error) {
    console.error('Error getting previous price:', error);
    return 0;
  }
}

// Enviar alerta a Discord
async function sendDiscordAlert(alert, projectData, message, percentageChange) {
  try {
    // Obtener información del proyecto
    const projectResult = await pool.query('SELECT * FROM nft_projects WHERE id = $1', [alert.project_id]);
    const project = projectResult.rows[0];
    
    if (!project) return;

    const currency = projectData.currency || 'ETH';
    const changeEmoji = percentageChange > 0 ? '📈' : '📉';
    const changeColor = percentageChange > 0 ? '#10B981' : '#EF4444';

    const embed = new EmbedBuilder()
      .setTitle(`${changeEmoji} ${project.name} - Alert`)
      .setDescription(`**${message}**`)
      .setColor(changeColor)
      .addFields(
        { 
          name: '💰 Floor Price', 
          value: `${projectData.floor_price.toFixed(2)} ${currency}`, 
          inline: true 
        },
        { 
          name: '📊 Volume 24h', 
          value: `${projectData.volume_24h.toFixed(2)} ${currency}`, 
          inline: true 
        },
        { 
          name: '🛒 Sales Count', 
          value: `${projectData.sales_count}`, 
          inline: true 
        }
      )
      .setTimestamp();

    // Por ahora solo log - necesitarías configurar un canal específico
    console.log(`🚨 Discord Alert: ${project.name} - ${message}`);
    
  } catch (error) {
    console.error('Error sending Discord alert:', error);
  }
}

// Obtener datos del proyecto desde múltiples APIs con retry logic
async function getProjectData(contractAddress) {
  console.log(`🔍 Fetching data for contract: ${contractAddress}`);
  
  // Intentar diferentes APIs según el marketplace
  const apis = [
    () => getMagicEdenData(contractAddress),
    () => getOpenSeaData(contractAddress),
    () => getMonadData(contractAddress)
  ];

  for (const api of apis) {
    try {
      const data = await api();
      if (data && data.floor_price > 0) {
        console.log(`✅ Data found via API:`, data);
        return data;
      }
    } catch (error) {
      console.log(`❌ API failed:`, error.message);
    }
  }

  // Fallback: datos simulados para testing
  console.log(`⚠️ No real data found, using simulated data`);
  return {
    floor_price: Math.random() * 0.5 + 0.1,
    volume_24h: Math.random() * 10 + 1,
    sales_count: Math.floor(Math.random() * 20) + 1,
    listings_count: Math.floor(Math.random() * 100) + 10,
    avg_sale_price: Math.random() * 0.6 + 0.2
  };
}

// Magic Eden API (Ethereum + Monad Testnet) - CORRECT ENDPOINTS WITH RETRY
async function getMagicEdenData(contractAddress) {
  try {
    // Intentar diferentes endpoints según la red
    const endpoints = [
      // Endpoint correcto para colecciones de Ethereum (v7 con id)
      {
        url: `https://api-mainnet.magiceden.dev/v3/rtp/ethereum/collections/v7?id=${contractAddress}&includeMintStages=false&includeSecurityConfigs=false&normalizeRoyalties=false&useNonFlaggedFloorAsk=false&sortBy=allTimeVolume&limit=20`,
        chain: 'ethereum'
      },
      // Endpoint correcto para colecciones de Monad Testnet (v7 con id)
      {
        url: `https://api-mainnet.magiceden.dev/v3/rtp/monad-testnet/collections/v7?id=${contractAddress}&includeMintStages=false&includeSecurityConfigs=false&normalizeRoyalties=false&useNonFlaggedFloorAsk=false&sortBy=allTimeVolume&limit=20`,
        chain: 'monad-testnet'
      }
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying Magic Eden endpoint: ${endpoint.url}`);
        
        const response = await axios.get(endpoint.url, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Discord-Bot/1.0'
          },
          timeout: 15000
        });

        if (response.data) {
          console.log(`✅ Magic Eden data found:`, response.data);
          
          // Para API v3, buscar la colección específica en el array
          let collection = null;
          
          if (response.data.collections && Array.isArray(response.data.collections)) {
            console.log(`Searching in ${response.data.collections.length} collections...`);
            
            // Buscar la colección por múltiples criterios
            collection = response.data.collections.find(col => {
              const matches = 
                col.id === contractAddress ||
                col.primaryContract === contractAddress ||
                col.symbol === contractAddress ||
                col.slug === contractAddress ||
                col.name.toLowerCase().includes(contractAddress.toLowerCase()) ||
                (col.primaryContract && col.primaryContract.toLowerCase() === contractAddress.toLowerCase()) ||
                (col.symbol && col.symbol.toLowerCase() === contractAddress.toLowerCase());
              
              if (matches) {
                console.log(`Found potential match: ${col.name} (${col.symbol}) - Contract: ${col.primaryContract}`);
              }
              
              return matches;
            });
          }
          
          // Si no encontramos la colección específica, no usar ninguna (evitar datos incorrectos)
          if (!collection) {
            console.log(`Collection with identifier ${contractAddress} not found in Magic Eden v3`);
            continue;
          }
          
          if (collection) {
            console.log(`Found collection: ${collection.name} (${collection.symbol})`);
            
            // Extraer datos de precios de la estructura v3
            const floorAsk = collection.floorAsk;
            const volume = collection.volume;
            
            // Obtener precio
            const priceInETH = floorAsk?.price?.amount?.decimal || 0;
            
            // Obtener top bid si está disponible
            const topBid = collection.topBid?.price?.amount?.decimal || 0;
            
            // Determinar moneda y conversión USD
            const isMonad = endpoint.chain === 'monad-testnet';
            const currency = isMonad ? 'MON' : 'ETH';
            
            // Obtener precio real de ETH para conversión USD
            let priceUSD = 0;
            if (isMonad) {
              priceUSD = priceInETH * 0.02; // MON testnet
            } else {
              try {
                const ethPrice = await getETHPrice();
                priceUSD = priceInETH * ethPrice;
              } catch (error) {
                console.error('Error getting ETH price for USD conversion:', error);
                priceUSD = 0; // Mostrar 0 si no se puede obtener el precio
              }
            }
            
            return {
              floor_price: priceInETH,
              volume_24h: volume?.["1day"] || 0,
              sales_count: collection.salesCount || 0,
              listings_count: collection.onSaleCount || 0,
              avg_sale_price: collection.avgPrice || 0,
              top_bid: topBid,
              source: 'Magic Eden',
              currency: currency,
              image: collection.image || null,
              marketplace_url: `https://magiceden.io/${endpoint.chain}/collections/${collection.slug || collection.id}`,
              price_usd: priceUSD
            };
          }
        }
      } catch (error) {
        console.log(`❌ Magic Eden endpoint failed: ${endpoint.url}`, error.message);
        if (error.response) {
          console.log(`❌ Response status: ${error.response.status}`);
          console.log(`❌ Response data:`, error.response.data);
          
          // Si es error 503, esperar un poco antes de continuar
          if (error.response.status === 503) {
            console.log(`⏳ Magic Eden API is down (503), waiting 2 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.log(`❌ Magic Eden API error:`, error.message);
    return null;
  }
}

// OpenSea API (Ethereum)
async function getOpenSeaData(contractAddress) {
  const response = await axios.get(`https://api.opensea.io/api/v1/collection/${contractAddress}/stats`, {
    headers: {
      'X-API-KEY': process.env.OPENSEA_API_KEY || '',
      'Content-Type': 'application/json'
    },
    timeout: 5000
  });

  if (response.data && response.data.stats) {
    const stats = response.data.stats;
    return {
      floor_price: parseFloat(stats.floor_price) || 0,
      volume_24h: parseFloat(stats.one_day_volume) || 0,
      sales_count: parseInt(stats.one_day_sales) || 0,
      listings_count: parseInt(stats.count) || 0,
      avg_sale_price: parseFloat(stats.average_price) || 0,
      source: 'OpenSea'
    };
  }
}

// Monad RPC (para proyectos de Monad Testnet/Mainnet)
async function getMonadData(contractAddress) {
  // TODO: Implementar integración con Monad RPC
  // Por ahora retornamos null para que use otras APIs
  console.log(`🔍 Monad RPC not implemented yet for ${contractAddress}`);
  return null;
}

// Verificar alertas
async function checkAlerts(project, newData) {
  console.log(`🔔 REAL checkAlerts: Starting for ${project.name} (ID: ${project.id})`);
  
  try {
    console.log(`🔔 REAL checkAlerts: About to query database for project ${project.id}`);
    const result = await pool.query(
      'SELECT * FROM user_alerts WHERE project_id = $1 AND is_active = true',
      [project.id]
    );
    const alerts = result.rows;

    console.log(`🔔 REAL checkAlerts: Found ${alerts.length} active alerts for project ${project.name}`);
    console.log(`🔔 REAL checkAlerts: Alert data:`, alerts);

    if (!alerts.length) {
      console.log(`🔔 REAL checkAlerts: No active alerts found for project ${project.name}`);
      return;
    }

    // Obtener configuración del servidor para el guild_id
    const serverConfig = await pool.query('SELECT guild_id FROM server_config LIMIT 1');
    const guildId = serverConfig.rows.length > 0 ? serverConfig.rows[0].guild_id : null;

    console.log(`🔔 REAL checkAlerts: Processing ${alerts.length} alerts`);
    for (const alert of alerts) {
      console.log(`🔔 REAL checkAlerts: Processing alert for user ${alert.discord_user_id}`);
      await processAlert(alert, project, newData, guildId);
    }
  } catch (error) {
    console.error('Error checking alerts:', error);
  }
}

// Procesar alerta individual
async function processAlert(alert, project, newData, guildId) {
  console.log(`🔔 processAlert: Starting for user ${alert.discord_user_id}, project ${project.name}`);
  
  try {
    console.log(`🔔 processAlert: About to fetch user ${alert.discord_user_id}`);
    const user = await client.users.fetch(alert.discord_user_id);
    console.log(`🔔 processAlert: User fetched:`, user ? user.username : 'null');
    
    if (!user) {
      console.log(`🔔 processAlert: User not found, returning`);
      return;
    }

    console.log(`🔔 processAlert: Alert types:`, alert.alert_types);
    console.log(`🔔 processAlert: Project data:`, newData);
    
    // Parsear alert_types JSON
    let alertConfigs = [];
    try {
      alertConfigs = JSON.parse(alert.alert_types);
      console.log(`🔔 processAlert: Parsed alert configs:`, alertConfigs);
    } catch (error) {
      console.log(`🔔 processAlert: Error parsing alert_types JSON:`, error);
      return;
    }

    let shouldNotify = false;
    let message = '';

    // Procesar cada configuración de alerta
    for (const alertConfig of alertConfigs) {
      console.log(`🔔 processAlert: Processing alert config:`, alertConfig);
      
      if (!alertConfig.enabled) {
        console.log(`🔔 processAlert: Alert config disabled, skipping`);
        continue;
      }

      // Verificar floor price
      if (alertConfig.type === 'floor_above' || alertConfig.type === 'floor_below') {
        console.log(`🔔 processAlert: Checking floor price ${alertConfig.type}`);
        console.log(`🔔 processAlert: Current floor: ${newData.floor_price}, threshold: ${alertConfig.threshold_value}`);
        
        let conditionMet = false;
        if (alertConfig.type === 'floor_above' && newData.floor_price > alertConfig.threshold_value) {
          conditionMet = true;
          console.log(`🔔 processAlert: Floor above threshold met!`);
        } else if (alertConfig.type === 'floor_below' && newData.floor_price < alertConfig.threshold_value) {
          conditionMet = true;
          console.log(`🔔 processAlert: Floor below threshold met!`);
        }
        
        if (conditionMet) {
          shouldNotify = true;
          const currency = newData.currency || 'ETH';
          message += `💰 Floor: ${newData.floor_price.toFixed(2)} ${currency} (${alertConfig.type === 'floor_above' ? 'above' : 'below'} ${alertConfig.threshold_value} ${currency})\n`;
        }
      }

      // Verificar volumen
      if (alertConfig.type === 'volume_above' || alertConfig.type === 'volume_below') {
        console.log(`🔔 processAlert: Checking volume ${alertConfig.type}`);
        console.log(`🔔 processAlert: Current volume: ${newData.volume_24h}, threshold: ${alertConfig.threshold_value}`);
        
        let conditionMet = false;
        if (alertConfig.type === 'volume_above' && newData.volume_24h > alertConfig.threshold_value) {
          conditionMet = true;
          console.log(`🔔 processAlert: Volume above threshold met!`);
        } else if (alertConfig.type === 'volume_below' && newData.volume_24h < alertConfig.threshold_value) {
          conditionMet = true;
          console.log(`🔔 processAlert: Volume below threshold met!`);
        }
        
        if (conditionMet) {
          shouldNotify = true;
          const currency = newData.currency || 'ETH';
          message += `📊 Volume: ${newData.volume_24h.toFixed(2)} ${currency} (${alertConfig.type === 'volume_above' ? 'above' : 'below'} ${alertConfig.threshold_value} ${currency})\n`;
        }
      }

      // Verificar ventas
      if (alertConfig.type === 'sales_change') {
        console.log(`🔔 processAlert: Checking sales change`);
        console.log(`🔔 processAlert: Current sales: ${newData.sales_count}, threshold: ${alertConfig.threshold_value}`);
        
        if (newData.sales_count >= alertConfig.threshold_value) {
          shouldNotify = true;
          console.log(`🔔 processAlert: Sales threshold met!`);
          message += `🛒 Sales: ${newData.sales_count} (above ${alertConfig.threshold_value})\n`;
        }
      }

      // Verificar listings
      if (alertConfig.type === 'listings_change') {
        console.log(`🔔 processAlert: Checking listings change`);
        console.log(`🔔 processAlert: Current listings: ${newData.listings_count}, threshold: ${alertConfig.threshold_value}`);
        
        if (parseInt(newData.listings_count) >= alertConfig.threshold_value) {
          shouldNotify = true;
          console.log(`🔔 processAlert: Listings threshold met!`);
          message += `📋 Listings: ${newData.listings_count} (above ${alertConfig.threshold_value})\n`;
        }
      }
    }

    if (shouldNotify) {
      console.log(`🔔 processAlert: Sending notification for project ${project.name}`);
      
      // Obtener configuración del servidor para el canal de alertas
      const serverConfig = await pool.query(
        'SELECT alerts_channel_id FROM server_config WHERE guild_id = $1',
        [guildId || 'default'] // Usar guildId pasado como parámetro
      );

      const embed = new EmbedBuilder()
        .setTitle(`🚨 Alert: ${project.name}`)
        .setDescription(message)
        .setColor(0xff0000)
        .setTimestamp();

      // Intentar enviar al canal configurado
      if (serverConfig.rows.length > 0 && serverConfig.rows[0].alerts_channel_id) {
        try {
          const channel = client.channels.cache.get(serverConfig.rows[0].alerts_channel_id);
          if (channel) {
            await channel.send({ embeds: [embed] });
            console.log(`🔔 processAlert: Notification sent to channel ${channel.name}!`);
            return;
          }
        } catch (error) {
          console.error('Error sending to channel:', error);
        }
      }

      // Fallback: enviar DM al usuario (solo si no hay canal configurado)
      console.log(`🔔 processAlert: No channel configured, sending DM to user ${user.username}`);
      await user.send({ embeds: [embed] });
      console.log(`🔔 processAlert: Notification sent via DM successfully!`);
    } else {
      console.log(`🔔 processAlert: No conditions met, no notification sent`);
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
      case 'test-api':
        await handleTestApiCommand(interaction);
        break;
      case 'alerts':
        await handleAlertsCommand(interaction);
        break;
      case 'delete':
        await handleDeleteCommand(interaction);
        break;
    }
  } catch (error) {
    console.error(`Error handling command ${commandName}:`, error);
    await interaction.reply({ content: '❌ Error interno. Intenta de nuevo.', flags: 64 });
  }
});

// Manejar autocompletado
client.on('interactionCreate', async interaction => {
  if (!interaction.isAutocomplete()) return;

  try {
    const focusedValue = interaction.options.getFocused();
    
    if (interaction.commandName === 'status' || 
        interaction.commandName === 'floor' || 
        interaction.commandName === 'volume' ||
        interaction.commandName === 'delete' ||
        (interaction.commandName === 'alerts' && interaction.options.getSubcommand() === 'setup') ||
        (interaction.commandName === 'alerts' && interaction.options.getSubcommand() === 'disable')) {
      
      const projects = await getProjectsList();
      const filtered = projects
        .filter(project => project.toLowerCase().includes(focusedValue.toLowerCase()))
        .slice(0, 25); // Discord limita a 25 opciones
      
      await interaction.respond(
        filtered.map(project => ({ name: project, value: project }))
      );
    }
  } catch (error) {
    console.error('Error handling autocomplete:', error);
  }
});

// Manejar comando setup
async function handleSetupCommand(interaction) {
  const projectName = interaction.options.getString('project');
  const contractAddress = interaction.options.getString('contract');

  try {
    await interaction.deferReply();
    
    // Verificar si el proyecto ya existe
    const existingProject = await pool.query('SELECT * FROM nft_projects WHERE name = $1 OR contract_address = $2', [projectName, contractAddress]);
    
    if (existingProject.rows.length > 0) {
      await interaction.editReply({ content: '❌ El proyecto ya existe.' });
      return;
    }

    // Validar el proyecto antes de agregarlo
    const validation = await validateProject(contractAddress);
    
    if (!validation.valid) {
      await interaction.editReply({ content: `❌ **Error de validación:** ${validation.error}` });
      return;
    }

    // Insertar nuevo proyecto con datos iniciales
    const result = await pool.query(
      'INSERT INTO nft_projects (name, contract_address, marketplace, status, last_floor_price, last_volume, last_sales_count, last_listings_count, last_avg_sale_price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [
        projectName, 
        contractAddress,
        'magic-eden',
        'active',
        validation.data.floor_price,
        validation.data.volume_24h,
        validation.data.sales_count,
        validation.data.listings_count,
        validation.data.avg_sale_price
      ]
    );

    const project = result.rows[0];
    const currency = validation.data.currency || 'ETH';
    
    const embed = new EmbedBuilder()
      .setTitle('✅ Proyecto Configurado')
      .setDescription(`**${projectName}** ha sido configurado para tracking`)
      .addFields(
        { name: 'Contract', value: contractAddress, inline: true },
        { name: 'Marketplace', value: 'Magic Eden', inline: true },
        { name: 'Status', value: 'Active', inline: true },
        { name: 'Floor Price', value: `${validation.data.floor_price.toFixed(2)} ${currency}`, inline: true },
        { name: 'Volume 24h', value: `${validation.data.volume_24h.toFixed(2)} ${currency}`, inline: true },
        { name: 'Sales', value: `${validation.data.sales_count}`, inline: true }
      )
      .setColor('#10B981')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleSetupCommand:', error);
    await interaction.editReply({ content: '❌ Error interno.' });
  }
}

// Manejar comando status
async function handleStatusCommand(interaction) {
  const projectName = interaction.options.getString('project');

  try {
    const result = await pool.query('SELECT * FROM nft_projects WHERE name = $1', [projectName]);
    const project = result.rows[0];

    if (!project) {
      await interaction.reply({ content: '❌ Proyecto no encontrado.', flags: 64 });
      return;
    }

    // Obtener datos frescos de la API
    await interaction.deferReply();
    const projectData = await getProjectData(project.contract_address);

    // Crear embed con información mejorada
    const embed = new EmbedBuilder()
      .setTitle(`📊 ${project.name} - Status`)
      .setColor('#7C3AED')
      .setTimestamp();

    // Agregar imagen si está disponible
    if (projectData?.image) {
      embed.setThumbnail(projectData.image);
    }

    // Determinar moneda y formato de precios
    const currency = projectData?.currency || 'ETH';
    const floorPrice = projectData?.floor_price || 0;
    const topBid = projectData?.top_bid || 0;
    const priceUSD = projectData?.price_usd || 0;

    // Campos principales
    embed.addFields(
      { 
        name: '💰 Floor Price', 
        value: `${floorPrice.toFixed(2)} ${currency}\n($${priceUSD.toFixed(2)} USD)`, 
        inline: true 
      },
      { 
        name: '🎯 Top Bid', 
        value: `${topBid.toFixed(2)} ${currency}\n($${(topBid * (currency === 'MON' ? 0.02 : await getETHPrice())).toFixed(2)} USD)`, 
        inline: true 
      },
      { 
        name: '📊 Volume 24h', 
        value: `${(projectData?.volume_24h || 0).toFixed(2)} ${currency}`, 
        inline: true 
      },
      { 
        name: '🛒 Sales Count', 
        value: `${projectData?.sales_count || 'N/A'}`, 
        inline: true 
      },
      { 
        name: '📋 Listings', 
        value: `${projectData?.listings_count || 'N/A'}`, 
        inline: true 
      },
      { 
        name: '🔗 Contract', 
        value: `${project.contract_address.slice(0, 10)}...`, 
        inline: true 
      }
    );

    // Agregar URL del marketplace si está disponible
    if (projectData?.marketplace_url) {
      embed.addFields({
        name: '🏪 Marketplace',
        value: `[View on Magic Eden](${projectData.marketplace_url})`,
        inline: false
      });
    }

    embed.setFooter({ text: `Data source: ${projectData?.source || 'Simulated'} • Status: ${project.status}` });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleStatusCommand:', error);
    await interaction.editReply({ content: '❌ Error interno.' });
  }
}

// Manejar comando test-api
async function handleTestApiCommand(interaction) {
  try {
    await interaction.deferReply();
    
    const embed = new EmbedBuilder()
      .setTitle('🔍 Testing Magic Eden API')
      .setDescription('Probando conexión con Magic Eden API...')
      .setColor('#FFA500')
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
    
    // Test Ethereum (Moriusa)
    const moriusaContract = '0xa8edf6c9ac6bf1a00afaaca6e0ca705b89192fb9';
    const ethereumUrl = `https://api-mainnet.magiceden.dev/v3/rtp/ethereum/collections/v7?id=${moriusaContract}&includeMintStages=false&includeSecurityConfigs=false&normalizeRoyalties=false&useNonFlaggedFloorAsk=false&sortBy=allTimeVolume&limit=20`;
    
    console.log(`🔍 Testing Ethereum API: ${ethereumUrl}`);
    
    let ethereumResult = '❌ Failed';
    try {
      const response = await axios.get(ethereumUrl, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Discord-Bot/1.0'
        },
        timeout: 15000
      });
      
      if (response.status === 200) {
        ethereumResult = `✅ Success (${response.data.collections?.length || 0} collections)`;
        if (response.data.collections && response.data.collections.length > 0) {
          const moriusa = response.data.collections.find(col => 
            col.primaryContract === moriusaContract ||
            col.name.toLowerCase().includes('moriusa')
          );
          if (moriusa) {
            ethereumResult += `\n🎯 Found: ${moriusa.name} - Floor: ${moriusa.floorAsk?.price?.amount?.decimal || 'N/A'}`;
          }
        }
      } else {
        ethereumResult = `❌ Status: ${response.status}`;
      }
    } catch (error) {
      ethereumResult = `❌ Error: ${error.response?.status || error.message}`;
    }
    
    // Test Monad Testnet (Momo)
    const momoContract = '0xbc8f6824fde979848ad97a52bced2d6ca1842a68';
    const monadUrl = `https://api-mainnet.magiceden.dev/v3/rtp/monad-testnet/collections/v7?id=${momoContract}&includeMintStages=false&includeSecurityConfigs=false&normalizeRoyalties=false&useNonFlaggedFloorAsk=false&sortBy=allTimeVolume&limit=20`;
    
    console.log(`🔍 Testing Monad API: ${monadUrl}`);
    
    let monadResult = '❌ Failed';
    try {
      const response = await axios.get(monadUrl, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Discord-Bot/1.0'
        },
        timeout: 15000
      });
      
      if (response.status === 200) {
        monadResult = `✅ Success (${response.data.collections?.length || 0} collections)`;
        if (response.data.collections && response.data.collections.length > 0) {
          const momo = response.data.collections.find(col => 
            col.primaryContract === momoContract ||
            col.name.toLowerCase().includes('momo')
          );
          if (momo) {
            monadResult += `\n🎯 Found: ${momo.name} - Floor: ${momo.floorAsk?.price?.amount?.decimal || 'N/A'}`;
          }
        }
      } else {
        monadResult = `❌ Status: ${response.status}`;
      }
    } catch (error) {
      monadResult = `❌ Error: ${error.response?.status || error.message}`;
    }
    
    // Update embed with results
    const resultEmbed = new EmbedBuilder()
      .setTitle('🔍 Magic Eden API Test Results')
      .addFields(
        { name: '🌐 Ethereum API', value: ethereumResult, inline: false },
        { name: '🔗 Monad Testnet API', value: monadResult, inline: false }
      )
      .setColor('#7C3AED')
      .setTimestamp();
    
    await interaction.editReply({ embeds: [resultEmbed] });
    
  } catch (error) {
    console.error('Error in handleTestApiCommand:', error);
    await interaction.editReply({ content: '❌ Error interno.' });
  }
}

// Manejar comando projects
async function handleProjectsCommand(interaction) {
  try {
    const result = await pool.query('SELECT * FROM nft_projects WHERE status = $1 ORDER BY created_at DESC', ['active']);
    const projects = result.rows;

    if (!projects.length) {
      await interaction.reply({ content: '📋 No hay proyectos configurados.', flags: 64 });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Proyectos Tracked')
      .setDescription(`Total: ${projects.length} proyectos`)
      .setColor('#7C3AED')
      .setTimestamp();

    // Obtener datos frescos para cada proyecto para mostrar la moneda correcta
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      const projectData = await getProjectData(project.contract_address);
      const currency = projectData?.currency || 'ETH';
      
      embed.addFields({
        name: `${i + 1}. ${project.name}`,
        value: `Floor: ${project.last_floor_price || 'N/A'} ${currency}\nVolume: ${project.last_volume || 'N/A'} ${currency}`,
        inline: true
      });
    }

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleProjectsCommand:', error);
    await interaction.reply({ content: '❌ Error interno.', flags: 64 });
  }
}

// Manejar comando floor
async function handleFloorCommand(interaction) {
  const projectName = interaction.options.getString('project');
  const period = interaction.options.getString('period') || '24h';

  try {
    const result = await pool.query('SELECT * FROM nft_projects WHERE name = $1', [projectName]);
    const project = result.rows[0];

    if (!project) {
      await interaction.reply({ content: '❌ Proyecto no encontrado.', flags: 64 });
      return;
    }

    // Obtener datos frescos de la API
    await interaction.deferReply();
    const projectData = await getProjectData(project.contract_address);

    // Crear embed mejorado para floor price
    const embed = new EmbedBuilder()
      .setTitle(`💰 ${project.name} - Floor Price`)
      .setDescription(`Período: ${period}`)
      .setColor('#10B981')
      .setTimestamp();

    // Agregar imagen si está disponible
    if (projectData?.image) {
      embed.setThumbnail(projectData.image);
    }

    // Determinar moneda y formato de precios
    const currency = projectData?.currency || 'ETH';
    const floorPrice = projectData?.floor_price || 0;
    const priceUSD = projectData?.price_usd || 0;

    embed.addFields(
      { 
        name: '💰 Floor Price', 
        value: `${floorPrice.toFixed(2)} ${currency}\n($${priceUSD.toFixed(2)} USD)`, 
        inline: true 
      },
      { 
        name: '📊 Volume 24h', 
        value: `${(projectData?.volume_24h || 0).toFixed(2)} ${currency}`, 
        inline: true 
      },
      { 
        name: '⏰ Period', 
        value: period || '24h', 
        inline: true 
      }
    );

    // Agregar URL del marketplace si está disponible
    if (projectData?.marketplace_url) {
      embed.addFields({
        name: '🏪 Marketplace',
        value: `[View on Magic Eden](${projectData.marketplace_url})`,
        inline: false
      });
    }

    embed.setFooter({ text: `Data source: ${projectData?.source || 'Simulated'}` });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleFloorCommand:', error);
    await interaction.editReply({ content: '❌ Error interno.' });
  }
}

// Manejar comando volume
async function handleVolumeCommand(interaction) {
  const projectName = interaction.options.getString('project');
  const period = interaction.options.getString('period') || '24h';

  try {
    const result = await pool.query('SELECT * FROM nft_projects WHERE name = $1', [projectName]);
    const project = result.rows[0];

    if (!project) {
      await interaction.reply({ content: '❌ Proyecto no encontrado.', flags: 64 });
      return;
    }

    // Obtener datos frescos de la API
    await interaction.deferReply();
    const projectData = await getProjectData(project.contract_address);

    // Crear embed mejorado para volume
    const embed = new EmbedBuilder()
      .setTitle(`📊 ${project.name} - Volume`)
      .setDescription(`Período: ${period}`)
      .setColor('#F59E0B')
      .setTimestamp();

    // Agregar imagen si está disponible
    if (projectData?.image) {
      embed.setThumbnail(projectData.image);
    }

    // Determinar moneda y formato de precios
    const currency = projectData?.currency || 'ETH';
    const volume24h = projectData?.volume_24h || 0;
    const avgSalePrice = projectData?.avg_sale_price || 0;

    embed.addFields(
      { 
        name: '📊 Volume 24h', 
        value: `${volume24h.toFixed(2)} ${currency}`, 
        inline: true 
      },
      { 
        name: '🛒 Sales Count', 
        value: `${projectData?.sales_count || 'N/A'}`, 
        inline: true 
      },
      { 
        name: '💰 Avg Sale Price', 
        value: `${avgSalePrice.toFixed(2)} ${currency}`, 
        inline: true 
      }
    );

    // Agregar URL del marketplace si está disponible
    if (projectData?.marketplace_url) {
      embed.addFields({
        name: '🏪 Marketplace',
        value: `[View on Magic Eden](${projectData.marketplace_url})`,
        inline: false
      });
    }

    embed.setFooter({ text: `Data source: ${projectData?.source || 'Simulated'}` });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleVolumeCommand:', error);
    await interaction.editReply({ content: '❌ Error interno.' });
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
    case 'remove':
      await handleAlertsRemove(interaction);
      break;
    case 'channel':
      await handleAlertsChannel(interaction);
      break;
    case 'enable-role':
      await handleAlertsEnableRole(interaction);
      break;
    case 'disable-role':
      await handleAlertsDisableRole(interaction);
      break;
    case 'status':
      await handleAlertsStatus(interaction);
      break;
  }
}

// Manejar setup de alertas
async function handleAlertsSetup(interaction) {
  // Verificar permisos: admin o rol habilitado
  const isAdmin = await hasAdminPermissions(interaction);
  const hasRole = await hasEnabledRole(interaction);
  
  if (!isAdmin && !hasRole) {
    await interaction.reply({ 
      content: '❌ No tienes permisos para configurar alertas. Contacta a un administrador.', 
      flags: 64 
    });
    return;
  }

  const projectName = interaction.options.getString('project');
  const alertType = interaction.options.getString('alert_type');
  const timeframe = interaction.options.getString('timeframe') || '24h';
  const thresholdType = interaction.options.getString('threshold_type') || 'percentage';
  const thresholdValue = interaction.options.getNumber('threshold_value') || (thresholdType === 'percentage' ? 5 : 0.1);
  
  // Debug: Log the raw values
  console.log(`🔍 Raw threshold_value: ${interaction.options.getNumber('threshold_value')}`);
  console.log(`🔍 thresholdType: ${thresholdType}`);
  console.log(`🔍 Final thresholdValue: ${thresholdValue}`);

  try {
    const result = await pool.query('SELECT * FROM nft_projects WHERE name = $1', [projectName]);
    const project = result.rows[0];

    if (!project) {
      await interaction.reply({ content: '❌ Proyecto no encontrado.', flags: 64 });
      return;
    }

    // Crear configuración de alerta más específica
    const alertConfig = {
      type: alertType,
      timeframe: timeframe,
      threshold_type: thresholdType,
      threshold_value: thresholdValue,
      enabled: true
    };

    // Verificar si ya existe una alerta para este usuario y proyecto
    const existingAlert = await pool.query(
      'SELECT * FROM user_alerts WHERE discord_user_id = $1 AND project_id = $2',
      [interaction.user.id, project.id]
    );

    if (existingAlert.rows.length > 0) {
      // Actualizar alerta existente - agregar nueva configuración al array existente
      const existingConfigs = JSON.parse(existingAlert.rows[0].alert_types || '[]');
      
      // Verificar si ya existe una configuración similar
      const similarConfig = existingConfigs.find(config => 
        config.type === alertConfig.type && 
        config.threshold_type === alertConfig.threshold_type &&
        config.threshold_value === alertConfig.threshold_value &&
        config.timeframe === alertConfig.timeframe
      );
      
      if (similarConfig) {
        await interaction.reply({ 
          content: '⚠️ Ya tienes una alerta idéntica configurada para este proyecto.', 
          flags: 64 
        });
        return;
      }
      
      // Agregar nueva configuración al array existente
      existingConfigs.push(alertConfig);
      
      await pool.query(
        'UPDATE user_alerts SET alert_types = $1, updated_at = NOW() WHERE discord_user_id = $2 AND project_id = $3',
        [JSON.stringify(existingConfigs), interaction.user.id, project.id]
      );
    } else {
      // Insertar nueva alerta
      await pool.query(
        'INSERT INTO user_alerts (discord_user_id, project_id, alert_types, floor_threshold, volume_threshold, is_active) VALUES ($1, $2, $3, $4, $5, $6)',
        [interaction.user.id, project.id, JSON.stringify([alertConfig]), thresholdValue, thresholdValue, true]
      );
    }

        // Obtener la moneda del proyecto para mostrar correctamente
        const projectData = await getProjectData(project.contract_address);
        const currency = projectData?.currency || 'ETH';
        const thresholdDisplay = thresholdType === 'percentage' ? `${thresholdValue}%` : `${thresholdValue} ${currency}`;
    const embed = new EmbedBuilder()
      .setTitle('✅ Alerta Configurada')
      .setDescription(`Alerta configurada para **${projectName}**`)
      .addFields(
        { name: 'Tipo', value: getAlertTypeName(alertType), inline: true },
        { name: 'Período', value: getTimeframeName(timeframe), inline: true },
        { name: 'Umbral', value: thresholdDisplay, inline: true }
      )
      .setColor('#10B981')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleAlertsSetup:', error);
    await interaction.reply({ content: '❌ Error interno.', flags: 64 });
  }
}

// Manejar eliminación de alerta específica
async function handleAlertsRemove(interaction) {
  const projectName = interaction.options.getString('project');
  const alertType = interaction.options.getString('alert_type');

  try {
    const result = await pool.query('SELECT * FROM nft_projects WHERE name = $1', [projectName]);
    const project = result.rows[0];

    if (!project) {
      await interaction.reply({ content: '❌ Proyecto no encontrado.', flags: 64 });
      return;
    }

    const alertResult = await pool.query(
      'SELECT * FROM user_alerts WHERE discord_user_id = $1 AND project_id = $2',
      [interaction.user.id, project.id]
    );

    if (alertResult.rows.length === 0) {
      await interaction.reply({ content: '❌ No tienes alertas configuradas para este proyecto.', flags: 64 });
      return;
    }

    const alert = alertResult.rows[0];
    const alertConfigs = JSON.parse(alert.alert_types || '[]');
    
    // Filtrar la configuración específica
    const filteredConfigs = alertConfigs.filter(config => config.type !== alertType);
    
    if (filteredConfigs.length === alertConfigs.length) {
      await interaction.reply({ 
        content: `❌ No tienes una alerta de tipo "${getAlertTypeName(alertType)}" configurada para este proyecto.`, 
        flags: 64 
      });
      return;
    }

    if (filteredConfigs.length === 0) {
      // Si no quedan configuraciones, eliminar toda la alerta
      await pool.query(
        'DELETE FROM user_alerts WHERE discord_user_id = $1 AND project_id = $2',
        [interaction.user.id, project.id]
      );
      await interaction.reply({ 
        content: `✅ Alerta "${getAlertTypeName(alertType)}" eliminada de **${projectName}**. No quedan más alertas para este proyecto.` 
      });
    } else {
      // Actualizar con las configuraciones restantes
      await pool.query(
        'UPDATE user_alerts SET alert_types = $1, updated_at = NOW() WHERE discord_user_id = $2 AND project_id = $3',
        [JSON.stringify(filteredConfigs), interaction.user.id, project.id]
      );
      await interaction.reply({ 
        content: `✅ Alerta "${getAlertTypeName(alertType)}" eliminada de **${projectName}**. Te quedan ${filteredConfigs.length} alertas más.` 
      });
    }
  } catch (error) {
    console.error('Error in handleAlertsRemove:', error);
    await interaction.reply({ content: '❌ Error interno.', flags: 64 });
  }
}

// Helper functions para nombres más amigables
function getAlertTypeName(type) {
  const names = {
    'floor_change': 'Floor Price Change',
    'floor_above': 'Floor Price Above',
    'floor_below': 'Floor Price Below',
    'volume_change': 'Volume Change',
    'volume_above': 'Volume Above',
    'volume_below': 'Volume Below',
    'sales_change': 'Sales Count Change',
    'listings_change': 'Listings Count Change'
  };
  return names[type] || type;
}

function getTimeframeName(timeframe) {
  const names = {
    '1h': '1 hora',
    '24h': '24 horas',
    '7d': '7 días',
    '30d': '30 días'
  };
  return names[timeframe] || timeframe;
}

// Manejar listado de alertas
async function handleAlertsList(interaction) {
  try {
    const result = await pool.query(
      'SELECT ua.*, np.name as project_name FROM user_alerts ua JOIN nft_projects np ON ua.project_id = np.id WHERE ua.discord_user_id = $1 AND ua.is_active = true',
      [interaction.user.id]
    );
    const alerts = result.rows;

    if (!alerts.length) {
      await interaction.reply({ content: '📋 No tienes alertas configuradas.', flags: 64 });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Tus Alertas')
      .setDescription(`Total: ${alerts.length} alertas activas`)
      .setColor('#7C3AED')
      .setTimestamp();

    alerts.forEach((alert, index) => {
      const alertConfigs = JSON.parse(alert.alert_types || '[]');
      const typesText = alertConfigs.map(config => getAlertTypeName(config.type)).join(', ');
      const thresholdsText = alertConfigs.map(config => {
        const thresholdDisplay = config.threshold_type === 'percentage' 
          ? `${config.threshold_value}%` 
          : `${config.threshold_value} ETH`;
        return `${getAlertTypeName(config.type)}: ${thresholdDisplay} (${getTimeframeName(config.timeframe)})`;
      }).join('\n');
      
      embed.addFields({
        name: `${index + 1}. ${alert.project_name}`,
        value: `**Tipos:** ${typesText}\n**Configuración:**\n${thresholdsText}`,
        inline: false
      });
    });

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleAlertsList:', error);
    await interaction.reply({ content: '❌ Error interno.', flags: 64 });
  }
}

// Manejar desactivación de alertas
async function handleAlertsDisable(interaction) {
  const projectName = interaction.options.getString('project');

  try {
    const result = await pool.query(
      'UPDATE user_alerts SET is_active = false FROM nft_projects WHERE user_alerts.project_id = nft_projects.id AND user_alerts.discord_user_id = $1 AND nft_projects.name = $2',
      [interaction.user.id, projectName]
    );

    if (result.rowCount === 0) {
      await interaction.reply({ content: '❌ No se encontraron alertas para desactivar.', flags: 64 });
      return;
    }

    await interaction.reply({ content: `✅ Alertas desactivadas para **${projectName}**`, flags: 64 });
  } catch (error) {
    console.error('Error in handleAlertsDisable:', error);
    await interaction.reply({ content: '❌ Error interno.', flags: 64 });
  }
}

// Verificar si el usuario tiene permisos de admin
async function hasAdminPermissions(interaction) {
  return interaction.member.permissions.has('Administrator');
}

// Verificar si el usuario tiene un rol habilitado
async function hasEnabledRole(interaction) {
  try {
    const result = await pool.query(
      'SELECT enabled_roles FROM server_config WHERE guild_id = $1',
      [interaction.guild.id]
    );

    if (result.rows.length === 0) {
      return false; // No hay configuración del servidor
    }

    const enabledRoles = JSON.parse(result.rows[0].enabled_roles || '[]');
    
    // Verificar si el usuario tiene alguno de los roles habilitados
    return interaction.member.roles.cache.some(role => enabledRoles.includes(role.id));
  } catch (error) {
    console.error('Error checking enabled role:', error);
    return false;
  }
}

// Manejar configuración de canal de alertas
async function handleAlertsChannel(interaction) {
  if (!await hasAdminPermissions(interaction)) {
    await interaction.reply({ content: '❌ Solo los administradores pueden configurar el canal de alertas.', flags: 64 });
    return;
  }

  const channel = interaction.options.getChannel('channel');

  try {
    // Verificar que el canal sea de texto
    if (channel.type !== 0) { // 0 = GUILD_TEXT
      await interaction.reply({ content: '❌ El canal debe ser un canal de texto.', flags: 64 });
      return;
    }

    // Verificar permisos del bot en el canal
    const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
    const permissions = channel.permissionsFor(botMember);
    
    if (!permissions.has(['SendMessages', 'EmbedLinks'])) {
      await interaction.reply({ content: '❌ El bot no tiene permisos para enviar mensajes en este canal.', flags: 64 });
      return;
    }

    // Insertar o actualizar configuración del servidor
    await pool.query(`
      INSERT INTO server_config (guild_id, alerts_channel_id, updated_at) 
      VALUES ($1, $2, NOW()) 
      ON CONFLICT (guild_id) 
      DO UPDATE SET alerts_channel_id = $2, updated_at = NOW()
    `, [interaction.guild.id, channel.id]);

    const embed = new EmbedBuilder()
      .setTitle('✅ Canal de Alertas Configurado')
      .setDescription(`Las alertas se enviarán a ${channel}`)
      .setColor('#10B981')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleAlertsChannel:', error);
    await interaction.reply({ content: '❌ Error interno.', flags: 64 });
  }
}

// Manejar habilitación de rol
async function handleAlertsEnableRole(interaction) {
  if (!await hasAdminPermissions(interaction)) {
    await interaction.reply({ content: '❌ Solo los administradores pueden habilitar roles.', flags: 64 });
    return;
  }

  const role = interaction.options.getRole('role');

  try {
    // Obtener configuración actual del servidor
    const result = await pool.query(
      'SELECT enabled_roles FROM server_config WHERE guild_id = $1',
      [interaction.guild.id]
    );

    let enabledRoles = [];
    if (result.rows.length > 0) {
      enabledRoles = JSON.parse(result.rows[0].enabled_roles || '[]');
    }

    // Verificar si el rol ya está habilitado
    if (enabledRoles.includes(role.id)) {
      await interaction.reply({ content: `⚠️ El rol ${role} ya está habilitado.`, flags: 64 });
      return;
    }

    // Agregar el rol a la lista
    enabledRoles.push(role.id);

    // Insertar o actualizar configuración del servidor
    await pool.query(`
      INSERT INTO server_config (guild_id, enabled_roles, updated_at) 
      VALUES ($1, $2, NOW()) 
      ON CONFLICT (guild_id) 
      DO UPDATE SET enabled_roles = $2, updated_at = NOW()
    `, [interaction.guild.id, JSON.stringify(enabledRoles)]);

    const embed = new EmbedBuilder()
      .setTitle('✅ Rol Habilitado')
      .setDescription(`El rol ${role} ahora puede usar el bot para configurar alertas`)
      .setColor('#10B981')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleAlertsEnableRole:', error);
    await interaction.reply({ content: '❌ Error interno.', flags: 64 });
  }
}

// Manejar deshabilitación de rol
async function handleAlertsDisableRole(interaction) {
  if (!await hasAdminPermissions(interaction)) {
    await interaction.reply({ content: '❌ Solo los administradores pueden deshabilitar roles.', flags: 64 });
    return;
  }

  const role = interaction.options.getRole('role');

  try {
    // Obtener configuración actual del servidor
    const result = await pool.query(
      'SELECT enabled_roles FROM server_config WHERE guild_id = $1',
      [interaction.guild.id]
    );

    if (result.rows.length === 0) {
      await interaction.reply({ content: '❌ No hay configuración del servidor.', flags: 64 });
      return;
    }

    let enabledRoles = JSON.parse(result.rows[0].enabled_roles || '[]');

    // Verificar si el rol está habilitado
    if (!enabledRoles.includes(role.id)) {
      await interaction.reply({ content: `⚠️ El rol ${role} no está habilitado.`, flags: 64 });
      return;
    }

    // Remover el rol de la lista
    enabledRoles = enabledRoles.filter(roleId => roleId !== role.id);

    // Actualizar configuración del servidor
    await pool.query(
      'UPDATE server_config SET enabled_roles = $1, updated_at = NOW() WHERE guild_id = $2',
      [JSON.stringify(enabledRoles), interaction.guild.id]
    );

    const embed = new EmbedBuilder()
      .setTitle('✅ Rol Deshabilitado')
      .setDescription(`El rol ${role} ya no puede usar el bot para configurar alertas`)
      .setColor('#EF4444')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleAlertsDisableRole:', error);
    await interaction.reply({ content: '❌ Error interno.', flags: 64 });
  }
}

// Manejar status de configuración de alertas
async function handleAlertsStatus(interaction) {
  try {
    const result = await pool.query(
      'SELECT * FROM server_config WHERE guild_id = $1',
      [interaction.guild.id]
    );

    if (result.rows.length === 0) {
      await interaction.reply({ content: '❌ No hay configuración de alertas para este servidor.', flags: 64 });
      return;
    }

    const config = result.rows[0];
    const enabledRoles = JSON.parse(config.enabled_roles || '[]');
    
    const embed = new EmbedBuilder()
      .setTitle('📊 Configuración de Alertas del Servidor')
      .setColor('#7C3AED')
      .setTimestamp();

    // Canal de alertas
    if (config.alerts_channel_id) {
      const channel = interaction.guild.channels.cache.get(config.alerts_channel_id);
      embed.addFields({
        name: '📢 Canal de Alertas',
        value: channel ? `${channel}` : '❌ Canal no encontrado',
        inline: true
      });
    } else {
      embed.addFields({
        name: '📢 Canal de Alertas',
        value: '❌ No configurado',
        inline: true
      });
    }

    // Roles habilitados
    if (enabledRoles.length > 0) {
      const roleNames = enabledRoles.map(roleId => {
        const role = interaction.guild.roles.cache.get(roleId);
        return role ? role.name : 'Rol eliminado';
      }).join(', ');
      
      embed.addFields({
        name: '👥 Roles Habilitados',
        value: roleNames,
        inline: false
      });
    } else {
      embed.addFields({
        name: '👥 Roles Habilitados',
        value: '❌ Ninguno configurado',
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleAlertsStatus:', error);
    await interaction.reply({ content: '❌ Error interno.', flags: 64 });
  }
}

// Validar proyecto antes de agregarlo
async function validateProject(contractAddress) {
  try {
    console.log(`🔍 Validating project: ${contractAddress}`);
    
    // Intentar obtener datos del proyecto
    const projectData = await getProjectData(contractAddress);
    
    if (!projectData) {
      return {
        valid: false,
        error: 'No se pudo encontrar datos para este contrato. Verifica que sea válido.'
      };
    }
    
    // Verificar que tenga datos básicos
    if (!projectData.floor_price || projectData.floor_price === 0) {
      return {
        valid: false,
        error: 'El proyecto no tiene precio de floor válido. Puede ser que no esté listado en Magic Eden.'
      };
    }
    
    return {
      valid: true,
      data: projectData
    };
  } catch (error) {
    console.error('Error validating project:', error);
    return {
      valid: false,
      error: 'Error interno al validar el proyecto.'
    };
  }
}

// Manejar comando delete
async function handleDeleteCommand(interaction) {
  const projectName = interaction.options.getString('project');

  try {
    await interaction.deferReply();
    
    // Buscar el proyecto
    const result = await pool.query('SELECT * FROM nft_projects WHERE name = $1', [projectName]);
    const project = result.rows[0];

    if (!project) {
      await interaction.editReply({ content: '❌ Proyecto no encontrado.' });
      return;
    }

    // Eliminar el proyecto y sus datos relacionados
    await pool.query('DELETE FROM user_alerts WHERE project_id = $1', [project.id]);
    await pool.query('DELETE FROM price_history WHERE project_id = $1', [project.id]);
    await pool.query('DELETE FROM nft_projects WHERE id = $1', [project.id]);

    await interaction.editReply({ 
      content: `✅ **Proyecto "${project.name}" eliminado exitosamente!**\n\n🗑️ Se eliminaron:\n• El proyecto\n• Todas las alertas asociadas\n• El historial de precios` 
    });
  } catch (error) {
    console.error('Error in handleDeleteCommand:', error);
    await interaction.editReply({ content: '❌ Error interno.' });
  }
}

// Obtener lista de proyectos para autocompletado
async function getProjectsList() {
  try {
    const result = await pool.query('SELECT name FROM nft_projects ORDER BY name');
    return result.rows.map(row => row.name);
  } catch (error) {
    console.error('Error getting projects list:', error);
    return [];
  }
}

// Obtener precio anterior para comparaciones
async function getPreviousPrice(projectId, field, timeframe) {
  try {
    let timeCondition = '';
    switch (timeframe) {
      case '1h':
        timeCondition = "recorded_at > NOW() - INTERVAL '1 hour'";
        break;
      case '24h':
        timeCondition = "recorded_at > NOW() - INTERVAL '24 hours'";
        break;
      case '7d':
        timeCondition = "recorded_at > NOW() - INTERVAL '7 days'";
        break;
      case '30d':
        timeCondition = "recorded_at > NOW() - INTERVAL '30 days'";
        break;
      default:
        timeCondition = "recorded_at > NOW() - INTERVAL '24 hours'";
    }

    const result = await pool.query(
      `SELECT ${field} FROM price_history WHERE project_id = $1 AND ${timeCondition} ORDER BY recorded_at ASC LIMIT 1`,
      [projectId]
    );

    if (result.rows.length > 0) {
      return parseFloat(result.rows[0][field]) || 0;
    }
    return 0;
  } catch (error) {
    console.error('Error getting previous price:', error);
    return 0;
  }
}

// Obtener precio ETH desde CoinGecko
async function getETHPrice() {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
      timeout: 5000
    });
    
    if (response.data && response.data.ethereum && response.data.ethereum.usd) {
      const ethPrice = response.data.ethereum.usd;
      console.log(`💰 ETH price from CoinGecko: $${ethPrice}`);
      return ethPrice;
    }
  } catch (error) {
    console.error('Error fetching ETH price:', error.message);
  }
  
  // Fallback si falla la API
  console.log('⚠️ Using fallback ETH price: $3000');
  return 3000;
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

