const axios = require('axios');
const xml2js = require('xml2js');

/**
 * Servicio para monitorear cuentas de Twitter usando feeds RSS
 * Usa alternativas a Nitter como twiiit.me, rxddit.com u otros servicios RSS
 */
class TwitterRSSService {
  constructor() {
    // Instancias de Nitter disponibles
    // El usuario reporta que nitter.net está funcionando
    this.rssProviders = [
      'https://nitter.net',   // Instancia oficial de Nitter - ACTUALIZADA 2024
      'https://nitter.it',    // Instancia alternativa
      'https://nitter.unixfox.eu', // Instancia alternativa
      // Agregar más instancias según estén disponibles
    ];
    
    this.currentProviderIndex = 0;
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml'
    };
  }

  /**
   * Cambiar a la siguiente instancia RSS si la actual falla
   */
  rotateProvider() {
    this.currentProviderIndex = (this.currentProviderIndex + 1) % this.rssProviders.length;
    console.log(`🔄 Rotando a proveedor RSS: ${this.rssProviders[this.currentProviderIndex]}`);
  }

  /**
   * Obtener el provider actual
   */
  getCurrentProvider() {
    return this.rssProviders[this.currentProviderIndex];
  }

  /**
   * Obtener feed RSS de una cuenta de Twitter
   * @param {string} username - Nombre de usuario de Twitter (sin @)
   * @returns {Promise<Array>} Array de tweets
   */
  async getTwitterFeed(username) {
    if (!username) {
      throw new Error('Username is required');
    }

    // Limpiar @ si está presente
    username = username.replace('@', '').trim();

    let lastError;
    const maxAttempts = this.rssProviders.length;

    // Intentar con cada proveedor hasta que uno funcione
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const provider = this.getCurrentProvider();
      const rssUrl = `${provider}/${username}/rss`;

      try {
        console.log(`📡 Intentando RSS desde: ${rssUrl}`);
        
        const response = await axios.get(rssUrl, {
          headers: this.headers,
          timeout: 10000
        });

        if (response.status === 200 && response.data) {
          // Parsear XML RSS
          const parser = new xml2js.Parser({
            explicitArray: false,
            ignoreAttrs: false
          });

          const result = await parser.parseStringPromise(response.data);
          
          // Extraer items del feed
          if (result && result.rss && result.rss.channel && result.rss.channel.item) {
            const items = Array.isArray(result.rss.channel.item) 
              ? result.rss.channel.item 
              : [result.rss.channel.item];
            
            const tweets = items.map(item => this.parseTweetItem(item, username));
            console.log(`✅ RSS exitoso: ${tweets.length} tweets obtenidos de @${username}`);
            return tweets;
          }
        }

        throw new Error('Invalid RSS response');

      } catch (error) {
        lastError = error;
        console.error(`❌ Error con proveedor ${provider}:`, error.message);
        this.rotateProvider();
      }
    }

    console.error(`❌ Todos los proveedores RSS fallaron para @${username}`);
    throw new Error(`Failed to fetch Twitter feed: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Parsear un item del RSS a formato de tweet
   */
  parseTweetItem(item, username) {
    try {
      // Extraer link del tweet
      const tweetUrl = item.link || '';
      const tweetId = this.extractTweetId(tweetUrl);
      
      // Extraer texto del tweet
      const description = item.description || item['content:encoded'] || '';
      const cleanText = this.cleanTweetText(description);
      
      // Extraer fecha
      const pubDate = item.pubDate || item.published || new Date().toISOString();
      const timestamp = new Date(pubDate);
      
      // Extraer imagen si está presente
      const imageUrl = this.extractImageUrl(description);

      return {
        id: tweetId,
        username: username,
        text: cleanText,
        url: tweetUrl,
        timestamp: timestamp,
        date: timestamp.toISOString(),
        imageUrl: imageUrl,
        raw: item
      };
    } catch (error) {
      console.error('Error parsing tweet item:', error);
      return null;
    }
  }

  /**
   * Extraer ID del tweet desde la URL
   */
  extractTweetId(url) {
    if (!url) return null;
    
    // Formato: https://twitter.com/username/status/1234567890
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Limpiar texto del tweet HTML
   */
  cleanTweetText(html) {
    if (!html) return '';
    
    // Remover etiquetas HTML
    let text = html.replace(/<[^>]*>/g, '');
    
    // Decodificar entidades HTML
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    
    // Limpiar espacios múltiples
    text = text.replace(/\s+/g, ' ').trim();
    
    // Limitar longitud
    if (text.length > 500) {
      text = text.substring(0, 497) + '...';
    }
    
    return text;
  }

  /**
   * Extraer URL de imagen del tweet
   */
  extractImageUrl(html) {
    if (!html) return null;
    
    // Buscar etiqueta img
    const imgMatch = html.match(/<img[^>]+src="([^"]+)"/i);
    if (imgMatch && imgMatch[1]) {
      const src = imgMatch[1];
      // Solo retornar si es una imagen de Twitter
      if (src.includes('pbs.twimg.com') || src.includes('pbs.twimg.com')) {
        return src;
      }
    }
    
    return null;
  }

  /**
   * Verificar si un feed RSS está disponible
   */
  async testRSSProvider(provider) {
    try {
      const testUrl = `${provider}/twitter/rss`;
      const response = await axios.get(testUrl, {
        headers: this.headers,
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtener el tweet más reciente de una cuenta
   */
  async getLatestTweet(username) {
    const tweets = await this.getTwitterFeed(username);
    return tweets && tweets.length > 0 ? tweets[0] : null;
  }

  /**
   * Verificar si hay nuevos tweets comparando con el último conocido
   */
  async getNewTweets(username, lastKnownTweetId) {
    const tweets = await this.getTwitterFeed(username);
    
    if (!tweets || tweets.length === 0) {
      return [];
    }

    // Si no hay tweet conocido, devolver solo el más reciente
    if (!lastKnownTweetId) {
      return [tweets[0]];
    }

    // Filtrar tweets nuevos (IDs más altos = más recientes)
    const newTweets = [];
    for (const tweet of tweets) {
      if (tweet.id && parseInt(tweet.id) > parseInt(lastKnownTweetId)) {
        newTweets.push(tweet);
      } else {
        break; // Tweets ordenados por fecha, no necesitamos seguir
      }
    }

    return newTweets.reverse(); // Enviar en orden cronológico
  }

  /**
   * Formatear tweet para Discord
   */
  formatTweetForDiscord(tweet) {
    return {
      title: `🐦 Nuevo Tweet de @${tweet.username}`,
      url: tweet.url,
      description: tweet.text,
      timestamp: tweet.timestamp,
      image: tweet.imageUrl ? { url: tweet.imageUrl } : undefined,
      color: 0x1DA1F2 // Color de Twitter/X
    };
  }
}

module.exports = TwitterRSSService;

