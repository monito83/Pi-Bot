const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const { ethers } = require('ethers');

const DEFAULT_AMOUNT_STRING = process.env.FAUCET_DEFAULT_AMOUNTS || '5,10,20,50,100';
const DEFAULT_AMOUNTS = parseAmountList(DEFAULT_AMOUNT_STRING, [5, 10, 20, 50, 100]);
const MIN_AMOUNT_DEFAULT = parseFloat(process.env.FAUCET_MIN_AMOUNT || '1');
const MAX_AMOUNT_DEFAULT = parseFloat(process.env.FAUCET_MAX_AMOUNT || '100');
const DAILY_CAP_DEFAULT = parseFloat(process.env.FAUCET_DAILY_CAP || '200');
const COOLDOWN_DEFAULT = parseInt(process.env.FAUCET_COOLDOWN_MINUTES || '60', 10);
const MAX_REQUESTS_DEFAULT = parseInt(process.env.FAUCET_MAX_REQUESTS_PER_DAY || '3', 10);
const CUSTOM_ENABLED_DEFAULT = process.env.FAUCET_ALLOW_CUSTOM === 'false' ? false : true;
const FAUCET_RPC_URL = process.env.FAUCET_RPC_URL || process.env.MONAD_RPC_URL;
const FAUCET_PRIVATE_KEY = process.env.FAUCET_PRIVATE_KEY;
const FAUCET_EXPLORER_BASE = (process.env.FAUCET_EXPLORER_TX || '').replace(/\/$/, '');
let faucetPublicAddress = process.env.FAUCET_PUBLIC_ADDRESS || process.env.FAUCET_WALLET_ADDRESS || null;

const CUSTOM_ID_SEPARATOR = '::';

let poolRef = null;
let clientRef = null;
let providerRef = null;
let faucetWalletRef = null;
let faucetReady = false;

const faucetSlashCommand = new SlashCommandBuilder()
  .setName('faucet')
  .setDescription('Gestionar el faucet comunitario de MON')
  .addSubcommand(sub =>
    sub
      .setName('menu')
      .setDescription('Mostrar el menú interactivo del faucet'))
  .addSubcommand(sub =>
    sub
      .setName('solicitar')
      .setDescription('Solicitar un monto específico del faucet')
      .addNumberOption(option =>
        option
          .setName('monto')
          .setDescription('Monto en MON a solicitar')
          .setRequired(true)
          .setMinValue(0.1))
      .addStringOption(option =>
        option
          .setName('wallet')
          .setDescription('Dirección de tu wallet Monad (0x...)')
          .setRequired(true)))
  .addSubcommand(sub =>
    sub
      .setName('info')
      .setDescription('Ver saldo actual y dirección del faucet'))
  .addSubcommand(sub =>
    sub
      .setName('configurar')
      .setDescription('Actualizar límites y canales del faucet (solo admins)')
      .addBooleanOption(option =>
        option
          .setName('pausado')
          .setDescription('Pausar o reanudar el faucet'))
      .addChannelOption(option =>
        option
          .setName('canal_logs')
          .setDescription('Canal para registrar retiros')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addChannelOption(option =>
        option
          .setName('canal_info')
          .setDescription('Canal para publicar el estado del faucet')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addStringOption(option =>
        option
          .setName('montos')
          .setDescription('Montos permitidos separados por comas (ej: 5,10,20)'))
      .addNumberOption(option =>
        option
          .setName('minimo')
          .setDescription('Monto mínimo por solicitud')
          .setMinValue(0.1))
      .addNumberOption(option =>
        option
          .setName('maximo')
          .setDescription('Monto máximo por solicitud')
          .setMinValue(0.1))
      .addNumberOption(option =>
        option
          .setName('diario')
          .setDescription('Tope diario por usuario (MON)')
          .setMinValue(0.1))
      .addIntegerOption(option =>
        option
          .setName('cooldown')
          .setDescription('Cooldown entre solicitudes (minutos)')
          .setMinValue(1))
      .addIntegerOption(option =>
        option
          .setName('max_solicitudes')
          .setDescription('Máximo de solicitudes en 24h')
          .setMinValue(1))
      .addBooleanOption(option =>
        option
          .setName('permitir_personalizado')
          .setDescription('Permitir monto personalizado en el modal')));

function setup({ pool, client }) {
  poolRef = pool;
  clientRef = client;
  initializeProvider();
}

function initializeProvider() {
  if (!FAUCET_PRIVATE_KEY || !FAUCET_RPC_URL) {
    console.log('⚠️ Faucet: variables FAUCET_PRIVATE_KEY o FAUCET_RPC_URL no configuradas. El módulo se cargará en modo información.');
    faucetReady = false;
    return;
  }

  try {
    providerRef = new ethers.JsonRpcProvider(FAUCET_RPC_URL);
    faucetWalletRef = new ethers.Wallet(FAUCET_PRIVATE_KEY, providerRef);
    faucetPublicAddress = faucetPublicAddress || faucetWalletRef.address;
    faucetReady = true;
    console.log(`💧 Faucet listo. Address: ${faucetWalletRef.address}`);
  } catch (error) {
    faucetReady = false;
    console.error('❌ No se pudo inicializar el faucet:', error);
  }
}

async function initializeSchema() {
  if (!poolRef) {
    console.warn('⚠️ Faucet: pool no disponible para inicializar el esquema.');
    return;
  }

  try {
    await poolRef.query(`
      CREATE TABLE IF NOT EXISTS faucet_settings (
        guild_id TEXT PRIMARY KEY,
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        is_paused BOOLEAN NOT NULL DEFAULT false,
        log_channel_id TEXT,
        info_channel_id TEXT,
        default_amounts JSONB NOT NULL DEFAULT '[]'::jsonb,
        min_amount NUMERIC(78, 18),
        max_amount NUMERIC(78, 18),
        daily_cap NUMERIC(78, 18),
        cooldown_minutes INTEGER DEFAULT 60,
        max_requests_per_day INTEGER DEFAULT 3,
        custom_amount_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await poolRef.query(`
      CREATE TABLE IF NOT EXISTS faucet_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        wallet_address TEXT NOT NULL,
        amount NUMERIC(78, 18) NOT NULL,
        tx_hash TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        failure_reason TEXT,
        request_source TEXT NOT NULL DEFAULT 'slash',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await poolRef.query(`
      CREATE INDEX IF NOT EXISTS idx_faucet_requests_user ON faucet_requests (guild_id, user_id, created_at DESC)
    `);

    console.log('✅ Faucet schema initialized');
  } catch (error) {
    console.error('❌ Error initializing faucet schema:', error);
  }
}

function getSlashCommandBuilder() {
  return faucetSlashCommand;
}

function isFaucetButton(customId = '') {
  return customId.startsWith('faucet_amount' + CUSTOM_ID_SEPARATOR) ||
    customId === 'faucet_refresh' ||
    customId === 'faucet_info';
}

function isFaucetModal(customId = '') {
  return customId.startsWith('faucet_modal' + CUSTOM_ID_SEPARATOR);
}

async function handleSlashCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'menu':
      await showFaucetMenu(interaction);
      break;
    case 'solicitar': {
      const amount = interaction.options.getNumber('monto');
      const wallet = interaction.options.getString('wallet');
      await processFaucetRequest(interaction, { amount, wallet, source: 'slash' });
      break;
    }
    case 'info':
      await respondWithInfo(interaction, { ephemeral: false });
      break;
    case 'configurar':
      await handleConfigure(interaction);
      break;
  }
}

async function handleButtonInteraction(interaction) {
  if (interaction.customId === 'faucet_info') {
    await respondWithInfo(interaction, { ephemeral: true });
    return;
  }

  if (interaction.customId === 'faucet_refresh') {
    await respondWithInfo(interaction, { ephemeral: true, compact: true });
    return;
  }

  if (interaction.customId.startsWith('faucet_amount' + CUSTOM_ID_SEPARATOR)) {
    const value = interaction.customId.split(CUSTOM_ID_SEPARATOR)[1];
    const amount = value === 'custom' ? null : parseFloat(value);
    const settings = await ensureSettings(interaction.guildId);

    if (value === 'custom' && !settings.custom_amount_enabled) {
      await interaction.reply({ content: '❌ El monto personalizado está deshabilitado por la DAO.', ephemeral: true });
      return;
    }

    const modal = buildRequestModal({ amount });
    await interaction.showModal(modal);
  }
}

async function handleModalSubmit(interaction) {
  const value = interaction.customId.split(CUSTOM_ID_SEPARATOR)[1];
  const presetAmount = value === 'custom' ? null : parseFloat(value);
  const wallet = interaction.fields.getTextInputValue('faucet_wallet').trim();
  const amountField = interaction.fields.getTextInputValue('faucet_amount');
  const amount = presetAmount ?? parseFloat(amountField);

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: 64 });
  }

  await processFaucetRequest(interaction, { amount, wallet, source: 'modal', skipDefer: true });
}

async function showFaucetMenu(interaction) {
  const settings = await ensureSettings(interaction.guildId);
  const balance = await getFaucetBalance();
  const embed = buildMenuEmbed({ interaction, settings, balance });
  const components = buildMenuComponents(settings);

  await interaction.reply({
    embeds: [embed],
    components,
    allowedMentions: { parse: [] },
    flags: 64
  });
}

async function respondWithInfo(interaction, { ephemeral = false, compact = false } = {}) {
  const settings = await ensureSettings(interaction.guildId);
  const balance = await getFaucetBalance();
  const embed = buildInfoEmbed({ interaction, settings, balance, compact });
  const components = compact ? [] : buildMenuComponents(settings);

  if (!interaction.deferred && !interaction.replied) {
    await interaction.reply({ embeds: [embed], components, ephemeral, allowedMentions: { parse: [] } });
  } else {
    await interaction.editReply({ embeds: [embed], components });
  }
}

async function handleConfigure(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ Solo administradores pueden usar este comando.', flags: 64 });
    return;
  }

  const updates = {};
  const paused = interaction.options.getBoolean('pausado');
  const logChannel = interaction.options.getChannel('canal_logs');
  const infoChannel = interaction.options.getChannel('canal_info');
  const amountString = interaction.options.getString('montos');
  const minAmount = interaction.options.getNumber('minimo');
  const maxAmount = interaction.options.getNumber('maximo');
  const dailyCap = interaction.options.getNumber('diario');
  const cooldown = interaction.options.getInteger('cooldown');
  const maxRequests = interaction.options.getInteger('max_solicitudes');
  const allowCustom = interaction.options.getBoolean('permitir_personalizado');

  if (paused !== null) updates.is_paused = paused;
  if (logChannel) updates.log_channel_id = logChannel.id;
  if (infoChannel) updates.info_channel_id = infoChannel.id;
  if (amountString) {
    const parsed = parseAmountList(amountString, DEFAULT_AMOUNTS);
    updates.default_amounts = JSON.stringify(parsed);
  }
  if (typeof minAmount === 'number') updates.min_amount = minAmount;
  if (typeof maxAmount === 'number') updates.max_amount = maxAmount;
  if (typeof dailyCap === 'number') updates.daily_cap = dailyCap;
  if (typeof cooldown === 'number') updates.cooldown_minutes = cooldown;
  if (typeof maxRequests === 'number') updates.max_requests_per_day = maxRequests;
  if (typeof allowCustom === 'boolean') updates.custom_amount_enabled = allowCustom;

  if (Object.keys(updates).length === 0) {
    await interaction.reply({ content: 'ℹ️ No se recibieron cambios.', flags: 64 });
    return;
  }

  const settings = await upsertSettings(interaction.guildId, updates);
  const summary = buildConfigSummary(settings);

  await interaction.reply({
    content: `✅ Configuración actualizada.\n${summary}`,
    flags: 64
  });
}

async function processFaucetRequest(interaction, { amount, wallet, source, skipDefer = false }) {
  if (!interaction.guildId) {
    await safeReply(interaction, { content: '❌ Este faucet solo está disponible dentro del servidor.', ephemeral: true });
    return;
  }

  if (!skipDefer && !interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: 64 });
  }

  const settings = await ensureSettings(interaction.guildId);

  if (!settings.is_enabled || settings.is_paused) {
    await interaction.editReply({ content: '⏸️ El faucet está en pausa. Consulta con un administrador.' });
    return;
  }

  if (!faucetReady || !faucetWalletRef) {
    await interaction.editReply({ content: '❌ El faucet no tiene fondos configurados todavía. Intenta más tarde.' });
    return;
  }

  if (!wallet || !ethers.isAddress(wallet)) {
    await interaction.editReply({ content: '❌ Wallet inválida. Debe ser una dirección 0x...' });
    return;
  }

  const sanitizedAmount = sanitizeAmount(amount);
  if (!sanitizedAmount) {
    await interaction.editReply({ content: '❌ Debes indicar un monto válido (mayor a 0).' });
    return;
  }

  const minAllowed = Number(settings.min_amount ?? MIN_AMOUNT_DEFAULT);
  const maxAllowed = Number(settings.max_amount ?? MAX_AMOUNT_DEFAULT);
  if (sanitizedAmount < minAllowed || sanitizedAmount > maxAllowed) {
    await interaction.editReply({
      content: `❌ Monto fuera de los límites permitidos.\nMin: ${formatMon(minAllowed)} | Max: ${formatMon(maxAllowed)}`
    });
    return;
  }

  const limits = await getUserLimits(interaction.guildId, interaction.user.id);
  const dailyCap = Number(settings.daily_cap ?? DAILY_CAP_DEFAULT);
  const cooldownMinutes = settings.cooldown_minutes ?? COOLDOWN_DEFAULT;
  const maxRequests = settings.max_requests_per_day ?? MAX_REQUESTS_DEFAULT;

  if (limits.sentAmount + sanitizedAmount > dailyCap) {
    await interaction.editReply({
      content: `❌ Superas el tope diario (${formatMon(dailyCap)}). Has consumido ${formatMon(limits.sentAmount)} en las últimas 24h.`
    });
    return;
  }

  if (limits.requestCount >= maxRequests) {
    await interaction.editReply({
      content: `❌ Alcanzaste el máximo de solicitudes (${maxRequests}) en las últimas 24h.`
    });
    return;
  }

  if (limits.lastRequestAt) {
    const msSinceLast = Date.now() - limits.lastRequestAt.getTime();
    const minMillis = cooldownMinutes * 60 * 1000;
    if (msSinceLast < minMillis) {
      const remaining = Math.ceil((minMillis - msSinceLast) / 60000);
      await interaction.editReply({
        content: `⏱️ Debes esperar ${remaining} min antes de pedir nuevamente.`
      });
      return;
    }
  }

  const balance = await getFaucetBalance();
  if (balance !== null && sanitizedAmount > balance) {
    await interaction.editReply({
      content: '💸 El faucet no tiene saldo suficiente. Avísale a un admin para que recargue fondos.'
    });
    return;
  }

  const amountString = sanitizedAmount.toString();
  const weiValue = ethers.parseUnits(amountString, 18);
  const requestRecord = await poolRef.query(
    `INSERT INTO faucet_requests (guild_id, user_id, wallet_address, amount, status, request_source)
     VALUES ($1, $2, $3, $4, 'pending', $5)
     RETURNING id`,
    [interaction.guildId, interaction.user.id, wallet, sanitizedAmount, source]
  );
  const requestId = requestRecord.rows[0].id;

  try {
    const tx = await faucetWalletRef.sendTransaction({ to: wallet, value: weiValue });
    await tx.wait?.();

    await poolRef.query(
      `UPDATE faucet_requests
       SET status = 'sent', tx_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [tx.hash, requestId]
    );

    const newBalance = await getFaucetBalance();
    const embed = buildSuccessEmbed({ interaction, wallet, amount: sanitizedAmount, txHash: tx.hash, balance: newBalance });

    await interaction.editReply({ embeds: [embed] });
    await sendLogEntry(interaction.guildId, settings, embed);
  } catch (error) {
    console.error('❌ Faucet transfer error:', error);
    const reason = (error?.shortMessage || error?.message || 'Error desconocido').slice(0, 280);

    await poolRef.query(
      `UPDATE faucet_requests
       SET status = 'failed', failure_reason = $1, updated_at = NOW()
       WHERE id = $2`,
      [reason, requestId]
    );

    const displayMessage = error?.code === 'INSUFFICIENT_FUNDS'
      ? '❌ El faucet no tiene suficientes MON para completar la transferencia.'
      : '❌ No se pudo completar la transferencia. Intenta nuevamente o avisa a un admin.';

    await interaction.editReply({ content: displayMessage });
  }
}

async function ensureSettings(guildId) {
  const existing = await poolRef.query('SELECT * FROM faucet_settings WHERE guild_id = $1', [guildId]);
  if (existing.rows.length > 0) {
    return hydrateSettings(existing.rows[0]);
  }

  const defaults = {
    default_amounts: JSON.stringify(DEFAULT_AMOUNTS),
    min_amount: MIN_AMOUNT_DEFAULT,
    max_amount: MAX_AMOUNT_DEFAULT,
    daily_cap: DAILY_CAP_DEFAULT,
    cooldown_minutes: COOLDOWN_DEFAULT,
    max_requests_per_day: MAX_REQUESTS_DEFAULT,
    custom_amount_enabled: CUSTOM_ENABLED_DEFAULT
  };

  await poolRef.query(
    `INSERT INTO faucet_settings
      (guild_id, default_amounts, min_amount, max_amount, daily_cap, cooldown_minutes, max_requests_per_day, custom_amount_enabled)
     VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (guild_id) DO NOTHING`,
    [guildId, defaults.default_amounts, defaults.min_amount, defaults.max_amount, defaults.daily_cap, defaults.cooldown_minutes, defaults.max_requests_per_day, defaults.custom_amount_enabled]
  );

  return hydrateSettings({
    guild_id: guildId,
    ...defaults,
    is_enabled: true,
    is_paused: false
  });
}

async function upsertSettings(guildId, updates) {
  await ensureSettings(guildId);

  const setFragments = [];
  const values = [];
  let idx = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (key === 'default_amounts') {
      setFragments.push(`default_amounts = $${idx}::jsonb`);
    } else {
      setFragments.push(`${key} = $${idx}`);
    }
    values.push(value);
    idx += 1;
  }

  setFragments.push(`updated_at = NOW()`);
  values.push(guildId);

  await poolRef.query(
    `UPDATE faucet_settings SET ${setFragments.join(', ')} WHERE guild_id = $${idx}`,
    values
  );

  const refreshed = await poolRef.query('SELECT * FROM faucet_settings WHERE guild_id = $1', [guildId]);
  return hydrateSettings(refreshed.rows[0]);
}

function hydrateSettings(row) {
  if (!row) return null;
  let amounts = [];
  if (Array.isArray(row.default_amounts)) {
    amounts = row.default_amounts;
  } else if (row.default_amounts) {
    try {
      amounts = JSON.parse(row.default_amounts);
    } catch (error) {
      amounts = DEFAULT_AMOUNTS;
    }
  }

  return {
    ...row,
    default_amounts: parseAmountList(amounts, DEFAULT_AMOUNTS)
  };
}

function buildMenuEmbed({ interaction, settings, balance }) {
  const embed = new EmbedBuilder()
    .setTitle('💧 Faucet Monad DAO')
    .setColor(settings.is_paused ? '#F87171' : '#06B6D4')
    .setDescription('Solicita MON para testnet y recarga la billetera comunitaria.')
    .addFields(
      { name: 'Estado', value: settings.is_paused ? '⏸️ En pausa' : faucetReady ? '✅ Operativo' : '⚠️ Solo lectura', inline: true },
      { name: 'Saldo disponible', value: balance !== null ? `${formatMon(balance)}` : 'N/A', inline: true },
      { name: 'Wallet DAO', value: faucetPublicAddress ? `\`${shortenAddress(faucetPublicAddress)}\`` : 'No configurada', inline: true }
    )
    .setFooter({ text: 'Usa los botones para solicitar rápidamente' })
    .setTimestamp();

  const limitsText = [
    `• Min: ${formatMon(settings.min_amount ?? MIN_AMOUNT_DEFAULT)}`,
    `• Max: ${formatMon(settings.max_amount ?? MAX_AMOUNT_DEFAULT)}`,
    `• Diario: ${formatMon(settings.daily_cap ?? DAILY_CAP_DEFAULT)}`,
    `• Cooldown: ${(settings.cooldown_minutes ?? COOLDOWN_DEFAULT)} min`
  ].join('\n');

  embed.addFields({ name: 'Límites', value: limitsText, inline: false });

  if (faucetPublicAddress) {
    embed.addFields({
      name: 'Recargar faucet',
      value: `Envía MON a \`${faucetPublicAddress}\` y avisa en el canal.`
    });
  }

  return embed;
}

function buildInfoEmbed({ interaction, settings, balance, compact }) {
  const embed = new EmbedBuilder()
    .setTitle(compact ? '💧 Saldo actualizado' : '💧 Estado del Faucet Monad')
    .setColor('#0EA5E9')
    .addFields(
      { name: 'Saldo', value: balance !== null ? formatMon(balance) : 'N/A', inline: true },
      { name: 'Wallet', value: faucetPublicAddress ? `\`${shortenAddress(faucetPublicAddress)}\`` : 'No configurada', inline: true }
    )
    .setTimestamp();

  if (!compact) {
    embed.addFields(
      {
        name: 'Límites',
        value: `Min ${formatMon(settings.min_amount ?? MIN_AMOUNT_DEFAULT)} | Max ${formatMon(settings.max_amount ?? MAX_AMOUNT_DEFAULT)} | Diario ${formatMon(settings.daily_cap ?? DAILY_CAP_DEFAULT)}`
      },
      {
        name: 'Cooldown',
        value: `${settings.cooldown_minutes ?? COOLDOWN_DEFAULT} minutos`,
        inline: true
      }
    );
  }

  const amounts = getAllowedAmounts(settings);
  if (!compact && amounts.length) {
    embed.addFields({
      name: 'Montos rápidos',
      value: amounts.map(a => formatMon(a)).join(' • ')
    });
  }

  return embed;
}

function buildSuccessEmbed({ interaction, wallet, amount, txHash, balance }) {
  const embed = new EmbedBuilder()
    .setTitle('✅ Transferencia enviada')
    .setColor('#22C55E')
    .addFields(
      { name: 'Usuario', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Monto', value: formatMon(amount), inline: true },
      { name: 'Destino', value: `\`${shortenAddress(wallet)}\``, inline: true }
    )
    .setTimestamp();

  if (txHash) {
    const explorerUrl = buildExplorerUrl(txHash);
    embed.addFields({
      name: 'Tx Hash',
      value: explorerUrl ? `[${txHash.slice(0, 10)}...](${explorerUrl})` : `\`${txHash}\``
    });
  }

  if (balance !== null) {
    embed.addFields({
      name: 'Saldo restante',
      value: formatMon(balance),
      inline: true
    });
  }

  return embed;
}

function buildMenuComponents(settings) {
  const amounts = getAllowedAmounts(settings);
  const rows = [];

  if (amounts.length) {
    const buttons = amounts.slice(0, 10).map(amount =>
      new ButtonBuilder()
        .setCustomId(`faucet_amount${CUSTOM_ID_SEPARATOR}${amount}`)
        .setLabel(`${amount} MON`)
        .setStyle(ButtonStyle.Primary)
    );

    for (let i = 0; i < buttons.length; i += 5) {
      rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
    }
  }

  const controls = [];
  controls.push(
    new ButtonBuilder()
      .setCustomId(`faucet_amount${CUSTOM_ID_SEPARATOR}custom`)
      .setLabel('Monto personalizado')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!settings.custom_amount_enabled)
  );
  controls.push(
    new ButtonBuilder()
      .setCustomId('faucet_refresh')
      .setLabel('Actualizar saldo')
      .setStyle(ButtonStyle.Secondary)
  );
  controls.push(
    new ButtonBuilder()
      .setCustomId('faucet_info')
      .setLabel('Dirección')
      .setStyle(ButtonStyle.Secondary)
  );

  rows.push(new ActionRowBuilder().addComponents(controls));
  return rows;
}

function buildRequestModal({ amount }) {
  const modal = new ModalBuilder()
    .setCustomId(`faucet_modal${CUSTOM_ID_SEPARATOR}${amount ?? 'custom'}`)
    .setTitle('Solicitud de faucet');

  const walletInput = new TextInputBuilder()
    .setCustomId('faucet_wallet')
    .setLabel('Wallet Monad (0x...)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('0xABC...')
    .setRequired(true);

  const amountInput = new TextInputBuilder()
    .setCustomId('faucet_amount')
    .setLabel('Monto en MON')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ej: 10')
    .setRequired(!amount);

  if (amount) {
    amountInput.setValue(amount.toString());
  }

  modal.addComponents(
    new ActionRowBuilder().addComponents(walletInput),
    new ActionRowBuilder().addComponents(amountInput)
  );

  return modal;
}

async function getFaucetBalance() {
  if (!providerRef || !faucetWalletRef) return null;
  try {
    const balance = await providerRef.getBalance(faucetWalletRef.address);
    return parseFloat(ethers.formatEther(balance));
  } catch (error) {
    console.error('⚠️ No se pudo obtener saldo del faucet:', error.message);
    return null;
  }
}

async function getUserLimits(guildId, userId) {
  const result = await poolRef.query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE status = 'sent'), 0) AS sent_amount,
       COUNT(*) FILTER (WHERE status IN ('pending', 'sent')) AS request_count,
       MAX(created_at) FILTER (WHERE status IN ('pending', 'sent')) AS last_request
     FROM faucet_requests
     WHERE guild_id = $1
       AND user_id = $2
       AND created_at >= NOW() - INTERVAL '24 hours'`,
    [guildId, userId]
  );

  const row = result.rows[0] || {};
  return {
    sentAmount: parseFloat(row.sent_amount || '0'),
    requestCount: parseInt(row.request_count || '0', 10),
    lastRequestAt: row.last_request ? new Date(row.last_request) : null
  };
}

async function sendLogEntry(guildId, settings, embed) {
  if (!settings?.log_channel_id || !clientRef) return;
  try {
    const channel = await clientRef.channels.fetch(settings.log_channel_id).catch(() => null);
    if (channel) {
      await channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('⚠️ No se pudo enviar log del faucet:', error.message);
  }
}

function formatMon(value) {
  const num = Number(value || 0);
  return `${num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} MON`;
}

function shortenAddress(address) {
  if (!address) return 'N/A';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function sanitizeAmount(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 1e6) / 1e6;
}

function getAllowedAmounts(settings) {
  const list = settings?.default_amounts && settings.default_amounts.length
    ? settings.default_amounts
    : DEFAULT_AMOUNTS;
  const unique = Array.from(new Set(list.map(Number).filter(n => Number.isFinite(n) && n > 0)));
  return unique.sort((a, b) => a - b);
}

function parseAmountList(input, fallback = []) {
  if (!input) return fallback;

  const values = Array.isArray(input) ? input : String(input).split(/[,;\s]+/);
  const parsed = values
    .map(value => Number(value))
    .filter(num => Number.isFinite(num) && num > 0);

  return parsed.length ? parsed : fallback;
}

function buildConfigSummary(settings) {
  const lines = [
    `• Pausado: ${settings.is_paused ? 'Sí' : 'No'}`,
    `• Montos: ${getAllowedAmounts(settings).join(', ')}`,
    `• Min/Max: ${formatMon(settings.min_amount ?? MIN_AMOUNT_DEFAULT)} - ${formatMon(settings.max_amount ?? MAX_AMOUNT_DEFAULT)}`,
    `• Diario: ${formatMon(settings.daily_cap ?? DAILY_CAP_DEFAULT)}`,
    `• Cooldown: ${settings.cooldown_minutes ?? COOLDOWN_DEFAULT} min`,
    `• Máx solicitudes: ${settings.max_requests_per_day ?? MAX_REQUESTS_DEFAULT}`
  ];

  if (settings.log_channel_id) {
    lines.push(`• Canal logs: <#${settings.log_channel_id}>`);
  }
  if (settings.info_channel_id) {
    lines.push(`• Canal info: <#${settings.info_channel_id}>`);
  }

  return lines.join('\n');
}

function buildExplorerUrl(txHash) {
  if (!FAUCET_EXPLORER_BASE || !txHash) return null;
  return `${FAUCET_EXPLORER_BASE}/${txHash}`;
}

async function safeReply(interaction, payload) {
  try {
    await interaction.reply(payload);
  } catch (error) {
    console.error('Error enviando respuesta del faucet:', error);
  }
}

module.exports = {
  setup,
  initializeSchema,
  getSlashCommandBuilder,
  handleSlashCommand,
  handleButtonInteraction,
  handleModalSubmit,
  isFaucetButton,
  isFaucetModal
};

