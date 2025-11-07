#!/bin/bash
# Script de instalación de Nitter en Ubuntu 22.04
# Copia todo este archivo y pégalo en tu VPS, luego ejecuta: bash install-nitter.sh

set -e  # Salir si hay error

echo "🚀 Iniciando instalación de Nitter..."

# Paso 1: Actualizar sistema
echo "📦 Actualizando sistema..."
sudo apt update
sudo apt upgrade -y

# Paso 2: Instalar dependencias
echo "📦 Instalando dependencias..."
sudo apt install -y ca-certificates curl gnupg lsb-release

# Paso 3: Configurar Docker repository
echo "🐳 Configurando Docker..."
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Paso 4: Instalar Docker
echo "🐳 Instalando Docker..."
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verificar Docker
echo "✅ Verificando Docker..."
sudo docker --version
sudo docker compose version

# Paso 5: Configurar Redis
echo "📦 Instalando Redis..."
sudo apt install -y redis-server

# Configurar límite de memoria para Redis (importante para 1GB RAM)
echo "⚙️ Configurando Redis (límite de memoria)..."
sudo sed -i 's/^# maxmemory <bytes>/maxmemory 256mb/' /etc/redis/redis.conf
sudo sed -i 's/^# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf

# Verificar si maxmemory ya existe y reemplazarlo
if grep -q "^maxmemory" /etc/redis/redis.conf; then
    sudo sed -i 's/^maxmemory.*/maxmemory 256mb/' /etc/redis/redis.conf
else
    echo "maxmemory 256mb" | sudo tee -a /etc/redis/redis.conf
fi

if grep -q "^maxmemory-policy" /etc/redis/redis.conf; then
    sudo sed -i 's/^maxmemory-policy.*/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf
else
    echo "maxmemory-policy allkeys-lru" | sudo tee -a /etc/redis/redis.conf
fi

# Reiniciar Redis
sudo systemctl enable redis-server
sudo systemctl restart redis-server

# Verificar Redis
echo "✅ Verificando Redis..."
redis-cli ping

echo ""
echo "✅ Docker y Redis instalados correctamente!"
echo ""
echo "📝 PRÓXIMOS PASOS:"
echo "1. Obtén los tokens de Twitter (auth_token y ct0)"
echo "2. Crea el archivo docker-compose.yml con tu configuración"
echo "3. Inicia Nitter con: docker compose up -d"
echo ""
echo "📚 Ver INSTALL_NITTER.md para más detalles"



