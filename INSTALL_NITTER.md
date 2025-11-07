# 🐦 Guía de Instalación de Nitter en Ubuntu 22.04

Esta guía te ayudará a instalar Nitter paso a paso en tu VPS con Ubuntu 22.04.

## 📋 Prerrequisitos

- VPS con Ubuntu 22.04 instalado
- Acceso SSH como root o usuario con sudo
- Mínimo 1GB RAM (recomendado 2GB)

## 🚀 Paso 1: Actualizar el Sistema

```bash
# Actualizar lista de paquetes
sudo apt update

# Actualizar sistema
sudo apt upgrade -y

# Reiniciar si es necesario (solo si actualizó el kernel)
sudo reboot
```

## 🐳 Paso 2: Instalar Docker

```bash
# Instalar dependencias
sudo apt install -y ca-certificates curl gnupg lsb-release

# Agregar clave GPG oficial de Docker
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Agregar repositorio de Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verificar instalación
sudo docker --version
sudo docker compose version
```

## ✅ Paso 3: Configurar Docker (Opcional pero Recomendado)

```bash
# Agregar tu usuario al grupo docker (para no usar sudo)
sudo usermod -aG docker $USER

# Reiniciar sesión SSH o ejecutar:
newgrp docker

# Probar sin sudo
docker run hello-world
```

## 📦 Paso 4: Instalar Redis (Requisito de Nitter)

```bash
# Instalar Redis
sudo apt install -y redis-server

# Configurar Redis para iniciar automáticamente
sudo systemctl enable redis-server

# Configurar límite de memoria (IMPORTANTE para 1GB RAM)
sudo nano /etc/redis/redis.conf
```

**En el archivo redis.conf, busca y modifica:**
```
maxmemory 256mb
maxmemory-policy allkeys-lru
```

**Guardar (Ctrl+O, Enter, Ctrl+X)**

```bash
# Reiniciar Redis
sudo systemctl restart redis-server

# Verificar que funciona
redis-cli ping
# Debería responder: PONG
```

## 🔧 Paso 5: Obtener Tokens de Sesión de Twitter

**Importante**: Nitter necesita cookies de sesión de Twitter desde 2024.

### Opción A: Desde Navegador (Más Fácil)

1. **Abre Twitter en tu navegador** (Chrome/Firefox)
2. **Abre DevTools** (F12)
3. Ve a la pestaña **Application** (Chrome) o **Storage** (Firefox)
4. En el menú izquierdo, ve a **Cookies** → **https://twitter.com**
5. **Busca estos cookies y copia sus valores**:
   - `auth_token`
   - `ct0` (CSRF token)
6. Los necesitarás para configurar Nitter

### Opción B: Script Automático (Avanzado)

Puedes usar herramientas como [Twitter Session Extractor](https://github.com/zedeus/nitter/wiki/Obtaining-twitter-session-tokens) (documentación oficial).

## 🐦 Paso 6: Instalar Nitter con Docker

```bash
# Crear directorio para Nitter
mkdir -p ~/nitter
cd ~/nitter

# Crear archivo de configuración
nano docker-compose.yml
```

**Pega esto en docker-compose.yml:**

```yaml
version: '3.8'

services:
  nitter:
    image: zedeus/nitter:latest
    container_name: nitter
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - NITTER_HOSTNAME=tu-dominio-o-ip
      - NITTER_SECRET=genera-un-secreto-aleatorio-aqui
      - REDIS_HOST=host.docker.internal
      - REDIS_PORT=6379
      - TWITTER_AUTH_TOKEN=tu-auth-token-de-twitter
      - TWITTER_CSRF_TOKEN=tu-ct0-token-de-twitter
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    container_name: nitter-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

**Guardar (Ctrl+O, Enter, Ctrl+X)**

**IMPORTANTE**: Reemplaza:
- `tu-dominio-o-ip`: Tu IP del VPS o dominio (ej: `123.45.67.89`)
- `genera-un-secreto-aleatorio-aqui`: Genera con: `openssl rand -hex 32`
- `tu-auth-token-de-twitter`: El valor de `auth_token` de las cookies
- `tu-ct0-token-de-twitter`: El valor de `ct0` de las cookies

## 🔑 Paso 7: Generar Secretos

```bash
# Generar secreto aleatorio para NITTER_SECRET
openssl rand -hex 32
```

Copia el resultado y úsalo en `docker-compose.yml`.

## 🚀 Paso 8: Iniciar Nitter

```bash
# Iniciar Nitter
docker compose up -d

# Ver logs
docker compose logs -f nitter
```

**Espera unos segundos y verifica que funcione:**

```bash
# Ver estado de los contenedores
docker compose ps

# Probar acceso local
curl http://localhost:8080
```

## 🌐 Paso 9: Acceder desde el Bot

Una vez que Nitter esté funcionando, necesitas:

1. **Tu IP del VPS o dominio**: `http://tu-ip:8080`
2. **Actualizar el bot** para usar tu instancia:

Edita `src/services/twitterRSS.js` y agrega tu instancia al principio de la lista:

```javascript
this.rssProviders = [
  'http://tu-ip-del-vps:8080',  // TU INSTANCIA PROPIA - PRIMERA
  'https://nitter.net',
  // ... resto de instancias
];
```

## 🔒 Paso 10: Configurar Firewall (Opcional pero Recomendado)

Si tienes firewall activo (ufw):

```bash
# Permitir puerto 8080
sudo ufw allow 8080/tcp

# Ver estado
sudo ufw status
```

## ✅ Verificación Final

1. **Accede desde navegador**: `http://tu-ip:8080/elonmusk`
2. **Prueba RSS feed**: `http://tu-ip:8080/elonmusk/rss`
3. **Verifica logs**: `docker compose logs nitter`

## 🐛 Solución de Problemas

### Nitter no inicia
```bash
# Ver logs detallados
docker compose logs nitter

# Verificar Redis
docker compose logs redis
redis-cli ping
```

### Error "Invalid session tokens"
- Verifica que los tokens de Twitter sean correctos
- Los tokens expiran, necesitas renovarlos periódicamente
- Consulta: https://github.com/zedeus/nitter/wiki/Obtaining-twitter-session-tokens

### Sin memoria suficiente
```bash
# Ver uso de memoria
free -h

# Si es necesario, aumenta swap
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## 📚 Recursos Adicionales

- [Nitter GitHub](https://github.com/zedeus/nitter)
- [Documentación Nitter](https://github.com/zedeus/nitter/#installation)
- [Obtener Tokens de Twitter](https://github.com/zedeus/nitter/wiki/Obtaining-twitter-session-tokens)



