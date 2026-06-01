import axios, { AxiosInstance } from 'axios';
import { ICandle } from '../types.js';
import { logInfo, logError } from '../utils/logger.js';

export class MarketDataService {
  private apiClient: AxiosInstance;

  constructor() {
    // Using Binance API as an example.
    // For Polygon.io, you could set baseURL: 'https://api.polygon.io' and pass apiKey in params.
    this.apiClient = axios.create({
      baseURL: 'https://api.binance.com/api/v3',
      timeout: 10000,
    });
  }

  /**
   * Fetches candlestick data for a given symbol and interval.
   * @param symbol Currency pair, e.g., 'EURUSDT'
   * @param interval Timeframe interval, e.g., '15m'
   * @param limit Number of candles
   */
  public async fetchMarketData(symbol: string = 'EURUSDT', interval: string = '15m', limit: number = 20): Promise<ICandle[]> {
    try {
      logInfo(`Fetching market data for ${symbol} (${interval})...`);
      const response = await this.apiClient.get('/klines', {
        params: { symbol, interval, limit }
      });

      return response.data.map((candle: any[]) => ({
        timestamp: candle[0], // Open time
        time: new Date(candle[0]).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
      }));
    } catch (error) {
      logError('Error fetching market data:', error);
      return [];
    }
  }
}
