# 🐦 Configuración de Monitoreo de Twitter/X

Este bot ahora incluye la funcionalidad de monitorear cuentas de Twitter/X y enviar alertas automáticas a Discord cuando se publiquen nuevos tweets.

## ⚠️ Importante: Proveedores RSS

El bot usa Nitter (https://nitter.net) y otras instancias RSS para acceder a Twitter sin API oficial. El bot está configurado con varias instancias que rotan automáticamente.

### Proveedores RSS Configurados

El bot viene pre-configurado con:
1. **https://nitter.net** - Instancia principal de Nitter (FUNCIONANDO ✅)
2. **https://nitter.it** - Instancia alternativa
3. **https://nitter.unixfox.eu** - Instancia alternativa

El bot rota automáticamente entre estas instancias si una falla.

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

### Error: "No se pudo acceder a la cuenta"
- Verifica que el nombre de usuario sea correcto
- Revisa que los proveedores RSS estén funcionando
- Intenta cambiar a otro proveedor en `twitterRSS.js`

### No se reciben notificaciones
- Verifica que la cuenta esté activa en `/twitter list`
- Revisa los logs del bot para ver errores
- Asegúrate que el canal de Discord tenga permisos correctos

### Proveedor RSS no funciona
1. Actualiza la lista de proveedores en `twitterRSS.js`
2. Reinicia el bot
3. Prueba con `/twitter test`

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

