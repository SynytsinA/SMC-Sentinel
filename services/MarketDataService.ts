import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs/promises';
import { ICandle, ITriTimeframeMarketData } from '../types.js';
import { logInfo, logError } from '../utils/logger.js';
import { calculateStructuralData } from '../utils/trading.js';

export class MarketDataService {
  private apiClient: AxiosInstance;

  constructor() {
    this.apiClient = axios.create({
      baseURL: 'https://api.twelvedata.com',
      timeout: 30000,
    });
  }

  /**
   * Fetches real-time multi-timeframe (H4 + M15 + M5) candlestick data for EUR/USD from Twelve Data API.
   */
  public async fetchMarketData(): Promise<ITriTimeframeMarketData> {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!apiKey) {
      logError('TWELVE_DATA_API_KEY is not defined in the environment variables.');
      return { candlesH4: [], candlesM15: [], candlesM5: [] };
    }

    logInfo(`Fetching 3-Timeframe (H4 + M15 + M5) real-time market data for EUR/USD from Twelve Data API...`);

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const [h4Response, m15Response, m5Response] = await Promise.all([
          this.apiClient.get('/time_series', {
            params: {
              symbol: 'EUR/USD',
              interval: '4h',
              outputsize: 60,
              order: 'ASC',
              timezone: 'UTC',
              apikey: apiKey
            }
          }),
          this.apiClient.get('/time_series', {
            params: {
              symbol: 'EUR/USD',
              interval: '15min',
              outputsize: 96,
              order: 'ASC',
              timezone: 'UTC',
              apikey: apiKey
            }
          }),
          this.apiClient.get('/time_series', {
            params: {
              symbol: 'EUR/USD',
              interval: '5min',
              outputsize: 36,
              order: 'ASC',
              timezone: 'UTC',
              apikey: apiKey
            }
          })
        ]);

        const parsedH4 = this.parseTwelveData(h4Response.data);
        const parsedM15 = this.parseTwelveData(m15Response.data);
        const parsedM5 = this.parseTwelveData(m5Response.data);

        const now = new Date();
        const currentH4Start = Math.floor(now.getTime() / (4 * 60 * 60 * 1000)) * (4 * 60 * 60 * 1000);
        const currentM15Start = Math.floor(now.getTime() / (15 * 60 * 1000)) * (15 * 60 * 1000);
        const currentM5Start = Math.floor(now.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000);

        // If the last candle belongs to the currently forming interval, slice it off.
        const fullyClosedH4 = parsedH4.length > 0 && parsedH4[parsedH4.length - 1].timestamp >= currentH4Start
          ? parsedH4.slice(0, -1)
          : parsedH4;

        const fullyClosedM15 = parsedM15.length > 0 && parsedM15[parsedM15.length - 1].timestamp >= currentM15Start
          ? parsedM15.slice(0, -1)
          : parsedM15;

        const fullyClosedM5 = parsedM5.length > 0 && parsedM5[parsedM5.length - 1].timestamp >= currentM5Start
          ? parsedM5.slice(0, -1)
          : parsedM5;

        console.log('\n=== DEBUG: LAST 3 CANDLES SENT TO LLM (H4) ===');
        console.log(JSON.stringify(fullyClosedH4.slice(-3), null, 2));
        console.log('========================================\n');

        console.log('\n=== DEBUG: LAST 3 CANDLES SENT TO LLM (M15) ===');
        console.log(JSON.stringify(fullyClosedM15.slice(-3), null, 2));
        console.log('========================================\n');

        console.log('\n=== DEBUG: LAST 3 CANDLES SENT TO LLM (M5) ===');
        console.log(JSON.stringify(fullyClosedM5.slice(-3), null, 2));
        console.log('========================================\n');

        // Write the data to a JSON file for manual LLM analysis
        try {
          await fs.mkdir('data', { recursive: true });
          const fetchedAtKyiv = new Date().toLocaleString('uk-UA', {
            timeZone: 'Europe/Kyiv'
          });
          const deterministicData = calculateStructuralData({
            candlesH4: fullyClosedH4,
            candlesM15: fullyClosedM15,
            candlesM5: fullyClosedM5
          });
          const fileContent = {
            info: "This file contains the latest market data for EUR/USD. Only fully closed candles are included. Time is formatted in Europe/Kyiv timezone.",
            symbol: "EUR/USD",
            fetched_at: fetchedAtKyiv,
            candles_h4_count: fullyClosedH4.length,
            candles_m15_count: fullyClosedM15.length,
            candles_m5_count: fullyClosedM5.length,
            deterministic_structural_data: deterministicData,
            candles_h4: fullyClosedH4,
            candles_m15: fullyClosedM15,
            candles_m5: fullyClosedM5
          };
          await fs.writeFile('data/latest_candles.json', JSON.stringify(fileContent, null, 2), 'utf-8');
          logInfo('Latest candlestick data written to data/latest_candles.json');
        } catch (writeError: any) {
          logError('Failed to write market data to data/latest_candles.json:', writeError.message);
        }

        return { candlesH4: fullyClosedH4, candlesM15: fullyClosedM15, candlesM5: fullyClosedM5 };
      } catch (error: any) {
        attempt++;
        logError(`Attempt ${attempt} failed fetching MTF market data from Twelve Data:`, error.message);
        if (attempt >= maxRetries) {
          logError('Max retries reached. Returning empty market data.');
          return { candlesH4: [], candlesM15: [], candlesM5: [] };
        }
        logInfo(`Waiting 2 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return { candlesH4: [], candlesM15: [], candlesM5: [] };
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
        close: Number(Number(close).toFixed(5))
      });
    }

    return candles;
  }
}
