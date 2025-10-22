# 🚀 QUICK START - MONAD NFT TRADING BOT

## ⚡ Inicio Rápido (5 minutos)

### 1. 📋 Prerrequisitos
- Node.js 18+ instalado
- Cuenta de Discord con permisos de administrador
- Cuenta de Supabase
- Token de Magic Eden API (opcional)

### 2. 🔧 Instalación
```bash
cd C:\Monad\BotsDC\tradingnft
npm install
```

### 3. ⚙️ Configuración
```bash
# Copiar archivo de configuración
cp env.example .env

# Editar .env con tus credenciales
notepad .env
```

**Variables mínimas requeridas:**
```env
DISCORD_BOT_TOKEN=tu_token_del_bot
DISCORD_CLIENT_ID=tu_client_id
DATABASE_URL=tu_railway_postgresql_url
```

### 4. 🗄️ Base de Datos
1. En Railway, agrega un servicio **PostgreSQL**
2. Copia la **DATABASE_URL** generada
3. Ejecuta el script `database/postgresql-schema.sql` en la consola SQL

### 5. 🤖 Ejecutar Bot
```bash
npm run dev
```

### 6. ✅ Verificar Funcionamiento
En Discord, escribe `/` y deberías ver los comandos disponibles:
- `/setup project Monad Punks contract 0x1234...`
- `/projects`
- `/status Monad Punks`

## 🎯 Primeros Pasos

### Configurar tu primer proyecto:
```
/setup project Monad Punks contract 0x1234567890abcdef1234567890abcdef12345678
```

### Ver el estado:
```
/status Monad Punks
```

### Configurar alertas:
```
/alerts setup Monad Punks types floor,volume
```

## 🔍 Troubleshooting Rápido

### ❌ Bot no responde
- Verifica que el token sea correcto
- Asegúrate de que el bot esté en el servidor
- Revisa la consola para errores

### ❌ Comandos no aparecen
- Espera 2-3 minutos después del inicio
- Verifica que el bot tenga permisos de "Use Slash Commands"

### ❌ Error de base de datos
- Verifica las credenciales de Supabase
- Asegúrate de que el schema esté ejecutado
- Revisa los permisos RLS

## 📚 Comandos Principales

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/setup` | Configurar proyecto | `/setup project Monad Punks contract 0x1234...` |
| `/status` | Ver estado | `/status Monad Punks` |
| `/projects` | Listar proyectos | `/projects` |
| `/floor` | Floor price | `/floor Monad Punks 24h` |
| `/volume` | Volumen | `/volume Monad Punks 7d` |
| `/alerts setup` | Configurar alertas | `/alerts setup Monad Punks` |
| `/alerts list` | Ver alertas | `/alerts list` |

## 🚀 Deployment

### Vercel (Recomendado)
```bash
npm i -g vercel
vercel --prod
```

### Railway
```bash
npm i -g @railway/cli
railway login
railway link
railway up
```

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs en la consola
2. Verifica la configuración en `.env`
3. Consulta `SETUP.md` para detalles completos
4. Revisa la documentación de Discord.js y Supabase

---

**¡Listo! Tu bot de NFT tracking está funcionando.** 🎉

