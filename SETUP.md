# SETUP GUIDE - MONAD NFT TRADING BOT

## 🚀 Configuración Inicial

### 1. Discord Bot Setup

1. Ve a [Discord Developer Portal](https://discord.com/developers/applications)
2. Crea una nueva aplicación
3. Ve a "Bot" y crea un bot
4. Copia el **Token** del bot
5. Ve a "OAuth2 > General" y copia el **Client ID**
6. Invita el bot a tu servidor con estos permisos:
   - Send Messages
   - Use Slash Commands
   - Embed Links
   - Read Message History

### 2. Supabase Setup

1. Crea una cuenta en [Supabase](https://supabase.com)
2. Crea un nuevo proyecto
3. Ve a Settings > API y copia:
   - **Project URL**
   - **anon public key**
   - **service_role secret key**
4. Ejecuta el script `database/schema.sql` en el SQL Editor

### 3. Magic Eden API (Opcional)

1. Ve a [Magic Eden API](https://magiceden.io/api)
2. Registra tu aplicación
3. Obtén tu API key

### 4. Configuración Local

```bash
cd C:\Monad\BotsDC\tradingnft
npm install
cp env.example .env
```

Edita `.env` con tus credenciales:

```env
DISCORD_BOT_TOKEN=tu_token_aqui
DISCORD_CLIENT_ID=tu_client_id_aqui
DISCORD_GUILD_ID=tu_guild_id_aqui
SUPABASE_URL=tu_supabase_url_aqui
SUPABASE_ANON_KEY=tu_supabase_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
MAGIC_EDEN_API_KEY=tu_api_key_aqui
MONAD_RPC_URL=https://rpc.monad.xyz
```

### 5. Ejecutar el Bot

```bash
npm run dev  # Desarrollo
npm start    # Producción
```

## 🔧 Comandos Disponibles

Una vez que el bot esté funcionando, puedes usar estos comandos:

- `/setup project Monad Punks contract 0x1234...` - Configurar proyecto
- `/status Monad Punks` - Ver estado
- `/projects` - Listar proyectos
- `/floor Monad Punks 24h` - Ver floor price
- `/volume Monad Punks 7d` - Ver volumen
- `/alerts setup Monad Punks` - Configurar alertas
- `/alerts list` - Ver alertas
- `/alerts disable Monad Punks` - Desactivar alertas

## 🚀 Deployment

### Vercel

1. Instala Vercel CLI: `npm i -g vercel`
2. Ejecuta: `vercel --prod`
3. Configura las variables de entorno en Vercel Dashboard

### Railway

1. Instala Railway CLI: `npm i -g @railway/cli`
2. Ejecuta: `railway login`
3. Ejecuta: `railway link`
4. Ejecuta: `railway up`
5. Configura las variables de entorno en Railway Dashboard

## 📊 Monitoreo

El bot ejecuta tracking automático cada 5 minutos y envía notificaciones cuando:
- Floor price cambia más del 5%
- Volume supera el threshold configurado
- Se detectan nuevas ventas o listados

## 🔍 Troubleshooting

### Bot no responde
- Verifica que el token sea correcto
- Asegúrate de que el bot tenga permisos en el servidor
- Revisa los logs en la consola

### Error de base de datos
- Verifica las credenciales de Supabase
- Asegúrate de que el schema esté ejecutado
- Revisa los permisos RLS

### Comandos no aparecen
- Espera unos minutos después del deploy
- Usa `/` para ver los comandos disponibles
- Verifica que el bot esté en el servidor correcto

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs del bot
2. Verifica la configuración de variables de entorno
3. Asegúrate de que todas las APIs estén funcionando
4. Consulta la documentación de Discord.js y Supabase




