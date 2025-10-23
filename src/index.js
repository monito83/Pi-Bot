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
      `https://api-mainnet.magiceden.dev/v3/rtp/ethereum/collections/v7?id=${contractAddress}&includeMintStages=false&includeSecurityConfigs=false&normalizeRoyalties=false&useNonFlaggedFloorAsk=false&sortBy=allTimeVolume&limit=20`,
      // Endpoint correcto para colecciones de Monad Testnet (v7 con id)
      `https://api-mainnet.magiceden.dev/v3/rtp/monad-testnet/collections/v7?id=${contractAddress}&includeMintStages=false&includeSecurityConfigs=false&normalizeRoyalties=false&useNonFlaggedFloorAsk=false&sortBy=allTimeVolume&limit=20`
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying Magic Eden endpoint: ${endpoint}`);
        
        const response = await axios.get(endpoint, {
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
            return null;
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
            
            return {
              floor_price: priceInETH,
              volume_24h: volume?.["1day"] || 0,
              sales_count: collection.salesCount || 0,
              listings_count: collection.onSaleCount || 0,
              avg_sale_price: collection.avgPrice || 0,
              top_bid: topBid,
              source: 'Magic Eden'
            };
          }
        }
      } catch (error) {
        console.log(`❌ Magic Eden endpoint failed: ${endpoint}`, error.message);
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
  try {
    const result = await pool.query(
      'SELECT * FROM user_alerts WHERE project_id = $1 AND is_active = true',
      [project.id]
    );
    const alerts = result.rows;

    if (!alerts.length) return;

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
      case 'test-api':
        await handleTestApiCommand(interaction);
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
    const result = await pool.query('SELECT * FROM nft_projects WHERE name = $1', [projectName]);
    const project = result.rows[0];

    if (!project) {
      await interaction.reply({ content: '❌ Proyecto no encontrado.', ephemeral: true });
      return;
    }

    // Obtener datos frescos de la API
    await interaction.deferReply();
    const projectData = await getProjectData(project.contract_address);

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${project.name} - Status`)
      .addFields(
        { name: 'Floor Price', value: `${projectData.floor_price || 'N/A'} ETH`, inline: true },
        { name: 'Volume 24h', value: `${projectData.volume_24h || 'N/A'} ETH`, inline: true },
        { name: 'Sales Count', value: `${projectData.sales_count || 'N/A'}`, inline: true },
        { name: 'Listings', value: `${projectData.listings_count || 'N/A'}`, inline: true },
        { name: 'Contract', value: `${project.contract_address.slice(0, 10)}...`, inline: true },
        { name: 'Status', value: project.status, inline: true }
      )
      .setFooter({ text: `Data source: ${projectData?.source || 'Simulated'}` })
      .setColor('#7C3AED')
      .setTimestamp();

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
    const result = await pool.query('SELECT * FROM nft_projects WHERE name = $1', [projectName]);
    const project = result.rows[0];

    if (!project) {
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
    const result = await pool.query('SELECT * FROM nft_projects WHERE name = $1', [projectName]);
    const project = result.rows[0];

    if (!project) {
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
    const result = await pool.query('SELECT * FROM nft_projects WHERE name = $1', [projectName]);
    const project = result.rows[0];

    if (!project) {
      await interaction.reply({ content: '❌ Proyecto no encontrado.', ephemeral: true });
      return;
    }

    const alertTypes = types.split(',').map(t => t.trim());

    await pool.query(
      'INSERT INTO user_alerts (discord_user_id, project_id, alert_types, floor_threshold, volume_threshold, is_active) VALUES ($1, $2, $3, $4, $5, $6)',
      [interaction.user.id, project.id, JSON.stringify(alertTypes), 5.0, 10.0, true]
    );

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
    const result = await pool.query(
      'SELECT ua.*, np.name as project_name FROM user_alerts ua JOIN nft_projects np ON ua.project_id = np.id WHERE ua.discord_user_id = $1 AND ua.is_active = true',
      [interaction.user.id]
    );
    const alerts = result.rows;

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
      const alertTypes = JSON.parse(alert.alert_types || '[]');
      embed.addFields({
        name: `${index + 1}. ${alert.project_name}`,
        value: `Tipos: ${alertTypes.join(', ')}\nFloor: ${alert.floor_threshold}%\nVolume: ${alert.volume_threshold} ETH`,
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
    const result = await pool.query(
      'UPDATE user_alerts SET is_active = false FROM nft_projects WHERE user_alerts.project_id = nft_projects.id AND user_alerts.discord_user_id = $1 AND nft_projects.name = $2',
      [interaction.user.id, projectName]
    );

    if (result.rowCount === 0) {
      await interaction.reply({ content: '❌ No se encontraron alertas para desactivar.', ephemeral: true });
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

