import axios, { AxiosInstance } from 'axios';
import { ICandle, IMtfMarketData } from '../types.js';
import { logInfo, logError } from '../utils/logger.js';

export class MarketDataService {
  private apiClient: AxiosInstance;

  constructor() {
    this.apiClient = axios.create({
      baseURL: 'https://api.binance.com/api/v3',
      timeout: 30000,
    });
  }

  /**
   * Fetches real-time multi-timeframe (H1 + M15) candlestick data for EURUSDT from Binance API.
   */
  public async fetchMarketData(): Promise<IMtfMarketData> {
    logInfo(`Fetching MTF (H1 + M15) real-time market data for EUR/USDT from Binance API...`);
    
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const [h1Response, m15Response] = await Promise.all([
          this.apiClient.get('/klines', { params: { symbol: 'EURUSDT', interval: '1h', limit: 30 } }),
          this.apiClient.get('/klines', { params: { symbol: 'EURUSDT', interval: '15m', limit: 40 } })
        ]);

        // Binance returns the currently forming candle as the last element.
        // We slice(0, -1) to remove it, ensuring the LLM only sees FULLY CLOSED candles.
        const fullyClosedH1 = this.parseBinanceData(h1Response.data).slice(0, -1);
        const fullyClosedM15 = this.parseBinanceData(m15Response.data).slice(0, -1);

        console.log('\n=== DEBUG: LAST 3 CANDLES SENT TO LLM (H1) ===');
        console.log(JSON.stringify(fullyClosedH1.slice(-3), null, 2));
        console.log('========================================\n');

        console.log('\n=== DEBUG: LAST 3 CANDLES SENT TO LLM (M15) ===');
        console.log(JSON.stringify(fullyClosedM15.slice(-3), null, 2));
        console.log('========================================\n');

        return { candlesH1: fullyClosedH1, candlesM15: fullyClosedM15 };
      } catch (error: any) {
        attempt++;
        logError(`Attempt ${attempt} failed fetching MTF market data from Binance:`, error.message);
        if (attempt >= maxRetries) {
          logError('Max retries reached. Returning empty market data.');
          return { candlesH1: [], candlesM15: [] };
        }
        logInfo(`Waiting 2 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    return { candlesH1: [], candlesM15: [] };
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
