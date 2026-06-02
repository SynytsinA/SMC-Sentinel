import axios, { AxiosInstance } from 'axios';
import { ICandle } from '../types.js';
import { logInfo, logError } from '../utils/logger.js';

export class MarketDataService {
  private apiClient: AxiosInstance;

  constructor() {
    this.apiClient = axios.create({
      baseURL: 'https://api.binance.com/api/v3',
      timeout: 10000,
    });
  }

  /**
   * Fetches real-time 15-minute candlestick data for EURUSDT from Binance API.
   * @param limit Number of recent candles to return (default 50)
   */
  public async fetchMarketData(limit: number = 50): Promise<ICandle[]> {
    try {
      logInfo(`Fetching real-time market data for EUR/USDT from Binance API...`);

      const response = await this.apiClient.get('/klines', {
        params: {
          symbol: 'EURUSDT',
          interval: '15m',
          limit: limit
        }
      });

      // Strict guard clause: check if the response is an array
      if (!response.data || !Array.isArray(response.data)) {
        logError(`Binance API returned unexpected structure or error: ${JSON.stringify(response.data)}`);
        return [];
      }

      // Map Binance array-of-arrays to ICandle objects
      const candles: ICandle[] = response.data.map((candle: any[]) => ({
        timestamp: candle[0],
        time: new Date(candle[0]).toLocaleTimeString('uk-UA', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Kyiv'
        }),
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
      }));

      return candles;
    } catch (error) {
      logError('Error fetching market data from Binance:', error);
      return [];
    }
  }
}
