console.log('🔥 LOG 1: Starting to load modules...');
console.log('🔥 ULTRA SIMPLE TEST v2: This code is definitely running!');
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelType } = require('discord.js');
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
const TwitterRSSService = require('./services/twitterRSS');
console.log('🔥 LOG 8: Twitter RSS Service loaded');

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

// Inicializar servicio de Twitter RSS
const twitterService = new TwitterRSSService();
console.log('🐦 Twitter RSS service initialized');

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

// Crear tabla de alertas enviadas para anti-spam
async function initializeAlertHistory() {
  try {
    console.log('🔧 Initializing alert_history table...');
    
    // Primero verificar si la tabla existe
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'alert_history'
      );
    `);
    
    console.log('🔧 Table exists check result:', checkTable.rows[0].exists);
    
    if (!checkTable.rows[0].exists) {
      console.log('🔧 Creating alert_history table...');
      await pool.query(`
        CREATE TABLE alert_history (
          id SERIAL PRIMARY KEY,
          project_id UUID NOT NULL REFERENCES nft_projects(id) ON DELETE CASCADE,
          alert_type TEXT NOT NULL,
          alert_value TEXT NOT NULL,
          sent_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      console.log('✅ Alert history table created successfully');
    } else {
      console.log('✅ Alert history table already exists');
    }
  } catch (error) {
    console.error('❌ Error initializing alert history table:', error);
    console.error('❌ Error details:', error.message);
    console.error('❌ Error code:', error.code);
  }
}

// Inicializar configuración del servidor
initializeServerConfig();

// Inicializar historial de alertas
initializeAlertHistory();

// Crear tabla de cuentas de Twitter si no existe
async function initializeTwitterTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS twitter_accounts (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        last_tweet_id TEXT,
        last_check TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(username, guild_id)
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS twitter_history (
        id SERIAL PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES twitter_accounts(id) ON DELETE CASCADE,
        tweet_id TEXT NOT NULL,
        tweet_text TEXT,
        tweet_url TEXT,
        tweeted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(account_id, tweet_id)
      )
    `);
    
    console.log('✅ Twitter tables initialized');
  } catch (error) {
    console.error('Error initializing Twitter tables:', error);
  }
}

async function initializeWalletSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wallet_projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        guild_id TEXT NOT NULL,
        project_name TEXT NOT NULL,
        chain TEXT NOT NULL DEFAULT 'monad',
        submitted_by TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS wallet_channels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES wallet_projects(id) ON DELETE CASCADE,
        submitted_by TEXT NOT NULL,
        label TEXT,
        channel_link TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`DROP INDEX IF EXISTS idx_wallet_projects_unique`);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_projects_unique
      ON wallet_projects (guild_id, chain, lower(project_name))
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_projects_guild
      ON wallet_projects (guild_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_projects_chain
      ON wallet_projects (guild_id, chain)
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_channels_unique
      ON wallet_channels (project_id, lower(COALESCE(label, '')), channel_link)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_channels_project
      ON wallet_channels (project_id)
    `);

    // Ensure new columns exist and migrate data if coming from legacy schema
    await pool.query(`
      ALTER TABLE wallet_projects
      ADD COLUMN IF NOT EXISTS chain TEXT
    `);
    await pool.query(`
      UPDATE wallet_projects SET chain = 'monad' WHERE chain IS NULL
    `);
    await pool.query(`
      ALTER TABLE wallet_projects
      ALTER COLUMN chain SET DEFAULT 'monad'
    `);
    await pool.query(`
      ALTER TABLE wallet_projects
      ALTER COLUMN chain SET NOT NULL
    `);

    await pool.query(`
      ALTER TABLE wallet_projects
      ADD COLUMN IF NOT EXISTS submitted_by TEXT DEFAULT ''
    `);
    await pool.query(`
      UPDATE wallet_projects SET submitted_by = COALESCE(submitted_by, '')
    `);
    await pool.query(`
      ALTER TABLE wallet_projects
      ALTER COLUMN submitted_by SET NOT NULL
    `);

    await pool.query(`
      ALTER TABLE wallet_projects
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()
    `);
    await pool.query(`
      ALTER TABLE wallet_projects
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
    `);
    await pool.query(`
      UPDATE wallet_projects SET created_at = NOW() WHERE created_at IS NULL
    `);
    await pool.query(`
      UPDATE wallet_projects SET updated_at = NOW() WHERE updated_at IS NULL
    `);

    const legacyColumn = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'wallet_projects' AND column_name = 'channel_link'
    `);

    if (legacyColumn.rows.length > 0) {
      await pool.query(`
        INSERT INTO wallet_channels (project_id, submitted_by, channel_link)
        SELECT id, submitted_by, channel_link FROM wallet_projects WHERE channel_link IS NOT NULL
        ON CONFLICT DO NOTHING
      `);

      await pool.query(`ALTER TABLE wallet_projects DROP COLUMN channel_link`);
    }

    await pool.query(`
      ALTER TABLE wallet_channels
      ADD COLUMN IF NOT EXISTS submitted_by TEXT DEFAULT ''
    `);
    await pool.query(`
      UPDATE wallet_channels SET submitted_by = COALESCE(submitted_by, '')
    `);
    await pool.query(`
      ALTER TABLE wallet_channels
      ALTER COLUMN submitted_by SET NOT NULL
    `);

    await pool.query(`
      ALTER TABLE server_config
      ADD COLUMN IF NOT EXISTS wallet_channel_id TEXT
    `);

    await pool.query(`
      ALTER TABLE server_config
      ADD COLUMN IF NOT EXISTS wallet_message_id TEXT
    `);

    console.log('✅ Wallet schema initialized');
  } catch (error) {
    console.error('Error initializing wallet schema:', error);
  }
}

// Inicializar tablas de Twitter
initializeTwitterTables();
initializeWalletSchema();

// Forzar creación de tabla alert_history después de un delay
setTimeout(async () => {
  console.log('🔧 Force creating alert_history table after delay...');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alert_history (
        id SERIAL PRIMARY KEY,
        project_id UUID NOT NULL REFERENCES nft_projects(id) ON DELETE CASCADE,
        alert_type TEXT NOT NULL,
        alert_value TEXT NOT NULL,
        sent_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('✅ Alert history table force created successfully');
  } catch (error) {
    console.error('❌ Error force creating alert history table:', error);
  }
}, 5000); // 5 segundos después del inicio

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
    .setName('verify-price')
    .setDescription('Verificar precio actual de un proyecto')
    .addStringOption(option =>
      option.setName('project')
        .setDescription('Nombre del proyecto')
        .setRequired(true)
        .setAutocomplete(true)),

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
        .setName('enable')
        .setDescription('Reactivar alertas')
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
        .setAutocomplete(true)),

  new SlashCommandBuilder()
    .setName('menu')
    .setDescription('Mostrar menú principal con botones interactivos'),

  // Comandos de Twitter
  new SlashCommandBuilder()
    .setName('twitter')
    .setDescription('Gestionar seguimiento de cuentas de Twitter/X')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Agregar una cuenta de Twitter para monitorear')
        .addStringOption(option =>
          option.setName('username')
            .setDescription('Nombre de usuario de Twitter (sin @)')
            .setRequired(true))
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Canal donde enviar las alertas')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remover una cuenta de Twitter del monitoreo')
        .addStringOption(option =>
          option.setName('username')
            .setDescription('Nombre de usuario de Twitter (sin @)')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Listar todas las cuentas de Twitter monitoreadas'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('test')
        .setDescription('Probar obtener el último tweet de una cuenta')
        .addStringOption(option =>
          option.setName('username')
            .setDescription('Nombre de usuario de Twitter (sin @)')
            .setRequired(true))),

  new SlashCommandBuilder()
    .setName('wallet')
    .setDescription('Gestionar lista de proyectos con submit de wallets')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Agregar un proyecto y su canal de submit')
        .addStringOption(option =>
          option.setName('project')
            .setDescription('Nombre del proyecto')
            .setRequired(true)
            .setMaxLength(100))
        .addStringOption(option =>
          option.setName('chain')
            .setDescription('Red del proyecto')
            .setRequired(true)
            .addChoices(
              { name: 'Monad', value: 'monad' },
              { name: 'Ethereum', value: 'eth' },
              { name: 'Solana', value: 'solana' },
              { name: 'Base', value: 'base' },
              { name: 'Otro', value: 'other' }
            ))
        .addStringOption(option =>
          option.setName('label')
            .setDescription('Etiqueta del canal (ej. FCFS, GTD)')
            .setRequired(false)
            .setMaxLength(100))
        .addStringOption(option =>
          option.setName('link')
            .setDescription('Link al canal del submit')
            .setRequired(true)
            .setMaxLength(2000)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Mostrar proyectos registrados')
        .addStringOption(option =>
          option.setName('chain')
            .setDescription('Filtrar por red')
            .setRequired(false)
            .addChoices(
              { name: 'Todas', value: 'all' },
              { name: 'Monad', value: 'monad' },
              { name: 'Ethereum', value: 'eth' },
              { name: 'Solana', value: 'solana' },
              { name: 'Base', value: 'base' },
              { name: 'Otro', value: 'other' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Eliminar un proyecto de la lista')
        .addStringOption(option =>
          option.setName('project')
            .setDescription('Nombre del proyecto a eliminar')
            .setRequired(true)
            .setMaxLength(100))
        .addStringOption(option =>
          option.setName('chain')
            .setDescription('Red del proyecto (si existe en varias)')
            .setRequired(false)
            .addChoices(
              { name: 'Monad', value: 'monad' },
              { name: 'Ethereum', value: 'eth' },
              { name: 'Solana', value: 'solana' },
              { name: 'Base', value: 'base' },
              { name: 'Otro', value: 'other' }
            ))
        .addStringOption(option =>
          option.setName('label')
            .setDescription('Etiqueta del canal a eliminar')
            .setRequired(false)
            .setMaxLength(100))
        .addStringOption(option =>
          option.setName('link')
            .setDescription('Link exacto del canal a eliminar')
            .setRequired(false)
            .setMaxLength(2000)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Actualizar datos de un proyecto registrado')
        .addStringOption(option =>
          option.setName('project')
            .setDescription('Nombre del proyecto a editar')
            .setRequired(true)
            .setMaxLength(100))
        .addStringOption(option =>
          option.setName('chain')
            .setDescription('Red actual del proyecto')
            .setRequired(false)
            .addChoices(
              { name: 'Monad', value: 'monad' },
              { name: 'Ethereum', value: 'eth' },
              { name: 'Solana', value: 'solana' },
              { name: 'Base', value: 'base' },
              { name: 'Otro', value: 'other' }
            ))
        .addStringOption(option =>
          option.setName('new_name')
            .setDescription('Nuevo nombre del proyecto')
            .setRequired(false)
            .setMaxLength(100))
        .addStringOption(option =>
          option.setName('new_chain')
            .setDescription('Nueva red del proyecto')
            .setRequired(false)
            .addChoices(
              { name: 'Monad', value: 'monad' },
              { name: 'Ethereum', value: 'eth' },
              { name: 'Solana', value: 'solana' },
              { name: 'Base', value: 'base' },
              { name: 'Otro', value: 'other' }
            ))
        .addStringOption(option =>
          option.setName('channel_label')
            .setDescription('Etiqueta del canal que deseas editar')
            .setRequired(false)
            .setMaxLength(100))
        .addStringOption(option =>
          option.setName('channel_link')
            .setDescription('Link actual del canal que deseas editar')
            .setRequired(false)
            .setMaxLength(2000))
        .addStringOption(option =>
          option.setName('new_label')
            .setDescription('Nueva etiqueta para el canal')
            .setRequired(false)
            .setMaxLength(100))
        .addStringOption(option =>
          option.setName('new_link')
            .setDescription('Nuevo link para el canal')
            .setRequired(false)
            .setMaxLength(2000)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('channel_set')
        .setDescription('Configurar el canal donde se mostrará la lista')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Canal para publicar la lista de submit wallets')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('channel_clear')
        .setDescription('Limpiar la configuración de canal para la lista'))
];
console.log('Comandos a registrar:', commands.map(cmd => cmd.name));
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
  // Programar tracking automático cada 1 minuto (TEMPORAL PARA DEBUG) - DISABLED
  // cron.schedule('*/1 * * * *', async () => {
  //   console.log('🔄 Ejecutando tracking automático...');
  //   await performTracking();
  // }, {
  //   timezone: "America/New_York"
  // });

  console.log('⏰ Tracking automático programado cada 1 minuto (DEBUG MODE) - DISABLED');
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
    
    return result.rows.length > 0 ? parseFloat(result.rows[0][field]) : null;
  } catch (error) {
    console.error('Error getting previous price:', error);
    return null;
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

  // No fallback data - return null if no real data found
  console.log(`❌ No real data found from any API for contract: ${contractAddress}`);
  return null;
}

// Magic Eden API V4 (Ethereum + Monad Testnet) - UPDATED TO V4 - FORCE DEPLOY
async function getMagicEdenData(contractAddress) {
  try {
    // Intentar diferentes endpoints según la red usando V4
    const endpoints = [
      // Endpoint V4 para colecciones de Ethereum
      {
        url: `https://api-mainnet.magiceden.dev/v4/collections`,
        chain: 'ethereum',
        method: 'POST',
        data: {
          contractAddress: contractAddress,
          chain: 'ethereum'
        }
      },
      // Endpoint V4 para colecciones de Monad Testnet
      {
        url: `https://api-mainnet.magiceden.dev/v4/collections`,
        chain: 'monad-testnet',
        method: 'POST',
        data: {
          contractAddress: contractAddress,
          chain: 'monad-testnet'
        }
      }
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying Magic Eden V4 endpoint: ${endpoint.url}`);
        console.log(`🔍 V4 POST data:`, endpoint.data);
        
        const response = await axios({
          method: endpoint.method,
          url: endpoint.url,
          data: endpoint.data,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Discord-Bot/1.0'
          },
          timeout: 15000
        });

        if (response.data) {
          console.log(`✅ Magic Eden data found:`, response.data);
          
          // Para API v4, procesar la respuesta según la nueva estructura
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

          // Verificar si ya se envió esta alerta hoy (anti-spam)
          const alertKey = `${alertConfig.type}_${alertConfig.threshold_value}`;
          const today = new Date().toISOString().split('T')[0];
          
          try {
            const existingAlert = await pool.query(
              'SELECT id FROM alert_history WHERE project_id = $1 AND alert_type = $2 AND alert_value = $3 AND sent_at::date = $4',
              [project.id, alertConfig.type, alertKey, today]
            );

            if (existingAlert.rows.length > 0) {
              console.log(`🔔 processAlert: Alert already sent today, skipping to prevent spam`);
              continue;
            }
          } catch (error) {
            console.log(`🔔 processAlert: Error checking alert history (table might not exist yet):`, error.message);
            // Continuar sin anti-spam si la tabla no existe
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

      // Agregar imagen del NFT si está disponible
      if (newData?.image) {
        embed.setThumbnail(newData.image);
      }

      // Agregar link al marketplace si está disponible
      if (newData?.marketplace_url) {
        embed.addFields({
          name: '🔗 Ver Colección',
          value: `[Magic Eden](${newData.marketplace_url})`,
          inline: true
        });
      }

      // Agregar información adicional
      const currency = newData?.currency || 'ETH';
      const floorPrice = newData?.floor_price || 0;
      const topBid = newData?.top_bid || 0;
      const volume24h = newData?.volume_24h || 0;
      const priceUSD = newData?.price_usd || 0;
      
      embed.addFields({
        name: '📊 Datos Actuales',
        value: `Floor: ${floorPrice.toFixed(2)} ${currency} ($${priceUSD.toFixed(2)})\nTop Bid: ${topBid.toFixed(2)} ${currency}\nVolume: ${volume24h.toFixed(2)} ${currency}`,
        inline: true
      });

      // Agregar botón para deshabilitar alerta
      const disableButton = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`disable_alert_${project.id}_${alert.discord_user_id}`)
            .setLabel('🔕 Deshabilitar Alerta')
            .setStyle(ButtonStyle.Danger)
        );

      // Intentar enviar al canal configurado
      if (serverConfig.rows.length > 0 && serverConfig.rows[0].alerts_channel_id) {
        try {
          const channel = client.channels.cache.get(serverConfig.rows[0].alerts_channel_id);
          if (channel) {
            await channel.send({ embeds: [embed], components: [disableButton] });
            console.log(`🔔 processAlert: Notification sent to channel ${channel.name}!`);
            
            // Registrar alerta enviada para anti-spam
            try {
              const alertKey = `${alertConfig.type}_${alertConfig.threshold_value}`;
              await pool.query(
                'INSERT INTO alert_history (project_id, alert_type, alert_value) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                [project.id, alertConfig.type, alertKey]
              );
              console.log(`🔔 processAlert: Alert recorded in history for anti-spam`);
            } catch (error) {
              console.log(`🔔 processAlert: Error recording alert history (table might not exist yet):`, error.message);
            }
            return;
          }
        } catch (error) {
          console.error('Error sending to channel:', error);
        }
      }

      // Fallback: enviar DM al usuario (solo si no hay canal configurado)
      console.log(`🔔 processAlert: No channel configured, sending DM to user ${user.username}`);
      await user.send({ embeds: [embed], components: [disableButton] });
      console.log(`🔔 processAlert: Notification sent via DM successfully!`);
      
      // Registrar alerta enviada para anti-spam
      try {
        const alertKey = `${alertConfig.type}_${alertConfig.threshold_value}`;
        await pool.query(
          'INSERT INTO alert_history (project_id, alert_type, alert_value) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [project.id, alertConfig.type, alertKey]
        );
        console.log(`🔔 processAlert: Alert recorded in history for anti-spam`);
      } catch (error) {
        console.log(`🔔 processAlert: Error recording alert history (table might not exist yet):`, error.message);
      }
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
      case 'verify-price':
        await handleVerifyPriceCommand(interaction);
        break;
      case 'alerts':
        await handleAlertsCommand(interaction);
        break;
      case 'delete':
        await handleDeleteCommand(interaction);
        break;
      case 'menu':
        await handleMenuCommand(interaction);
        break;
      case 'twitter':
        await handleTwitterCommand(interaction);
        break;
      case 'wallet':
        await handleWalletCommand(interaction);
        break;
    }
  } catch (error) {
    console.error(`Error handling command ${commandName}:`, error);
    try {
      // Solo intentar reply si no fue deferred
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ content: '❌ Error interno. Intenta de nuevo.', flags: 64 });
      }
    } catch (replyError) {
      console.error('Error sending error reply:', replyError);
    }
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
        interaction.commandName === 'verify-price' ||
        (interaction.commandName === 'alerts' && interaction.options.getSubcommand() === 'setup') ||
        (interaction.commandName === 'alerts' && interaction.options.getSubcommand() === 'disable') ||
        (interaction.commandName === 'alerts' && interaction.options.getSubcommand() === 'enable') ||
        (interaction.commandName === 'alerts' && interaction.options.getSubcommand() === 'remove')) {
      
      const projects = await getProjectsList();
      const filtered = projects
        .filter(project => project.toLowerCase().includes(focusedValue.toLowerCase()))
        .slice(0, 25); // Discord limita a 25 opciones
      
      await interaction.respond(
        filtered.map(project => ({ name: project, value: project }))
      );
      return;
    }
    
    // Autocompletado para cuentas de Twitter
    if (interaction.commandName === 'twitter' && interaction.options.getSubcommand() === 'remove') {
      const accounts = await getTwitterAccountsList(interaction.guildId);
      const filtered = accounts
        .filter(account => account.toLowerCase().includes(focusedValue.toLowerCase()))
        .slice(0, 25);
      
      await interaction.respond(
        filtered.map(account => ({ name: `@${account}`, value: account }))
      );
      return;
    }

    if (interaction.commandName === 'wallet') {
      let subcommand;
      try {
        subcommand = interaction.options.getSubcommand();
      } catch (error) {
        subcommand = null;
      }

      if (subcommand === 'remove' || subcommand === 'edit') {
        const projects = await getWalletProjectNames(interaction.guildId);
        const filtered = projects
          .filter(project => project.toLowerCase().includes(focusedValue.toLowerCase()))
          .slice(0, 25);

        await interaction.respond(
          filtered.map(project => ({ name: project, value: project }))
        );
      } else {
        await interaction.respond([]);
      }
    }
  } catch (error) {
    console.error('Error handling autocomplete:', error);
  }
});

// Manejar botones
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  try {
    if (interaction.customId.startsWith('disable_alert_')) {
      const parts = interaction.customId.split('_');
      const projectId = parts[2];
      const userId = parts[3];

      // Verificar que el usuario que hace clic es el mismo que configuró la alerta
      if (interaction.user.id !== userId) {
        await interaction.reply({ 
          content: '❌ Solo puedes deshabilitar tus propias alertas.', 
          flags: 64 
        });
        return;
      }

      // Deshabilitar alertas para este proyecto
      await pool.query(
        'UPDATE user_alerts SET is_active = false WHERE discord_user_id = $1 AND project_id = $2',
        [userId, projectId]
      );

      // Obtener nombre del proyecto
      const projectResult = await pool.query('SELECT name FROM nft_projects WHERE id = $1', [projectId]);
      const projectName = projectResult.rows[0]?.name || 'Unknown';

      await interaction.reply({ 
        content: `✅ Alertas deshabilitadas para **${projectName}**`, 
        flags: 64 
      });
    } else if (interaction.customId.startsWith('menu_')) {
      // Manejar botones del menú principal
      await handleMenuButton(interaction);
    } else if (interaction.customId === 'back_to_menu') {
      // Volver al menú principal
      await handleMenuCommand(interaction);
    } else if (interaction.customId.startsWith('projects_')) {
      // Manejar botones de proyectos
      await handleProjectsButton(interaction);
    } else if (interaction.customId.startsWith('alerts_')) {
      // Manejar botones de alertas
      await handleAlertsButton(interaction);
    } else if (interaction.customId.startsWith('config_')) {
      // Manejar botones de configuración
      await handleConfigButton(interaction);
    } else if (interaction.customId.startsWith('stats_')) {
      // Manejar botones de estadísticas
      await handleStatsButton(interaction);
    } else if (interaction.customId.startsWith('tools_')) {
      // Manejar botones de herramientas
      await handleToolsButton(interaction);
    } else if (interaction.customId.startsWith('help_')) {
      // Manejar botones de ayuda
      await handleHelpButton(interaction);
    }
  } catch (error) {
    console.error('Error handling button interaction:', error);
    await interaction.reply({ 
      content: '❌ Error al procesar la solicitud.', 
      flags: 64 
    });
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
        value: `${topBid.toFixed(2)} ${currency}\n(${currency === 'MON' ? (topBid * 0.02).toFixed(2) : 'N/A'} USD)`, 
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
    const ethereumUrl = `https://api-mainnet.magiceden.dev/v4/collections`;
    
    console.log(`🔍 Testing Ethereum API: ${ethereumUrl}`);
    
    let ethereumResult = '❌ Failed';
    try {
      const response = await axios.post(ethereumUrl, {
        contractAddress: moriusaContract,
        chain: 'ethereum'
      }, {
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
    const monadUrl = `https://api-mainnet.magiceden.dev/v4/collections`;
    
    console.log(`🔍 Testing Monad API: ${monadUrl}`);
    
    let monadResult = '❌ Failed';
    try {
      const response = await axios.post(monadUrl, {
        contractAddress: momoContract,
        chain: 'monad-testnet'
      }, {
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
    case 'enable':
      await handleAlertsEnable(interaction);
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

// Manejar reactivación de alertas
async function handleAlertsEnable(interaction) {
  const projectName = interaction.options.getString('project');

  try {
    const result = await pool.query(
      'UPDATE user_alerts SET is_active = true FROM nft_projects WHERE user_alerts.project_id = nft_projects.id AND user_alerts.discord_user_id = $1 AND nft_projects.name = $2',
      [interaction.user.id, projectName]
    );

    if (result.rowCount === 0) {
      await interaction.reply({ content: '❌ No se encontraron alertas para reactivar.', flags: 64 });
      return;
    }

    await interaction.reply({ content: `✅ Alertas reactivadas para **${projectName}**`, flags: 64 });
  } catch (error) {
    console.error('Error in handleAlertsEnable:', error);
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

// Manejar botones del menú
async function handleMenuButton(interaction) {
  const buttonId = interaction.customId;
  
  try {
    await interaction.deferReply({ flags: 64 }); // Ephemeral response
    
    switch (buttonId) {
      case 'menu_projects':
        await showProjectsMenu(interaction);
        break;
      case 'menu_alerts':
        await showAlertsMenu(interaction);
        break;
      case 'menu_config':
        await showConfigMenu(interaction);
        break;
      case 'menu_stats':
        await showStatsMenu(interaction);
        break;
      case 'menu_tools':
        await showToolsMenu(interaction);
        break;
      case 'menu_help':
        await showHelpMenu(interaction);
        break;
      default:
        await interaction.editReply({ content: '❌ Opción no reconocida.' });
    }
  } catch (error) {
    console.error('Error in handleMenuButton:', error);
    await interaction.editReply({ content: '❌ Error interno.' });
  }
}

// Mostrar menú de proyectos
async function showProjectsMenu(interaction) {
  try {
    // Obtener lista de proyectos
    const projects = await getProjectsList();
    
    const embed = new EmbedBuilder()
      .setTitle('📊 Gestión de Proyectos')
      .setDescription('Selecciona una acción para gestionar proyectos NFT:')
      .setColor('#10B981')
      .setTimestamp();

    if (projects.length > 0) {
      embed.addFields({
        name: '📋 Proyectos Actuales',
        value: projects.slice(0, 10).map((p, i) => `${i + 1}. **${p}**`).join('\n') + 
               (projects.length > 10 ? `\n... y ${projects.length - 10} más` : ''),
        inline: false
      });
    } else {
      embed.addFields({
        name: '📋 Proyectos Actuales',
        value: 'No hay proyectos configurados',
        inline: false
      });
    }

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('projects_list')
          .setLabel('📋 Listar Proyectos')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('projects_add')
          .setLabel('➕ Agregar Proyecto')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('projects_status')
          .setLabel('📊 Ver Status')
          .setStyle(ButtonStyle.Secondary)
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('projects_floor')
          .setLabel('💰 Floor Price')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('projects_volume')
          .setLabel('📈 Volume')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('projects_delete')
          .setLabel('🗑️ Eliminar')
          .setStyle(ButtonStyle.Danger)
      );

    const row3 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('back_to_menu')
          .setLabel('🔙 Volver al Menú')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({ 
      embeds: [embed], 
      components: [row1, row2, row3] 
    });
  } catch (error) {
    console.error('Error in showProjectsMenu:', error);
    await interaction.editReply({ content: '❌ Error al mostrar menú de proyectos.' });
  }
}

// Mostrar menú de alertas
async function showAlertsMenu(interaction) {
  try {
    const embed = new EmbedBuilder()
      .setTitle('🔔 Gestión de Alertas')
      .setDescription('Configura y gestiona alertas de precios para tus proyectos NFT:')
      .setColor('#F59E0B')
      .setTimestamp()
      .addFields(
        { name: '🔔 Tipos de Alertas', value: '• Floor Price Change\n• Volume Change\n• Sales Count Change\n• Listings Change', inline: true },
        { name: '⏰ Timeframes', value: '• 1 hora\n• 24 horas\n• 7 días\n• 30 días', inline: true },
        { name: '🎯 Umbrales', value: '• Porcentuales (%)\n• Absolutos (ETH)', inline: true }
      );

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('alerts_setup')
          .setLabel('⚙️ Configurar Alerta')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('alerts_list')
          .setLabel('📋 Mis Alertas')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('alerts_disable')
          .setLabel('🔕 Deshabilitar')
          .setStyle(ButtonStyle.Secondary)
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('alerts_remove')
          .setLabel('🗑️ Eliminar Alerta')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('alerts_channel')
          .setLabel('📢 Canal de Alertas')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('back_to_menu')
          .setLabel('🔙 Volver al Menú')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({ 
      embeds: [embed], 
      components: [row1, row2] 
    });
  } catch (error) {
    console.error('Error in showAlertsMenu:', error);
    await interaction.editReply({ content: '❌ Error al mostrar menú de alertas.' });
  }
}

// Mostrar menú de configuración
async function showConfigMenu(interaction) {
  try {
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Configuración del Servidor')
      .setDescription('Configura los permisos y canales del bot:')
      .setColor('#8B5CF6')
      .setTimestamp()
      .addFields(
        { name: '📢 Canal de Alertas', value: 'Configura un canal específico para recibir alertas', inline: true },
        { name: '👥 Roles Permitidos', value: 'Define qué roles pueden usar el bot', inline: true },
        { name: '🔧 Configuración General', value: 'Ajustes generales del servidor', inline: true }
      );

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('config_channel')
          .setLabel('📢 Canal de Alertas')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('config_role')
          .setLabel('👥 Roles')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('config_status')
          .setLabel('📊 Estado')
          .setStyle(ButtonStyle.Secondary)
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('back_to_menu')
          .setLabel('🔙 Volver al Menú')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({ 
      embeds: [embed], 
      components: [row1, row2] 
    });
  } catch (error) {
    console.error('Error in showConfigMenu:', error);
    await interaction.editReply({ content: '❌ Error al mostrar menú de configuración.' });
  }
}

// Mostrar menú de estadísticas
async function showStatsMenu(interaction) {
  try {
    // Obtener estadísticas básicas
    const projectsResult = await pool.query('SELECT COUNT(*) as count FROM nft_projects WHERE status = $1', ['active']);
    const alertsResult = await pool.query('SELECT COUNT(*) as count FROM user_alerts WHERE is_active = true');
    const historyResult = await pool.query('SELECT COUNT(*) as count FROM price_history');

    const embed = new EmbedBuilder()
      .setTitle('📈 Estadísticas del Bot')
      .setDescription('Estadísticas generales del sistema de tracking:')
      .setColor('#06B6D4')
      .setTimestamp()
      .addFields(
        { name: '📊 Proyectos Activos', value: `${projectsResult.rows[0].count}`, inline: true },
        { name: '🔔 Alertas Activas', value: `${alertsResult.rows[0].count}`, inline: true },
        { name: '📈 Registros Históricos', value: `${historyResult.rows[0].count}`, inline: true },
        { name: '⏰ Última Actualización', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
        { name: '🔄 Frecuencia de Tracking', value: 'Cada 5 minutos', inline: true },
        { name: '🌐 Estado del Bot', value: '🟢 Activo', inline: true }
      );

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('stats_projects')
          .setLabel('📊 Detalles Proyectos')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('stats_alerts')
          .setLabel('🔔 Detalles Alertas')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('stats_history')
          .setLabel('📈 Historial')
          .setStyle(ButtonStyle.Secondary)
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('back_to_menu')
          .setLabel('🔙 Volver al Menú')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({ 
      embeds: [embed], 
      components: [row1, row2] 
    });
  } catch (error) {
    console.error('Error in showStatsMenu:', error);
    await interaction.editReply({ content: '❌ Error al mostrar estadísticas.' });
  }
}

// Mostrar menú de herramientas
async function showToolsMenu(interaction) {
  try {
    const embed = new EmbedBuilder()
      .setTitle('🔧 Herramientas y Debugging')
      .setDescription('Herramientas adicionales para testing y debugging:')
      .setColor('#EF4444')
      .setTimestamp()
      .addFields(
        { name: '🔍 Verificar Precios', value: 'Obtener datos frescos de la API', inline: true },
        { name: '🧪 Test API', value: 'Probar conexión con Magic Eden', inline: true },
        { name: '📊 Debug Info', value: 'Información técnica del bot', inline: true }
      );

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('tools_verify')
          .setLabel('🔍 Verificar Precios')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('tools_test')
          .setLabel('🧪 Test API')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('tools_debug')
          .setLabel('📊 Debug Info')
          .setStyle(ButtonStyle.Secondary)
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('back_to_menu')
          .setLabel('🔙 Volver al Menú')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({ 
      embeds: [embed], 
      components: [row1, row2] 
    });
  } catch (error) {
    console.error('Error in showToolsMenu:', error);
    await interaction.editReply({ content: '❌ Error al mostrar herramientas.' });
  }
}

// Mostrar menú de ayuda
async function showHelpMenu(interaction) {
  try {
    const embed = new EmbedBuilder()
      .setTitle('ℹ️ Ayuda y Comandos')
      .setDescription('Información sobre cómo usar el bot NFT Tracking:')
      .setColor('#84CC16')
      .setTimestamp()
      .addFields(
        { name: '🤖 Comandos Principales', value: '• `/menu` - Menú principal con botones\n• `/setup` - Agregar proyecto\n• `/status` - Ver estado de proyecto', inline: false },
        { name: '🔔 Comandos de Alertas', value: '• `/alerts setup` - Configurar alerta\n• `/alerts list` - Ver mis alertas\n• `/alerts disable` - Deshabilitar alertas', inline: false },
        { name: '📊 Comandos de Datos', value: '• `/floor` - Floor price\n• `/volume` - Volume 24h\n• `/projects` - Listar proyectos', inline: false },
        { name: '🔧 Comandos de Debug', value: '• `/test-api` - Probar API\n• `/verify-price` - Verificar precios\n• `/delete` - Eliminar proyecto', inline: false },
        { name: '💡 Consejos', value: '• Usa `/menu` para navegación fácil\n• Las alertas se envían por DM o canal configurado\n• El bot actualiza datos cada minuto', inline: false }
      )
      .setFooter({ text: 'Para más ayuda, contacta al administrador del servidor' });

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('help_commands')
          .setLabel('📋 Lista Completa')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('help_examples')
          .setLabel('💡 Ejemplos')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('back_to_menu')
          .setLabel('🔙 Volver al Menú')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({ 
      embeds: [embed], 
      components: [row1] 
    });
  } catch (error) {
    console.error('Error in showHelpMenu:', error);
    await interaction.editReply({ content: '❌ Error al mostrar ayuda.' });
  }
}

// Crear modal para agregar proyecto
function createAddProjectModal() {
  const modal = new ModalBuilder()
    .setCustomId('add_project_modal')
    .setTitle('➕ Agregar Proyecto NFT');

  const nameInput = new TextInputBuilder()
    .setCustomId('project_name')
    .setLabel('Nombre del Proyecto')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ej: Bored Ape Yacht Club')
    .setRequired(true)
    .setMaxLength(100);

  const contractInput = new TextInputBuilder()
    .setCustomId('contract_address')
    .setLabel('Dirección del Contrato')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('0x...')
    .setRequired(true)
    .setMaxLength(42);

  const firstActionRow = new ActionRowBuilder().addComponents(nameInput);
  const secondActionRow = new ActionRowBuilder().addComponents(contractInput);

  modal.addComponents(firstActionRow, secondActionRow);
  return modal;
}

// Crear modal para configurar alertas
function createAlertSetupModal() {
  const modal = new ModalBuilder()
    .setCustomId('alert_setup_modal')
    .setTitle('🔔 Configurar Alerta');

  const projectInput = new TextInputBuilder()
    .setCustomId('alert_project')
    .setLabel('Nombre del Proyecto')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ej: Bored Ape Yacht Club')
    .setRequired(true)
    .setMaxLength(100);

  const thresholdInput = new TextInputBuilder()
    .setCustomId('alert_threshold')
    .setLabel('Umbral (ej: 0.5 ETH o 10%)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('0.5 ETH')
    .setRequired(true)
    .setMaxLength(20);

  const firstActionRow = new ActionRowBuilder().addComponents(projectInput);
  const secondActionRow = new ActionRowBuilder().addComponents(thresholdInput);

  modal.addComponents(firstActionRow, secondActionRow);
  return modal;
}

// Crear modal de confirmación para eliminar proyecto
function createDeleteProjectModal() {
  const modal = new ModalBuilder()
    .setCustomId('delete_project_modal')
    .setTitle('🗑️ Eliminar Proyecto');

  const projectInput = new TextInputBuilder()
    .setCustomId('delete_project_name')
    .setLabel('Nombre del Proyecto a Eliminar')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Escribe exactamente el nombre del proyecto')
    .setRequired(true)
    .setMaxLength(100);

  const confirmInput = new TextInputBuilder()
    .setCustomId('delete_confirm')
    .setLabel('Confirmación (escribe "ELIMINAR")')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('ELIMINAR')
    .setRequired(true)
    .setMaxLength(10);

  const firstActionRow = new ActionRowBuilder().addComponents(projectInput);
  const secondActionRow = new ActionRowBuilder().addComponents(confirmInput);

  modal.addComponents(firstActionRow, secondActionRow);
  return modal;
}

// Mostrar modal de selección de proyecto para status
async function showProjectStatusModal(interaction) {
  try {
    const projects = await getProjectsList();
    
    if (projects.length === 0) {
      await interaction.editReply({ content: '❌ No hay proyectos disponibles.' });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_project_status')
      .setPlaceholder('Selecciona un proyecto para ver su status')
      .addOptions(
        projects.map(project => 
          new StringSelectMenuOptionBuilder()
            .setLabel(project)
            .setValue(project)
        )
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({ 
      content: '📊 Selecciona un proyecto para ver su status:', 
      components: [row] 
    });
  } catch (error) {
    console.error('Error in showProjectStatusModal:', error);
    await interaction.editReply({ content: '❌ Error al mostrar proyectos.' });
  }
}

// Mostrar modal de selección de proyecto para floor price
async function showFloorPriceModal(interaction) {
  try {
    const projects = await getProjectsList();
    
    if (projects.length === 0) {
      await interaction.editReply({ content: '❌ No hay proyectos disponibles.' });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_project_floor')
      .setPlaceholder('Selecciona un proyecto para ver el floor price')
      .addOptions(
        projects.map(project => 
          new StringSelectMenuOptionBuilder()
            .setLabel(project)
            .setValue(project)
        )
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({ 
      content: '💰 Selecciona un proyecto para ver el floor price:', 
      components: [row] 
    });
  } catch (error) {
    console.error('Error in showFloorPriceModal:', error);
    await interaction.editReply({ content: '❌ Error al mostrar proyectos.' });
  }
}

// Mostrar modal de selección de proyecto para volume
async function showVolumeModal(interaction) {
  try {
    const projects = await getProjectsList();
    
    if (projects.length === 0) {
      await interaction.editReply({ content: '❌ No hay proyectos disponibles.' });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_project_volume')
      .setPlaceholder('Selecciona un proyecto para ver el volume')
      .addOptions(
        projects.map(project => 
          new StringSelectMenuOptionBuilder()
            .setLabel(project)
            .setValue(project)
        )
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({ 
      content: '📈 Selecciona un proyecto para ver el volume:', 
      components: [row] 
    });
  } catch (error) {
    console.error('Error in showVolumeModal:', error);
    await interaction.editReply({ content: '❌ Error al mostrar proyectos.' });
  }
}

// Mostrar modal de selección de proyecto para deshabilitar alertas
async function showDisableAlertModal(interaction) {
  try {
    const result = await pool.query(
      'SELECT DISTINCT np.name FROM user_alerts ua JOIN nft_projects np ON ua.project_id = np.id WHERE ua.discord_user_id = $1 AND ua.is_active = true',
      [interaction.user.id]
    );
    
    const projects = result.rows.map(row => row.name);
    
    if (projects.length === 0) {
      await interaction.editReply({ content: '❌ No tienes alertas activas para deshabilitar.' });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_project_disable')
      .setPlaceholder('Selecciona un proyecto para deshabilitar alertas')
      .addOptions(
        projects.map(project => 
          new StringSelectMenuOptionBuilder()
            .setLabel(project)
            .setValue(project)
        )
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({ 
      content: '🔕 Selecciona un proyecto para deshabilitar sus alertas:', 
      components: [row] 
    });
  } catch (error) {
    console.error('Error in showDisableAlertModal:', error);
    await interaction.editReply({ content: '❌ Error al mostrar proyectos.' });
  }
}

// Mostrar modal de selección de proyecto para eliminar alertas
async function showRemoveAlertModal(interaction) {
  try {
    const result = await pool.query(
      'SELECT DISTINCT np.name FROM user_alerts ua JOIN nft_projects np ON ua.project_id = np.id WHERE ua.discord_user_id = $1',
      [interaction.user.id]
    );
    
    const projects = result.rows.map(row => row.name);
    
    if (projects.length === 0) {
      await interaction.editReply({ content: '❌ No tienes alertas para eliminar.' });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_project_remove')
      .setPlaceholder('Selecciona un proyecto para eliminar alertas')
      .addOptions(
        projects.map(project => 
          new StringSelectMenuOptionBuilder()
            .setLabel(project)
            .setValue(project)
        )
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({ 
      content: '🗑️ Selecciona un proyecto para eliminar sus alertas:', 
      components: [row] 
    });
  } catch (error) {
    console.error('Error in showRemoveAlertModal:', error);
    await interaction.editReply({ content: '❌ Error al mostrar proyectos.' });
  }
}

// Mostrar modal de configuración de canal
async function showChannelConfigModal(interaction) {
  try {
    if (!await hasAdminPermissions(interaction)) {
      await interaction.editReply({ content: '❌ Solo los administradores pueden configurar el canal de alertas.' });
      return;
    }

    const channels = interaction.guild.channels.cache
      .filter(channel => channel.type === 0) // Solo canales de texto
      .map(channel => ({
        label: `#${channel.name}`,
        value: channel.id
      }))
      .slice(0, 25); // Discord limita a 25 opciones

    if (channels.length === 0) {
      await interaction.editReply({ content: '❌ No hay canales de texto disponibles.' });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_channel_config')
      .setPlaceholder('Selecciona un canal para las alertas')
      .addOptions(
        channels.map(channel => 
          new StringSelectMenuOptionBuilder()
            .setLabel(channel.label)
            .setValue(channel.value)
        )
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({ 
      content: '📢 Selecciona un canal para recibir las alertas:', 
      components: [row] 
    });
  } catch (error) {
    console.error('Error in showChannelConfigModal:', error);
    await interaction.editReply({ content: '❌ Error al mostrar canales.' });
  }
}

// Manejar botones de proyectos
async function handleProjectsButton(interaction) {
  const buttonId = interaction.customId;
  
  try {
    switch (buttonId) {
      case 'projects_list':
        await interaction.deferReply({ flags: 64 });
        await handleProjectsCommand(interaction);
        break;
      case 'projects_add':
        await interaction.showModal(createAddProjectModal());
        break;
      case 'projects_status':
        await interaction.deferReply({ flags: 64 });
        await showProjectStatusModal(interaction);
        break;
      case 'projects_floor':
        await interaction.deferReply({ flags: 64 });
        await showFloorPriceModal(interaction);
        break;
      case 'projects_volume':
        await interaction.deferReply({ flags: 64 });
        await showVolumeModal(interaction);
        break;
      case 'projects_delete':
        await interaction.showModal(createDeleteProjectModal());
        break;
      default:
        await interaction.reply({ content: '❌ Opción no reconocida.', flags: 64 });
    }
  } catch (error) {
    console.error('Error in handleProjectsButton:', error);
    await interaction.reply({ content: '❌ Error interno.', flags: 64 });
  }
}

// Manejar botones de alertas
async function handleAlertsButton(interaction) {
  const buttonId = interaction.customId;
  
  try {
    switch (buttonId) {
      case 'alerts_setup':
        await interaction.showModal(createAlertSetupModal());
        break;
      case 'alerts_list':
        await interaction.deferReply({ flags: 64 });
        await handleAlertsList(interaction);
        break;
      case 'alerts_disable':
        await interaction.deferReply({ flags: 64 });
        await showDisableAlertModal(interaction);
        break;
      case 'alerts_remove':
        await interaction.deferReply({ flags: 64 });
        await showRemoveAlertModal(interaction);
        break;
      case 'alerts_channel':
        await interaction.deferReply({ flags: 64 });
        await showChannelConfigModal(interaction);
        break;
      default:
        await interaction.reply({ content: '❌ Opción no reconocida.', flags: 64 });
    }
  } catch (error) {
    console.error('Error in handleAlertsButton:', error);
    await interaction.reply({ content: '❌ Error interno.', flags: 64 });
  }
}

// Manejar botones de configuración
async function handleConfigButton(interaction) {
  const buttonId = interaction.customId;
  
  try {
    await interaction.deferReply({ flags: 64 });
    
    switch (buttonId) {
      case 'config_channel':
        await interaction.editReply({ 
          content: '💡 Para configurar el canal de alertas, usa el comando `/alerts channel` seguido del canal.' 
        });
        break;
      case 'config_role':
        await interaction.editReply({ 
          content: '💡 Para configurar roles permitidos, usa el comando `/alerts enable-role` seguido del rol.' 
        });
        break;
      case 'config_status':
        await handleAlertsStatus(interaction);
        break;
      default:
        await interaction.editReply({ content: '❌ Opción no reconocida.' });
    }
  } catch (error) {
    console.error('Error in handleConfigButton:', error);
    await interaction.editReply({ content: '❌ Error interno.' });
  }
}

// Manejar botones de estadísticas
async function handleStatsButton(interaction) {
  const buttonId = interaction.customId;
  
  try {
    await interaction.deferReply({ flags: 64 });
    
    switch (buttonId) {
      case 'stats_projects':
        await handleProjectsCommand(interaction);
        break;
      case 'stats_alerts':
        await handleAlertsList(interaction);
        break;
      case 'stats_history':
        await interaction.editReply({ 
          content: '📈 El historial de precios se guarda automáticamente cuando hay cambios significativos (>1%).' 
        });
        break;
      default:
        await interaction.editReply({ content: '❌ Opción no reconocida.' });
    }
  } catch (error) {
    console.error('Error in handleStatsButton:', error);
    await interaction.editReply({ content: '❌ Error interno.' });
  }
}

// Manejar botones de herramientas
async function handleToolsButton(interaction) {
  const buttonId = interaction.customId;
  
  try {
    await interaction.deferReply({ flags: 64 });
    
    switch (buttonId) {
      case 'tools_verify':
        await interaction.editReply({ 
          content: '💡 Para verificar precios, usa el comando `/verify-price` seguido del nombre del proyecto.' 
        });
        break;
      case 'tools_test':
        await handleTestApiCommand(interaction);
        break;
      case 'tools_debug':
        await interaction.editReply({ 
          content: '🔧 **Información de Debug:**\n• Bot activo y funcionando\n• Tracking cada 1 minuto\n• Base de datos conectada\n• API Magic Eden operativa' 
        });
        break;
      default:
        await interaction.editReply({ content: '❌ Opción no reconocida.' });
    }
  } catch (error) {
    console.error('Error in handleToolsButton:', error);
    await interaction.editReply({ content: '❌ Error interno.' });
  }
}

// Manejar botones de ayuda
async function handleHelpButton(interaction) {
  const buttonId = interaction.customId;
  
  try {
    await interaction.deferReply({ flags: 64 });
    
    switch (buttonId) {
      case 'help_commands':
        await interaction.editReply({ 
          content: '📋 **Lista Completa de Comandos:**\n\n**Principales:**\n• `/menu` - Menú con botones\n• `/setup` - Agregar proyecto\n• `/status` - Estado del proyecto\n• `/projects` - Listar proyectos\n• `/delete` - Eliminar proyecto\n\n**Alertas:**\n• `/alerts setup` - Configurar alerta\n• `/alerts list` - Mis alertas\n• `/alerts disable` - Deshabilitar\n• `/alerts remove` - Eliminar alerta\n• `/alerts channel` - Canal de alertas\n\n**Datos:**\n• `/floor` - Floor price\n• `/volume` - Volume 24h\n• `/verify-price` - Verificar precios\n• `/test-api` - Probar API' 
        });
        break;
      case 'help_examples':
        await interaction.editReply({ 
          content: '💡 **Ejemplos de Uso:**\n\n**Agregar proyecto:**\n`/setup project:MonadPunks contract:0x123...`\n\n**Configurar alerta:**\n`/alerts setup project:MonadPunks alert_type:floor_change threshold:10%`\n\n**Ver estado:**\n`/status project:MonadPunks`\n\n**Ver floor price:**\n`/floor project:MonadPunks`' 
        });
        break;
      default:
        await interaction.editReply({ content: '❌ Opción no reconocida.' });
    }
  } catch (error) {
    console.error('Error in handleHelpButton:', error);
    await interaction.editReply({ content: '❌ Error interno.' });
  }
}

// Manejar comando twitter
async function handleTwitterCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();
  
  switch (subcommand) {
    case 'add':
      await handleTwitterAdd(interaction);
      break;
    case 'remove':
      await handleTwitterRemove(interaction);
      break;
    case 'list':
      await handleTwitterList(interaction);
      break;
    case 'test':
      await handleTwitterTest(interaction);
      break;
  }
}

// Agregar cuenta de Twitter
async function handleTwitterAdd(interaction) {
  try {
    await interaction.deferReply();
    
    const username = interaction.options.getString('username').replace('@', '').trim().toLowerCase();
    const channel = interaction.options.getChannel('channel');
    const guildId = interaction.guildId;
    
    // Validar canal
    if (!channel) {
      await interaction.editReply({ content: '❌ Canal no válido.' });
      return;
    }
    
    // Verificar si la cuenta ya está siendo monitoreada
    const existing = await pool.query(
      'SELECT * FROM twitter_accounts WHERE username = $1 AND guild_id = $2',
      [username, guildId]
    );
    
    if (existing.rows.length > 0) {
      await interaction.editReply({ 
        content: `❌ La cuenta @${username} ya está siendo monitoreada en este servidor.` 
      });
      return;
    }
    
    // Probar que podemos obtener el feed RSS
    try {
      const latestTweet = await twitterService.getLatestTweet(username);
      
      if (!latestTweet) {
        throw new Error('No se pudo obtener tweets de esta cuenta');
      }
      
      // Insertar en base de datos
      const result = await pool.query(
        `INSERT INTO twitter_accounts (username, channel_id, guild_id, last_tweet_id, is_active)
         VALUES ($1, $2, $3, $4, true) RETURNING *`,
        [username, channel.id, guildId, latestTweet.id]
      );
      
      const embed = new EmbedBuilder()
        .setTitle('✅ Cuenta de Twitter Agregada')
        .setDescription(`**@${username}** ahora será monitoreada`)
        .addFields(
          { name: 'Canal', value: `<#${channel.id}>`, inline: true },
          { name: 'Último tweet', value: latestTweet.id ? `ID: ${latestTweet.id}` : 'N/A', inline: true }
        )
        .setColor(0x1DA1F2)
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
      console.log(`✅ Cuenta de Twitter agregada: @${username} en canal ${channel.name}`);
      
    } catch (error) {
      console.error('Error verificando cuenta de Twitter:', error);
      await interaction.editReply({ 
        content: `❌ No se pudo acceder a la cuenta @${username}. Verifica que el nombre sea correcto.` 
      });
    }
    
  } catch (error) {
    console.error('Error in handleTwitterAdd:', error);
    await interaction.editReply({ content: '❌ Error interno al agregar cuenta de Twitter.' });
  }
}

// Remover cuenta de Twitter
async function handleTwitterRemove(interaction) {
  try {
    await interaction.deferReply();
    
    const username = interaction.options.getString('username').replace('@', '').trim().toLowerCase();
    const guildId = interaction.guildId;
    
    const result = await pool.query(
      'DELETE FROM twitter_accounts WHERE username = $1 AND guild_id = $2 RETURNING *',
      [username, guildId]
    );
    
    if (result.rows.length === 0) {
      await interaction.editReply({ content: `❌ No se encontró la cuenta @${username} en este servidor.` });
      return;
    }
    
    const embed = new EmbedBuilder()
      .setTitle('✅ Cuenta de Twitter Removida')
      .setDescription(`**@${username}** ya no será monitoreada`)
      .setColor(0xFF6B6B)
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
    console.log(`✅ Cuenta de Twitter removida: @${username}`);
    
  } catch (error) {
    console.error('Error in handleTwitterRemove:', error);
    await interaction.editReply({ content: '❌ Error interno al remover cuenta de Twitter.' });
  }
}

// Listar cuentas de Twitter
async function handleTwitterList(interaction) {
  try {
    await interaction.deferReply();
    
    const guildId = interaction.guildId;
    const result = await pool.query(
      'SELECT * FROM twitter_accounts WHERE guild_id = $1 ORDER BY username',
      [guildId]
    );
    
    if (result.rows.length === 0) {
      await interaction.editReply({ content: '📭 No hay cuentas de Twitter monitoreadas en este servidor.' });
      return;
    }
    
    const accounts = result.rows;
    const fields = accounts.map(account => {
      const channel = interaction.guild.channels.cache.get(account.channel_id);
      const status = account.is_active ? '✅ Activo' : '❌ Inactivo';
      return {
        name: `@${account.username}`,
        value: `Canal: ${channel ? `<#${channel.id}>` : 'N/A'}\nStatus: ${status}\nÚltimo check: <t:${Math.floor(new Date(account.last_check).getTime() / 1000)}:R>`,
        inline: true
      };
    });
    
    const embed = new EmbedBuilder()
      .setTitle('🐦 Cuentas de Twitter Monitoreadas')
      .setDescription(`**${accounts.length}** cuenta(s) configurada(s)`)
      .addFields(fields)
      .setColor(0x1DA1F2)
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error in handleTwitterList:', error);
    await interaction.editReply({ content: '❌ Error interno al listar cuentas de Twitter.' });
  }
}

// Probar cuenta de Twitter
async function handleTwitterTest(interaction) {
  try {
    await interaction.deferReply();
    
    const username = interaction.options.getString('username').replace('@', '').trim().toLowerCase();
    
    // Intentar obtener el último tweet
    const latestTweet = await twitterService.getLatestTweet(username);
    
    if (!latestTweet) {
      await interaction.editReply({ content: `❌ No se pudo obtener tweets de @${username}. Verifica que el nombre sea correcto.` });
      return;
    }
    
    const embed = new EmbedBuilder()
      .setTitle('✅ Test Exitoso')
      .setDescription(`Se pudo acceder a la cuenta @${username}`)
      .addFields(
        { name: 'Último tweet ID', value: latestTweet.id || 'N/A', inline: true },
        { name: 'Publicado', value: `<t:${Math.floor(latestTweet.timestamp.getTime() / 1000)}:R>`, inline: true }
      )
      .setURL(latestTweet.url)
      .setColor(0x1DA1F2)
      .setTimestamp();
    
    if (latestTweet.text) {
      embed.addFields({ name: 'Preview', value: latestTweet.text.substring(0, 256) + (latestTweet.text.length > 256 ? '...' : '') });
    }
    
    await interaction.editReply({ embeds: [embed] });
    console.log(`✅ Test de Twitter exitoso para: @${username}`);
    
  } catch (error) {
    console.error('Error in handleTwitterTest:', error);
    try {
      const username = interaction.options?.getString('username')?.replace('@', '').trim().toLowerCase() || 'desconocida';
      await interaction.editReply({ content: `❌ Error al probar cuenta @${username}: ${error.message}` });
    } catch (replyError) {
      console.error('Error sending error reply:', replyError);
    }
  }
}

const SUPPORTED_WALLET_CHAINS = ['monad', 'eth', 'solana', 'base', 'other'];

function normalizeChain(value, fallback = 'monad') {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  return SUPPORTED_WALLET_CHAINS.includes(normalized) ? normalized : 'other';
}

// Manejar comandos de wallet
async function handleWalletCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'add':
      await handleWalletAdd(interaction);
      break;
    case 'list':
      await handleWalletList(interaction);
      break;
    case 'remove':
      await handleWalletRemove(interaction);
      break;
    case 'edit':
      await handleWalletEdit(interaction);
      break;
    case 'channel_set':
      await handleWalletChannelSet(interaction);
      break;
    case 'channel_clear':
      await handleWalletChannelClear(interaction);
      break;
    default:
      await interaction.reply({ content: '❌ Subcomando no soportado.', ephemeral: true });
  }
}

async function handleWalletAdd(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const projectName = interaction.options.getString('project').trim();
  const chain = normalizeChain(interaction.options.getString('chain'));
  const label = interaction.options.getString('label')?.trim() || null;
  const link = interaction.options.getString('link').trim();
  const guildId = interaction.guildId;

  if (!projectName) {
    await interaction.editReply({ content: '❌ Debes proporcionar un nombre de proyecto.' });
    return;
  }

  if (!isValidUrl(link)) {
    await interaction.editReply({ content: '❌ Link inválido. Debe comenzar con http:// o https://.' });
    return;
  }

  try {
    await ensureServerConfigRow(guildId);

    const existing = await pool.query(
      `SELECT * FROM wallet_projects
       WHERE guild_id = $1 AND lower(project_name) = lower($2) AND lower(chain) = lower($3)`,
      [guildId, projectName, chain]
    );

    let projectId;
    let createdNew = false;

    if (existing.rows.length === 0) {
      const inserted = await pool.query(
        `INSERT INTO wallet_projects (guild_id, project_name, chain, submitted_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [guildId, projectName, chain, interaction.user.id]
      );
      projectId = inserted.rows[0].id;
      createdNew = true;
    } else {
      projectId = existing.rows[0].id;
    }

    const duplicateChannel = await pool.query(
      `SELECT id FROM wallet_channels WHERE project_id = $1 AND channel_link = $2`,
      [projectId, link]
    );

    if (duplicateChannel.rows.length > 0) {
      await interaction.editReply({ content: '❌ Ese link ya está registrado para este proyecto.' });
      return;
    }

    await pool.query(
      `INSERT INTO wallet_channels (project_id, submitted_by, label, channel_link)
       VALUES ($1, $2, $3, $4)`,
      [projectId, interaction.user.id, label, link]
    );

    await pool.query('UPDATE wallet_projects SET updated_at = NOW() WHERE id = $1', [projectId]);

    await updateWalletMessage(guildId);

    if (createdNew) {
      await interaction.editReply({ content: `✅ Proyecto **${projectName}** (${chain.toUpperCase()}) agregado con su primer canal.` });
    } else {
      await interaction.editReply({ content: `✅ Canal agregado al proyecto **${projectName}** (${chain.toUpperCase()}).` });
    }
  } catch (error) {
    console.error('Error in handleWalletAdd:', error);
    await interaction.editReply({ content: '❌ No se pudo agregar el proyecto. Intenta nuevamente.' });
  }
}

async function handleWalletList(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const chainOption = interaction.options.getString('chain');
    const chainFilter = chainOption && chainOption !== 'all' ? normalizeChain(chainOption) : null;

    const projects = await getWalletProjectsWithChannels(interaction.guildId, chainFilter);
    const embed = buildWalletEmbed(projects, { chainFilter });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleWalletList:', error);
    await interaction.editReply({ content: '❌ No se pudo obtener la lista de proyectos.' });
  }
}

async function handleWalletRemove(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const projectName = interaction.options.getString('project').trim();
  const chainOption = interaction.options.getString('chain');
  const chain = chainOption ? normalizeChain(chainOption) : null;
  const label = interaction.options.getString('label')?.trim() || null;
  const link = interaction.options.getString('link')?.trim() || null;
  const guildId = interaction.guildId;

  if (!projectName) {
    await interaction.editReply({ content: '❌ Debes indicar el nombre del proyecto.' });
    return;
  }

  try {
    const resolution = await resolveWalletProject(guildId, projectName, chain);

    if (resolution.error === 'not_found') {
      await interaction.editReply({ content: '❌ No se encontró un proyecto con ese nombre.' });
      return;
    }

    if (resolution.error === 'ambiguous') {
      const chains = resolution.chains.map(c => c.toUpperCase()).join(', ');
      await interaction.editReply({ content: `❌ Ese proyecto existe en varias redes (${chains}). Especifica la opción 'chain' para continuar.` });
      return;
    }

    const project = resolution.project;

    if (label || link) {
      const params = [project.id];
      let query = 'SELECT id FROM wallet_channels WHERE project_id = $1';

      if (label) {
        params.push(label.toLowerCase());
        query += ` AND lower(COALESCE(label, '')) = lower($${params.length})`;
      }

      if (link) {
        params.push(link);
        query += ` AND channel_link = $${params.length}`;
      }

      const channelResult = await pool.query(query, params);

      if (channelResult.rows.length === 0) {
        await interaction.editReply({ content: '❌ No se encontró un canal que coincida con los datos proporcionados.' });
        return;
      }

      const ids = channelResult.rows.map(row => row.id);
      await pool.query('DELETE FROM wallet_channels WHERE id = ANY($1::uuid[])', [ids]);

      const remaining = await pool.query('SELECT COUNT(*)::int FROM wallet_channels WHERE project_id = $1', [project.id]);

      if (remaining.rows[0].count === 0) {
        await pool.query('DELETE FROM wallet_projects WHERE id = $1', [project.id]);
        await updateWalletMessage(guildId);
        await interaction.editReply({ content: `🗑️ Se eliminaron los canales y el proyecto **${project.project_name}** (${project.chain.toUpperCase()}) quedó vacío, por lo que también se eliminó.` });
        return;
      }

      await pool.query('UPDATE wallet_projects SET updated_at = NOW() WHERE id = $1', [project.id]);
      await updateWalletMessage(guildId);
      await interaction.editReply({ content: `🗑️ Canal eliminado para **${project.project_name}** (${project.chain.toUpperCase()}).` });
      return;
    }

    await pool.query('DELETE FROM wallet_projects WHERE id = $1', [project.id]);
    await updateWalletMessage(guildId);

    await interaction.editReply({ content: `🗑️ Proyecto **${project.project_name}** (${project.chain.toUpperCase()}) eliminado.` });
  } catch (error) {
    console.error('Error in handleWalletRemove:', error);
    await interaction.editReply({ content: '❌ No se pudo eliminar el proyecto.' });
  }
}

async function handleWalletEdit(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const projectName = interaction.options.getString('project').trim();
  const chainOption = interaction.options.getString('chain');
  const chain = chainOption ? normalizeChain(chainOption) : null;
  const newName = interaction.options.getString('new_name')?.trim();
  const newChainOption = interaction.options.getString('new_chain');
  const newChain = newChainOption ? normalizeChain(newChainOption) : null;
  const channelLabel = interaction.options.getString('channel_label')?.trim();
  const channelLink = interaction.options.getString('channel_link')?.trim();
  const newLabel = interaction.options.getString('new_label')?.trim();
  const newLink = interaction.options.getString('new_link')?.trim();
  const guildId = interaction.guildId;

  if (!newName && !newChain && !newLabel && !newLink) {
    await interaction.editReply({ content: '❌ Debes proporcionar algún cambio (nuevo nombre, red o datos de canal).' });
    return;
  }

  try {
    const resolution = await resolveWalletProject(guildId, projectName, chain);

    if (resolution.error === 'not_found') {
      await interaction.editReply({ content: '❌ No se encontró un proyecto con ese nombre.' });
      return;
    }

    if (resolution.error === 'ambiguous') {
      const chains = resolution.chains.map(c => c.toUpperCase()).join(', ');
      await interaction.editReply({ content: `❌ Ese proyecto existe en varias redes (${chains}). Especifica la opción 'chain' para continuar.` });
      return;
    }

    const project = resolution.project;
    const appliedChanges = [];

    if (newName) {
      if (!newName.trim()) {
        await interaction.editReply({ content: '❌ El nuevo nombre no puede estar vacío.' });
        return;
      }

      const duplicateCheck = await pool.query(
        `SELECT id FROM wallet_projects
         WHERE guild_id = $1 AND lower(project_name) = lower($2) AND lower(chain) = lower($3) AND id <> $4`,
        [guildId, newName, project.chain, project.id]
      );

      if (duplicateCheck.rows.length > 0) {
        await interaction.editReply({ content: '❌ Ya existe otro proyecto con ese nombre en esa red.' });
        return;
      }

      await pool.query('UPDATE wallet_projects SET project_name = $1, updated_at = NOW() WHERE id = $2', [newName, project.id]);
      project.project_name = newName;
      appliedChanges.push('nombre');
    }

    if (newChain && newChain !== project.chain) {
      const conflict = await pool.query(
        `SELECT id FROM wallet_projects
         WHERE guild_id = $1 AND lower(project_name) = lower($2) AND lower(chain) = lower($3) AND id <> $4`,
        [guildId, project.project_name, newChain, project.id]
      );

      if (conflict.rows.length > 0) {
        await interaction.editReply({ content: '❌ Ya existe ese proyecto en la red seleccionada.' });
        return;
      }

      await pool.query('UPDATE wallet_projects SET chain = $1, updated_at = NOW() WHERE id = $2', [newChain, project.id]);
      project.chain = newChain;
      appliedChanges.push('red');
    }

    if (channelLabel || channelLink) {
      const params = [project.id];
      let query = 'SELECT * FROM wallet_channels WHERE project_id = $1';

      if (channelLabel) {
        params.push(channelLabel.toLowerCase());
        query += ` AND lower(COALESCE(label, '')) = lower($${params.length})`;
      }

      if (channelLink) {
        params.push(channelLink);
        query += ` AND channel_link = $${params.length}`;
      }

      query += ' ORDER BY created_at LIMIT 1';

      const channelResult = await pool.query(query, params);

      if (channelResult.rows.length === 0) {
        await interaction.editReply({ content: '❌ No se encontró un canal que coincida con los datos proporcionados.' });
        return;
      }

      const channel = channelResult.rows[0];
      const updates = [];
      const updateParams = [];

      if (newLabel !== undefined && newLabel !== null) {
        updateParams.push(newLabel || null);
        updates.push(`label = $${updateParams.length}`);
        channel.label = newLabel || null;
      }

      if (newLink) {
        if (!isValidUrl(newLink)) {
          await interaction.editReply({ content: '❌ El nuevo link del canal no es válido.' });
          return;
        }
        updateParams.push(newLink);
        updates.push(`channel_link = $${updateParams.length}`);
        channel.channel_link = newLink;
      }

      if (updates.length > 0) {
        updateParams.push(channel.id);
        await pool.query(
          `UPDATE wallet_channels SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${updateParams.length}`,
          updateParams
        );
        appliedChanges.push('canal');
      }
    }

    if (appliedChanges.length === 0) {
      await interaction.editReply({ content: 'ℹ️ No se detectaron cambios para aplicar.' });
      return;
    }

    await pool.query('UPDATE wallet_projects SET updated_at = NOW() WHERE id = $1', [project.id]);
    await updateWalletMessage(guildId);

    await interaction.editReply({ content: `✏️ Cambios aplicados en **${project.project_name}** (${project.chain.toUpperCase()}): ${appliedChanges.join(', ')}.` });
  } catch (error) {
    console.error('Error in handleWalletEdit:', error);
    await interaction.editReply({ content: '❌ No se pudo actualizar el proyecto.' });
  }
}

async function handleWalletChannelSet(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const channel = interaction.options.getChannel('channel');
  const guildId = interaction.guildId;

  if (!channel || !channel.isTextBased()) {
    await interaction.editReply({ content: '❌ Debes seleccionar un canal de texto válido.' });
    return;
  }

  if (channel.guildId && channel.guildId !== guildId) {
    await interaction.editReply({ content: '❌ Solo puedes seleccionar canales del servidor actual.' });
    return;
  }

  try {
    await ensureServerConfigRow(guildId);

    await pool.query(
      `UPDATE server_config
       SET wallet_channel_id = $1,
           wallet_message_id = NULL,
           updated_at = NOW()
       WHERE guild_id = $2`,
      [channel.id, guildId]
    );

    await updateWalletMessage(guildId);

    await interaction.editReply({ content: `✅ Canal configurado: <#${channel.id}>` });
  } catch (error) {
    console.error('Error in handleWalletChannelSet:', error);
    await interaction.editReply({ content: '❌ No se pudo configurar el canal.' });
  }
}

async function handleWalletChannelClear(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId;

  try {
    const config = await getServerConfigRow(guildId);

    await pool.query(
      `UPDATE server_config
       SET wallet_channel_id = NULL,
           wallet_message_id = NULL,
           updated_at = NOW()
       WHERE guild_id = $1`,
      [guildId]
    );

    // Intentar eliminar mensaje existente si se guardó
    if (config?.wallet_channel_id && config?.wallet_message_id) {
      const channel = await client.channels.fetch(config.wallet_channel_id).catch(() => null);
      if (channel && channel.isTextBased()) {
        try {
          const message = await channel.messages.fetch(config.wallet_message_id);
          await message.unpin().catch(() => {});
          await message.delete().catch(() => {});
        } catch (error) {
          console.log('No se pudo eliminar el mensaje de wallet existente:', error.message);
        }
      }
    }

    await interaction.editReply({ content: '✅ Canal de wallet reseteado.' });
  } catch (error) {
    console.error('Error in handleWalletChannelClear:', error);
    await interaction.editReply({ content: '❌ No se pudo limpiar la configuración de canal.' });
  }
}

async function ensureServerConfigRow(guildId) {
  try {
    await pool.query(
      'INSERT INTO server_config (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO NOTHING',
      [guildId]
    );
  } catch (error) {
    console.error('Error ensuring server config row:', error);
  }
}

async function getServerConfigRow(guildId) {
  const result = await pool.query('SELECT * FROM server_config WHERE guild_id = $1', [guildId]);
  return result.rows[0] || null;
}

async function getWalletProjectNames(guildId) {
  const result = await pool.query(
    `SELECT DISTINCT project_name
     FROM wallet_projects
     WHERE guild_id = $1
     ORDER BY lower(project_name)` ,
    [guildId]
  );
  return result.rows.map(row => row.project_name);
}

async function updateWalletMessage(guildId) {
  try {
    await ensureServerConfigRow(guildId);
    const config = await getServerConfigRow(guildId);
    if (!config || !config.wallet_channel_id) {
      return;
    }

    const channel = await client.channels.fetch(config.wallet_channel_id).catch(() => null);

    if (!channel || !channel.isTextBased()) {
      console.warn(`Wallet channel not accessible for guild ${guildId}`);
      return;
    }

    const projects = await getWalletProjectsWithChannels(guildId);
    const embed = buildWalletEmbed(projects, {});

    let messageId = config.wallet_message_id;

    if (messageId) {
      try {
        const existingMessage = await channel.messages.fetch(messageId);
        await existingMessage.edit({ embeds: [embed] });
        if (!existingMessage.pinned) {
          await existingMessage.pin().catch(() => {});
        }
        return;
      } catch (error) {
        console.log('No se pudo actualizar el mensaje de wallet, se creará uno nuevo:', error.message);
        messageId = null;
      }
    }

    const sentMessage = await channel.send({ embeds: [embed] });
    await pool.query(
      'UPDATE server_config SET wallet_message_id = $1, updated_at = NOW() WHERE guild_id = $2',
      [sentMessage.id, guildId]
    );
    await sentMessage.pin().catch(() => {});
  } catch (error) {
    console.error('Error updating wallet message:', error);
  }
}

function buildWalletEmbed(projects, { chainFilter = null } = {}) {
  const embed = new EmbedBuilder()
    .setTitle('📋 Proyectos con submit de wallets')
    .setColor(0x3B82F6)
    .setTimestamp(new Date());

  if (!projects || projects.length === 0) {
    if (chainFilter) {
      embed.setDescription(`No hay proyectos registrados para la red **${chainFilter.toUpperCase()}**.`);
    } else {
      embed.setDescription('No hay proyectos registrados todavía. Usa `/wallet add` para agregar uno.');
    }
    return embed;
  }

  let description = '';
  let countIncluded = 0;

  for (const [index, project] of projects.entries()) {
    const header = `${index + 1}. **${escapeMarkdown(project.project_name)}** (${project.chain.toUpperCase()})`;
    const channelLines = project.channels.length > 0
      ? project.channels.map(channel => {
          const label = channel.label ? escapeMarkdown(channel.label) : 'Canal';
          return `   • [${label}](${channel.channel_link})`;
        })
      : ['   • Sin canales registrados'];

    const block = [header, ...channelLines].join('\n');

    if ((description + '\n' + block).length > 4000) {
      break;
    }

    description += (description ? '\n' : '') + block;
    countIncluded++;
  }

  embed.setDescription(description);

  if (countIncluded < projects.length) {
    embed.addFields({
      name: 'Más proyectos',
      value: `... y ${projects.length - countIncluded} proyectos más. Usa \\/wallet list para ver el listado completo.`
    });
  }

  const footerChain = chainFilter ? `${chainFilter.toUpperCase()} • ` : '';
  embed.setFooter({ text: `${footerChain}${projects.length} proyecto(s) registrado(s)` });

  return embed;
}

function escapeMarkdown(text = '') {
  return text.replace(/([\\*_`~|])/g, '\\$1').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

// Manejar comando menu
async function handleMenuCommand(interaction) {
  try {
    const embed = new EmbedBuilder()
      .setTitle('🤖 NFT Tracking Bot - Menú Principal')
      .setDescription('Selecciona una opción usando los botones de abajo:')
      .setColor('#7C3AED')
      .setTimestamp()
      .addFields(
        { name: '📊 Proyectos', value: 'Ver, agregar y gestionar proyectos NFT', inline: true },
        { name: '🔔 Alertas', value: 'Configurar y gestionar alertas de precios', inline: true },
        { name: '⚙️ Configuración', value: 'Configurar el servidor y permisos', inline: true },
        { name: '📈 Estadísticas', value: 'Ver estadísticas y datos de proyectos', inline: true },
        { name: '🔧 Herramientas', value: 'Herramientas adicionales y debugging', inline: true },
        { name: 'ℹ️ Ayuda', value: 'Información y comandos disponibles', inline: true }
      )
      .setFooter({ text: 'Usa los botones para navegar por las opciones' });

    // Crear botones para el menú principal
    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('menu_projects')
          .setLabel('📊 Proyectos')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('menu_alerts')
          .setLabel('🔔 Alertas')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('menu_config')
          .setLabel('⚙️ Configuración')
          .setStyle(ButtonStyle.Secondary)
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('menu_stats')
          .setLabel('📈 Estadísticas')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('menu_tools')
          .setLabel('🔧 Herramientas')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('menu_help')
          .setLabel('ℹ️ Ayuda')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.reply({ 
      embeds: [embed], 
      components: [row1, row2] 
    });
  } catch (error) {
    console.error('Error in handleMenuCommand:', error);
    await interaction.reply({ content: '❌ Error interno.', flags: 64 });
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

// Manejar comando verify-price
async function handleVerifyPriceCommand(interaction) {
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

    // Obtener datos frescos de la API
    const projectData = await getProjectData(project.contract_address);
    
    if (!projectData) {
      await interaction.editReply({ content: '❌ No se pudieron obtener datos de la API.' });
      return;
    }

    const currency = projectData.currency || 'ETH';
    const floorPrice = projectData.floor_price || 0;
    const priceUSD = projectData.price_usd || 0;

    const embed = new EmbedBuilder()
      .setTitle(`🔍 Verificación de Precio: ${project.name}`)
      .setDescription('Datos obtenidos directamente de la API')
      .setColor('#3B82F6')
      .setTimestamp();

    // Agregar imagen si está disponible
    if (projectData.image) {
      embed.setThumbnail(projectData.image);
    }

    embed.addFields(
      { 
        name: '💰 Floor Price (API)', 
        value: `${floorPrice.toFixed(2)} ${currency}\n($${priceUSD.toFixed(2)} USD)`, 
        inline: true 
      },
      { 
        name: '📊 Volume 24h', 
        value: `${(projectData.volume_24h || 0).toFixed(2)} ${currency}`, 
        inline: true 
      },
      { 
        name: '🛒 Sales', 
        value: `${projectData.sales_count || 0}`, 
        inline: true 
      },
      { 
        name: '📋 Listings', 
        value: `${projectData.listings_count || 0}`, 
        inline: true 
      },
      { 
        name: '🎯 Top Bid', 
        value: `${(projectData.top_bid || 0).toFixed(2)} ${currency}`, 
        inline: true 
      },
      { 
        name: '📈 Avg Sale Price', 
        value: `${(projectData.avg_sale_price || 0).toFixed(2)} ${currency}`, 
        inline: true 
      }
    );

    // Agregar información de la fuente
    embed.addFields({
      name: '🔗 Fuente',
      value: `API: ${projectData.source || 'Unknown'}`,
      inline: false
    });

    // Agregar link al marketplace si está disponible
    if (projectData.marketplace_url) {
      embed.addFields({
        name: '🏪 Marketplace',
        value: `[Ver en Magic Eden](${projectData.marketplace_url})`,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleVerifyPriceCommand:', error);
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

// Obtener lista de cuentas de Twitter para autocompletado
async function getTwitterAccountsList(guildId) {
  try {
    const result = await pool.query(
      'SELECT username FROM twitter_accounts WHERE guild_id = $1 ORDER BY username', 
      [guildId]
    );
    return result.rows.map(row => row.username);
  } catch (error) {
    console.error('Error getting Twitter accounts list:', error);
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
    throw new Error(`Failed to fetch ETH price: ${error.message}`);
  }
}

// Inicializar base de datos y tablas
async function initializeDatabase() {
  try {
    console.log('🔧 Initializing database...');
    
    // Crear tablas principales si no existen
    await pool.query(`
      CREATE TABLE IF NOT EXISTS nft_projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        contract_address TEXT NOT NULL,
        marketplace TEXT DEFAULT 'magic-eden',
        status TEXT DEFAULT 'active',
        last_floor_price DECIMAL,
        last_volume DECIMAL,
        last_sales_count INTEGER,
        last_listings_count INTEGER,
        last_avg_sale_price DECIMAL,
        last_update TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS price_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES nft_projects(id) ON DELETE CASCADE,
        floor_price DECIMAL,
        volume_24h DECIMAL,
        sales_count INTEGER,
        listings_count INTEGER,
        avg_sale_price DECIMAL,
        recorded_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        discord_user_id TEXT NOT NULL,
        project_id UUID REFERENCES nft_projects(id) ON DELETE CASCADE,
        alert_types JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(discord_user_id, project_id)
      );
    `);
    
    // Inicializar tablas adicionales
    await initializeAlertHistory();
    await initializeServerConfig();
    
    console.log('🔧 Database initialization completed');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Inicializar tabla de historial de alertas
async function initializeAlertHistory() {
  try {
    console.log('🔔 Initializing alert_history table...');
    
    // Verificar si la tabla existe
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'alert_history'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('🔔 Creating alert_history table...');
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS alert_history (
          id SERIAL PRIMARY KEY,
          project_id UUID REFERENCES nft_projects(id) ON DELETE CASCADE,
          alert_type VARCHAR(50) NOT NULL,
          alert_value VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
      
      console.log('🔔 alert_history table created successfully');
    } else {
      console.log('🔔 alert_history table already exists');
    }
  } catch (error) {
    console.error('Error initializing alert_history table:', error);
  }
}

// Inicializar tabla de configuración del servidor
async function initializeServerConfig() {
  try {
    console.log('🔔 Initializing server_config table...');
    
    // Verificar si la tabla existe
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'server_config'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('🔔 Creating server_config table...');
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS server_config (
          id SERIAL PRIMARY KEY,
          guild_id VARCHAR(20) UNIQUE NOT NULL,
          alerts_channel_id VARCHAR(20),
          enabled_role_id VARCHAR(20),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      
      console.log('🔔 server_config table created successfully');
    } else {
      console.log('🔔 server_config table already exists');
    }
  } catch (error) {
    console.error('Error initializing server_config table:', error);
  }
}

// Función para verificar alertas
async function checkAlerts(project, projectData) {
  console.log('🔔 ENTERING checkAlerts function v3');
  console.log('🔔 Project:', project.name);
  console.log('🔔 ProjectData:', projectData);
  
  try {
    // Obtener todas las alertas activas para este proyecto
    const alertsResult = await pool.query(
      'SELECT * FROM user_alerts WHERE project_id = $1 AND is_active = true',
      [project.id]
    );
    
    console.log('🔔 Found alerts:', alertsResult.rows.length);
    
    if (alertsResult.rows.length === 0) {
      console.log('🔔 No active alerts found for project');
      return;
    }
    
    // Procesar cada alerta
    for (const alert of alertsResult.rows) {
      console.log('🔔 Processing alert for user:', alert.discord_user_id);
      
      try {
        // Parsear las configuraciones de alerta
        const alertConfigs = JSON.parse(alert.alert_types || '[]');
        console.log('🔔 Alert configs:', alertConfigs);
        
        // Procesar cada configuración de alerta
        for (const alertConfig of alertConfigs) {
          console.log('🔔 Processing alert config:', alertConfig);
          await processAlert(project, projectData, alert, alertConfig);
        }
      } catch (error) {
        console.error('Error processing alert for user:', alert.discord_user_id, error);
      }
    }
    
    console.log('🔔 checkAlerts function completed successfully');
  } catch (error) {
    console.error('Error in checkAlerts:', error);
  }
}

// Función para procesar una alerta específica
async function processAlert(project, projectData, alert, alertConfig) {
  console.log('🔔 processAlert: Starting for', project.name, 'config:', alertConfig);
  
  try {
    let shouldNotify = false;
    let message = '';
    
    // Obtener datos anteriores para comparación
    const previousFloorPrice = await getPreviousPrice(project.id, 'floor_price', alertConfig.timeframe);
    const previousVolume = await getPreviousPrice(project.id, 'volume_24h', alertConfig.timeframe);
    const previousSales = await getPreviousPrice(project.id, 'sales_count', alertConfig.timeframe);
    const previousListings = await getPreviousPrice(project.id, 'listings_count', alertConfig.timeframe);
    
    console.log('🔔 processAlert: Previous data - Floor:', previousFloorPrice, 'Volume:', previousVolume, 'Sales:', previousSales);
    
    const currentFloorPrice = projectData.floor_price || 0;
    const currentVolume = projectData.volume_24h || 0;
    const currentSales = projectData.sales_count || 0;
    const currentListings = projectData.listings_count || 0;
    
    console.log('🔔 processAlert: Current data - Floor:', currentFloorPrice, 'Volume:', currentVolume, 'Sales:', currentSales);
    
    // Verificar condiciones según el tipo de alerta
    switch (alertConfig.type) {
      case 'floor_change':
        if (previousFloorPrice > 0) {
          const changePercent = ((currentFloorPrice - previousFloorPrice) / previousFloorPrice) * 100;
          if (alertConfig.threshold_type === 'percentage') {
            shouldNotify = Math.abs(changePercent) >= alertConfig.threshold_value;
            message = `Floor price changed by ${changePercent.toFixed(2)}% (threshold: ${alertConfig.threshold_value}%)`;
          } else {
            const changeAbsolute = Math.abs(currentFloorPrice - previousFloorPrice);
            shouldNotify = changeAbsolute >= alertConfig.threshold_value;
            message = `Floor price changed by ${changeAbsolute.toFixed(4)} ${projectData.currency || 'ETH'} (threshold: ${alertConfig.threshold_value} ${projectData.currency || 'ETH'})`;
          }
        }
        break;
        
      case 'floor_above':
        shouldNotify = currentFloorPrice >= alertConfig.threshold_value;
        message = `Floor price is above ${alertConfig.threshold_value} ${projectData.currency || 'ETH'}`;
        break;
        
      case 'floor_below':
        shouldNotify = currentFloorPrice <= alertConfig.threshold_value;
        message = `Floor price is below ${alertConfig.threshold_value} ${projectData.currency || 'ETH'}`;
        break;
        
      case 'volume_change':
        if (previousVolume > 0) {
          const changePercent = ((currentVolume - previousVolume) / previousVolume) * 100;
          if (alertConfig.threshold_type === 'percentage') {
            shouldNotify = Math.abs(changePercent) >= alertConfig.threshold_value;
            message = `Volume changed by ${changePercent.toFixed(2)}% (threshold: ${alertConfig.threshold_value}%)`;
          } else {
            const changeAbsolute = Math.abs(currentVolume - previousVolume);
            shouldNotify = changeAbsolute >= alertConfig.threshold_value;
            message = `Volume changed by ${changeAbsolute.toFixed(4)} ${projectData.currency || 'ETH'} (threshold: ${alertConfig.threshold_value} ${projectData.currency || 'ETH'})`;
          }
        }
        break;
        
      case 'volume_above':
        shouldNotify = currentVolume >= alertConfig.threshold_value;
        message = `Volume is above ${alertConfig.threshold_value} ${projectData.currency || 'ETH'}`;
        break;
        
      case 'volume_below':
        shouldNotify = currentVolume <= alertConfig.threshold_value;
        message = `Volume is below ${alertConfig.threshold_value} ${projectData.currency || 'ETH'}`;
        break;
        
      case 'sales_change':
        if (previousSales > 0) {
          const changePercent = ((currentSales - previousSales) / previousSales) * 100;
          if (alertConfig.threshold_type === 'percentage') {
            shouldNotify = Math.abs(changePercent) >= alertConfig.threshold_value;
            message = `Sales count changed by ${changePercent.toFixed(2)}% (threshold: ${alertConfig.threshold_value}%)`;
          } else {
            const changeAbsolute = Math.abs(currentSales - previousSales);
            shouldNotify = changeAbsolute >= alertConfig.threshold_value;
            message = `Sales count changed by ${changeAbsolute} (threshold: ${alertConfig.threshold_value})`;
          }
        }
        break;
        
      case 'listings_change':
        if (previousListings > 0) {
          const changePercent = ((currentListings - previousListings) / previousListings) * 100;
          if (alertConfig.threshold_type === 'percentage') {
            shouldNotify = Math.abs(changePercent) >= alertConfig.threshold_value;
            message = `Listings count changed by ${changePercent.toFixed(2)}% (threshold: ${alertConfig.threshold_value}%)`;
          } else {
            const changeAbsolute = Math.abs(currentListings - previousListings);
            shouldNotify = changeAbsolute >= alertConfig.threshold_value;
            message = `Listings count changed by ${changeAbsolute} (threshold: ${alertConfig.threshold_value})`;
          }
        }
        break;
    }
    
    console.log('🔔 processAlert: Should notify:', shouldNotify, 'Message:', message);
    
    if (shouldNotify) {
      // Verificar anti-spam (no enviar la misma alerta en el mismo día)
      const today = new Date().toISOString().split('T')[0];
      const alertKey = `${alertConfig.type}_${alertConfig.threshold_value}`;
      
      const spamCheck = await pool.query(
        'SELECT * FROM alert_history WHERE project_id = $1 AND alert_type = $2 AND alert_value = $3 AND created_at::date = $4',
        [project.id, alertConfig.type, alertKey, today]
      );
      
      if (spamCheck.rows.length > 0) {
        console.log('🔔 processAlert: Alert already sent today, skipping to avoid spam');
        return;
      }
      
      // Obtener usuario de Discord
      const user = await client.users.fetch(alert.discord_user_id);
      if (!user) {
        console.log('🔔 processAlert: User not found:', alert.discord_user_id);
        return;
      }
      
      // Obtener configuración del servidor
      const serverConfig = await pool.query(
        'SELECT * FROM server_config WHERE guild_id = $1',
        [user.id] // Usar user ID como fallback, debería ser guild_id
      );
      
      // Crear embed de notificación
      const embed = new EmbedBuilder()
        .setTitle(`🔔 Alerta: ${project.name}`)
        .setDescription(`**${getAlertTypeName(alertConfig.type)}**`)
        .addFields(
          { name: '📊 Condición', value: message, inline: false },
          { name: '⏰ Timeframe', value: getTimeframeName(alertConfig.timeframe), inline: true },
          { name: '🎯 Umbral', value: `${alertConfig.threshold_value}${alertConfig.threshold_type === 'percentage' ? '%' : ' ETH'}`, inline: true }
        )
        .setColor('#FF6B6B')
        .setTimestamp();
      
      // Agregar imagen del NFT si está disponible
      if (projectData.image) {
        embed.setThumbnail(projectData.image);
      }
      
      // Agregar datos actuales
      const currency = projectData.currency || 'ETH';
      const floorPrice = projectData.floor_price || 0;
      const topBid = projectData.top_bid || 0;
      const priceUSD = projectData.price_usd || 0;
      
      embed.addFields({
        name: '📊 Datos Actuales',
        value: `Floor: ${floorPrice.toFixed(2)} ${currency} ($${priceUSD.toFixed(2)})\nTop Bid: ${topBid.toFixed(2)} ${currency}\nVolume: ${currentVolume.toFixed(2)} ${currency}`,
        inline: true
      });

      // Agregar botón para deshabilitar alerta
      const disableButton = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`disable_alert_${project.id}_${alert.discord_user_id}`)
            .setLabel('🔕 Deshabilitar Alerta')
            .setStyle(ButtonStyle.Danger)
        );

      // Intentar enviar al canal configurado
      if (serverConfig.rows.length > 0 && serverConfig.rows[0].alerts_channel_id) {
        try {
          const channel = client.channels.cache.get(serverConfig.rows[0].alerts_channel_id);
          if (channel) {
            await channel.send({ embeds: [embed], components: [disableButton] });
            console.log(`🔔 processAlert: Notification sent to channel ${channel.name}!`);
            
            // Registrar alerta enviada para anti-spam
            try {
              await pool.query(
                'INSERT INTO alert_history (project_id, alert_type, alert_value) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                [project.id, alertConfig.type, alertKey]
              );
              console.log(`🔔 processAlert: Alert recorded in history for anti-spam`);
            } catch (error) {
              console.log(`🔔 processAlert: Error recording alert history (table might not exist yet):`, error.message);
            }
            return;
          }
        } catch (error) {
          console.error('Error sending to channel:', error);
        }
      }

      // Fallback: enviar DM al usuario (solo si no hay canal configurado)
      console.log(`🔔 processAlert: No channel configured, sending DM to user ${user.username}`);
      await user.send({ embeds: [embed], components: [disableButton] });
      console.log(`🔔 processAlert: Notification sent via DM successfully!`);
      
      // Registrar alerta enviada para anti-spam
      try {
        await pool.query(
          'INSERT INTO alert_history (project_id, alert_type, alert_value) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [project.id, alertConfig.type, alertKey]
        );
        console.log(`🔔 processAlert: Alert recorded in history for anti-spam`);
      } catch (error) {
        console.log(`🔔 processAlert: Error recording alert history (table might not exist yet):`, error.message);
      }
    } else {
      console.log(`🔔 processAlert: No conditions met, no notification sent`);
    }
  } catch (error) {
    console.error('Error processing alert:', error);
  }
}

// Función para guardar historial de precios solo si hay cambios significativos
async function savePriceHistoryIfChanged(project, projectData) {
  try {
    // Obtener el último registro de precios
    const lastRecord = await pool.query(
      'SELECT * FROM price_history WHERE project_id = $1 ORDER BY recorded_at DESC LIMIT 1',
      [project.id]
    );
    
    if (lastRecord.rows.length === 0) {
      // No hay registros previos, insertar el primero
      await pool.query(
        'INSERT INTO price_history (project_id, floor_price, volume_24h, sales_count, listings_count, avg_sale_price) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          project.id,
          projectData.floor_price || 0,
          projectData.volume_24h || 0,
          projectData.sales_count || 0,
          projectData.listings_count || 0,
          projectData.avg_sale_price || 0
        ]
      );
      console.log(`📊 Price history: First record saved for ${project.name}`);
      return;
    }
    
    const lastData = lastRecord.rows[0];
    const currentFloorPrice = projectData.floor_price || 0;
    const currentVolume = projectData.volume_24h || 0;
    const currentSales = projectData.sales_count || 0;
    
    // Calcular cambios porcentuales
    const floorChange = lastData.floor_price > 0 ? 
      Math.abs((currentFloorPrice - lastData.floor_price) / lastData.floor_price) : 0;
    const volumeChange = lastData.volume_24h > 0 ? 
      Math.abs((currentVolume - lastData.volume_24h) / lastData.volume_24h) : 0;
    const salesChange = lastData.sales_count > 0 ? 
      Math.abs((currentSales - lastData.sales_count) / lastData.sales_count) : 0;
    
    // Solo guardar si hay cambios significativos (>1%)
    if (floorChange > 0.01 || volumeChange > 0.01 || salesChange > 0.01) {
      await pool.query(
        'INSERT INTO price_history (project_id, floor_price, volume_24h, sales_count, listings_count, avg_sale_price) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          project.id,
          currentFloorPrice,
          currentVolume,
          currentSales,
          projectData.listings_count || 0,
          projectData.avg_sale_price || 0
        ]
      );
      console.log(`📊 Price history: Significant change detected and saved for ${project.name}`);
    } else {
      console.log(`📊 Price history: No significant changes for ${project.name}, skipping save`);
    }
  } catch (error) {
    console.error('Error saving price history:', error);
  }
}

// Función para trackear un proyecto
async function trackProject(project) {
  console.log(`🔍 Tracking project: ${project.name}`);
  
  try {
    // Obtener datos del proyecto
    const projectData = await getProjectData(project.contract_address);
    
    if (!projectData) {
      console.log(`❌ No data found for project: ${project.name}`);
      return;
    }
    
    console.log(`📊 Project data for ${project.name}:`, {
      floor_price: projectData.floor_price,
      volume_24h: projectData.volume_24h,
      sales_count: projectData.sales_count,
      currency: projectData.currency
    });
    
    // Actualizar datos del proyecto en la base de datos
    await pool.query(
      'UPDATE nft_projects SET last_floor_price = $1, last_volume = $2, last_sales_count = $3, last_listings_count = $4, last_avg_sale_price = $5 WHERE id = $6',
      [
        projectData.floor_price,
        projectData.volume_24h,
        projectData.sales_count,
        projectData.listings_count,
        projectData.avg_sale_price,
        project.id
      ]
    );
    
    // Guardar historial de precios (solo si hay cambios significativos)
    await savePriceHistoryIfChanged(project, projectData);
    
    // Verificar alertas
    console.log('🔔 About to check alerts');
    try {
      await checkAlerts(project, projectData);
      console.log('🔔 Calling checkAlerts function...');
    } catch (error) {
      console.error('Error calling checkAlerts:', error);
    }
    console.log('🔔 checkAlerts function completed successfully');
    
  } catch (error) {
    console.error(`Error tracking project ${project.name}:`, error);
  }
}

// Configurar job de cron para tracking automático (cada 5 minutos)
cron.schedule('*/5 * * * *', async () => {
  console.log('⏰ Cron job: Starting project tracking...');
  
  try {
    // Obtener todos los proyectos activos
    const result = await pool.query('SELECT * FROM nft_projects WHERE status = $1', ['active']);
    const projects = result.rows;
    
    console.log(`⏰ Found ${projects.length} active projects to track`);
    
    // Trackear cada proyecto
    for (const project of projects) {
      await trackProject(project);
      // Pequeña pausa entre proyectos para evitar sobrecarga
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('⏰ Cron job: Project tracking completed');
  } catch (error) {
    console.error('Error in cron job:', error);
  }
});

// Monitorear un tweet específico
async function trackTwitterAccount(account) {
  try {
    console.log(`🐦 Checking Twitter account: @${account.username}`);
    
    // Obtener nuevos tweets
    const newTweets = await twitterService.getNewTweets(
      account.username, 
      account.last_tweet_id
    );
    
    if (!newTweets || newTweets.length === 0) {
      console.log(`🐦 No hay nuevos tweets de @${account.username}`);
      return;
    }
    
    console.log(`🐦 ${newTweets.length} nuevos tweets de @${account.username}`);
    
    // Obtener canal de Discord
    const channel = await client.channels.fetch(account.channel_id);
    
    if (!channel) {
      console.error(`❌ Canal no encontrado: ${account.channel_id}`);
      return;
    }
    
    // Enviar cada tweet como notificación
    for (const tweet of newTweets) {
      await sendTwitterAlert(channel, tweet);
      
      // Guardar en historial
      await pool.query(
        `INSERT INTO twitter_history (account_id, tweet_id, tweet_text, tweet_url, tweeted_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (account_id, tweet_id) DO NOTHING`,
        [account.id, tweet.id, tweet.text, tweet.url, tweet.timestamp]
      );
      
      // Pequeña pausa entre tweets
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Actualizar último tweet conocido
    const latestTweetId = newTweets[0].id;
    await pool.query(
      'UPDATE twitter_accounts SET last_tweet_id = $1, last_check = NOW() WHERE id = $2',
      [latestTweetId, account.id]
    );
    
    console.log(`✅ Twitter tracking completado para @${account.username}`);
    
  } catch (error) {
    console.error(`❌ Error tracking Twitter account @${account.username}:`, error);
  }
}

// Enviar alerta de Twitter a Discord
async function sendTwitterAlert(channel, tweet) {
  try {
    const embed = new EmbedBuilder()
      .setTitle(`🐦 Nuevo Tweet de @${tweet.username}`)
      .setDescription(tweet.text)
      .setURL(tweet.url)
      .setColor(0x1DA1F2) // Color azul de Twitter/X
      .setTimestamp(tweet.timestamp)
      .setFooter({ text: `Twitter/X Alert` });
    
    if (tweet.imageUrl) {
      embed.setImage(tweet.imageUrl);
    }
    
    await channel.send({ embeds: [embed] });
    console.log(`✅ Tweet enviado al canal: ${channel.name}`);
    
  } catch (error) {
    console.error('❌ Error enviando alerta de Twitter:', error);
  }
}

// Configurar job de cron para tracking de Twitter (cada 3 minutos)
cron.schedule('*/3 * * * *', async () => {
  console.log('🐦 Cron job: Starting Twitter tracking...');
  
  try {
    // Obtener todas las cuentas de Twitter activas
    const result = await pool.query('SELECT * FROM twitter_accounts WHERE is_active = true');
    const accounts = result.rows;
    
    console.log(`🐦 Found ${accounts.length} active Twitter accounts to track`);
    
    // Monitorear cada cuenta
    for (const account of accounts) {
      await trackTwitterAccount(account);
      // Pausa entre cuentas para evitar rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('🐦 Cron job: Twitter tracking completed');
  } catch (error) {
    console.error('❌ Error in Twitter cron job:', error);
  }
});

// Manejar interacciones de botones, modales y menús
client.on('interactionCreate', async (interaction) => {
  // Manejar botones
  if (interaction.isButton()) {
    const customId = interaction.customId;
    
    // Botón de deshabilitar alerta
    if (customId.startsWith('disable_alert_')) {
      try {
        const [, , projectId, userId] = customId.split('_');
        
        // Verificar que el usuario que presionó el botón es el mismo que configuró la alerta
        if (interaction.user.id !== userId) {
          await interaction.reply({ 
            content: '❌ Solo puedes deshabilitar tus propias alertas.', 
            flags: 64 
          });
          return;
        }
        
        // Deshabilitar la alerta
        await pool.query(
          'UPDATE user_alerts SET is_active = false WHERE project_id = $1 AND discord_user_id = $2',
          [projectId, userId]
        );
        
        // Obtener nombre del proyecto para el mensaje
        const projectResult = await pool.query('SELECT name FROM nft_projects WHERE id = $1', [projectId]);
        const projectName = projectResult.rows[0]?.name || 'Proyecto';
        
        await interaction.reply({ 
          content: `✅ Alerta deshabilitada para **${projectName}**.`, 
          flags: 64 
        });
        
        console.log(`🔕 Alert disabled for user ${userId} and project ${projectName}`);
      } catch (error) {
        console.error('Error handling disable alert button:', error);
        await interaction.reply({ 
          content: '❌ Error al deshabilitar la alerta.', 
          flags: 64 
        });
      }
    }
    
    // Botones del menú principal
    else if (customId.startsWith('menu_')) {
      await handleMenuButton(interaction);
    }
    
    // Botones de proyectos
    else if (customId.startsWith('projects_')) {
      await handleProjectsButton(interaction);
    }
    
    // Botones de alertas
    else if (customId.startsWith('alerts_')) {
      await handleAlertsButton(interaction);
    }
    
    // Botones de configuración
    else if (customId.startsWith('config_')) {
      await handleConfigButton(interaction);
    }
    
    // Botones de estadísticas
    else if (customId.startsWith('stats_')) {
      await handleStatsButton(interaction);
    }
    
    // Botones de herramientas
    else if (customId.startsWith('tools_')) {
      await handleToolsButton(interaction);
    }
    
    // Botones de ayuda
    else if (customId.startsWith('help_')) {
      await handleHelpButton(interaction);
    }
    
    // Botón de volver al menú
    else if (customId === 'back_to_menu') {
      await handleMenuCommand(interaction);
    }
  }
  
  // Manejar modales
  else if (interaction.isModalSubmit()) {
    const customId = interaction.customId;
    
    try {
      await interaction.deferReply({ flags: 64 });
      
      switch (customId) {
        case 'add_project_modal':
          await handleAddProjectModal(interaction);
          break;
        case 'alert_setup_modal':
          await handleAlertSetupModal(interaction);
          break;
        case 'delete_project_modal':
          await handleDeleteProjectModal(interaction);
          break;
        default:
          await interaction.editReply({ content: '❌ Modal no reconocido.' });
      }
    } catch (error) {
      console.error('Error handling modal:', error);
      await interaction.editReply({ content: '❌ Error interno.' });
    }
  }
  
  // Manejar menús de selección
  else if (interaction.isStringSelectMenu()) {
    const customId = interaction.customId;
    
    try {
      await interaction.deferReply({ flags: 64 });
      
      switch (customId) {
        case 'select_project_status':
          await handleProjectStatusSelection(interaction);
          break;
        case 'select_project_floor':
          await handleProjectFloorSelection(interaction);
          break;
        case 'select_project_volume':
          await handleProjectVolumeSelection(interaction);
          break;
        case 'select_project_disable':
          await handleProjectDisableSelection(interaction);
          break;
        case 'select_project_remove':
          await handleProjectRemoveSelection(interaction);
          break;
        case 'select_channel_config':
          await handleChannelConfigSelection(interaction);
          break;
        default:
          await interaction.editReply({ content: '❌ Menú de selección no reconocido.' });
      }
    } catch (error) {
      console.error('Error handling select menu:', error);
      await interaction.editReply({ content: '❌ Error interno.' });
    }
  }
});

// Funciones auxiliares para comandos
async function handleStatusCommand(interaction, projectName) {
  try {
    const result = await pool.query('SELECT * FROM nft_projects WHERE name = $1', [projectName]);
    const project = result.rows[0];

    if (!project) {
      await interaction.editReply({ content: '❌ Proyecto no encontrado.' });
      return;
    }

    // Obtener datos frescos de la API
    const projectData = await getProjectData(project.contract_address);
    
    if (!projectData) {
      await interaction.editReply({ content: '❌ No se pudieron obtener datos de la API. El proyecto puede no existir o estar temporalmente no disponible.' });
      return;
    }

    // Verificar que tenemos datos reales
    if (!projectData.floor_price && projectData.floor_price !== 0) {
      await interaction.editReply({ content: '❌ Error: No se pudo obtener datos del proyecto.' });
      return;
    }

    const currency = projectData.currency;
    const floorPrice = projectData.floor_price;
    const priceUSD = projectData.price_usd || 0;

    const embed = new EmbedBuilder()
      .setTitle(`📊 Estado: ${project.name}`)
      .setDescription('Estado actual del proyecto')
      .setColor('#3B82F6')
      .setTimestamp();

    if (projectData.image) {
      embed.setThumbnail(projectData.image);
    }

    embed.addFields(
      { 
        name: '💰 Floor Price', 
        value: `${floorPrice.toFixed(2)} ${currency}\n($${priceUSD.toFixed(2)} USD)`, 
        inline: true 
      },
      { 
        name: '📊 Volume 24h', 
        value: `${projectData.volume_24h ? projectData.volume_24h.toFixed(2) : 'N/A'} ${currency}`, 
        inline: true 
      },
      { 
        name: '🛒 Sales', 
        value: `${projectData.sales_count || 'N/A'}`, 
        inline: true 
      },
      { 
        name: '📋 Listings', 
        value: `${projectData.listings_count || 'N/A'}`, 
        inline: true 
      },
      { 
        name: '🎯 Top Bid', 
        value: `${projectData.top_bid ? projectData.top_bid.toFixed(2) : 'N/A'} ${currency}`, 
        inline: true 
      },
      { 
        name: '📈 Avg Sale Price', 
        value: `${projectData.avg_sale_price ? projectData.avg_sale_price.toFixed(2) : 'N/A'} ${currency}`, 
        inline: true 
      }
    );

    if (projectData.marketplace_url) {
      embed.addFields({
        name: '🏪 Marketplace',
        value: `[Ver en Magic Eden](${projectData.marketplace_url})`,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleStatusCommand:', error);
    await interaction.editReply({ content: '❌ Error interno.' });
  }
}

async function handleFloorCommand(interaction, projectName) {
  try {
    const result = await pool.query('SELECT * FROM nft_projects WHERE name = $1', [projectName]);
    const project = result.rows[0];

    if (!project) {
      await interaction.editReply({ content: '❌ Proyecto no encontrado.' });
      return;
    }

    // Obtener datos frescos de la API
    const projectData = await getProjectData(project.contract_address);
    
    if (!projectData) {
      await interaction.editReply({ content: '❌ No se pudieron obtener datos de la API. El proyecto puede no existir o estar temporalmente no disponible.' });
      return;
    }

    // Verificar que tenemos datos reales
    if (!projectData.floor_price && projectData.floor_price !== 0) {
      await interaction.editReply({ content: '❌ Error: No se pudo obtener el floor price del proyecto.' });
      return;
    }

    const currency = projectData.currency;
    const floorPrice = projectData.floor_price;
    const priceUSD = projectData.price_usd || 0;

    const embed = new EmbedBuilder()
      .setTitle(`💰 Floor Price: ${project.name}`)
      .setDescription(`Precio mínimo actual`)
      .setColor('#10B981')
      .setTimestamp();

    if (projectData.image) {
      embed.setThumbnail(projectData.image);
    }

    embed.addFields(
      { 
        name: '💰 Floor Price', 
        value: `${floorPrice.toFixed(2)} ${currency}`, 
        inline: true 
      },
      { 
        name: '💵 USD', 
        value: `$${priceUSD.toFixed(2)}`, 
        inline: true 
      },
      { 
        name: '🎯 Top Bid', 
        value: `${projectData.top_bid ? projectData.top_bid.toFixed(2) : 'N/A'} ${currency}`, 
        inline: true 
      }
    );

    if (projectData.marketplace_url) {
      embed.addFields({
        name: '🏪 Marketplace',
        value: `[Ver en Magic Eden](${projectData.marketplace_url})`,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleFloorCommand:', error);
    await interaction.editReply({ content: '❌ Error interno.' });
  }
}

async function handleVolumeCommand(interaction, projectName) {
  try {
    const result = await pool.query('SELECT * FROM nft_projects WHERE name = $1', [projectName]);
    const project = result.rows[0];

    if (!project) {
      await interaction.editReply({ content: '❌ Proyecto no encontrado.' });
      return;
    }

    // Obtener datos frescos de la API
    const projectData = await getProjectData(project.contract_address);
    
    if (!projectData) {
      await interaction.editReply({ content: '❌ No se pudieron obtener datos de la API. El proyecto puede no existir o estar temporalmente no disponible.' });
      return;
    }

    // Verificar que tenemos datos reales
    if (!projectData.volume_24h && projectData.volume_24h !== 0) {
      await interaction.editReply({ content: '❌ Error: No se pudo obtener el volumen del proyecto.' });
      return;
    }

    const currency = projectData.currency;
    const volume24h = projectData.volume_24h;
    const salesCount = projectData.sales_count;

    const embed = new EmbedBuilder()
      .setTitle(`📊 Volume: ${project.name}`)
      .setDescription(`Volumen de trading en las últimas 24 horas`)
      .setColor('#F59E0B')
      .setTimestamp();

    if (projectData.image) {
      embed.setThumbnail(projectData.image);
    }

    embed.addFields(
      { 
        name: '📊 Volume 24h', 
        value: `${volume24h.toFixed(2)} ${currency}`, 
        inline: true 
      },
      { 
        name: '🛒 Sales', 
        value: `${salesCount}`, 
        inline: true 
      },
      { 
        name: '📈 Avg Sale', 
        value: `${salesCount > 0 ? (volume24h / salesCount).toFixed(2) : 'N/A'} ${currency}`, 
        inline: true 
      }
    );

    if (projectData.marketplace_url) {
      embed.addFields({
        name: '🏪 Marketplace',
        value: `[Ver en Magic Eden](${projectData.marketplace_url})`,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleVolumeCommand:', error);
    await interaction.editReply({ content: '❌ Error interno.' });
  }
}

async function handleTestApiCommand(interaction) {
  try {
    await interaction.editReply({ content: '🧪 Probando conexión con Magic Eden API...' });
    
    // Probar con un contrato conocido (Bored Ape Yacht Club)
    const testContract = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D';
    const testData = await getProjectData(testContract);
    
    if (testData) {
      const embed = new EmbedBuilder()
        .setTitle('✅ Test API Exitoso')
        .setDescription('Conexión con Magic Eden API funcionando correctamente')
        .setColor('#10B981')
        .addFields(
          { name: '🔗 API Status', value: '✅ Conectada', inline: true },
          { name: '📊 Datos Obtenidos', value: '✅ Válidos', inline: true },
          { name: '⏰ Tiempo de Respuesta', value: '< 5 segundos', inline: true }
        )
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply({ content: '❌ Error: No se pudieron obtener datos de la API.' });
    }
  } catch (error) {
    console.error('Error in handleTestApiCommand:', error);
    await interaction.editReply({ content: '❌ Error al probar la API.' });
  }
}

// Manejadores de modales
async function handleAddProjectModal(interaction) {
  try {
    const projectName = interaction.fields.getTextInputValue('project_name');
    const contractAddress = interaction.fields.getTextInputValue('contract_address');
    
    // Validar dirección del contrato
    if (!contractAddress.startsWith('0x') || contractAddress.length !== 42) {
      await interaction.editReply({ content: '❌ Dirección de contrato inválida. Debe empezar con 0x y tener 42 caracteres.' });
      return;
    }
    
    // Verificar si el proyecto ya existe
    const existingProject = await pool.query('SELECT * FROM nft_projects WHERE name = $1 OR contract_address = $2', [projectName, contractAddress]);
    
    if (existingProject.rows.length > 0) {
      await interaction.editReply({ content: '❌ Ya existe un proyecto con ese nombre o dirección de contrato.' });
      return;
    }
    
    // Obtener datos del proyecto desde la API
    const projectData = await getProjectData(contractAddress);
    
    if (!projectData) {
      await interaction.editReply({ content: '❌ No se pudieron obtener datos del proyecto desde la API. Verifica la dirección del contrato y que el proyecto exista en Magic Eden.' });
      return;
    }
    
    // Verificar que tenemos datos reales (no null/undefined)
    if (!projectData.floor_price && projectData.floor_price !== 0) {
      await interaction.editReply({ content: '❌ Error: No se pudo obtener el floor price del proyecto. El contrato puede no existir o no tener datos disponibles.' });
      return;
    }
    
    // Insertar proyecto en la base de datos
    const result = await pool.query(
      'INSERT INTO nft_projects (name, contract_address, status, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id',
      [projectName, contractAddress, 'active']
    );
    
    const projectId = result.rows[0].id;
    
    // Guardar datos iniciales del proyecto (solo datos reales)
    await pool.query(
      'INSERT INTO price_history (project_id, floor_price, volume_24h, sales_count, listings_count, avg_sale_price) VALUES ($1, $2, $3, $4, $5, $6)',
      [projectId, projectData.floor_price, projectData.volume_24h, projectData.sales_count, projectData.listings_count, projectData.avg_sale_price]
    );
    
    const embed = new EmbedBuilder()
      .setTitle('✅ Proyecto Agregado Exitosamente')
      .setDescription(`**${projectName}** ha sido agregado al sistema de tracking`)
      .setColor('#10B981')
      .addFields(
        { name: '📝 Nombre', value: projectName, inline: true },
        { name: '📍 Contrato', value: `\`${contractAddress}\``, inline: true },
        { name: '💰 Floor Price', value: `${projectData.floor_price.toFixed(2)} ${projectData.currency}`, inline: true },
        { name: '📊 Volume 24h', value: `${projectData.volume_24h.toFixed(2)} ${projectData.currency}`, inline: true },
        { name: '🛒 Sales', value: `${projectData.sales_count}`, inline: true },
        { name: '📋 Listings', value: `${projectData.listings_count}`, inline: true }
      )
      .setTimestamp();
    
    if (projectData.image) {
      embed.setThumbnail(projectData.image);
    }
    
    await interaction.editReply({ embeds: [embed] });
    console.log(`✅ Project added: ${projectName} (${contractAddress})`);
  } catch (error) {
    console.error('Error in handleAddProjectModal:', error);
    await interaction.editReply({ content: '❌ Error al agregar el proyecto.' });
  }
}

async function handleAlertSetupModal(interaction) {
  try {
    const projectName = interaction.fields.getTextInputValue('alert_project');
    const threshold = interaction.fields.getTextInputValue('alert_threshold');
    
    // Buscar el proyecto
    const projectResult = await pool.query('SELECT * FROM nft_projects WHERE name = $1', [projectName]);
    const project = projectResult.rows[0];
    
    if (!project) {
      await interaction.editReply({ content: '❌ Proyecto no encontrado.' });
      return;
    }
    
    // Parsear el umbral
    const thresholdValue = parseFloat(threshold.replace(/[^\d.-]/g, ''));
    const thresholdType = threshold.includes('%') ? 'percentage' : 'absolute';
    
    if (isNaN(thresholdValue) || thresholdValue <= 0) {
      await interaction.editReply({ content: '❌ Umbral inválido. Usa un número válido (ej: 0.5 ETH o 10%).' });
      return;
    }
    
    // Crear configuración de alerta básica (floor_above)
    const alertConfig = {
      type: 'floor_above',
      threshold_value: thresholdValue,
      threshold_type: thresholdType,
      timeframe: '24h',
      enabled: true
    };
    
    // Verificar si ya existe una alerta para este usuario y proyecto
    const existingAlert = await pool.query(
      'SELECT * FROM user_alerts WHERE discord_user_id = $1 AND project_id = $2',
      [interaction.user.id, project.id]
    );
    
    if (existingAlert.rows.length > 0) {
      // Actualizar alerta existente
      const existingConfigs = JSON.parse(existingAlert.rows[0].alert_types || '[]');
      existingConfigs.push(alertConfig);
      
      await pool.query(
        'UPDATE user_alerts SET alert_types = $1, updated_at = NOW() WHERE discord_user_id = $2 AND project_id = $3',
        [JSON.stringify(existingConfigs), interaction.user.id, project.id]
      );
    } else {
      // Crear nueva alerta
      await pool.query(
        'INSERT INTO user_alerts (discord_user_id, project_id, alert_types, is_active, created_at) VALUES ($1, $2, $3, true, NOW())',
        [interaction.user.id, project.id, JSON.stringify([alertConfig])]
      );
    }
    
    const embed = new EmbedBuilder()
      .setTitle('✅ Alerta Configurada')
      .setDescription(`Alerta configurada para **${projectName}**`)
      .setColor('#10B981')
      .addFields(
        { name: '📊 Tipo', value: 'Floor Price Above', inline: true },
        { name: '🎯 Umbral', value: `${thresholdValue}${thresholdType === 'percentage' ? '%' : ' ETH'}`, inline: true },
        { name: '⏰ Timeframe', value: '24 horas', inline: true }
      )
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
    console.log(`✅ Alert configured for user ${interaction.user.id} and project ${projectName}`);
  } catch (error) {
    console.error('Error in handleAlertSetupModal:', error);
    await interaction.editReply({ content: '❌ Error al configurar la alerta.' });
  }
}

async function handleDeleteProjectModal(interaction) {
  try {
    const projectName = interaction.fields.getTextInputValue('delete_project_name');
    const confirmText = interaction.fields.getTextInputValue('delete_confirm');
    
    if (confirmText !== 'ELIMINAR') {
      await interaction.editReply({ content: '❌ Confirmación incorrecta. Debes escribir exactamente "ELIMINAR".' });
      return;
    }
    
    // Buscar el proyecto
    const projectResult = await pool.query('SELECT * FROM nft_projects WHERE name = $1', [projectName]);
    const project = projectResult.rows[0];
    
    if (!project) {
      await interaction.editReply({ content: '❌ Proyecto no encontrado.' });
      return;
    }
    
    // Eliminar el proyecto y sus datos relacionados
    await pool.query('DELETE FROM user_alerts WHERE project_id = $1', [project.id]);
    await pool.query('DELETE FROM price_history WHERE project_id = $1', [project.id]);
    await pool.query('DELETE FROM nft_projects WHERE id = $1', [project.id]);
    
    const embed = new EmbedBuilder()
      .setTitle('✅ Proyecto Eliminado')
      .setDescription(`**${projectName}** ha sido eliminado del sistema`)
      .setColor('#EF4444')
      .addFields(
        { name: '🗑️ Eliminado', value: 'Proyecto y todos sus datos relacionados', inline: false },
        { name: '📊 Alertas', value: 'Todas las alertas asociadas eliminadas', inline: true },
        { name: '📈 Historial', value: 'Historial de precios eliminado', inline: true }
      )
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
    console.log(`✅ Project deleted: ${projectName}`);
  } catch (error) {
    console.error('Error in handleDeleteProjectModal:', error);
    await interaction.editReply({ content: '❌ Error al eliminar el proyecto.' });
  }
}

// Manejadores de menús de selección
async function handleProjectStatusSelection(interaction) {
  const projectName = interaction.values[0];
  await handleStatusCommand(interaction, projectName);
}

async function handleProjectFloorSelection(interaction) {
  const projectName = interaction.values[0];
  await handleFloorCommand(interaction, projectName);
}

async function handleProjectVolumeSelection(interaction) {
  const projectName = interaction.values[0];
  await handleVolumeCommand(interaction, projectName);
}

async function handleProjectDisableSelection(interaction) {
  const projectName = interaction.values[0];
  
  try {
    const result = await pool.query(
      'UPDATE user_alerts SET is_active = false FROM nft_projects WHERE user_alerts.project_id = nft_projects.id AND user_alerts.discord_user_id = $1 AND nft_projects.name = $2',
      [interaction.user.id, projectName]
    );

    if (result.rowCount === 0) {
      await interaction.editReply({ content: '❌ No se encontraron alertas para desactivar.' });
      return;
    }

    await interaction.editReply({ content: `✅ Alertas desactivadas para **${projectName}**` });
  } catch (error) {
    console.error('Error in handleProjectDisableSelection:', error);
    await interaction.editReply({ content: '❌ Error al deshabilitar alertas.' });
  }
}

async function handleProjectRemoveSelection(interaction) {
  const projectName = interaction.values[0];
  
  try {
    const result = await pool.query(
      'DELETE FROM user_alerts USING nft_projects WHERE user_alerts.project_id = nft_projects.id AND user_alerts.discord_user_id = $1 AND nft_projects.name = $2',
      [interaction.user.id, projectName]
    );

    if (result.rowCount === 0) {
      await interaction.editReply({ content: '❌ No se encontraron alertas para eliminar.' });
      return;
    }

    await interaction.editReply({ content: `✅ Alertas eliminadas para **${projectName}**` });
  } catch (error) {
    console.error('Error in handleProjectRemoveSelection:', error);
    await interaction.editReply({ content: '❌ Error al eliminar alertas.' });
  }
}

async function handleChannelConfigSelection(interaction) {
  const channelId = interaction.values[0];
  
  try {
    if (!await hasAdminPermissions(interaction)) {
      await interaction.editReply({ content: '❌ Solo los administradores pueden configurar el canal de alertas.' });
      return;
    }

    const channel = interaction.guild.channels.cache.get(channelId);
    
    if (!channel) {
      await interaction.editReply({ content: '❌ Canal no encontrado.' });
      return;
    }

    // Verificar permisos del bot en el canal
    const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
    const permissions = channel.permissionsFor(botMember);
    
    if (!permissions.has(['SendMessages', 'EmbedLinks'])) {
      await interaction.editReply({ content: '❌ El bot no tiene permisos para enviar mensajes en este canal.' });
      return;
    }

    // Insertar o actualizar configuración del servidor
    await pool.query(`
      INSERT INTO server_config (guild_id, alerts_channel_id, updated_at) 
      VALUES ($1, $2, NOW()) 
      ON CONFLICT (guild_id) 
      DO UPDATE SET alerts_channel_id = $2, updated_at = NOW()
    `, [interaction.guild.id, channelId]);

    const embed = new EmbedBuilder()
      .setTitle('✅ Canal de Alertas Configurado')
      .setDescription(`Las alertas se enviarán a ${channel}`)
      .setColor('#10B981')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleChannelConfigSelection:', error);
    await interaction.editReply({ content: '❌ Error al configurar el canal.' });
  }
}

// Inicializar base de datos al iniciar
initializeDatabase().then(() => {
  console.log('🚀 Database initialization completed, starting bot...');
}).catch(error => {
  console.error('Failed to initialize database:', error);
});

// Forzar creación de alert_history después de 5 segundos (por si acaso)
setTimeout(async () => {
  try {
    console.log('🔔 Force-creating alert_history table after 5 seconds...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alert_history (
        id SERIAL PRIMARY KEY,
        project_id UUID REFERENCES nft_projects(id) ON DELETE CASCADE,
        alert_type VARCHAR(50) NOT NULL,
        alert_value VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('🔔 alert_history table force-created successfully');
  } catch (error) {
    console.error('Error force-creating alert_history table:', error);
  }
}, 5000);

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

async function resolveWalletProject(guildId, projectName, chain) {
  const params = [guildId, projectName];
  let query = `SELECT * FROM wallet_projects WHERE guild_id = $1 AND lower(project_name) = lower($2)`;

  if (chain) {
    params.push(chain);
    query += ` AND lower(chain) = lower($${params.length})`;
  }

  const result = await pool.query(query, params);

  if (result.rows.length === 0) {
    return { error: 'not_found' };
  }

  if (!chain && result.rows.length > 1) {
    return { error: 'ambiguous', chains: result.rows.map(row => row.chain) };
  }

  return { project: result.rows[0] };
}

async function getWalletProjectsWithChannels(guildId, chainFilter = null) {
  const params = [guildId];
  let query = `
    SELECT
      p.id,
      p.project_name,
      p.chain,
      p.submitted_by,
      p.created_at,
      p.updated_at,
      c.id AS channel_id,
      c.label,
      c.channel_link,
      c.submitted_by AS channel_submitted_by,
      c.created_at AS channel_created_at
    FROM wallet_projects p
    LEFT JOIN wallet_channels c ON c.project_id = p.id
    WHERE p.guild_id = $1`;

  if (chainFilter) {
    params.push(chainFilter);
    query += ` AND p.chain = $${params.length}`;
  }

  query += ' ORDER BY lower(p.project_name), c.created_at';

  const result = await pool.query(query, params);
  const projectMap = new Map();

  for (const row of result.rows) {
    if (!projectMap.has(row.id)) {
      projectMap.set(row.id, {
        id: row.id,
        project_name: row.project_name,
        chain: row.chain,
        submitted_by: row.submitted_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
        channels: []
      });
    }

    if (row.channel_id) {
      projectMap.get(row.id).channels.push({
        id: row.channel_id,
        label: row.label,
        channel_link: row.channel_link,
        submitted_by: row.channel_submitted_by,
        created_at: row.channel_created_at
      });
    }
  }

  return Array.from(projectMap.values());
}

