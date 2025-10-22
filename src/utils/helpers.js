// Utility functions for the Discord Bot

// Formatear números con decimales
function formatNumber(number, decimals = 3) {
  if (number === null || number === undefined) return 'N/A';
  return parseFloat(number).toFixed(decimals);
}

// Formatear porcentajes
function formatPercentage(number) {
  if (number === null || number === undefined) return 'N/A';
  const sign = number >= 0 ? '+' : '';
  return `${sign}${parseFloat(number).toFixed(1)}%`;
}

// Formatear fechas
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Formatear tiempo relativo
function formatTimeAgo(dateString) {
  if (!dateString) return 'N/A';
  
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'hace un momento';
  if (diffInSeconds < 3600) return `hace ${Math.floor(diffInSeconds / 60)} min`;
  if (diffInSeconds < 86400) return `hace ${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `hace ${Math.floor(diffInSeconds / 86400)}d`;
  
  return formatDate(dateString);
}

// Validar dirección de contrato
function isValidContractAddress(address) {
  if (!address) return false;
  // Validación básica para direcciones Ethereum/Monad
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Validar nombre de proyecto
function isValidProjectName(name) {
  if (!name) return false;
  return name.length >= 2 && name.length <= 50;
}

// Generar emoji basado en cambio de precio
function getPriceChangeEmoji(change) {
  if (change > 5) return '🚀';
  if (change > 0) return '📈';
  if (change < -5) return '📉';
  if (change < 0) return '📉';
  return '➡️';
}

// Generar color basado en cambio de precio
function getPriceChangeColor(change) {
  if (change > 5) return '#10B981'; // Verde brillante
  if (change > 0) return '#059669'; // Verde
  if (change < -5) return '#DC2626'; // Rojo brillante
  if (change < 0) return '#EF4444'; // Rojo
  return '#6B7280'; // Gris
}

// Calcular cambio porcentual
function calculatePercentageChange(oldValue, newValue) {
  if (!oldValue || oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

// Formatear volumen
function formatVolume(volume) {
  if (volume === null || volume === undefined) return 'N/A';
  
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}K`;
  }
  return formatNumber(volume, 2);
}

// Formatear precio ETH
function formatETH(price) {
  if (price === null || price === undefined) return 'N/A';
  
  if (price >= 1) {
    return `${formatNumber(price, 2)} ETH`;
  }
  return `${formatNumber(price, 3)} ETH`;
}

// Generar ID único para alertas
function generateAlertId() {
  return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Validar tipos de alerta
function isValidAlertType(type) {
  const validTypes = ['floor', 'volume', 'sales', 'listings'];
  return validTypes.includes(type.toLowerCase());
}

// Parsear tipos de alerta desde string
function parseAlertTypes(typesString) {
  if (!typesString) return ['floor', 'volume'];
  
  return typesString
    .split(',')
    .map(type => type.trim().toLowerCase())
    .filter(type => isValidAlertType(type));
}

// Generar mensaje de notificación
function generateNotificationMessage(project, data, alertType) {
  const messages = {
    floor: `🔥 **${project.name}** - Floor Update\n💰 Nuevo Floor: ${formatETH(data.floor_price)}\n📊 Cambio: ${formatPercentage(data.floor_change)}`,
    volume: `📈 **${project.name}** - Volume Spike\n🚀 Volume: ${formatETH(data.volume_24h)}\n⏰ Período: Últimas 24h`,
    sales: `💎 **${project.name}** - New Sales\n🛒 ${data.sales_count} ventas detectadas\n💰 Avg: ${formatETH(data.avg_sale_price)}`,
    listings: `🆕 **${project.name}** - New Listings\n📋 ${data.listings_count} nuevas listas\n💰 Floor: ${formatETH(data.floor_price)}`
  };
  
  return messages[alertType] || `📢 **${project.name}** - Update`;
}

// Limpiar texto para Discord
function sanitizeText(text) {
  if (!text) return '';
  return text
    .replace(/[`*_~|]/g, '') // Remover markdown
    .substring(0, 2000); // Limitar longitud
}

// Generar embed de error
function createErrorEmbed(title, description) {
  return {
    title: `❌ ${title}`,
    description: sanitizeText(description),
    color: 0xFF6B6B,
    timestamp: new Date().toISOString()
  };
}

// Generar embed de éxito
function createSuccessEmbed(title, description) {
  return {
    title: `✅ ${title}`,
    description: sanitizeText(description),
    color: 0x10B981,
    timestamp: new Date().toISOString()
  };
}

// Generar embed de información
function createInfoEmbed(title, description) {
  return {
    title: `ℹ️ ${title}`,
    description: sanitizeText(description),
    color: 0x3B82F6,
    timestamp: new Date().toISOString()
  };
}

// Generar embed de advertencia
function createWarningEmbed(title, description) {
  return {
    title: `⚠️ ${title}`,
    description: sanitizeText(description),
    color: 0xF59E0B,
    timestamp: new Date().toISOString()
  };
}

// Delay para evitar rate limits
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry con backoff exponencial
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = baseDelay * Math.pow(2, i);
      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Validar configuración del bot
function validateBotConfig(config) {
  const required = [
    'DISCORD_BOT_TOKEN',
    'DISCORD_CLIENT_ID',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY'
  ];
  
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  return true;
}

module.exports = {
  formatNumber,
  formatPercentage,
  formatDate,
  formatTimeAgo,
  isValidContractAddress,
  isValidProjectName,
  getPriceChangeEmoji,
  getPriceChangeColor,
  calculatePercentageChange,
  formatVolume,
  formatETH,
  generateAlertId,
  isValidAlertType,
  parseAlertTypes,
  generateNotificationMessage,
  sanitizeText,
  createErrorEmbed,
  createSuccessEmbed,
  createInfoEmbed,
  createWarningEmbed,
  delay,
  retryWithBackoff,
  validateBotConfig
};

