import axios, { AxiosInstance } from 'axios';
import { ICandle, IMtfMarketData } from '../types.js';
import { logInfo, logError } from '../utils/logger.js';

export class MarketDataService {
  private apiClient: AxiosInstance;

  constructor() {
    this.apiClient = axios.create({
      baseURL: 'https://api.twelvedata.com',
      timeout: 30000,
    });
  }

  /**
   * Fetches real-time multi-timeframe (H1 + M15) candlestick data for EUR/USD from Twelve Data API.
   */
  public async fetchMarketData(): Promise<IMtfMarketData> {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!apiKey) {
      logError('TWELVE_DATA_API_KEY is not defined in the environment variables.');
      return { candlesH1: [], candlesM15: [] };
    }

    logInfo(`Fetching MTF (H1 + M15) real-time market data for EUR/USD from Twelve Data API...`);

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const [h1Response, m15Response] = await Promise.all([
          this.apiClient.get('/time_series', {
            params: {
              symbol: 'EUR/USD',
              interval: '1h',
              outputsize: 120,
              order: 'ASC',
              timezone: 'UTC',
              apikey: apiKey
            }
          }),
          this.apiClient.get('/time_series', {
            params: {
              symbol: 'EUR/USD',
              interval: '15min',
              outputsize: 200,
              order: 'ASC',
              timezone: 'UTC',
              apikey: apiKey
            }
          })
        ]);

        // Twelve Data returns the currently forming candle as the last element.
        // We slice(0, -1) to remove it, ensuring the LLM only sees FULLY CLOSED candles.
        const fullyClosedH1 = this.parseTwelveData(h1Response.data).slice(0, -1);
        const fullyClosedM15 = this.parseTwelveData(m15Response.data).slice(0, -1);

        console.log('\n=== DEBUG: LAST 3 CANDLES SENT TO LLM (H1) ===');
        console.log(JSON.stringify(fullyClosedH1.slice(-3), null, 2));
        console.log('========================================\n');

        console.log('\n=== DEBUG: LAST 3 CANDLES SENT TO LLM (M15) ===');
        console.log(JSON.stringify(fullyClosedM15.slice(-3), null, 2));
        console.log('========================================\n');

        return { candlesH1: fullyClosedH1, candlesM15: fullyClosedM15 };
      } catch (error: any) {
        attempt++;
        logError(`Attempt ${attempt} failed fetching MTF market data from Twelve Data:`, error.message);
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

  private parseTwelveData(data: any): ICandle[] {
    if (data?.status === 'error') {
      logError(`Twelve Data API error: ${data.message} (Code: ${data.code})`);
      return [];
    }

    const values = data?.values;
    if (!values || !Array.isArray(values)) {
      logError(`Twelve Data API returned unexpected structure: ${JSON.stringify(data)}`);
      return [];
    }

    const candles: ICandle[] = [];

    for (const val of values) {
      const open = val.open;
      const high = val.high;
      const low = val.low;
      const close = val.close;
      const volume = val.volume ?? '0';

      if (
        !val.datetime ||
        open === undefined || open === null ||
        high === undefined || high === null ||
        low === undefined || low === null ||
        close === undefined || close === null
      ) {
        continue;
      }

      // Convert "YYYY-MM-DD HH:MM:SS" (in UTC) to a standard ISO date string
      const isoString = val.datetime.replace(' ', 'T') + 'Z';
      const date = new Date(isoString);
      const timestamp = date.getTime();

      // Format time in Kyiv timezone: "10:00"
      const time = date.toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Kyiv'
      });

      candles.push({
        timestamp,
        time,
        open: Number(Number(open).toFixed(5)),
        high: Number(Number(high).toFixed(5)),
        low: Number(Number(low).toFixed(5)),
        close: Number(Number(close).toFixed(5)),
        volume: Number(volume)
      });
    }

    return candles;
  }
}
