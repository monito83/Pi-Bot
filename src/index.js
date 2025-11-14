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
const { getCalendarEvents, getCalendarEventsBetween } = require('./services/googleCalendar');
const faucetModule = require('./modules/faucet');
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
const DISCORD_GUILD_IDS = (process.env.DISCORD_GUILD_IDS || '')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);
if (DISCORD_GUILD_IDS.length) {
  console.log('🔥 LOG 13b: DISCORD_GUILD_IDS loaded:', DISCORD_GUILD_IDS.join(', '));
}
const TARGET_GUILD_IDS = DISCORD_GUILD_IDS.length
  ? DISCORD_GUILD_IDS
  : (DISCORD_GUILD_ID ? [DISCORD_GUILD_ID] : []);
if (!TARGET_GUILD_IDS.length) {
  console.warn('⚠️ No se configuró ningún DISCORD_GUILD_ID/IDS; los comandos slash no podrán registrarse.');
}
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
faucetModule.setup({ pool, client });
console.log('💧 Faucet module configured');

const WALLET_CHANNEL_VALUE_PREFIX = 'channel:';
const WALLET_PROJECT_VALUE_PREFIX = 'project:';
const WALLET_CHAIN_VALUE_PREFIX = 'chain:';
const WALLET_NO_LABEL_DISPLAY = 'Sin etiqueta';

const CALENDAR_RANGES = {
  hoy: { label: 'Hoy', range: 'today', emoji: '📅' },
  tresdias: { label: 'Próximos 3 días', range: '3days', emoji: '🗓️' },
  semana: { label: 'Próxima semana', range: 'week', emoji: '🗓️' },
  mes: { label: 'Próximo mes', range: 'month', emoji: '📆' }
};
const CALENDAR_DISPLAY_LOCALE = process.env.GOOGLE_CALENDAR_LOCALE || 'es-ES';
const CALENDAR_DISPLAY_TIMEZONE = process.env.GOOGLE_CALENDAR_DISPLAY_TZ || 'UTC';
const CALENDAR_CRON_TIMEZONE = process.env.GOOGLE_CALENDAR_CRON_TZ || 'UTC';
const CALENDAR_DAILY_CRON = process.env.GOOGLE_CALENDAR_DAILY_CRON || '0 9 * * *';
const CALENDAR_REMINDER_CRON = process.env.GOOGLE_CALENDAR_REMINDER_CRON || '*/5 * * * *';
const CALENDAR_REMINDER_LOOKAHEAD_MINUTES = parseInt(process.env.GOOGLE_CALENDAR_REMINDER_MINUTES || '60', 10);

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS wallet_chains (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        guild_id TEXT NOT NULL,
        chain_key TEXT NOT NULL,
        display_name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Legacy migrations for wallet_projects
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
      ADD COLUMN IF NOT EXISTS submitted_by TEXT
    `);
    await pool.query(`
      UPDATE wallet_projects SET submitted_by = COALESCE(submitted_by, '')
    `);
    await pool.query(`
      ALTER TABLE wallet_projects
      ALTER COLUMN submitted_by SET DEFAULT ''
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
        INSERT INTO wallet_channels (project_id, submitted_by, label, channel_link)
        SELECT id, submitted_by, NULL, channel_link FROM wallet_projects WHERE channel_link IS NOT NULL
        ON CONFLICT DO NOTHING
      `);

      await pool.query(`ALTER TABLE wallet_projects DROP COLUMN channel_link`);
    }

    // Legacy migrations for wallet_channels
    await pool.query(`
      ALTER TABLE wallet_channels
      ADD COLUMN IF NOT EXISTS submitted_by TEXT
    `);
    await pool.query(`
      UPDATE wallet_channels SET submitted_by = COALESCE(submitted_by, '')
    `);
    await pool.query(`
      ALTER TABLE wallet_channels
      ALTER COLUMN submitted_by SET DEFAULT ''
    `);
    await pool.query(`
      ALTER TABLE wallet_channels
      ALTER COLUMN submitted_by SET NOT NULL
    `);

    await pool.query(`
      ALTER TABLE wallet_channels
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()
    `);
    await pool.query(`
      ALTER TABLE wallet_channels
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
    `);
    await pool.query(`
      UPDATE wallet_channels SET created_at = NOW() WHERE created_at IS NULL
    `);
    await pool.query(`
      UPDATE wallet_channels SET updated_at = NOW() WHERE updated_at IS NULL
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

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_chains_key
      ON wallet_chains (guild_id, lower(chain_key))
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_chains_display
      ON wallet_chains (guild_id, lower(display_name))
    `);

    await pool.query(`
      ALTER TABLE server_config
      ADD COLUMN IF NOT EXISTS wallet_channel_id TEXT
    `);

    await pool.query(`
      ALTER TABLE server_config
      ADD COLUMN IF NOT EXISTS wallet_message_id TEXT
    `);

    await pool.query(`
      INSERT INTO wallet_chains (id, guild_id, chain_key, display_name)
      SELECT gen_random_uuid(), wp.guild_id, lower(wp.chain), INITCAP(wp.chain)
      FROM (
        SELECT DISTINCT guild_id, chain
        FROM wallet_projects
        WHERE chain IS NOT NULL AND chain <> ''
      ) wp
      ON CONFLICT (guild_id, lower(chain_key)) DO NOTHING
    `);

    console.log('✅ Wallet schema initialized');
  } catch (error) {
    console.error('Error initializing wallet schema:', error);
  }
}

async function initializeCalendarSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS calendar_notifications (
        id SERIAL PRIMARY KEY,
        guild_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        notification_type TEXT NOT NULL,
        sent_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(guild_id, event_id, notification_type)
      )
    `);

    await pool.query(`
      ALTER TABLE server_config
      ADD COLUMN IF NOT EXISTS calendar_channel_id TEXT
    `);

    await pool.query(`
      ALTER TABLE server_config
      ADD COLUMN IF NOT EXISTS calendar_last_daily DATE
    `);

    console.log('✅ Calendar schema initialized');
  } catch (error) {
    console.error('Error initializing calendar schema:', error);
  }
}

// Inicializar tablas de Twitter
initializeTwitterTables();
initializeWalletSchema();
initializeCalendarSchema();
faucetModule.initializeSchema();

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
    .setDescription('Abrir el panel principal del bot'),

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
    .setName('calendario')
    .setDescription('Consultar eventos del calendario Monad')
    .addSubcommand(subcommand =>
      subcommand
        .setName('menu')
        .setDescription('Abrir el panel interactivo del calendario'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('hoy')
        .setDescription('Mostrar los eventos de hoy'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('tresdias')
        .setDescription('Mostrar eventos de los próximos 3 días'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('semana')
        .setDescription('Mostrar eventos de la próxima semana'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('mes')
        .setDescription('Mostrar eventos del próximo mes'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('channel_set')
        .setDescription('Configurar el canal para notificaciones del calendario')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Canal donde se enviarán los avisos del calendario')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('channel_clear')
        .setDescription('Eliminar el canal configurado para el calendario')),

  new SlashCommandBuilder()
    .setName('wallet')
    .setDescription('Gestionar lista de proyectos con submit de wallets')
    .addSubcommand(subcommand =>
      subcommand
        .setName('menu')
        .setDescription('Abrir el gestor interactivo de submit wallets'))
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
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('link')
            .setDescription('Link al canal del submit')
            .setRequired(true)
            .setMaxLength(2000))
        .addStringOption(option =>
          option.setName('label')
            .setDescription('Etiqueta del canal (ej. FCFS, GTD)')
            .setRequired(false)
            .setMaxLength(100)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Mostrar proyectos registrados')
        .addStringOption(option =>
          option.setName('chain')
            .setDescription('Filtrar por red')
            .setRequired(false)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Eliminar un proyecto de la lista')
        .addStringOption(option =>
          option.setName('project')
            .setDescription('Nombre del proyecto a eliminar')
            .setRequired(true)
            .setMaxLength(100)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('chain')
            .setDescription('Red del proyecto (si existe en varias)')
            .setRequired(false)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('label')
            .setDescription('Etiqueta del canal a eliminar')
            .setRequired(false)
            .setMaxLength(100)
            .setAutocomplete(true))
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
            .setMaxLength(100)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('chain')
            .setDescription('Red actual del proyecto')
            .setRequired(false)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('new_name')
            .setDescription('Nuevo nombre del proyecto')
            .setRequired(false)
            .setMaxLength(100))
        .addStringOption(option =>
          option.setName('new_chain')
            .setDescription('Nueva red del proyecto')
            .setRequired(false)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('channel_label')
            .setDescription('Etiqueta del canal que deseas editar')
            .setRequired(false)
            .setMaxLength(100)
            .setAutocomplete(true))
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
    .addSubcommand(subcommand =>
      subcommand
        .setName('chain_add')
        .setDescription('Agregar una nueva red disponible')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Nombre visible de la red (ej. Monad, Ethereum)')
            .setRequired(true)
            .setMaxLength(50))
        .addStringOption(option =>
          option.setName('key')
            .setDescription('Identificador corto (opcional, ej. monad, eth)')
            .setRequired(false)
            .setMaxLength(30)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('chain_remove')
        .setDescription('Eliminar una red disponible')
        .addStringOption(option =>
          option.setName('chain')
            .setDescription('Red a eliminar')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('chain_list')
        .setDescription('Listar redes configuradas'))
];
commands.push(faucetModule.getSlashCommandBuilder());
console.log('Comandos a registrar:', commands.map(cmd => cmd.name));
// Registrar comandos
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔄 Registrando comandos slash...');
    if (!TARGET_GUILD_IDS.length) {
      console.warn('⚠️ No hay guilds configurados; omitiendo registro de comandos.');
    } else {
      for (const guildId of TARGET_GUILD_IDS) {
        await rest.put(
          Routes.applicationGuildCommands(DISCORD_CLIENT_ID, guildId),
          { body: commands }
        );
        console.log(`✅ Comandos slash registrados exitosamente para ${guildId}`);
      }
    }
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
  scheduleCalendarJobs();
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

let calendarJobsScheduled = false;

function scheduleCalendarJobs() {
  if (calendarJobsScheduled) {
    return;
  }
  calendarJobsScheduled = true;

  cron.schedule(
    CALENDAR_DAILY_CRON,
    async () => {
      for (const guild of client.guilds.cache.values()) {
        try {
          await sendCalendarDailySummary(guild.id);
        } catch (error) {
          console.error(`Error enviando resumen diario para guild ${guild.id}:`, error);
        }
      }
    },
    { timezone: CALENDAR_CRON_TIMEZONE }
  );

  cron.schedule(
    CALENDAR_REMINDER_CRON,
    async () => {
      try {
        await processCalendarReminderWindow();
      } catch (error) {
        console.error('Error procesando recordatorios de calendario:', error);
      }
    },
    { timezone: CALENDAR_CRON_TIMEZONE }
  );
}

async function sendCalendarDailySummary(guildId) {
  try {
    await ensureServerConfigRow(guildId);
    const config = await getServerConfigRow(guildId);

    if (!config?.calendar_channel_id) {
      return;
    }

    const todayUTC = new Date().toISOString().slice(0, 10);
    if (config.calendar_last_daily && config.calendar_last_daily === todayUTC) {
      return;
    }

    const channel = await client.channels.fetch(config.calendar_channel_id).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      console.warn(`Canal de calendario no accesible para guild ${guildId}`);
      return;
    }

    const events = await getCalendarEvents('today');
    const embed = buildCalendarEmbed('hoy', events);

    await channel.send({ content: '📅 **Resumen de eventos para hoy**', embeds: [embed] });

    await pool.query(
      `UPDATE server_config
       SET calendar_last_daily = $1,
           updated_at = NOW()
       WHERE guild_id = $2`,
      [todayUTC, guildId]
    );
  } catch (error) {
    console.error(`Error preparando resumen diario para guild ${guildId}:`, error);
  }
}

async function processCalendarReminderWindow() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + CALENDAR_REMINDER_LOOKAHEAD_MINUTES * 60 * 1000);
  const timeMin = now.toISOString();
  const timeMax = windowEnd.toISOString();

  let events = [];
  try {
    events = await getCalendarEventsBetween(timeMin, timeMax);
  } catch (error) {
    console.error('Error obteniendo eventos para recordatorios:', error);
    return;
  }

  if (!events.length) {
    return;
  }

  for (const guild of client.guilds.cache.values()) {
    const guildId = guild.id;
    try {
      await ensureServerConfigRow(guildId);
      const config = await getServerConfigRow(guildId);
      if (!config?.calendar_channel_id) {
        continue;
      }

      const channel = await client.channels.fetch(config.calendar_channel_id).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        continue;
      }

      for (const event of events) {
        const startISO = event.start?.dateTime;
        if (!startISO) {
          continue;
        }

        const startDate = new Date(startISO);
        const diffMs = startDate.getTime() - now.getTime();

        if (diffMs < 0 || diffMs > CALENDAR_REMINDER_LOOKAHEAD_MINUTES * 60 * 1000) {
          continue;
        }

        const inserted = await recordCalendarNotification(guildId, event.id, 'hour_before');
        if (!inserted) {
          continue;
        }

        const embed = buildCalendarReminderEmbed(event);
        await channel.send({ content: '⏰ **Recordatorio de evento en 1 hora**', embeds: [embed] });
      }
    } catch (error) {
      console.error(`Error enviando recordatorios para guild ${guildId}:`, error);
    }
  }
}

async function recordCalendarNotification(guildId, eventId, notificationType) {
  try {
    const result = await pool.query(
      `INSERT INTO calendar_notifications (guild_id, event_id, notification_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (guild_id, event_id, notification_type) DO NOTHING
       RETURNING id`,
      [guildId, eventId, notificationType]
    );

    return result.rowCount > 0;
  } catch (error) {
    console.error('Error registrando notificación de calendario:', error);
    return false;
  }
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
  console.log(`⚙️ Received slash command: ${commandName}`);

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
        await handleMainMenuCommand(interaction);
        break;
      case 'twitter':
        await handleTwitterCommand(interaction);
        break;
      case 'calendario':
        await handleCalendarCommand(interaction);
        break;
      case 'wallet':
        await handleWalletCommand(interaction);
        break;
      case 'faucet':
        await faucetModule.handleSlashCommand(interaction);
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
    const focused = interaction.options.getFocused(true);
    const focusedValue = focused.value ?? '';
    const focusedName = focused.name;
    
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

      if ((subcommand === 'remove' || subcommand === 'edit') && focusedName === 'project') {
        const suggestions = await getWalletProjectSuggestions(interaction.guildId, focusedValue);
        await interaction.respond(suggestions);
        return;
      }

      if ((['add', 'list', 'remove', 'edit', 'chain_remove'].includes(subcommand) && focusedName === 'chain') ||
          (subcommand === 'edit' && focusedName === 'new_chain')) {
        const includeAll = subcommand === 'list';
        const suggestions = await getWalletChainSuggestions(interaction.guildId, focusedValue, { includeAllOption: includeAll });
        await interaction.respond(suggestions);
        return;
      }

      if (subcommand === 'remove' && focusedName === 'label') {
        const projectRaw = interaction.options.getString('project');
        const { projectId, projectName } = parseWalletProjectOption(projectRaw);

        if (!projectId && !projectName) {
          await interaction.respond([]);
          return;
        }

        const suggestions = await getWalletChannelLabelSuggestions({
          guildId: interaction.guildId,
          projectId,
          projectName,
          searchTerm: focusedValue
        });

        await interaction.respond(suggestions);
        return;
      }

      if (subcommand === 'edit' && focusedName === 'channel_label') {
        const projectRaw = interaction.options.getString('project');
        const { projectId, projectName } = parseWalletProjectOption(projectRaw);

        if (!projectId && !projectName) {
          await interaction.respond([]);
          return;
        }

        const suggestions = await getWalletChannelLabelSuggestions({
          guildId: interaction.guildId,
          projectId,
          projectName,
          searchTerm: focusedValue
        });

        await interaction.respond(suggestions);
        return;
      }

      await interaction.respond([]);
    }
  } catch (error) {
    console.error('Error handling autocomplete:', error);
  }
});

// Manejar botones
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  try {
    if (faucetModule.isFaucetButton(interaction.customId)) {
      await faucetModule.handleButtonInteraction(interaction);
      return;
    }

    if (interaction.customId.startsWith('wallet_')) {
      await handleWalletButton(interaction);
      return;
    }

    if (interaction.customId.startsWith('calendar_')) {
      await handleCalendarButton(interaction);
      return;
    }

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
    } else if (interaction.customId.startsWith('menu_main_')) {
      await handleMainMenuButton(interaction);
    } else if (interaction.customId.startsWith('menu_')) {
      await handleLegacyMenuButton(interaction);
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
    try {
      if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({ 
      content: '❌ Error al procesar la solicitud.', 
      flags: 64 
    });
      }
    } catch (replyError) {
      console.error('Error sending button error reply:', replyError);
    }
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

// Manejar botones del menú legado (NFT Tracker detallado)
async function handleLegacyMenuButton(interaction) {
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
    console.error('Error in handleLegacyMenuButton:', error);
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
          content: [
            '📋 **Lista Completa de Comandos:**',
            '',
            '**Principales:**',
            '• `/menu` - Menú con botones',
            '• `/setup` - Agregar proyecto',
            '• `/status` - Estado del proyecto',
            '• `/projects` - Listar proyectos',
            '• `/delete` - Eliminar proyecto',
            '',
            '**Alertas:**',
            '• `/alerts setup` - Configurar alerta',
            '• `/alerts list` - Mis alertas',
            '• `/alerts disable` - Desactivar alertas',
            '',
            '**Twitter:**',
            '• `/twitter add` - Agregar cuenta',
            '• `/twitter list` - Listar cuentas',
            '• `/twitter remove` - Quitar cuenta',
            '',
            '**Wallets:**',
            '• `/wallet add` - Registrar proyecto/canal',
            '• `/wallet list` - Ver proyectos',
            '• `/wallet edit` - Editar proyecto o canal',
            '• `/wallet remove` - Eliminar proyecto o canal'
          ].join('\n')
        });
        break;
      case 'help_examples':
        await interaction.editReply({ 
          content: '💡 Ejemplos de uso de los comandos:\n\n• `/alerts setup` - Configurar una alerta\n• `/alerts list` - Ver tus alertas configuradas\n• `/alerts disable` - Deshabilitar alertas\n• `/twitter add @username #channel` - Agregar una cuenta de Twitter\n• `/twitter list` - Listar cuentas de Twitter\n• `/twitter remove @username` - Quitar una cuenta de Twitter\n• `/wallet add ProjectName eth solana` - Registrar un proyecto con su nombre y red\n• `/wallet list` - Ver proyectos registrados\n• `/wallet edit ProjectName eth solana` - Editar un proyecto o canal\n• `/wallet remove ProjectName` - Eliminar un proyecto o canal'
        });
        break;
      default:
        await interaction.editReply({ content: '❌ Opción no reconocida.' });
    }
  } catch (error) {
    console.error('Error in handleHelpButton:', error);
    await interaction.editReply({ content: '❌ Error al mostrar ayuda.' });
  }
}

function parseWalletProjectOption(rawValue) {
  if (!rawValue) {
    return { projectId: null, projectName: null };
  }

  const trimmed = rawValue.trim();
  if (trimmed.startsWith(WALLET_PROJECT_VALUE_PREFIX)) {
    return {
      projectId: trimmed.slice(WALLET_PROJECT_VALUE_PREFIX.length),
      projectName: null
    };
  }

  return {
    projectId: null,
    projectName: trimmed
  };
}

function parseWalletChainOption(rawValue) {
  if (!rawValue) {
    return { chainKey: null, raw: null };
  }

  const trimmed = rawValue.trim();
  if (trimmed.startsWith(WALLET_CHAIN_VALUE_PREFIX)) {
    return {
      chainKey: trimmed.slice(WALLET_CHAIN_VALUE_PREFIX.length),
      raw: trimmed
    };
  }

  return { chainKey: null, raw: trimmed };
}

const DEFAULT_WALLET_CHAINS = [
  { key: 'monad', name: 'Monad' },
  { key: 'eth', name: 'Ethereum' },
  { key: 'solana', name: 'Solana' },
  { key: 'base', name: 'Base' },
  { key: 'other', name: 'Otra' }
];

function normalizeChain(value) {
  return value ? value.toLowerCase() : null;
}

function generateChainKey(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30) || null;
}

function isValidChainKey(key) {
  return /^[a-z0-9][a-z0-9_-]{1,29}$/.test(key);
}

async function ensureWalletChainsForGuild(guildId) {
  if (!guildId) return;

  for (const chain of DEFAULT_WALLET_CHAINS) {
    await pool.query(
      `INSERT INTO wallet_chains (id, guild_id, chain_key, display_name)
       VALUES (gen_random_uuid(), $1, $2, $3)
       ON CONFLICT (guild_id, lower(chain_key)) DO NOTHING`,
      [guildId, chain.key, chain.name]
    ).catch(() => {});
  }
}

async function getWalletChainByKey(guildId, chainKey) {
  if (!guildId || !chainKey) return null;

  const result = await pool.query(
    `SELECT id, chain_key, display_name
     FROM wallet_chains
     WHERE guild_id = $1 AND lower(chain_key) = lower($2)
     LIMIT 1`,
    [guildId, chainKey]
  );

  return result.rows[0] || null;
}

async function getWalletChainSuggestions(guildId, searchTerm = '', { includeAllOption = false } = {}) {
  await ensureWalletChainsForGuild(guildId);

  const normalizedSearch = searchTerm.toLowerCase();
  const params = [guildId];
  let query = `
    SELECT chain_key, display_name
    FROM wallet_chains
    WHERE guild_id = $1
  `;

  if (normalizedSearch) {
    params.push(`%${normalizedSearch}%`);
    query += ` AND (lower(chain_key) LIKE $${params.length} OR lower(display_name) LIKE $${params.length})`;
  }

  params.push(25);
  query += ` ORDER BY lower(display_name) LIMIT $${params.length}`;

  const result = await pool.query(query, params);

  const suggestions = result.rows.map(row => ({
    name: `${row.display_name} (${row.chain_key})`,
    value: `${WALLET_CHAIN_VALUE_PREFIX}${row.chain_key}`
  }));

  if (includeAllOption && (!normalizedSearch || 'todas las redes'.includes(normalizedSearch))) {
    suggestions.unshift({
      name: 'Todas las redes',
      value: 'all'
    });
  }

  return suggestions.slice(0, 25);
}

async function resolveWalletChainOption(guildId, rawValue, { required = false } = {}) {
  if (!rawValue) {
    if (required) {
      throw new Error('CHAIN_REQUIRED');
    }
    return null;
  }

  await ensureWalletChainsForGuild(guildId);

  const { chainKey, raw } = parseWalletChainOption(rawValue);

  if (chainKey) {
    const chainRow = await getWalletChainByKey(guildId, chainKey);
    if (!chainRow) {
      throw new Error('CHAIN_NOT_FOUND');
    }
    return chainRow;
  }

  const normalized = raw.toLowerCase();

    const result = await pool.query(
    `SELECT chain_key, display_name
     FROM wallet_chains
     WHERE guild_id = $1
       AND (lower(chain_key) = $2 OR lower(display_name) = $2)
     LIMIT 1`,
    [guildId, normalized]
  );

  if (result.rows.length === 0) {
    if (required) {
      throw new Error('CHAIN_NOT_FOUND');
    }
    return null;
  }

  return result.rows[0];
}

async function listWalletChains(guildId) {
  await ensureWalletChainsForGuild(guildId);

  const result = await pool.query(
    `SELECT chain_key, display_name, created_at
     FROM wallet_chains
     WHERE guild_id = $1
     ORDER BY lower(display_name)`,
    [guildId]
  );

  return result.rows;
}

async function getWalletProjectsByChain(guildId, chainKey) {
  const result = await pool.query(
    `SELECT id, project_name
     FROM wallet_projects
     WHERE guild_id = $1 AND lower(chain) = lower($2)
     ORDER BY lower(project_name)`,
    [guildId, chainKey]
  );

  return result.rows;
}

async function createWalletChain(guildId, displayName, keyInput) {
  const trimmedName = displayName ? displayName.trim() : '';
  if (!trimmedName) {
    throw new Error('CHAIN_NAME_REQUIRED');
  }

  let chainKey = keyInput ? keyInput.toLowerCase() : generateChainKey(trimmedName);
  if (!chainKey || !isValidChainKey(chainKey)) {
    throw new Error('CHAIN_INVALID_KEY');
  }

  await ensureWalletChainsForGuild(guildId);

  const duplicateCheck = await pool.query(
    `SELECT 1 FROM wallet_chains
     WHERE guild_id = $1 AND (lower(chain_key) = lower($2) OR lower(display_name) = lower($3))`,
    [guildId, chainKey, trimmedName]
  );

  if (duplicateCheck.rows.length > 0) {
    throw new Error('CHAIN_DUPLICATE');
  }

  await pool.query(
    `INSERT INTO wallet_chains (id, guild_id, chain_key, display_name)
     VALUES (gen_random_uuid(), $1, $2, $3)`,
    [guildId, chainKey, trimmedName]
  );

  return { chainKey, displayName: trimmedName };
}

async function handleCalendarCommand(interaction) {
  let subcommand = 'hoy';
  try {
    subcommand = interaction.options.getSubcommand();
  } catch (error) {
    // Ignorar si no hay subcomando (no debería ocurrir)
  }

  switch (subcommand) {
    case 'menu':
      await showCalendarMenu(interaction);
      return;
    case 'channel_set':
      await handleCalendarChannelSet(interaction);
      return;
    case 'channel_clear':
      await handleCalendarChannelClear(interaction);
      return;
    default:
      break;
  }

  const rangeKey = CALENDAR_RANGES[subcommand] ? subcommand : 'hoy';

  try {
    await interaction.deferReply({ ephemeral: true });
  } catch (error) {
    if (error.code !== 40060 && error.code !== 10062) {
      throw error;
    }
  }

  await respondCalendarRange(interaction, rangeKey);
}

async function handleCalendarButton(interaction) {
  const { customId } = interaction;

  if (customId === 'calendar_show_menu') {
    await showCalendarMenu(interaction);
      return;
    }

  if (customId.startsWith('calendar_show_')) {
    const rangeKey = customId.replace('calendar_show_', '');
    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (error) {
      if (error.code !== 40060 && error.code !== 10062) {
        throw error;
      }
    }
    await respondCalendarRange(interaction, rangeKey);
    return;
  }

  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({
      content: '❌ Opción de calendario no reconocida.',
      flags: 64
    });
  }
}

async function respondCalendarRange(interaction, rangeKey) {
  const rangeConfig = CALENDAR_RANGES[rangeKey] || CALENDAR_RANGES.hoy;

  try {
    const events = await getCalendarEvents(rangeConfig.range);
    const embed = buildCalendarEmbed(rangeKey, events);

    if (interaction.deferred) {
      await interaction.editReply({ content: null, embeds: [embed], components: [] });
    } else if (interaction.replied) {
      await interaction.followUp({ embeds: [embed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } catch (error) {
    console.error('Error obteniendo eventos del calendario:', error);
    const message = '❌ No se pudieron obtener los eventos. Verifica la configuración del calendario.';

    if (interaction.deferred) {
      await interaction.editReply({ content: message, embeds: [], components: [] });
    } else if (interaction.replied) {
      await interaction.followUp({ content: message, ephemeral: true });
    } else {
      await interaction.reply({ content: message, ephemeral: true });
    }
  }
}

async function handleCalendarChannelSet(interaction) {
  const channel = interaction.options.getChannel('channel');
  const guildId = interaction.guildId;

  if (!channel || !channel.isTextBased()) {
    await interaction.reply({ content: '❌ Debes seleccionar un canal de texto válido.', ephemeral: true });
      return;
    }

  if (channel.guildId && channel.guildId !== guildId) {
    await interaction.reply({ content: '❌ Solo puedes seleccionar canales del servidor actual.', ephemeral: true });
    return;
  }

  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }
  } catch (error) {
    if (error.code !== 40060 && error.code !== 10062) {
      throw error;
    }
  }

  try {
    await ensureServerConfigRow(guildId);
    await pool.query(
      `UPDATE server_config
       SET calendar_channel_id = $1,
           updated_at = NOW()
       WHERE guild_id = $2`,
      [channel.id, guildId]
    );

    const message = { content: `✅ Canal de calendario configurado en <#${channel.id}>.` };
    if (interaction.deferred) {
      await interaction.editReply(message);
    } else if (interaction.replied) {
      await interaction.followUp({ ...message, ephemeral: true });
    } else {
      await interaction.reply({ ...message, ephemeral: true });
    }
  } catch (error) {
    console.error('Error configurando canal de calendario:', error);
    const message = { content: '❌ No se pudo configurar el canal del calendario.' };
    if (interaction.deferred) {
      await interaction.editReply(message);
    } else if (interaction.replied) {
      await interaction.followUp({ ...message, ephemeral: true });
    } else {
      await interaction.reply({ ...message, ephemeral: true });
    }
  }
}

async function handleCalendarChannelClear(interaction) {
  const guildId = interaction.guildId;

  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }
  } catch (error) {
    if (error.code !== 40060 && error.code !== 10062) {
      throw error;
    }
  }

  try {
    await ensureServerConfigRow(guildId);
    await pool.query(
      `UPDATE server_config
       SET calendar_channel_id = NULL,
           calendar_last_daily = NULL,
           updated_at = NOW()
       WHERE guild_id = $1`,
      [guildId]
    );

    const message = { content: '✅ Canal de calendario eliminado.' };
    if (interaction.deferred) {
      await interaction.editReply(message);
    } else if (interaction.replied) {
      await interaction.followUp({ ...message, ephemeral: true });
    } else {
      await interaction.reply({ ...message, ephemeral: true });
    }
  } catch (error) {
    console.error('Error limpiando canal de calendario:', error);
    const message = { content: '❌ No se pudo limpiar el canal del calendario.' };
    if (interaction.deferred) {
      await interaction.editReply(message);
    } else if (interaction.replied) {
      await interaction.followUp({ ...message, ephemeral: true });
    } else {
      await interaction.reply({ ...message, ephemeral: true });
    }
  }
}

function buildCalendarEmbed(rangeKey, events) {
  const rangeConfig = CALENDAR_RANGES[rangeKey] || CALENDAR_RANGES.hoy;
  const emoji = rangeConfig.emoji || '🗓️';

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} Calendario Monad — ${rangeConfig.label}`)
    .setColor(0xF97316)
    .setTimestamp(new Date())
    .setFooter({ text: `Zona horaria mostrada: ${CALENDAR_DISPLAY_TIMEZONE}` });

  if (!events || events.length === 0) {
    embed.setDescription('No hay eventos programados en este rango.');
    return embed;
  }

  let description = '';
  let countIncluded = 0;

  for (const event of events) {
    const block = formatCalendarEventBlock(event);
    const separator = description ? '\n\n' : '';

    if ((description + separator + block).length > 4000) {
      break;
    }

    description += separator + block;
    countIncluded++;
  }

  embed.setDescription(description);

  if (countIncluded < events.length) {
    embed.addFields({
      name: 'Más eventos',
      value: `... y ${events.length - countIncluded} evento(s) adicionales en este rango.`,
      inline: false
    });
  }

  return embed;
}

function formatCalendarEventBlock(event) {
  const title = escapeMarkdown(event.summary || 'Sin título');
  const timeInfo = formatCalendarEventTime(event);
  const location = event.location ? `\n📍 ${escapeMarkdown(truncateString(event.location, 150))}` : '';
  const link = event.htmlLink ? `\n🔗 [Abrir en Google Calendar](${event.htmlLink})` : '';

  return `**${title}**\n${timeInfo}${location}${link}`;
}

function formatCalendarEventTime(event) {
  const locale = CALENDAR_DISPLAY_LOCALE;
  const timeZone = CALENDAR_DISPLAY_TIMEZONE;

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone
  });

  const dateTimeFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone
  });

  if (event.start?.dateTime) {
    const start = new Date(event.start.dateTime);
    const end = event.end?.dateTime ? new Date(event.end.dateTime) : null;
    const startStr = dateTimeFormatter.format(start);
    const endStr = end ? dateTimeFormatter.format(end) : null;

    if (endStr && endStr !== startStr) {
      return `🕒 ${startStr} — ${endStr} (${timeZone})`;
    }

    return `🕒 ${startStr} (${timeZone})`;
  }

  if (event.start?.date) {
    const start = new Date(`${event.start.date}T00:00:00Z`);
    const end = event.end?.date ? new Date(`${event.end.date}T00:00:00Z`) : null;
    let rangeText = dateFormatter.format(start);

    if (end) {
      const endAdjusted = new Date(end.getTime() - 1);
      if (endAdjusted > start) {
        rangeText += ` — ${dateFormatter.format(endAdjusted)}`;
      }
    }

    return `📅 ${rangeText} • Todo el día`;
  }

  return '🕒 Horario no especificado';
}

function normalizeCalendarText(text) {
  if (!text) return '';
  let result = text;

  result = result.replace(/<br\s*\/?>/gi, '\n');
  result = result.replace(/<\/p>/gi, '\n\n');
  result = result.replace(/<\/?[^>]+(>|$)/g, '');

  const entities = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'"
  };
  result = result.replace(/&[a-zA-Z0-9#]+;/g, match => entities[match] || match);

  return result.trim();
}

function truncateString(text, maxLength = 200) {
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function buildCalendarReminderEmbed(event) {
  const title = escapeMarkdown(event.summary || 'Evento');
  const embed = new EmbedBuilder()
    .setTitle(`⏰ Recordatorio: ${title}`)
    .setDescription(formatCalendarEventTime(event))
    .setColor(0xF97316)
    .setTimestamp(new Date());

  if (event.location) {
      embed.addFields({
      name: 'Ubicación',
      value: escapeMarkdown(truncateString(event.location, 200)),
        inline: false
      });
    }

  if (event.description) {
    embed.addFields({
      name: 'Descripción',
      value: escapeMarkdown(truncateString(normalizeCalendarText(event.description), 500)),
      inline: false
    });
  }

  if (event.htmlLink) {
    embed.addFields({
      name: 'Enlace',
      value: `[Abrir en Google Calendar](${event.htmlLink})`,
      inline: false
    });
  }

  return embed;
}

async function showCalendarMenu(interaction) {
  let alreadyAcknowledged = interaction.deferred || interaction.replied;

  if (!alreadyAcknowledged) {
    try {
      await interaction.deferReply({ ephemeral: true });
      alreadyAcknowledged = true;
  } catch (error) {
      if (error.code === 40060 || error.code === 10062) {
        alreadyAcknowledged = true;
      } else {
        throw error;
      }
    }
  }

  const rangeKey = 'tresdias';
  let upcomingCount = null;

  try {
    const upcomingEvents = await getCalendarEvents(CALENDAR_RANGES[rangeKey].range);
    upcomingCount = upcomingEvents.length;
  } catch (error) {
    console.error('Error al obtener eventos para el menú de calendario:', error);
  }

  const embed = new EmbedBuilder()
    .setTitle('🗓️ Calendario Monad')
    .setDescription('Consulta los próximos eventos del calendario de la DAO.')
    .setColor(0xF97316)
    .setTimestamp(new Date())
    .addFields(
      {
        name: 'Próximos 3 días',
        value: upcomingCount === null ? 'No disponible por ahora.' : `${upcomingCount} evento(s) registrados.`,
        inline: false
      },
      {
        name: 'Comandos rápidos',
        value: '`/calendario hoy` • `/calendario tresdias` • `/calendario semana` • `/calendario mes`',
        inline: false
      },
      {
        name: 'Notificaciones automáticas',
        value: '• Resumen diario a las 09:00 UTC\n• Recordatorios 1 hora antes de cada evento',
        inline: false
      }
    )
    .setFooter({ text: `Zona horaria mostrada: ${CALENDAR_DISPLAY_TIMEZONE}` });

  const rangeButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('calendar_show_hoy')
      .setLabel('Hoy')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('calendar_show_tresdias')
      .setLabel('Próximos 3 días')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('calendar_show_semana')
      .setLabel('Semana')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('calendar_show_mes')
      .setLabel('Mes')
      .setStyle(ButtonStyle.Secondary)
  );

  const payload = {
    embeds: [embed],
    components: [rangeButtons]
  };

  if (interaction.deferred) {
    await interaction.editReply(payload);
  } else if (interaction.replied || alreadyAcknowledged) {
    await interaction.followUp({ ...payload, ephemeral: true });
  } else {
    await interaction.reply({ ...payload, ephemeral: true });
  }
}

async function handleWalletCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'menu':
      await showWalletMenu(interaction);
        break;
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
    case 'chain_add':
      await handleWalletChainAdd(interaction);
      break;
    case 'chain_remove':
      await handleWalletChainRemove(interaction);
      break;
    case 'chain_list':
      await handleWalletChainList(interaction);
        break;
      default:
      await interaction.reply({ content: '❌ Subcomando no soportado.', ephemeral: true });
  }
}

async function handleWalletAdd(interaction) {
  const projectName = interaction.options.getString('project')?.trim();
  const chainOption = interaction.options.getString('chain');
  const link = interaction.options.getString('link')?.trim();
  const label = interaction.options.getString('label')?.trim() || null;
  const guildId = interaction.guildId;

  console.log('⚙️ handleWalletAdd invoked', { projectName, chainOption, link, label, guildId });

  const respond = async (payload) => {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ ...payload, ephemeral: true });
      } else {
        await interaction.followUp({ ...payload, ephemeral: true });
      }
  } catch (error) {
      if (error.code === 40060) {
        console.warn('wallet_add respond ignored (already acknowledged).');
        return;
      }
      throw error;
    }
  };

  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }
  } catch (error) {
    if (error.code !== 40060 && error.code !== 10062) {
      throw error;
    }
    console.warn(`wallet_add: unable to defer (${error.code}), continuing with direct reply.`);
  }

  try {
    const chainInfo = await resolveWalletChainOption(guildId, chainOption, { required: true });

    const result = await addWalletProject({
      guildId,
      userId: interaction.user.id,
      projectName,
      chainKey: chainInfo.chain_key,
      link,
      label
    });

    const message = result.createdNew
      ? `✅ Proyecto **${result.projectName}** (${chainInfo.display_name}) agregado con su primer canal.`
      : `✅ Canal agregado al proyecto **${result.projectName}** (${chainInfo.display_name}).`;

    await respond({ content: message });
  } catch (error) {
    console.error('Error in handleWalletAdd:', error);

    let response = '❌ No se pudo agregar el proyecto. Intenta nuevamente.';
    switch (error.message) {
      case 'PROJECT_NAME_REQUIRED':
        response = '❌ Debes proporcionar un nombre de proyecto.';
        break;
      case 'INVALID_URL':
        response = '❌ Link inválido. Debe comenzar con http:// o https://.';
        break;
      case 'CHANNEL_ALREADY_EXISTS':
        response = '❌ Ese link ya está registrado para este proyecto.';
        break;
      case 'CHAIN_NOT_FOUND':
        response = '❌ La red seleccionada no existe. Usa `/wallet chain_add` para crearla.';
        break;
      case 'CHAIN_REQUIRED':
        response = '❌ Debes seleccionar una red válida.';
        break;
      default:
        break;
    }

    await respond({ content: response });
  }
}

async function handleWalletList(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const chainOption = interaction.options.getString('chain');
    let chainFilterKey = null;
    let chainFilterName = null;

    if (chainOption && chainOption !== 'all') {
      const chainInfo = await resolveWalletChainOption(interaction.guildId, chainOption, { required: true });
      chainFilterKey = chainInfo.chain_key;
      chainFilterName = chainInfo.display_name;
    }

    const projects = await getWalletProjectsWithChannels(interaction.guildId, chainFilterKey);
    const embeds = buildWalletEmbeds(projects, { chainFilterKey, chainFilterName });

    if (embeds.length <= 10) {
      await interaction.editReply({ embeds });
    } else {
      await interaction.editReply({ embeds: embeds.slice(0, 10) });
      for (let i = 10; i < embeds.length; i += 10) {
        const chunk = embeds.slice(i, i + 10);
        await interaction.followUp({ embeds: chunk, ephemeral: true });
      }
    }
  } catch (error) {
    console.error('Error in handleWalletList:', error);
    if (error.message === 'CHAIN_NOT_FOUND') {
      await interaction.editReply({ content: '❌ La red seleccionada no existe. Usa `/wallet chain_add` para crearla.' });
    } else {
      await interaction.editReply({ content: '❌ No se pudo obtener la lista de proyectos.' });
    }
  }
}

async function handleWalletRemove(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const projectRaw = interaction.options.getString('project');
  const { projectId, projectName: projectNameInput } = parseWalletProjectOption(projectRaw);
  const projectName = projectNameInput ? projectNameInput.trim() : null;
  const chainOption = interaction.options.getString('chain');
  let chainKeyFilter = null;
  const labelRaw = interaction.options.getString('label');
  const selectedChannelId = labelRaw?.startsWith(WALLET_CHANNEL_VALUE_PREFIX)
    ? labelRaw.slice(WALLET_CHANNEL_VALUE_PREFIX.length)
    : null;
  const label = selectedChannelId ? null : labelRaw?.trim() || null;
  const link = interaction.options.getString('link')?.trim() || null;
  const guildId = interaction.guildId;

  if (!projectId && !projectName) {
    await interaction.editReply({ content: '❌ Debes indicar el nombre del proyecto.' });
    return;
  }

  try {
    let project;

    if (chainOption) {
      const chainInfo = await resolveWalletChainOption(guildId, chainOption, { required: false });
      if (chainInfo) {
        chainKeyFilter = chainInfo.chain_key;
    } else {
        await interaction.editReply({ content: '❌ La red seleccionada no existe.' });
        return;
      }
    }

    if (projectId) {
      project = await getWalletProjectById(projectId, guildId);
      if (!project) {
        await interaction.editReply({ content: '❌ No se encontró un proyecto con ese identificador.' });
      return;
    }
    } else {
      const resolution = await resolveWalletProject(guildId, projectName, chainKeyFilter);

      if (resolution.error === 'not_found') {
        await interaction.editReply({ content: '❌ No se encontró un proyecto con ese nombre.' });
        return;
      }

      if (resolution.error === 'ambiguous') {
        const chains = resolution.chains.map(c => c.toUpperCase()).join(', ');
        await interaction.editReply({ content: `❌ Ese proyecto existe en varias redes (${chains}). Especifica la opción 'chain' para continuar.` });
        return;
      }

      project = resolution.project;
    }

    if (chainKeyFilter && project.chain !== chainKeyFilter) {
      const chainInfo = await getWalletChainByKey(guildId, project.chain);
      await interaction.editReply({ content: `❌ Ese proyecto está registrado en la red ${chainInfo?.display_name || project.chain}.` });
      return;
    }
    
    const projectChainInfo = await getWalletChainByKey(guildId, project.chain);
    let projectChainDisplay = projectChainInfo?.display_name || project.chain;

    if (selectedChannelId || label || link) {
      const params = [project.id];
      let query = 'SELECT id FROM wallet_channels WHERE project_id = $1';

      if (selectedChannelId) {
        const removal = await removeWalletChannelById(selectedChannelId, guildId);
        if (!removal) {
          await interaction.editReply({ content: '❌ No se encontró un canal con el identificador seleccionado.' });
          return;
        }

        if (removal.projectRemoved) {
          await interaction.editReply({ content: `🗑️ Canal eliminado y el proyecto **${project.project_name}** (${projectChainDisplay}) quedó vacío, por lo que también se eliminó.` });
    } else {
          await interaction.editReply({ content: `🗑️ Canal eliminado para **${project.project_name}** (${projectChainDisplay}).` });
        }
        return;
      } else if (label) {
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
        await removeWalletProjectById(project.id, guildId);
        await interaction.editReply({ content: `🗑️ Se eliminaron los canales y el proyecto **${project.project_name}** (${projectChainDisplay}) quedó vacío, por lo que también se eliminó.` });
        return;
      }

      await pool.query('UPDATE wallet_projects SET updated_at = NOW() WHERE id = $1', [project.id]);
      await updateWalletMessage(guildId);
      await interaction.editReply({ content: `🗑️ Canal eliminado para **${project.project_name}** (${projectChainDisplay}).` });
      return;
    }

    const removed = await removeWalletProjectById(project.id, guildId);
    if (!removed) {
      await interaction.editReply({ content: '❌ No se pudo eliminar el proyecto.' });
      return;
    }

    await interaction.editReply({ content: `🗑️ Proyecto **${removed.project_name}** (${removed.chain_display}) eliminado.` });
  } catch (error) {
    console.error('Error in handleWalletRemove:', error);
    if (error.message === 'CHAIN_NOT_FOUND') {
      await interaction.editReply({ content: '❌ La red seleccionada no existe.' });
          } else {
      await interaction.editReply({ content: '❌ No se pudo eliminar el proyecto.' });
    }
  }
}

async function handleWalletEdit(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const projectRaw = interaction.options.getString('project');
  const { projectId, projectName: projectNameInput } = parseWalletProjectOption(projectRaw);
  const projectName = projectNameInput ? projectNameInput.trim() : null;
  const chainOption = interaction.options.getString('chain');
  let chainKeyFilter = null;
  const newName = interaction.options.getString('new_name')?.trim();
  const newChainOption = interaction.options.getString('new_chain');
  let newChainKey = null;
  const channelLabelRaw = interaction.options.getString('channel_label');
  const selectedChannelId = channelLabelRaw?.startsWith(WALLET_CHANNEL_VALUE_PREFIX)
    ? channelLabelRaw.slice(WALLET_CHANNEL_VALUE_PREFIX.length)
    : null;
  const channelLabel = selectedChannelId ? null : channelLabelRaw?.trim();
  const channelLink = interaction.options.getString('channel_link')?.trim();
  const newLabel = interaction.options.getString('new_label')?.trim();
  const newLink = interaction.options.getString('new_link')?.trim();
  const guildId = interaction.guildId;

  if (!newName && !newChainOption && !newLabel && !newLink) {
    await interaction.editReply({ content: '❌ Debes proporcionar algún cambio (nuevo nombre, red o datos de canal).' });
    return;
  }

  if (!projectId && !projectName) {
    await interaction.editReply({ content: '❌ Debes indicar el nombre del proyecto.' });
    return;
  }

  try {
    if (chainOption) {
      const chainInfo = await resolveWalletChainOption(guildId, chainOption, { required: false });
      if (chainInfo) {
        chainKeyFilter = chainInfo.chain_key;
          } else {
        await interaction.editReply({ content: '❌ La red seleccionada no existe.' });
        return;
      }
    }

    let newChainDisplay = null;
    if (newChainOption) {
      const newChainInfo = await resolveWalletChainOption(guildId, newChainOption, { required: true });
      newChainKey = newChainInfo.chain_key;
      newChainDisplay = newChainInfo.display_name;
    }

    let project;

    if (projectId) {
      project = await getWalletProjectById(projectId, guildId);
      if (!project) {
        await interaction.editReply({ content: '❌ No se encontró un proyecto con ese identificador.' });
        return;
      }
          } else {
      const resolution = await resolveWalletProject(guildId, projectName, chainKeyFilter);

      if (resolution.error === 'not_found') {
        await interaction.editReply({ content: '❌ No se encontró un proyecto con ese nombre.' });
        return;
      }

      if (resolution.error === 'ambiguous') {
        const chains = resolution.chains.map(c => c.toUpperCase()).join(', ');
        await interaction.editReply({ content: `❌ Ese proyecto existe en varias redes (${chains}). Especifica la opción 'chain' para continuar.` });
        return;
      }

      project = resolution.project;
    }

    if (chainKeyFilter && project.chain !== chainKeyFilter) {
      const chainInfo = await getWalletChainByKey(guildId, project.chain);
      await interaction.editReply({ content: `❌ Ese proyecto está registrado en la red ${chainInfo?.display_name || project.chain}.` });
      return;
    }

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

    if (newChainKey && newChainKey !== project.chain) {
      const conflict = await pool.query(
        `SELECT id FROM wallet_projects
         WHERE guild_id = $1 AND lower(project_name) = lower($2) AND lower(chain) = lower($3) AND id <> $4`,
        [guildId, project.project_name, newChainKey, project.id]
      );

      if (conflict.rows.length > 0) {
        await interaction.editReply({ content: '❌ Ya existe ese proyecto en la red seleccionada.' });
        return;
      }

      await pool.query('UPDATE wallet_projects SET chain = $1, updated_at = NOW() WHERE id = $2', [newChainKey, project.id]);
      project.chain = newChainKey;
      appliedChanges.push('cadena');
    }

    if (selectedChannelId || channelLabel || channelLink) {
      const params = [project.id];
      let query = 'SELECT * FROM wallet_channels WHERE project_id = $1';

      if (selectedChannelId) {
        params.push(selectedChannelId);
        query += ` AND id = $${params.length}`;
      } else if (channelLabel) {
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
      }

      if (newLink) {
        if (!isValidUrl(newLink)) {
          await interaction.editReply({ content: '❌ El nuevo link del canal no es válido.' });
        return;
          }
        updateParams.push(newLink);
        updates.push(`channel_link = $${updateParams.length}`);
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

    const finalChainInfo = await getWalletChainByKey(guildId, project.chain);
    const finalChainDisplay = finalChainInfo?.display_name || project.chain;

    await interaction.editReply({ content: `✏️ Cambios aplicados en **${project.project_name}** (${finalChainDisplay}): ${appliedChanges.join(', ')}.` });
            } catch (error) {
    console.error('Error in handleWalletEdit:', error);
    if (error.message === 'CHAIN_NOT_FOUND') {
      await interaction.editReply({ content: '❌ La red seleccionada no existe.' });
    } else {
      await interaction.editReply({ content: '❌ No se pudo actualizar el proyecto.' });
    }
  }
}

async function handleWalletChannelSet(interaction) {
  const channel = interaction.options.getChannel('channel');
  const guildId = interaction.guildId;

  const respond = async (payload) => {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ ...payload, ephemeral: true });
    } else {
        await interaction.followUp({ ...payload, ephemeral: true });
    }
  } catch (error) {
      if (error.code === 40060) {
        console.warn('wallet_channel_set respond ignored (already acknowledged).');
            return;
      }
      throw error;
    }
  };
  
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
          }
        } catch (error) {
    if (error.code !== 40060 && error.code !== 10062) {
      throw error;
    }
    console.warn(`wallet_channel_set: unable to defer (${error.code}), continuing with direct reply.`);
  }
  
  if (!channel || !channel.isTextBased()) {
    await respond({ content: '❌ Debes seleccionar un canal de texto válido.' });
      return;
    }
    
  if (channel.guildId && channel.guildId !== guildId) {
    await respond({ content: '❌ Solo puedes seleccionar canales del servidor actual.' });
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

    await respond({ content: `✅ Canal configurado: <#${channel.id}>` });
      } catch (error) {
    console.error('Error in handleWalletChannelSet:', error);
    await respond({ content: '❌ No se pudo configurar el canal.' });
  }
}

async function handleWalletChannelClear(interaction) {
  const guildId = interaction.guildId;

  const respond = async (payload) => {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ ...payload, ephemeral: true });
    } else {
        await interaction.followUp({ ...payload, ephemeral: true });
    }
  } catch (error) {
      if (error.code === 40060) {
        console.warn('wallet_channel_clear respond ignored (already acknowledged).');
      return;
    }
      throw error;
    }
  };

  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }
  } catch (error) {
    if (error.code !== 40060 && error.code !== 10062) {
      throw error;
    }
    console.warn(`wallet_channel_clear: unable to defer (${error.code}), continuing with direct reply.`);
  }

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
    
    await respond({ content: '✅ Canal de wallet reseteado.' });
  } catch (error) {
    console.error('Error in handleWalletChannelClear:', error);
    await respond({ content: '❌ No se pudo limpiar la configuración de canal.' });
  }
}

async function handleWalletChainAdd(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId;
  const name = interaction.options.getString('name')?.trim();
  const keyInput = interaction.options.getString('key')?.trim();

  try {
    const { chainKey, displayName } = await createWalletChain(guildId, name, keyInput);
    await interaction.editReply({ content: `✅ Red **${displayName}** (${chainKey}) agregada correctamente.` });
  } catch (error) {
    switch (error.message) {
      case 'CHAIN_NAME_REQUIRED':
        await interaction.editReply({ content: '❌ Debes indicar un nombre para la red.' });
        break;
      case 'CHAIN_INVALID_KEY':
        await interaction.editReply({ content: '❌ El identificador debe contener solo letras, números, guiones o guiones bajos y tener entre 2 y 30 caracteres.' });
        break;
      case 'CHAIN_DUPLICATE':
        await interaction.editReply({ content: '❌ Ya existe una red con ese nombre o identificador.' });
        break;
      default:
        console.error('Error creating wallet chain:', error);
        await interaction.editReply({ content: '❌ No se pudo agregar la red.' });
        break;
    }
  }
}

async function handleWalletChainRemove(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId;
  const chainOption = interaction.options.getString('chain');

  try {
    const chainInfo = await resolveWalletChainOption(guildId, chainOption, { required: true });

    const usage = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM wallet_projects
       WHERE guild_id = $1 AND lower(chain) = lower($2)`,
      [guildId, chainInfo.chain_key]
    );

    if (usage.rows[0].count > 0) {
      await interaction.editReply({ content: `❌ No puedes eliminar la red **${chainInfo.display_name}** porque hay proyectos asociados. Actualiza o elimina esos proyectos primero.` });
      return;
    }
    
      await pool.query(
      `DELETE FROM wallet_chains
       WHERE guild_id = $1 AND lower(chain_key) = lower($2)`,
      [guildId, chainInfo.chain_key]
    );

    await interaction.editReply({ content: `🗑️ Red **${chainInfo.display_name}** eliminada.` });
  } catch (error) {
    console.error('Error removing wallet chain:', error);
    if (error.message === 'CHAIN_NOT_FOUND') {
      await interaction.editReply({ content: '❌ La red seleccionada no existe.' });
    } else {
      await interaction.editReply({ content: '❌ No se pudo eliminar la red.' });
    }
  }
}

async function handleWalletChainList(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  try {
    const chains = await listWalletChains(interaction.guildId);
    
    if (chains.length === 0) {
      await interaction.editReply({ content: '📋 No hay redes configuradas. Usa `/wallet chain_add` para agregar nuevas redes.' });
      return;
    }
    
    const lines = chains.map(chain => `• **${chain.display_name}** (${chain.chain_key})`);
    await interaction.editReply({ content: `🌐 Redes disponibles:\n${lines.join('\n')}` });
  } catch (error) {
    console.error('Error listing wallet chains:', error);
    await interaction.editReply({ content: '❌ No se pudieron obtener las redes configuradas.' });
  }
}

async function getWalletProjectById(projectId, guildId) {
  const result = await pool.query(
    `SELECT *
     FROM wallet_projects
     WHERE id = $1 AND guild_id = $2`,
    [projectId, guildId]
  );

  return result.rows[0] || null;
}

async function getWalletProjectSuggestions(guildId, searchTerm, limit = 25) {
  await ensureWalletChainsForGuild(guildId);
  const normalizedSearch = (searchTerm || '').toLowerCase();
  const pattern = normalizedSearch ? `%${normalizedSearch}%` : '%';

  const result = await pool.query(
    `SELECT p.id, p.project_name, p.chain, c.display_name
     FROM wallet_projects p
     LEFT JOIN wallet_chains c
       ON c.guild_id = p.guild_id AND lower(c.chain_key) = lower(p.chain)
     WHERE p.guild_id = $1
       AND lower(p.project_name) LIKE $2
     ORDER BY lower(p.project_name), p.chain
     LIMIT $3`,
    [guildId, pattern, limit]
  );

  return result.rows.map(row => ({
    name: `${row.project_name} (${row.display_name || row.chain})`,
    value: `${WALLET_PROJECT_VALUE_PREFIX}${row.id}`
  }));
}

function formatChannelOptionLabel(label, link) {
  const displayLabel = label?.trim() ? label.trim() : WALLET_NO_LABEL_DISPLAY;
  if (!link) {
    return displayLabel;
  }

  try {
    const url = new URL(link);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const guildIdPart = parts[0];
      const channelIdPart = parts[1];
      return `${displayLabel} • ${guildIdPart}/${channelIdPart}`;
    }
    return `${displayLabel} • ${url.hostname}`;
    } catch (error) {
    return `${displayLabel} • ${link.slice(-12)}`;
  }
}

async function getWalletChannelLabelSuggestions({ guildId, projectId, projectName, searchTerm = '', limit = 25 }) {
  const params = [guildId];
  let query = `
    SELECT p.id AS project_id, c.id AS channel_id, c.label, c.channel_link
    FROM wallet_projects p
    JOIN wallet_channels c ON c.project_id = p.id
    WHERE p.guild_id = $1`;

  if (projectId) {
    params.push(projectId);
    query += ` AND p.id = $${params.length}`;
  } else if (projectName) {
    params.push(projectName);
    query += ` AND lower(p.project_name) = lower($${params.length})`;
          } else {
    return [];
  }

  const normalizedSearch = (searchTerm || '').toLowerCase();
  if (normalizedSearch) {
    params.push(`%${normalizedSearch}%`);
    query += ` AND (lower(COALESCE(c.label, '')) LIKE $${params.length} OR lower(c.channel_link) LIKE $${params.length})`;
  }

  params.push(limit);
  query += ` ORDER BY c.created_at LIMIT $${params.length}`;

  const result = await pool.query(query, params);

  return result.rows.map(row => ({
    name: formatChannelOptionLabel(row.label, row.channel_link).slice(0, 100),
    value: `${WALLET_CHANNEL_VALUE_PREFIX}${row.channel_id}`
  }));
}

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
      COALESCE(ch.display_name, p.chain) AS chain_display_name,
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
    LEFT JOIN wallet_chains ch
      ON ch.guild_id = p.guild_id AND lower(ch.chain_key) = lower(p.chain)
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
        chain_display_name: row.chain_display_name,
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
    const embeds = buildWalletEmbeds(projects, {});

    let messageId = config.wallet_message_id;

    if (messageId) {
      try {
        const existingMessage = await channel.messages.fetch(messageId);
        await existingMessage.edit({ embeds });
        if (!existingMessage.pinned) {
          await existingMessage.pin().catch(() => {});
            }
            return;
    } catch (error) {
        console.log('No se pudo actualizar el mensaje de wallet, se creará uno nuevo:', error.message);
        messageId = null;
      }
    }

    const sentMessage = await channel.send({ embeds });
        await pool.query(
      'UPDATE server_config SET wallet_message_id = $1, updated_at = NOW() WHERE guild_id = $2',
      [sentMessage.id, guildId]
        );
    await sentMessage.pin().catch(() => {});
      } catch (error) {
    console.error('Error updating wallet message:', error);
  }
}

function buildWalletEmbeds(projects, { chainFilterKey = null, chainFilterName = null } = {}) {
  const totalProjects = projects?.length || 0;
  const filterLabel = chainFilterKey ? (chainFilterName || chainFilterKey) : null;
  const embeds = [];

  const createBaseEmbed = () =>
    new EmbedBuilder()
      .setColor(0x3B82F6)
      .setTimestamp(new Date());

  if (!totalProjects) {
    const embed = createBaseEmbed()
      .setTitle('📋 Proyectos con submit de wallets')
      .setDescription(
        filterLabel
          ? `No hay proyectos registrados para la red **${filterLabel}**.`
          : 'No hay proyectos registrados todavía. Usa `/wallet add` para incluir el primero.'
      );

    const footerParts = [];
    if (filterLabel) footerParts.push(filterLabel);
    footerParts.push('0 proyectos');
    embed.setFooter({ text: footerParts.join(' • ') });
    return [embed];
  }

  const blocks = projects.map((project, index) => {
    const chainLabel = project.chain_display_name || project.chain;
    const header = `${index + 1}. **${escapeMarkdown(project.project_name)}** (${chainLabel})`;
    const channelLines = project.channels.length > 0
      ? project.channels.map(channel => {
          const label = channel.label ? escapeMarkdown(channel.label) : 'Canal';
          return `   • [${label}](${channel.channel_link})`;
        })
      : ['   • Sin canales registrados'];

    return [header, ...channelLines].join('\n');
  });

  const MAX_DESCRIPTION_LENGTH = 3800;
  let currentBlocks = [];
  let currentLength = 0;

  for (const block of blocks) {
    const separatorLength = currentBlocks.length ? 2 : 0; // "\n\n"
    if (currentLength + block.length + separatorLength > MAX_DESCRIPTION_LENGTH) {
      const embed = createBaseEmbed().setDescription(currentBlocks.join('\n\n'));
      embeds.push(embed);
      currentBlocks = [block];
      currentLength = block.length;
    } else {
      currentBlocks.push(block);
      currentLength += block.length + separatorLength;
    }
  }

  if (currentBlocks.length) {
    const embed = createBaseEmbed().setDescription(currentBlocks.join('\n\n'));
    embeds.push(embed);
  }

  const totalPages = embeds.length;
  embeds.forEach((embed, index) => {
    const title =
      totalPages > 1
        ? `📋 Proyectos con submit de wallets (${index + 1}/${totalPages})`
        : '📋 Proyectos con submit de wallets';
    embed.setTitle(title);

    const footerParts = [];
    if (filterLabel) footerParts.push(filterLabel);
    footerParts.push(`${totalProjects} proyecto(s)`);
    embed.setFooter({ text: footerParts.join(' • ') });
  });

  return embeds;
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

async function addWalletProject({ guildId, userId, projectName, chainKey, link, label }) {
  const trimmedName = (projectName || '').trim();
  if (!trimmedName) {
    throw new Error('PROJECT_NAME_REQUIRED');
  }

  if (!isValidUrl(link || '')) {
    throw new Error('INVALID_URL');
  }

  const normalizedChain = normalizeChain(chainKey);

  await ensureServerConfigRow(guildId);

  if (!normalizedChain) {
    throw new Error('CHAIN_NOT_FOUND');
  }

  const chainRow = await getWalletChainByKey(guildId, normalizedChain);
  if (!chainRow) {
    throw new Error('CHAIN_NOT_FOUND');
  }

  const existing = await pool.query(
    `SELECT * FROM wallet_projects
     WHERE guild_id = $1 AND lower(project_name) = lower($2) AND lower(chain) = lower($3)`,
    [guildId, trimmedName, normalizedChain]
  );

  let projectId;
  let createdNew = false;

  if (existing.rows.length === 0) {
    const inserted = await pool.query(
      `INSERT INTO wallet_projects (guild_id, project_name, chain, submitted_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [guildId, trimmedName, normalizedChain, userId]
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
    throw new Error('CHANNEL_ALREADY_EXISTS');
  }

  await pool.query(
    `INSERT INTO wallet_channels (project_id, submitted_by, label, channel_link)
     VALUES ($1, $2, $3, $4)` ,
    [projectId, userId, label, link]
  );

  await pool.query('UPDATE wallet_projects SET updated_at = NOW() WHERE id = $1', [projectId]);
  await updateWalletMessage(guildId);

  return { createdNew, projectName: trimmedName, chain: normalizedChain, chainDisplayName: chainRow.display_name };
}

async function removeWalletProjectById(projectId, guildId) {
  const projectResult = await pool.query(
    'SELECT project_name, chain FROM wallet_projects WHERE id = $1 AND guild_id = $2',
    [projectId, guildId]
  );

  if (projectResult.rows.length === 0) {
    return null;
  }

  await pool.query('DELETE FROM wallet_projects WHERE id = $1', [projectId]);

  const project = projectResult.rows[0];
  const chainInfo = await getWalletChainByKey(guildId, project.chain);

  await updateWalletMessage(guildId);
  return {
    project_name: project.project_name,
    chain: project.chain,
    chain_display: chainInfo?.display_name || project.chain
  };
}

async function removeWalletChannelById(channelId, guildId) {
  const result = await pool.query(
    `DELETE FROM wallet_channels
     WHERE id = $1
     RETURNING project_id, label, channel_link`,
    [channelId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const { project_id: projectId, label, channel_link: channelLink } = result.rows[0];
  const projectResult = await pool.query(
    'SELECT project_name, chain FROM wallet_projects WHERE id = $1',
    [projectId]
  );

  let projectRemoved = false;
  let projectInfo = projectResult.rows[0] || null;

  const remaining = await pool.query(
    'SELECT COUNT(*)::int AS count FROM wallet_channels WHERE project_id = $1',
    [projectId]
  );

  let chainDisplay = null;

  if (remaining.rows[0].count === 0) {
    const removedProject = await removeWalletProjectById(projectId, guildId);
    projectRemoved = true;
    if (removedProject) {
      chainDisplay = removedProject.chain_display || removedProject.chain;
    }
  } else {
    await pool.query('UPDATE wallet_projects SET updated_at = NOW() WHERE id = $1', [projectId]);
    await updateWalletMessage(guildId);
    if (projectInfo) {
      const chainInfo = await getWalletChainByKey(guildId, projectInfo.chain);
      chainDisplay = chainInfo?.display_name || projectInfo.chain;
    }
  }

  if (!chainDisplay && projectInfo) {
    const chainInfo = await getWalletChainByKey(guildId, projectInfo.chain);
    chainDisplay = chainInfo?.display_name || projectInfo.chain;
  }

  return {
    projectRemoved,
    project: {
      project_name: projectInfo?.project_name || null,
      chain: projectInfo?.chain || null,
      chain_display: chainDisplay || projectInfo?.chain || null
    },
    removedChannel: {
      id: channelId,
      label,
      link: channelLink
    }
  };
}

async function editWalletChannelById(channelId, guildId, { newLabel, newLink }) {
  const channelResult = await pool.query(
    `SELECT c.id, c.project_id, c.label, c.channel_link, p.project_name, p.chain
     FROM wallet_channels c
     JOIN wallet_projects p ON p.id = c.project_id
     WHERE c.id = $1`,
    [channelId]
  );

  if (channelResult.rows.length === 0) {
    throw new Error('CHANNEL_NOT_FOUND');
  }

  const channel = channelResult.rows[0];
  const updates = [];
  const params = [];
  const changes = [];

  if (typeof newLabel !== 'undefined') {
    let value = newLabel;
    if (typeof value === 'string' && value.toLowerCase() === 'clear') {
      value = null;
    }

    const normalized = value && typeof value === 'string' ? value.trim() : null;
    const currentLabel = channel.label || null;

    if (normalized !== currentLabel) {
      updates.push(`label = $${updates.length + 1}`);
      params.push(normalized);
      changes.push(normalized ? 'etiqueta' : 'etiqueta eliminada');
    }
  }

  if (typeof newLink !== 'undefined') {
    const trimmedLink = newLink ? newLink.trim() : '';
    if (trimmedLink && trimmedLink !== channel.channel_link) {
      if (!isValidUrl(trimmedLink)) {
        throw new Error('INVALID_URL');
      }
      updates.push(`channel_link = $${updates.length + 1}`);
      params.push(trimmedLink);
      changes.push('link');
    }
  }

  if (updates.length === 0) {
    throw new Error('NO_CHANGES');
  }

  params.push(channelId);
  await pool.query(
    `UPDATE wallet_channels
     SET ${updates.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length}`,
    params
  );

  await pool.query('UPDATE wallet_projects SET updated_at = NOW() WHERE id = $1', [channel.project_id]);
  await updateWalletMessage(guildId);

  return {
    project: {
      name: channel.project_name,
      chain: channel.chain
    },
    changes
  };
}

async function editWalletProjectById(projectId, guildId, { newName, newChainKey }) {
  const projectResult = await pool.query('SELECT * FROM wallet_projects WHERE id = $1', [projectId]);
  if (projectResult.rows.length === 0) {
    throw new Error('PROJECT_NOT_FOUND');
  }

    const project = projectResult.rows[0];
  let updatedName = project.project_name;
  let updatedChain = project.chain;
  const changes = [];

  if (newName) {
    const trimmed = newName.trim();
    if (!trimmed) {
      throw new Error('PROJECT_NAME_REQUIRED');
    }

    const duplicateCheck = await pool.query(
      `SELECT id FROM wallet_projects
       WHERE guild_id = $1 AND lower(project_name) = lower($2) AND lower(chain) = lower($3) AND id <> $4`,
      [guildId, trimmed, project.chain, project.id]
    );

    if (duplicateCheck.rows.length > 0) {
      throw new Error('DUPLICATE_PROJECT');
    }

    await pool.query('UPDATE wallet_projects SET project_name = $1, updated_at = NOW() WHERE id = $2', [trimmed, project.id]);
    updatedName = trimmed;
    changes.push('nombre');
  }

  if (newChainKey) {
    const normalizedChain = normalizeChain(newChainKey);
    const chainRow = await getWalletChainByKey(guildId, normalizedChain);
    if (!chainRow) {
      throw new Error('CHAIN_NOT_FOUND');
    }

    if (normalizedChain !== project.chain) {
      const conflict = await pool.query(
        `SELECT id FROM wallet_projects
         WHERE guild_id = $1 AND lower(project_name) = lower($2) AND lower(chain) = lower($3) AND id <> $4`,
        [guildId, updatedName, normalizedChain, project.id]
      );

      if (conflict.rows.length > 0) {
        throw new Error('DUPLICATE_PROJECT_CHAIN');
      }

      await pool.query('UPDATE wallet_projects SET chain = $1, updated_at = NOW() WHERE id = $2', [normalizedChain, project.id]);
      updatedChain = normalizedChain;
      changes.push('cadena');
    }
  }

  if (changes.length === 0) {
    throw new Error('NO_CHANGES');
  }

  await updateWalletMessage(guildId);
  const finalChain = await getWalletChainByKey(guildId, updatedChain);
  return {
    projectName: updatedName,
    chain: updatedChain,
    chainDisplay: finalChain?.display_name || updatedChain,
    changes
  };
}

async function handleMainMenuCommand(interaction) {
    const embed = new EmbedBuilder()
    .setTitle('🤖 Panel Principal de Pi-Bot')
    .setDescription('Selecciona el módulo que quieres gestionar:')
    .addFields(
      { name: '💎 NFT Tracker', value: 'Tracking de colecciones, alertas y herramientas relacionadas con NFTs.', inline: false },
      { name: '🐦 Tweet Tracker', value: 'Monitorea cuentas de X/Twitter y recibe notificaciones en Discord.', inline: false },
      { name: '📝 Submit Wallets', value: 'Gestiona los proyectos y canales para enviar wallets dentro del servidor.', inline: false },
      { name: '🗓️ Calendario Monad', value: 'Consulta los eventos programados de la DAO y obtén recordatorios rápidos.', inline: false }
    )
    .setColor(0x5865F2)
      .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('menu_main_nft')
        .setLabel('NFT Tracker')
        .setEmoji('💎')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('menu_main_twitter')
        .setLabel('Tweet Tracker')
        .setEmoji('🐦')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('menu_main_calendar')
        .setLabel('Calendario')
        .setEmoji('🗓️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('menu_main_wallet')
        .setLabel('Submit Wallets')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('menu_main_test')
        .setLabel('Prueba')
        .setStyle(ButtonStyle.Secondary)
    );

  const payload = { embeds: [embed], components: [row] };

  const isAcknowledged = () => interaction.deferred || interaction.replied;

  const attemptEdit = async () => {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }
    await interaction.editReply(payload);
  };

  try {
    await attemptEdit();
    return;
  } catch (error) {
    if (error.code !== 40060 && error.code !== 10062 && error.code !== 'InteractionNotReplied') {
      throw error;
    }
  }

  if (isAcknowledged()) {
    try {
      await interaction.followUp({ ...payload, ephemeral: true });
      return;
    } catch (followError) {
      if (followError.code !== 40060 && followError.code !== 10062 && followError.code !== 'InteractionNotReplied') {
        throw followError;
      }
    }
  }

  try {
    await interaction.reply({ ...payload, ephemeral: true });
  } catch (replyError) {
    if (replyError.code !== 40060 && replyError.code !== 10062) {
      throw replyError;
    }
  }
}

async function handleMainMenuButton(interaction) {
  const { customId } = interaction;

  try {
    if (customId === 'menu_main_nft') {
      await showLegacyMainMenu(interaction);
      return;
    }

    if (customId === 'menu_main_twitter') {
      await showTwitterTrackerMenu(interaction);
      return;
    }

    if (customId === 'menu_main_calendar') {
      await showCalendarMenu(interaction);
      return;
    }
    
    if (customId === 'menu_main_wallet') {
      await showWalletMenu(interaction);
      return;
    }

    if (customId === 'menu_main_test') {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '✅ Botón de prueba recibido.', ephemeral: true });
      } else {
        await interaction.followUp({ content: '✅ Botón de prueba recibido.', ephemeral: true });
      }
      return;
    }

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Opción no disponible.', ephemeral: true });
    }
  } catch (error) {
    console.error('Error handling main menu button:', error);
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({ content: '❌ Error al procesar la opción del menú principal.', ephemeral: true });
      } catch (replyError) {
        console.error('Error replying to main menu button failure:', replyError);
      }
    }
  }
}

async function showLegacyMainMenu(interaction) {
    const embed = new EmbedBuilder()
    .setTitle('💎 NFT Tracker')
    .setDescription('Selecciona una sección para administrar el seguimiento de NFTs.')
    .setColor(0x22c55e)
      .setTimestamp();

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('menu_projects')
        .setLabel('📋 Proyectos')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('menu_alerts')
        .setLabel('🔔 Alertas')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('menu_stats')
        .setLabel('📈 Estadísticas')
        .setStyle(ButtonStyle.Secondary)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('menu_config')
        .setLabel('⚙️ Configuración')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('menu_tools')
        .setLabel('🧰 Herramientas')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('menu_help')
        .setLabel('❓ Ayuda')
        .setStyle(ButtonStyle.Secondary)
    );

  const payload = { embeds: [embed], components: [row1, row2], ephemeral: true };
  if (interaction.deferred) {
    await interaction.editReply(payload);
  } else if (interaction.replied) {
    await interaction.followUp(payload);
  } else {
    await interaction.reply(payload);
  }
}

async function showTwitterTrackerMenu(interaction) {
    const embed = new EmbedBuilder()
    .setTitle('🐦 Tweet Tracker')
    .setDescription('Herramientas para monitorear cuentas de X/Twitter.')
      .addFields(
      { name: 'Agregar', value: '`/twitter add usuario canal` — registra una cuenta y el canal donde recibir alertas.', inline: false },
      { name: 'Listar', value: '`/twitter list` — muestra todas las cuentas monitoreadas.', inline: false },
      { name: 'Eliminar', value: '`/twitter remove usuario` — deja de monitorear una cuenta.', inline: false },
      { name: 'Probar', value: '`/twitter test usuario` — obtiene el último tweet manualmente.', inline: false }
    )
    .setColor(0x1d9bf0)
    .setFooter({ text: 'Recuerda configurar tus tokens y proveedores de Nitter.' })
      .setTimestamp();
    
  const embedPayload = { embeds: [embed], ephemeral: true };
  if (interaction.deferred) {
    await interaction.editReply(embedPayload);
  } else if (interaction.replied) {
    await interaction.followUp(embedPayload);
  } else {
    await interaction.reply(embedPayload);
  }
}

async function showWalletMenu(interaction) {
  const guildId = interaction.guildId;
  const projects = await getWalletProjectsWithChannels(guildId);
  const totalProjects = projects.length;
  const totalChannels = projects.reduce((acc, project) => acc + project.channels.length, 0);

      const embed = new EmbedBuilder()
    .setTitle('📋 Gestor de Submit Wallets')
    .setDescription('Selecciona una opción para gestionar los proyectos registrados.')
        .addFields(
      { name: 'Proyectos cargados', value: `${totalProjects}`, inline: true },
      { name: 'Canales registrados', value: `${totalChannels}`, inline: true },
      { name: 'Configuración', value: 'Usa `/wallet channel_set` para definir el canal donde se publica la lista.', inline: false }
    )
    .setColor('#3B82F6')
        .setTimestamp();
      
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('wallet_add')
        .setLabel('➕ Agregar')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('wallet_list')
        .setLabel('📋 Listar')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('wallet_edit')
        .setLabel('✏️ Editar')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('wallet_remove')
        .setLabel('🗑️ Eliminar')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('wallet_refresh')
        .setLabel('🔄 Refrescar Pin')
        .setStyle(ButtonStyle.Secondary)
    );

  const chainRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('wallet_chain_add')
        .setLabel('➕ Agregar red')
        .setStyle(ButtonStyle.Primary)
    );

  await interaction.reply({ embeds: [embed], components: [row, chainRow], ephemeral: true });
}

function createWalletAddModal(chain) {
  const modal = new ModalBuilder()
    .setCustomId(`wallet_add_modal_${chain.chain_key}`)
    .setTitle(`➕ Agregar proyecto • ${chain.display_name}`);

  const projectInput = new TextInputBuilder()
    .setCustomId('wallet_add_project')
    .setLabel('Nombre del proyecto')
    .setPlaceholder('Ej: Monzilla')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const linkInput = new TextInputBuilder()
    .setCustomId('wallet_add_link')
    .setLabel('Link al canal de submit')
    .setPlaceholder('https://discord.com/channels/...')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(2000);

  const labelInput = new TextInputBuilder()
    .setCustomId('wallet_add_label')
    .setLabel('Etiqueta del canal (opcional)')
    .setPlaceholder('Ej: GTD, FCFS, WL')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(100);

  modal.addComponents(
    new ActionRowBuilder().addComponents(projectInput),
    new ActionRowBuilder().addComponents(linkInput),
    new ActionRowBuilder().addComponents(labelInput)
  );

  return modal;
}

function createWalletAddChannelModal(project, chainInfo) {
  const modal = new ModalBuilder()
    .setCustomId(`wallet_add_channel_modal_${project.id}`)
    .setTitle(`➕ Nuevo canal • ${project.project_name}`);

  const linkInput = new TextInputBuilder()
    .setCustomId('wallet_channel_link')
    .setLabel('Link al canal de submit')
    .setPlaceholder('https://discord.com/channels/...')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(2000);

  const labelInput = new TextInputBuilder()
    .setCustomId('wallet_channel_label')
    .setLabel('Etiqueta del canal (opcional)')
    .setPlaceholder('Ej: GTD, FCFS, WL')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(100);

  modal.addComponents(
    new ActionRowBuilder().addComponents(linkInput),
    new ActionRowBuilder().addComponents(labelInput)
  );

  if (chainInfo?.display_name) {
    modal.setTitle(`➕ Canal • ${project.project_name} (${chainInfo.display_name})`);
  }

  return modal;
}

function createWalletEditModal(project, projectId) {
  const modal = new ModalBuilder()
    .setCustomId(`wallet_edit_modal_${projectId}`)
    .setTitle(`✏️ Editar ${project.project_name}`);

  const newNameInput = new TextInputBuilder()
    .setCustomId('wallet_edit_new_name')
    .setLabel('Nuevo nombre (opcional)')
    .setPlaceholder(project.project_name)
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(100);

  const newChainInput = new TextInputBuilder()
    .setCustomId('wallet_edit_new_chain')
    .setLabel('Nueva red (opcional)')
    .setPlaceholder(`${project.chain} -> otra red`)
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(10);

  modal.addComponents(
    new ActionRowBuilder().addComponents(newNameInput),
    new ActionRowBuilder().addComponents(newChainInput)
  );

  return modal;
}

function createWalletChannelEditModal(project, channel) {
  const modal = new ModalBuilder()
    .setCustomId(`wallet_edit_channel_modal_${channel.id}`)
    .setTitle(`✏️ Canal de ${project.project_name}`);

  const labelInput = new TextInputBuilder()
    .setCustomId('wallet_channel_new_label')
    .setLabel('Nueva etiqueta (opcional)')
    .setPlaceholder(`${channel.label || WALLET_NO_LABEL_DISPLAY} (escribe "clear" para borrar)`)
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(100);

  const linkInput = new TextInputBuilder()
    .setCustomId('wallet_channel_new_link')
    .setLabel('Nuevo link (opcional)')
    .setPlaceholder(channel.link || 'https://discord.com/channels/...')
    .setValue(channel.link || '')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(2000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(labelInput),
    new ActionRowBuilder().addComponents(linkInput)
  );

  return modal;
}

function createWalletChainModal() {
  const modal = new ModalBuilder()
    .setCustomId('wallet_chain_add_modal')
    .setTitle('➕ Agregar nueva red');

  const nameInput = new TextInputBuilder()
    .setCustomId('wallet_chain_name')
    .setLabel('Nombre visible (ej. Monad, Ethereum)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(50);

  const keyInput = new TextInputBuilder()
    .setCustomId('wallet_chain_key')
    .setLabel('Identificador (opcional, ej. monad)')
    .setPlaceholder('Se generará automáticamente si lo dejas vacío')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(30);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(keyInput)
  );

  return modal;
}

async function getWalletProjectsForSelect(guildId) {
  const projects = await getWalletProjectsWithChannels(guildId);
  return projects.slice(0, 25).map(project => ({
    label: `${project.project_name} (${project.chain_display_name || project.chain})`,
    value: project.id
  }));
}

function buildWalletAddProjectComponents({ chainInfo, projects, page = 0 }) {
  const PAGE_SIZE = 24; // 1 opción reservada para "nuevo proyecto"
  const safeProjects = Array.isArray(projects) ? projects : [];
  const totalProjects = safeProjects.length;
  const totalPages = Math.max(1, Math.ceil(totalProjects / PAGE_SIZE));
  const safePage = Math.min(Math.max(Number.isFinite(page) ? page : 0, 0), totalPages - 1);
  const start = safePage * PAGE_SIZE;
  const currentProjects = safeProjects.slice(start, start + PAGE_SIZE);

  const select = new StringSelectMenuBuilder()
    .setCustomId(`wallet_add_project_select_${chainInfo.chain_key}_${safePage}`)
    .setPlaceholder(
      totalProjects
        ? `Selecciona proyecto • ${chainInfo.display_name} (${safePage + 1}/${totalPages})`
        : `Crear proyecto en ${chainInfo.display_name}`
    )
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('➕ Crear nuevo proyecto')
        .setDescription('Registrar un proyecto nuevo en esta red')
        .setValue(`new:${chainInfo.chain_key}`)
    );

  currentProjects.forEach(project => {
    select.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(project.project_name.slice(0, 100))
        .setValue(`project:${project.id}`)
    );
  });

  const rows = [new ActionRowBuilder().addComponents(select)];

  if (totalPages > 1) {
    const navRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`wallet_add_page_${chainInfo.chain_key}_${safePage - 1}`)
        .setLabel('⬅️ Anterior')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage === 0),
      new ButtonBuilder()
        .setCustomId(`wallet_add_page_${chainInfo.chain_key}_${safePage + 1}`)
        .setLabel('Siguiente ➡️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage >= totalPages - 1)
    );
    rows.push(navRow);
  }

  const summaryParts = [
    `Red: **${chainInfo.display_name}**`,
    `${totalProjects} proyecto(s)`
  ];

  if (totalPages > 1) {
    summaryParts.push(`Página ${safePage + 1}/${totalPages}`);
  }

  const summary = summaryParts.join(' • ');

  return {
    components: rows,
    summary,
    totalProjects,
    totalPages,
    page: safePage
  };
}

async function showWalletRemoveSelect(interaction) {
  const options = await getWalletProjectsForSelect(interaction.guildId);

  if (!options.length) {
    await interaction.reply({ content: '📋 No hay proyectos para eliminar.', ephemeral: true });
      return;
    }
    
  const select = new StringSelectMenuBuilder()
    .setCustomId('wallet_remove_select')
    .setPlaceholder('Selecciona un proyecto para eliminar')
    .addOptions(options);

  await interaction.reply({
    content: 'Selecciona el proyecto que deseas eliminar:',
    components: [new ActionRowBuilder().addComponents(select)],
    ephemeral: true
  });
}

async function showWalletEditSelect(interaction) {
  const options = await getWalletProjectsForSelect(interaction.guildId);

  if (!options.length) {
    await interaction.reply({ content: '📋 No hay proyectos para editar.', ephemeral: true });
      return;
    }
    
  const select = new StringSelectMenuBuilder()
    .setCustomId('wallet_edit_select')
    .setPlaceholder('Selecciona un proyecto para editar')
    .addOptions(options);

  await interaction.reply({
    content: 'Selecciona el proyecto que deseas editar:',
    components: [new ActionRowBuilder().addComponents(select)],
    ephemeral: true
  });
}

async function showWalletAddChainSelector(interaction) {
  const guildId = interaction.guildId;
  await ensureWalletChainsForGuild(guildId);
  const chains = await listWalletChains(guildId);

  if (!chains.length) {
    await interaction.reply({ content: '❌ No hay redes configuradas. Usa `/wallet chain_add` para crear una.', ephemeral: true });
      return;
    }
    
  const options = chains.slice(0, 25).map(chain =>
    new StringSelectMenuOptionBuilder()
      .setLabel(`${chain.display_name} (${chain.chain_key})`)
      .setValue(`${WALLET_CHAIN_VALUE_PREFIX}${chain.chain_key}`)
  );

  const select = new StringSelectMenuBuilder()
    .setCustomId('wallet_add_chain_select')
    .setPlaceholder('Selecciona la red para el nuevo proyecto')
    .addOptions(options);

  const components = [
    new ActionRowBuilder().addComponents(select),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('wallet_chain_add')
        .setLabel('➕ Crear nueva red')
        .setStyle(ButtonStyle.Secondary)
    )
  ];

  await interaction.reply({
    content: 'Selecciona la red para el proyecto que deseas gestionar:',
    components,
    ephemeral: true
  });
}

async function showWalletListChainSelector(interaction) {
  const guildId = interaction.guildId;
  await ensureWalletChainsForGuild(guildId);
  const chains = await listWalletChains(guildId);

  const select = new StringSelectMenuBuilder()
    .setCustomId('wallet_list_chain_select')
    .setPlaceholder('Selecciona la red a listar')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Todas las redes')
        .setValue('all')
        .setDescription('Mostrar todos los proyectos registrados')
    );

  chains.slice(0, 24).forEach(chain => {
    select.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`${chain.display_name} (${chain.chain_key})`)
        .setValue(`${WALLET_CHAIN_VALUE_PREFIX}${chain.chain_key}`)
    );
  });

  await interaction.reply({
    content: '¿Qué red quieres revisar?',
    components: [new ActionRowBuilder().addComponents(select)],
    ephemeral: true
  });
}

async function sendWalletListEmbed(interaction, { chainKey = null, chainName = null, asUpdate = false } = {}) {
  const projects = await getWalletProjectsWithChannels(interaction.guildId, chainKey);
  const embeds = buildWalletEmbeds(projects, { chainFilterKey: chainKey, chainFilterName: chainName });
  if (embeds.length <= 10) {
    if (asUpdate) {
      await interaction.update({ content: null, embeds, components: [] });
    } else if (interaction.deferred) {
    await interaction.editReply({ content: null, embeds, components: [] });
    } else {
      await interaction.reply({ content: null, embeds, components: [], ephemeral: true });
    }
    return;
  }

  const firstChunk = embeds.slice(0, 10);
  if (asUpdate) {
    await interaction.update({ content: null, embeds: firstChunk, components: [] });
  } else if (interaction.deferred) {
    await interaction.editReply({ content: null, embeds: firstChunk, components: [] });
  } else {
    await interaction.reply({ content: null, embeds: firstChunk, components: [], ephemeral: true });
  }

  for (let i = 10; i < embeds.length; i += 10) {
    const chunk = embeds.slice(i, i + 10);
    try {
      await interaction.followUp({ embeds: chunk, ephemeral: true });
    } catch (error) {
      if (error?.code === 40060 || error?.code === 10062) {
        console.warn('wallet_list followUp ignored (interaction already acknowledged).');
        break;
      }
      console.error('Error sending additional wallet list chunk:', error);
      break;
    }
  }
}

async function handleWalletButton(interaction) {
  const { customId } = interaction;

  if (customId === 'wallet_add') {
    await showWalletAddChainSelector(interaction);
      return;
    }
    
  if (customId.startsWith('wallet_add_page_')) {
    const match = customId.match(/^wallet_add_page_(.+)_(-?\d+)$/);
    if (!match) {
      await interaction.update({ content: '❌ Navegación inválida.', components: [] });
      return;
    }

    const chainKey = match[1];
    const targetPage = parseInt(match[2], 10);
    const chainInfo = await getWalletChainByKey(interaction.guildId, chainKey);

    if (!chainInfo) {
      await interaction.update({ content: '❌ La red seleccionada ya no existe.', components: [] });
      return;
    }
    
    const projects = await getWalletProjectsByChain(interaction.guildId, chainInfo.chain_key);
    const { components, summary, totalProjects } = buildWalletAddProjectComponents({
      chainInfo,
      projects,
      page: targetPage
    });

    const advisory = totalProjects
      ? 'Selecciona un proyecto existente para agregarle otro canal o crea uno nuevo.'
      : 'No hay proyectos registrados; crea uno nuevo para empezar.';

    await interaction.update({
      content: `${summary}\n${advisory}`,
      components
    });
      return;
    }
    
  if (customId === 'wallet_edit') {
    await showWalletEditSelect(interaction);
      return;
    }
    
  if (customId.startsWith('wallet_edit_project_')) {
    const projectId = customId.replace('wallet_edit_project_', '');
    const projectResult = await pool.query(
      'SELECT project_name, chain FROM wallet_projects WHERE id = $1',
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      await interaction.reply({ content: '❌ El proyecto seleccionado ya no existe.', ephemeral: true });
      return;
    }
    
    await interaction.showModal(createWalletEditModal(projectResult.rows[0], projectId));
    return;
  }

  if (customId === 'wallet_remove') {
    await showWalletRemoveSelect(interaction);
      return;
    }
    
  if (customId === 'wallet_list') {
    await showWalletListChainSelector(interaction);
    return;
  }
  
  if (customId === 'wallet_refresh') {
    await updateWalletMessage(interaction.guildId);
    await interaction.reply({ content: '🔄 Lista actualizada y mensaje pineado refrescado.', ephemeral: true });
    return;
  }

  if (customId === 'wallet_chain_add') {
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.showModal(createWalletChainModal());
      }
  } catch (error) {
      if (error.code !== 40060) { // Interaction already acknowledged
        throw error;
      }
      console.warn('Modal already acknowledged for wallet_chain_add:', error.message);
    }
    return;
  }
}

client.login(DISCORD_TOKEN).catch(error => {
  console.error('❌ Error iniciando sesión en Discord:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isStringSelectMenu()) return;

  try {
    if (interaction.customId === 'wallet_add_chain_select') {
      const value = interaction.values[0];
      const chainInfo = await resolveWalletChainOption(interaction.guildId, value, { required: true });
      const projects = await getWalletProjectsByChain(interaction.guildId, chainInfo.chain_key);
      const { components, summary, totalProjects } = buildWalletAddProjectComponents({
        chainInfo,
        projects,
        page: 0
      });

      const advisory = totalProjects
        ? 'Selecciona un proyecto existente para agregarle otro canal o crea uno nuevo.'
        : 'No hay proyectos registrados; crea uno nuevo para empezar.';

      await interaction.update({
        content: `${summary}\n${advisory}`,
        components
      });
      return;
    }
    
    if (interaction.customId.startsWith('wallet_add_project_select_')) {
      const match = interaction.customId.match(/^wallet_add_project_select_(.+)_(\d+)$/);
      const value = interaction.values[0];

      if (!match || !value) {
        await interaction.update({ content: '❌ Selección inválida.', components: [] });
      return;
    }
    
      const chainKey = match[1];

      if (value.startsWith('new:')) {
        const chainInfo = await getWalletChainByKey(interaction.guildId, chainKey);
        if (!chainInfo) {
          await interaction.update({ content: '❌ La red seleccionada ya no existe.', components: [] });
          return;
        }
        await interaction.showModal(createWalletAddModal(chainInfo));
        return;
      }

      if (value.startsWith('project:')) {
        const projectId = value.replace('project:', '');
        const projectResult = await pool.query(
          `SELECT id, project_name, chain
           FROM wallet_projects
           WHERE id = $1 AND guild_id = $2`,
          [projectId, interaction.guildId]
        );

        if (projectResult.rows.length === 0) {
          await interaction.update({ content: '❌ El proyecto seleccionado ya no existe.', components: [] });
          return;
        }

        const project = projectResult.rows[0];
        const chainInfo = await getWalletChainByKey(interaction.guildId, project.chain);
        await interaction.showModal(createWalletAddChannelModal(project, chainInfo));
        return;
      }

      await interaction.update({ content: '❌ Selección inválida.', components: [] });
      return;
    }
    
    if (interaction.customId === 'wallet_list_chain_select') {
      const value = interaction.values[0];
      if (!value || value === 'all') {
        await sendWalletListEmbed(interaction, { chainKey: null, chainName: 'Todas las redes', asUpdate: true });
        return;
      }

      const chainInfo = await resolveWalletChainOption(interaction.guildId, value, { required: true });
      await sendWalletListEmbed(interaction, {
        chainKey: chainInfo.chain_key,
        chainName: chainInfo.display_name,
        asUpdate: true
      });
      return;
    }

    if (interaction.customId === 'wallet_remove_select') {
      const projectId = interaction.values[0];
      const projectResult = await pool.query(
        'SELECT project_name, chain FROM wallet_projects WHERE id = $1',
        [projectId]
      );

      if (projectResult.rows.length === 0) {
        await interaction.update({ content: '❌ No se encontró el proyecto seleccionado.', components: [] });
      return;
    }

      const channelsResult = await pool.query(
        'SELECT id, label, channel_link FROM wallet_channels WHERE project_id = $1 ORDER BY created_at',
        [projectId]
      );

      if (channelsResult.rows.length === 0) {
        const removed = await removeWalletProjectById(projectId, interaction.guildId);
        if (!removed) {
          await interaction.update({ content: '❌ El proyecto seleccionado ya no existe.', components: [] });
      return;
    }

        await interaction.update({
          content: `🗑️ Proyecto **${removed.project_name}** (${removed.chain.toUpperCase()}) eliminado.`,
          components: []
        });
        return;
      }

      const options = channelsResult.rows.slice(0, 24).map(channel => new StringSelectMenuOptionBuilder()
        .setLabel(formatChannelOptionLabel(channel.label, channel.channel_link).slice(0, 100))
        .setValue(`${WALLET_CHANNEL_VALUE_PREFIX}${channel.id}`)
        .setDescription(channel.channel_link.slice(0, 100))
      );

      options.push(
        new StringSelectMenuOptionBuilder()
          .setLabel('🗑️ Eliminar proyecto completo')
          .setValue(`${WALLET_PROJECT_VALUE_PREFIX}${projectId}`)
      );

      const select = new StringSelectMenuBuilder()
        .setCustomId(`wallet_remove_channel_select_${projectId}`)
        .setPlaceholder('Selecciona qué deseas eliminar')
        .addOptions(options);

      await interaction.update({
        content: `Selecciona qué deseas eliminar de **${projectResult.rows[0].project_name}** (${projectResult.rows[0].chain.toUpperCase()}):`,
        components: [new ActionRowBuilder().addComponents(select)]
      });
      return;
    }
    
    if (interaction.customId.startsWith('wallet_remove_channel_select_')) {
      const value = interaction.values[0];
      const projectId = interaction.customId.replace('wallet_remove_channel_select_', '');

      if (value.startsWith(WALLET_PROJECT_VALUE_PREFIX)) {
        const removed = await removeWalletProjectById(projectId, interaction.guildId);
        if (!removed) {
          await interaction.update({ content: '❌ El proyecto seleccionado ya no existe.', components: [] });
      return;
    }
    
        await interaction.update({
          content: `🗑️ Proyecto **${removed.project_name}** (${removed.chain.toUpperCase()}) eliminado.`,
          components: []
        });
        return;
      }

      if (value.startsWith(WALLET_CHANNEL_VALUE_PREFIX)) {
        const channelId = value.slice(WALLET_CHANNEL_VALUE_PREFIX.length);
        try {
          const removal = await removeWalletChannelById(channelId, interaction.guildId);
          if (!removal) {
            await interaction.update({ content: '❌ No se encontró el canal seleccionado.', components: [] });
      return;
    }

          if (removal.projectRemoved && removal.project) {
            await interaction.update({
              content: `🗑️ Canal eliminado y el proyecto **${removal.project.project_name}** (${removal.project.chain_display}) quedó vacío, por lo que también se eliminó.`,
              components: []
            });
          } else if (removal.project) {
            await interaction.update({
              content: `🗑️ Canal eliminado para **${removal.project.project_name}** (${removal.project.chain_display}).`,
              components: []
            });
          } else {
            await interaction.update({
              content: '🗑️ Canal eliminado.',
              components: []
            });
          }
  } catch (error) {
          console.error('Error removing channel via select:', error);
          await interaction.update({ content: '❌ No se pudo eliminar el canal seleccionado.', components: [] });
        }
        return;
      }

      await interaction.update({ content: '❌ Selección inválida.', components: [] });
      return;
    }

    if (interaction.customId === 'wallet_edit_select') {
      const projectId = interaction.values[0];
      const projectResult = await pool.query('SELECT project_name, chain FROM wallet_projects WHERE id = $1', [projectId]);

      if (projectResult.rows.length === 0) {
        await interaction.update({ content: '❌ No se encontró el proyecto seleccionado.', components: [] });
      return;
    }

      const project = projectResult.rows[0];
      const channelsResult = await pool.query(
        'SELECT id, label, channel_link FROM wallet_channels WHERE project_id = $1 ORDER BY created_at',
        [projectId]
      );

      const components = [];

      const actionsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`wallet_edit_project_${projectId}`)
          .setLabel('Editar datos del proyecto')
          .setStyle(ButtonStyle.Primary)
      );

      components.push(actionsRow);

      if (channelsResult.rows.length > 0) {
        const channelOptions = channelsResult.rows.slice(0, 25).map(channel =>
          new StringSelectMenuOptionBuilder()
            .setLabel(formatChannelOptionLabel(channel.label, channel.channel_link).slice(0, 100))
            .setValue(`${WALLET_CHANNEL_VALUE_PREFIX}${channel.id}`)
            .setDescription(channel.channel_link.slice(0, 100))
        );

        const select = new StringSelectMenuBuilder()
          .setCustomId(`wallet_edit_channel_select_${projectId}`)
          .setPlaceholder('Selecciona un canal para editar')
          .addOptions(channelOptions);

        components.push(new ActionRowBuilder().addComponents(select));
      }

      await interaction.update({
        content: `Selecciona qué deseas editar de **${project.project_name}** (${project.chain.toUpperCase()}):`,
        components
      });
      return;
    }

    if (interaction.customId.startsWith('wallet_edit_channel_select_')) {
      const value = interaction.values[0];
      if (!value || !value.startsWith(WALLET_CHANNEL_VALUE_PREFIX)) {
        await interaction.reply({ content: '❌ Selección inválida.', ephemeral: true });
        return;
      }

      const channelId = value.slice(WALLET_CHANNEL_VALUE_PREFIX.length);
      const channelResult = await pool.query(
        `SELECT c.id, c.label, c.channel_link, p.project_name, p.chain, p.id AS project_id
         FROM wallet_channels c
         JOIN wallet_projects p ON p.id = c.project_id
         WHERE c.id = $1`,
        [channelId]
      );

      if (channelResult.rows.length === 0) {
        await interaction.reply({ content: '❌ El canal seleccionado ya no existe.', ephemeral: true });
      return;
    }

      const row = channelResult.rows[0];
      await interaction.showModal(createWalletChannelEditModal(
        { project_name: row.project_name, chain: row.chain, id: row.project_id },
        { id: row.id, label: row.label, link: row.channel_link }
      ));
      return;
    }
  } catch (error) {
    console.error('Error handling select menu:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isModalSubmit()) return;

  try {
    if (faucetModule.isFaucetModal(interaction.customId)) {
      await faucetModule.handleModalSubmit(interaction);
      return;
    }

    if (interaction.customId.startsWith('wallet_add_modal_')) {
      const chainKey = interaction.customId.replace('wallet_add_modal_', '');
      const chainInfo = await getWalletChainByKey(interaction.guildId, chainKey);
      if (!chainInfo) {
        await interaction.reply({ content: '❌ La red seleccionada ya no existe. Reintenta el proceso.', ephemeral: true });
      return;
    }

      const projectName = interaction.fields.getTextInputValue('wallet_add_project');
      const link = interaction.fields.getTextInputValue('wallet_add_link');
      const labelValue = interaction.fields.getTextInputValue('wallet_add_label');
      const label = labelValue ? labelValue.trim() : null;

      try {
        const result = await addWalletProject({
          guildId: interaction.guildId,
          userId: interaction.user.id,
          projectName,
          chainKey,
          link,
          label
        });

        const message = result.createdNew
          ? `✅ Proyecto **${result.projectName}** (${chainInfo.display_name}) agregado con su primer canal.`
          : `✅ Canal agregado al proyecto **${result.projectName}** (${chainInfo.display_name}).`;

        await interaction.reply({ content: message, ephemeral: true });
  } catch (error) {
        console.error('Error in wallet add modal:', error);

        let response = '❌ No se pudo agregar el proyecto. Intenta nuevamente.';
        if (error.message === 'PROJECT_NAME_REQUIRED') {
          response = '❌ Debes proporcionar un nombre de proyecto.';
        } else if (error.message === 'INVALID_URL') {
          response = '❌ Link inválido. Debe comenzar con http:// o https://.';
        } else if (error.message === 'CHANNEL_ALREADY_EXISTS') {
          response = '❌ Ese link ya está registrado para este proyecto.';
        } else if (error.message === 'CHAIN_NOT_FOUND') {
          response = '❌ La red seleccionada ya no existe. Usa `/wallet chain_add` para crearla nuevamente.';
        }

        await interaction.reply({ content: response, ephemeral: true });
      }
      return;
    }

    if (interaction.customId.startsWith('wallet_add_channel_modal_')) {
      const projectId = interaction.customId.replace('wallet_add_channel_modal_', '');
      const projectResult = await pool.query(
        `SELECT project_name, chain
         FROM wallet_projects
         WHERE id = $1 AND guild_id = $2`,
        [projectId, interaction.guildId]
      );

      if (projectResult.rows.length === 0) {
        await interaction.reply({ content: '❌ El proyecto seleccionado ya no existe.', ephemeral: true });
      return;
    }

      const project = projectResult.rows[0];
      const chainInfo = await getWalletChainByKey(interaction.guildId, project.chain);

      const link = interaction.fields.getTextInputValue('wallet_channel_link');
      const labelValue = interaction.fields.getTextInputValue('wallet_channel_label');
      const label = labelValue ? labelValue.trim() : null;

      try {
        const result = await addWalletProject({
          guildId: interaction.guildId,
          userId: interaction.user.id,
          projectName: project.project_name,
          chainKey: project.chain,
          link,
          label
        });

        const chainName = chainInfo?.display_name || project.chain;
        const message = result.createdNew
          ? `✅ Proyecto **${result.projectName}** (${chainName}) agregado con su primer canal.`
          : `✅ Canal agregado al proyecto **${result.projectName}** (${chainName}).`;

        await interaction.reply({ content: message, ephemeral: true });
  } catch (error) {
        console.error('Error in wallet channel add modal:', error);

        let response = '❌ No se pudo agregar el canal. Intenta nuevamente.';
        if (error.message === 'INVALID_URL') {
          response = '❌ Link inválido. Debe comenzar con http:// o https://.';
        } else if (error.message === 'CHANNEL_ALREADY_EXISTS') {
          response = '❌ Ese link ya está registrado para este proyecto.';
        } else if (error.message === 'CHAIN_NOT_FOUND') {
          response = '❌ La red del proyecto ya no existe. Usa `/wallet chain_add` para crearla nuevamente.';
        } else if (error.message === 'PROJECT_NAME_REQUIRED') {
          response = '❌ El proyecto seleccionado ya no es válido.';
        }

        await interaction.reply({ content: response, ephemeral: true });
      }
      return;
    }

    if (interaction.customId === 'wallet_chain_add_modal') {
      const name = interaction.fields.getTextInputValue('wallet_chain_name');
      const keyInputRaw = interaction.fields.getTextInputValue('wallet_chain_key');
      const keyInput = keyInputRaw ? keyInputRaw.trim() : null;

      try {
        const { chainKey, displayName } = await createWalletChain(interaction.guildId, name.trim(), keyInput);
        await interaction.reply({ content: `✅ Red **${displayName}** (${chainKey}) agregada correctamente.`, ephemeral: true });
  } catch (error) {
        let response = '❌ No se pudo agregar la red.';
        switch (error.message) {
          case 'CHAIN_NAME_REQUIRED':
            response = '❌ Debes indicar un nombre para la red.';
            break;
          case 'CHAIN_INVALID_KEY':
            response = '❌ El identificador debe contener solo letras, números, guiones o guiones bajos y tener entre 2 y 30 caracteres.';
            break;
          case 'CHAIN_DUPLICATE':
            response = '❌ Ya existe una red con ese nombre o identificador.';
            break;
          default:
            console.error('Error creating chain from modal:', error);
            break;
        }
        await interaction.reply({ content: response, ephemeral: true });
      }
      return;
    }

    if (interaction.customId.startsWith('wallet_edit_modal_')) {
      const projectId = interaction.customId.replace('wallet_edit_modal_', '');
      const newNameRaw = interaction.fields.getTextInputValue('wallet_edit_new_name');
      const newChainRaw = interaction.fields.getTextInputValue('wallet_edit_new_chain');

      const newName = newNameRaw ? newNameRaw.trim() : null;
      const newChainInput = newChainRaw ? newChainRaw.trim() : null;
      let newChainKey = null;
      if (newChainInput) {
        const chainInfo = await resolveWalletChainOption(interaction.guildId, newChainInput, { required: true });
        newChainKey = chainInfo.chain_key;
      }

      try {
        const result = await editWalletProjectById(projectId, interaction.guildId, { newName, newChainKey });
        const changeMap = { nombre: 'nombre', cadena: 'red' };
        const changesText = result.changes.map(change => changeMap[change] || change).join(', ');

        await interaction.reply({
          content: `✏️ Cambios aplicados en **${result.projectName}** (${result.chainDisplay}): ${changesText}.`,
          ephemeral: true
        });
  } catch (error) {
        console.error('Error in wallet edit modal:', error);
        let response = '❌ No se pudo actualizar el proyecto.';

        switch (error.message) {
          case 'PROJECT_NOT_FOUND':
            response = '❌ El proyecto seleccionado ya no existe.';
            break;
          case 'PROJECT_NAME_REQUIRED':
            response = '❌ El nuevo nombre no puede estar vacío.';
            break;
          case 'DUPLICATE_PROJECT':
          case 'DUPLICATE_PROJECT_CHAIN':
            response = '❌ Ya existe un proyecto con esa combinación de nombre y red.';
            break;
          case 'NO_CHANGES':
            response = 'ℹ️ No se detectaron cambios para aplicar.';
            break;
          case 'CHAIN_NOT_FOUND':
            response = '❌ La red ingresada no existe. Usa `/wallet chain_add` para crearla.';
            break;
          default:
            break;
        }

        await interaction.reply({ content: response, ephemeral: true });
      }
      return;
    }

    if (interaction.customId.startsWith('wallet_edit_channel_modal_')) {
      const channelId = interaction.customId.replace('wallet_edit_channel_modal_', '');
      const newLabelRaw = interaction.fields.getTextInputValue('wallet_channel_new_label');
      const newLinkRaw = interaction.fields.getTextInputValue('wallet_channel_new_link');

      const newLabel = newLabelRaw && newLabelRaw.trim() !== '' ? newLabelRaw.trim() : undefined;
      const newLink = newLinkRaw && newLinkRaw.trim() !== '' ? newLinkRaw.trim() : undefined;

      try {
        const result = await editWalletChannelById(channelId, interaction.guildId, { newLabel, newLink });
        const changeMap = {
          etiqueta: 'etiqueta',
          'etiqueta eliminada': 'etiqueta eliminada',
          link: 'link'
        };
        const changesText = result.changes.map(change => changeMap[change] || change).join(', ');

        await interaction.reply({
          content: `✏️ Canal actualizado en **${result.project.name}** (${result.project.chain.toUpperCase()}): ${changesText}.`,
          ephemeral: true
        });
      } catch (error) {
        console.error('Error editing wallet channel via modal:', error);
        let response = '❌ No se pudo actualizar el canal.';

        switch (error.message) {
          case 'CHANNEL_NOT_FOUND':
            response = '❌ El canal seleccionado ya no existe.';
            break;
          case 'INVALID_URL':
            response = '❌ El link ingresado no es válido.';
            break;
          case 'NO_CHANGES':
            response = 'ℹ️ No se detectaron cambios para aplicar.';
            break;
          default:
            break;
        }

        await interaction.reply({ content: response, ephemeral: true });
      }
      return;
    }
  } catch (error) {
    console.error('Error handling modal submit:', error);
  }
});