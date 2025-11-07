# MONAD NFT TRADING BOT

🤖 Bot de Discord para tracking de NFTs en Monad Testnet/Mainnet + Cuentas de Twitter/X

## 🎯 Funcionalidades

- **Tracking de Proyectos NFT**: Configurar proyectos NFT para seguimiento
- **Notificaciones Automáticas**: Alertas de floor price, ventas, listados y volumen
- **Análisis en Tiempo Real**: Estadísticas y tendencias
- **Configuración Personalizada**: Alertas personalizables
- **🐦 Monitoreo de Twitter/X**: Alertas cuando cuentas específicas publiquen nuevos tweets

## 📋 Comandos

### NFTs (Básicos)
- `/setup project <nombre>` - Configurar proyecto
- `/status <proyecto>` - Ver estado
- `/projects` - Listar proyectos
- `/floor <proyecto> [período]` - Floor price
- `/volume <proyecto> [período]` - Volumen

### NFTs (Configuración)
- `/alerts setup <proyecto>` - Configurar alertas
- `/alerts list` - Ver alertas
- `/alerts disable <proyecto>` - Desactivar

### 🐦 Twitter/X
- `/twitter add <username> <canal>` - Agregar cuenta de Twitter para monitorear
- `/twitter remove <username>` - Remover cuenta de Twitter
- `/twitter list` - Listar cuentas monitoreadas
- `/twitter test <username>` - Probar acceso a una cuenta

### 📥 Submit Wallets
- `/wallet add <proyecto> <link>` - Registrar un proyecto y su canal de submit
- `/wallet list` - Ver proyectos registrados (lista alfabética)
- `/wallet edit <proyecto>` - Actualizar nombre o link
- `/wallet remove <proyecto>` - Eliminar un proyecto de la lista
- `/wallet channel_set <canal>` - Configurar canal donde se publica la lista
- `/wallet channel_clear` - Limpiar canal configurado

## 🚀 Instalación

```bash
cd C:\Monad\BotsDC\tradingnft
npm install
cp env.example .env
# Editar .env con credenciales
npm run dev
```

## 🔧 Variables de Entorno

```env
DISCORD_BOT_TOKEN=tu_token
DISCORD_CLIENT_ID=tu_client_id
DATABASE_URL=tu_railway_postgresql_url
MAGIC_EDEN_API_KEY=tu_api_key
MONAD_RPC_URL=https://rpc.monad.xyz
```

## 📊 Base de Datos (Railway PostgreSQL)

### NFTs
- `nft_projects` - Proyectos tracked
- `user_alerts` - Alertas de usuarios
- `price_history` - Historial de precios

### Twitter/X
- `twitter_accounts` - Cuentas de Twitter monitoreadas
- `twitter_history` - Historial de tweets enviados

## 📱 Ejemplos de Notificación

### NFT
```
🔥 Monad Punks - Floor Update
💰 Nuevo Floor: 0.35 ETH
📉 Cambio: -12.5% en 2h
📊 Volume: 8.5 ETH
```

### Twitter/X
```
🐦 Nuevo Tweet de @monad_io
[Texto del tweet con preview]
[Link al tweet original]
[Imagen si está disponible]
```

## 🐦 Configuración de Twitter/X

⚠️ **Importante**: El monitoreo de Twitter usa feeds RSS a través de instancias alternativas a Nitter. 

Ver documentación completa en [TWITTER_SETUP.md](TWITTER_SETUP.md) para:
- Configurar proveedores RSS
- Solución de problemas comunes
- Requisitos y limitaciones

