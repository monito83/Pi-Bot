const axios = require('axios');

class MagicEdenService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api-mainnet.magiceden.io/v2';
    this.headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  // Obtener información de una colección
  async getCollection(contractAddress) {
    try {
      const response = await axios.get(`${this.baseURL}/collections/${contractAddress}`, {
        headers: this.headers
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching collection:', error.response?.data || error.message);
      return null;
    }
  }

  // Obtener estadísticas de una colección
  async getCollectionStats(contractAddress) {
    try {
      const response = await axios.get(`${this.baseURL}/collections/${contractAddress}/stats`, {
        headers: this.headers
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching collection stats:', error.response?.data || error.message);
      return null;
    }
  }

  // Obtener listados de una colección
  async getListings(contractAddress, limit = 20) {
    try {
      const response = await axios.get(`${this.baseURL}/collections/${contractAddress}/listings`, {
        headers: this.headers,
        params: {
          limit,
          sortBy: 'priceAsc'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching listings:', error.response?.data || error.message);
      return null;
    }
  }

  // Obtener ventas recientes
  async getRecentSales(contractAddress, limit = 20) {
    try {
      const response = await axios.get(`${this.baseURL}/collections/${contractAddress}/activities`, {
        headers: this.headers,
        params: {
          limit,
          activityType: 'sale'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching recent sales:', error.response?.data || error.message);
      return null;
    }
  }

  // Obtener datos completos de un proyecto
  async getProjectData(contractAddress) {
    try {
      const [stats, listings, sales] = await Promise.all([
        this.getCollectionStats(contractAddress),
        this.getListings(contractAddress, 10),
        this.getRecentSales(contractAddress, 10)
      ]);

      if (!stats) return null;

      // Calcular floor price desde los listados
      let floorPrice = null;
      if (listings && listings.length > 0) {
        floorPrice = parseFloat(listings[0].price);
      }

      // Calcular volumen de las últimas 24h
      let volume24h = 0;
      let salesCount = 0;
      let avgSalePrice = 0;

      if (sales && sales.length > 0) {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const recentSales = sales.filter(sale => {
          const saleDate = new Date(sale.blockTime * 1000);
          return saleDate >= yesterday;
        });

        salesCount = recentSales.length;
        volume24h = recentSales.reduce((sum, sale) => sum + parseFloat(sale.price), 0);
        avgSalePrice = salesCount > 0 ? volume24h / salesCount : 0;
      }

      return {
        floor_price: floorPrice,
        volume_24h: volume24h,
        sales_count: salesCount,
        listings_count: listings ? listings.length : 0,
        avg_sale_price: avgSalePrice,
        total_supply: stats.totalSupply || 0,
        listed_count: stats.listedCount || 0,
        floor_price_24h_change: stats.floorPrice24hChange || 0,
        volume_24h_change: stats.volume24hChange || 0
      };
    } catch (error) {
      console.error('Error getting project data:', error);
      return null;
    }
  }

  // Buscar colecciones por nombre
  async searchCollections(query, limit = 10) {
    try {
      const response = await axios.get(`${this.baseURL}/collections/search`, {
        headers: this.headers,
        params: {
          q: query,
          limit
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching collections:', error.response?.data || error.message);
      return null;
    }
  }

  // Obtener información de un NFT específico
  async getNFTInfo(contractAddress, tokenId) {
    try {
      const response = await axios.get(`${this.baseURL}/tokens/${contractAddress}/${tokenId}`, {
        headers: this.headers
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching NFT info:', error.response?.data || error.message);
      return null;
    }
  }

  // Obtener historial de precios (simulado - Magic Eden no tiene endpoint directo)
  async getPriceHistory(contractAddress, days = 7) {
    try {
      // Por ahora retornamos datos simulados
      // En el futuro se puede implementar con datos históricos almacenados
      const history = [];
      const now = new Date();
      
      for (let i = days; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        history.push({
          date: date.toISOString().split('T')[0],
          floor_price: Math.random() * 0.5 + 0.1,
          volume: Math.random() * 10 + 1,
          sales_count: Math.floor(Math.random() * 20) + 1
        });
      }
      
      return history;
    } catch (error) {
      console.error('Error getting price history:', error);
      return [];
    }
  }
}

module.exports = MagicEdenService;



