import axios, { AxiosInstance } from 'axios';
import { ICandle, IMtfMarketData } from '../types.js';
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
   * Fetches real-time multi-timeframe (H1 + M15) candlestick data for EURUSDT from Binance API.
   */
  public async fetchMarketData(): Promise<IMtfMarketData> {
    logInfo(`Fetching MTF (H1 + M15) real-time market data for EUR/USDT from Binance API...`);
    
    try {
      const [h1Response, m15Response] = await Promise.all([
        this.apiClient.get('/klines', { params: { symbol: 'EURUSDT', interval: '1h', limit: 30 } }),
        this.apiClient.get('/klines', { params: { symbol: 'EURUSDT', interval: '15m', limit: 40 } })
      ]);

      const candlesH1 = this.parseBinanceData(h1Response.data);
      const candlesM15 = this.parseBinanceData(m15Response.data);

      console.log('\n=== DEBUG: LAST 3 CANDLES SENT TO LLM (H1) ===');
      console.log(JSON.stringify(candlesH1.slice(-3), null, 2));
      console.log('========================================\n');

      console.log('\n=== DEBUG: LAST 3 CANDLES SENT TO LLM (M15) ===');
      console.log(JSON.stringify(candlesM15.slice(-3), null, 2));
      console.log('========================================\n');

      return { candlesH1, candlesM15 };
    } catch (error) {
      logError('Error fetching MTF market data from Binance:', error);
      return { candlesH1: [], candlesM15: [] };
    }
  }

  private parseBinanceData(data: any): ICandle[] {
    // Strict guard clause: check if the response is an array
    if (!data || !Array.isArray(data)) {
      logError(`Binance API returned unexpected structure or error: ${JSON.stringify(data)}`);
      return [];
    }

    // Map Binance array-of-arrays to ICandle objects
    return data.map((candle: any[]) => ({
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
  }
}
