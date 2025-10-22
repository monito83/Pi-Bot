# MONAD NFT TRADING BOT

🤖 Bot de Discord para tracking de NFTs en Monad Testnet/Mainnet

## 🎯 Funcionalidades

- **Tracking de Proyectos**: Configurar proyectos NFT para seguimiento
- **Notificaciones Automáticas**: Alertas de floor price, ventas, listados y volumen
- **Análisis en Tiempo Real**: Estadísticas y tendencias
- **Configuración Personalizada**: Alertas personalizables

## 📋 Comandos

### Básicos
- `/setup project <nombre>` - Configurar proyecto
- `/status <proyecto>` - Ver estado
- `/projects` - Listar proyectos
- `/floor <proyecto> [período]` - Floor price
- `/volume <proyecto> [período]` - Volumen

### Configuración
- `/alerts setup <proyecto>` - Configurar alertas
- `/alerts list` - Ver alertas
- `/alerts disable <proyecto>` - Desactivar

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

- `nft_projects` - Proyectos tracked
- `user_alerts` - Alertas de usuarios
- `price_history` - Historial de precios

## 📱 Ejemplo Notificación

```
🔥 Monad Punks - Floor Update
💰 Nuevo Floor: 0.35 ETH
📉 Cambio: -12.5% en 2h
📊 Volume: 8.5 ETH
```

