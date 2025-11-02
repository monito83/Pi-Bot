# 🚀 Guía de Despliegue en Railway

Esta guía explica cómo desplegar los cambios del bot en Railway.

## 📋 Pasos para Subir Cambios a Railway

Railway detecta automáticamente los cambios cuando haces push a tu repositorio de GitHub.

### 1️⃣ Verificar Estado del Git

```bash
cd C:\Monad\BotsDC\tradingnft
git status
```

Deberías ver todos los archivos modificados y nuevos.

### 2️⃣ Agregar Cambios

```bash
git add .
```

O agregar archivos específicos:
```bash
git add src/
git add database/
git add package.json
git add README.md
git add TWITTER_SETUP.md
git add DEPLOY.md
```

### 3️⃣ Crear Commit

```bash
git commit -m "Agregar funcionalidad de monitoreo de Twitter/X"
```

### 4️⃣ Subir a GitHub

```bash
git push
```

### 5️⃣ Railway Despliega Automáticamente

Railway detecta el push y:
- ✅ Inicia el build automáticamente
- ✅ Instala dependencias (`npm install`)
- ✅ Ejecuta el bot (`npm start`)
- ✅ Las tablas de Twitter se crean automáticamente

## ⚠️ Importante: Base de Datos

**NO necesitas crear las tablas manualmente**. El bot las crea automáticamente al iniciar.

Si por alguna razón quieres verificar, conecta a PostgreSQL en Railway y ejecuta:
```sql
-- Verificar que las tablas existen
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'twitter_%';
```

## 🔍 Verificar Despliegue

### En Railway:
1. Ve a tu proyecto en Railway
2. Ve a la sección "Deployments"
3. Verifica que el último deployment sea exitoso (✅ green)

### En Discord:
1. Reinicia el bot o espera a que se recargue automáticamente
2. Prueba el comando: `/twitter test monad_io`
3. Si funciona, verás una respuesta exitosa

### Ver Logs:
En Railway, ve a "View Logs" para ver los logs en tiempo real:

```
🔥 LOG 1: Starting to load modules...
🐦 Twitter RSS service initialized
✅ Twitter tables initialized
...
```

## 🛠️ Solución de Problemas

### Error: "Cannot find module 'xml2js'"
- Railway no instaló la dependencia nueva
- Ve a Railway → Settings → Manual Deploy → Deploy

### Error: "CREATE TABLE already exists"
- Las tablas ya existen, es normal
- El bot usa `CREATE TABLE IF NOT EXISTS`

### El bot no responde
- Verifica los logs en Railway
- Verifica que `DISCORD_BOT_TOKEN` esté configurado
- Verifica que el bot tenga permisos en tu servidor

### Las notificaciones no llegan
- Verifica que la cuenta de Twitter esté correctamente configurada
- Usa `/twitter test username` para probar
- Verifica que Nitter esté funcionando: https://nitter.net

## 📝 Comandos Útiles

### Ver estado de archivos modificados:
```bash
git status
```

### Ver diferencias:
```bash
git diff
```

### Ver commits recientes:
```bash
git log --oneline -5
```

### Rollback si algo sale mal:
```bash
git revert HEAD
git push
```

## 🔗 Enlaces Útiles

- **Railway Dashboard**: https://railway.app
- **Railway Docs**: https://docs.railway.app
- **Nitter.net**: https://nitter.net
- **GitHub**: (Tu repo enlazado a Railway)

## ✨ Automatización

Una vez configurado, cada push a tu rama principal:
```
git push → GitHub → Railway detecta → Build → Deploy → ✅ Bot actualizado
```

**No necesitas hacer nada en Railway manualmente**, excepto verificar los logs si hay problemas.

