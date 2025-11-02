# 🐦 Configuración de Monitoreo de Twitter/X

Este bot ahora incluye la funcionalidad de monitorear cuentas de Twitter/X y enviar alertas automáticas a Discord cuando se publiquen nuevos tweets.

## ⚠️ Importante: Proveedores RSS

El bot usa Nitter (https://nitter.net) y otras instancias RSS para acceder a Twitter sin API oficial. El bot está configurado con varias instancias que rotan automáticamente.

### Proveedores RSS Configurados

El bot viene pre-configurado con múltiples instancias de Nitter (basadas en [status.d420.de](https://status.d420.de/)):
1. **https://nitter.net** - Instancia principal (85% uptime promedio)
2. **https://nitter.it** - Instancia alternativa
3. **https://d420.de/nitter** - Instancia alternativa (Healthy)
4. **https://nitter.privacyredirect.com** - Instancia alternativa (Healthy)
5. **https://nitter.unixfox.eu** - Instancia alternativa

El bot rota automáticamente entre estas instancias si una falla.

**⚠️ IMPORTANTE**: Desde 2024, Nitter requiere [tokens de sesión reales de Twitter](https://github.com/zedeus/nitter/), lo que significa que las instancias públicas tienen **rate limits estrictos**. Los 429 (Too Many Requests) son normales con uso intensivo.

### Instancia Propia (Recomendado para Producción)

Para uso intensivo, se recomienda [hostear tu propia instancia de Nitter](https://github.com/zedeus/nitter/#installation):
- ✅ **100% FREE** - No pagas por tokens ni APIs
- ✅ Control total sobre rate limits
- ✅ Mayor estabilidad (no dependes de instancias públicas)
- ⚠️ Requiere: Docker + Redis + tokens de sesión de una cuenta de Twitter gratuita

**¿Qué son los "tokens de sesión"?**
Son cookies de tu cuenta de Twitter. Los extraes de tu navegador una vez (proceso de 2 minutos) y los usas gratis. La cuenta de Twitter es gratuita, no pagas nada.

**Costos reales:**
- Nitter + Redis: **GRATIS** (open source)
- Hosting (servidor para correr Docker): **~$5-10/mes** (VPS como DigitalOcean/Linode)
- Tokens de Twitter: **GRATIS** (cuenta personal normal)
- API de Twitter: **NO NECESARIA** (Nitter funciona sin API oficial)

Ver instrucciones completas: https://github.com/zedeus/nitter/#installation

### Agregar Más Instancias

Si quieres agregar más instancias RSS, edita `src/services/twitterRSS.js` y actualiza la lista:

```javascript
this.rssProviders = [
  'https://nitter.net',   // Ya incluida
  'https://nitter.it',    // Ya incluida
  'https://nitter.unixfox.eu', // Ya incluida
  'https://tu-nueva-instancia.com', // Agrega esta
];
```

## 📝 Comandos Disponibles

### `/twitter add <username> <canal>`
Agrega una cuenta de Twitter para monitorear. Ejemplo:
```
/twitter add monad_io #notificaciones
```

### `/twitter remove <username>`
Remueve una cuenta de Twitter del monitoreo.

### `/twitter list`
Muestra todas las cuentas de Twitter monitoreadas en el servidor.

### `/twitter test <username>`
Prueba si se puede acceder a una cuenta de Twitter.

## 🔧 Funcionamiento

- **Verificación automática**: Cada 3 minutos el bot verifica todos los tweets de las cuentas configuradas
- **Notificaciones**: Solo envía tweets nuevos (no reenvía tweets antiguos)
- **Historial**: Guarda todos los tweets enviados para evitar duplicados
- **Embeds**: Las notificaciones incluyen texto, imágenes y link al tweet original

## 🚨 Solución de Problemas

### Error: "No se pudo acceder a la cuenta @username"
- ✅ **Primero**: Verifica que el nombre de usuario sea correcto (sin @)
- ✅ **Segundo**: Asegúrate que la cuenta sea pública en Twitter
- ⚠️ **Si persiste**: Es probable que todas las instancias públicas estén con rate limit (429)
- 💡 **Solución**: Configura tu propia instancia de Nitter o espera unos minutos

### Error 429 (Rate Limit)
**Este es NORMAL** con instancias públicas de Nitter:
- Las instancias públicas comparten su quota entre todos los usuarios
- El bot rota automáticamente entre 5 instancias
- Si todas fallan, espera 5-10 minutos y prueba de nuevo
- Para producción: hostea tu propia instancia de Nitter

### No se reciben notificaciones
- Verifica que la cuenta esté activa en `/twitter list`
- Revisa los logs del bot en Railway para ver errores
- Asegúrate que el canal de Discord tenga permisos correctos
- Verifica que la cuenta haya publicado tweets desde que la agregaste

### Proveedor RSS no funciona / Todas fallan
1. Consulta [status.d420.de](https://status.d420.de/) para ver instancias disponibles
2. Actualiza la lista de proveedores en `twitterRSS.js` si es necesario
3. Reinicia el bot: `git push` y espera el deployment
4. Prueba con `/twitter test elonmusk` (cuenta pública conocida)

## 📊 Estructura de Base de Datos

El bot crea automáticamente dos tablas:

- **twitter_accounts**: Almacena las cuentas monitoreadas
- **twitter_history**: Historial de tweets enviados

## 🎯 Limitaciones Actuales

1. **Dependencia de proveedores RSS**: Sin Nitter oficial, dependes de alternativas
2. **Rate limits**: Los proveedores RSS pueden tener límites de requests
3. **Retraso**: Las verificaciones son cada 3 minutos (no tiempo real)
4. **Medios**: Las imágenes se muestran si están disponibles en el RSS

## 💡 Próximas Mejoras

- [ ] Soporte para API oficial de Twitter/X
- [ ] Webhooks para notificaciones más rápidas
- [ ] Filtrado de tweets por palabras clave
- [ ] Soporte para mentions y respuestas
- [ ] Estadísticas de engagement

## 🤝 Contribuir

Si encuentras proveedores RSS alternativos que funcionen, por favor actualiza la lista en `twitterRSS.js` y comparte con la comunidad.

