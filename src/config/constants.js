// Configuration constants for the Discord Bot

const CONFIG = {
  // Bot settings
  BOT_PREFIX: process.env.BOT_PREFIX || '/',
  NOTIFICATION_INTERVAL: parseInt(process.env.NOTIFICATION_INTERVAL) || 300000, // 5 minutes
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  
  // Rate limiting
  API_RATE_LIMIT: parseInt(process.env.API_RATE_LIMIT) || 100,
  API_RATE_WINDOW: parseInt(process.env.API_RATE_WINDOW) || 60000, // 1 minute
  
  // Notification settings
  ENABLE_FLOOR_ALERTS: process.env.ENABLE_FLOOR_ALERTS === 'true',
  ENABLE_VOLUME_ALERTS: process.env.ENABLE_VOLUME_ALERTS === 'true',
  ENABLE_SALES_ALERTS: process.env.ENABLE_SALES_ALERTS === 'true',
  ENABLE_LISTING_ALERTS: process.env.ENABLE_LISTING_ALERTS === 'true',
  
  // Default thresholds
  DEFAULT_FLOOR_THRESHOLD: 5.0, // 5%
  DEFAULT_VOLUME_THRESHOLD: 10.0, // 10 ETH
  DEFAULT_SALES_THRESHOLD: 5, // 5 sales
  
  // Magic Eden API
  MAGIC_EDEN_BASE_URL: 'https://api-mainnet.magiceden.io/v2',
  MAGIC_EDEN_TIMEOUT: 10000, // 10 seconds
  
  // Monad RPC
  MONAD_RPC_URL: process.env.MONAD_RPC_URL || 'https://rpc.monad.xyz',
  MONAD_RPC_TIMEOUT: 15000, // 15 seconds
  
  // Database
  SUPABASE_TIMEOUT: 10000, // 10 seconds
  MAX_RETRIES: 3,
  
  // Discord
  DISCORD_TIMEOUT: 5000, // 5 seconds
  MAX_EMBED_DESCRIPTION_LENGTH: 4096,
  MAX_EMBED_FIELD_LENGTH: 1024,
  MAX_EMBED_FIELDS: 25,
  
  // Tracking intervals
  TRACKING_INTERVALS: {
    FREQUENT: 300000, // 5 minutes
    NORMAL: 900000,   // 15 minutes
    LOW: 3600000      // 1 hour
  },
  
  // Alert types
  ALERT_TYPES: {
    FLOOR: 'floor',
    VOLUME: 'volume',
    SALES: 'sales',
    LISTINGS: 'listings'
  },
  
  // Project status
  PROJECT_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    PAUSED: 'paused',
    ERROR: 'error'
  },
  
  // Marketplaces
  MARKETPLACES: {
    MAGIC_EDEN: 'magic-eden',
    OPENSEA: 'opensea',
    BLUR: 'blur'
  },
  
  // Colors for embeds
  COLORS: {
    SUCCESS: 0x10B981, // Green
    ERROR: 0xFF6B6B,   // Red
    WARNING: 0xF59E0B, // Yellow
    INFO: 0x3B82F6,    // Blue
    PRIMARY: 0x7C3AED, // Purple
    SECONDARY: 0x6B7280 // Gray
  },
  
  // Emojis
  EMOJIS: {
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️',
    FIRE: '🔥',
    ROCKET: '🚀',
    CHART_UP: '📈',
    CHART_DOWN: '📉',
    MONEY: '💰',
    VOLUME: '📊',
    SALES: '💎',
    LISTINGS: '🆕',
    FLOOR: '🏠',
    PROJECT: '📋',
    ALERT: '🔔',
    SETTINGS: '⚙️',
    CLOCK: '⏰',
    ARROW_RIGHT: '➡️'
  },
  
  // Time periods
  TIME_PERIODS: {
    '24h': '24 hours',
    '7d': '7 days',
    '30d': '30 days'
  },
  
  // Validation rules
  VALIDATION: {
    PROJECT_NAME_MIN_LENGTH: 2,
    PROJECT_NAME_MAX_LENGTH: 50,
    CONTRACT_ADDRESS_PATTERN: /^0x[a-fA-F0-9]{40}$/,
    MAX_ALERTS_PER_USER: 10,
    MAX_PROJECTS_PER_USER: 20
  },
  
  // Error messages
  ERROR_MESSAGES: {
    PROJECT_NOT_FOUND: 'Proyecto no encontrado',
    INVALID_CONTRACT: 'Dirección de contrato inválida',
    INVALID_PROJECT_NAME: 'Nombre de proyecto inválido',
    ALERT_LIMIT_REACHED: 'Límite de alertas alcanzado',
    PROJECT_LIMIT_REACHED: 'Límite de proyectos alcanzado',
    API_ERROR: 'Error de API externa',
    DATABASE_ERROR: 'Error de base de datos',
    PERMISSION_DENIED: 'Permisos insuficientes',
    RATE_LIMITED: 'Demasiadas solicitudes, intenta más tarde'
  },
  
  // Success messages
  SUCCESS_MESSAGES: {
    PROJECT_CREATED: 'Proyecto creado exitosamente',
    PROJECT_UPDATED: 'Proyecto actualizado',
    ALERT_CREATED: 'Alerta creada exitosamente',
    ALERT_UPDATED: 'Alerta actualizada',
    ALERT_DELETED: 'Alerta eliminada',
    SETTINGS_SAVED: 'Configuración guardada'
  }
};

// Export configuration
module.exports = CONFIG;

