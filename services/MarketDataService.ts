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
  public async fetchMarketData(
    h4Size: number = 60,
    m15Size: number = 96,
    m5Size: number = 36
  ): Promise<ITriTimeframeMarketData> {
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
              outputsize: h4Size + 10,
              order: 'ASC',
              timezone: 'UTC',
              apikey: apiKey
            }
          }),
          this.apiClient.get('/time_series', {
            params: {
              symbol: 'EUR/USD',
              interval: '15min',
              outputsize: m15Size + 10,
              order: 'ASC',
              timezone: 'UTC',
              apikey: apiKey
            }
          }),
          this.apiClient.get('/time_series', {
            params: {
              symbol: 'EUR/USD',
              interval: '5min',
              outputsize: m5Size + 10,
              order: 'ASC',
              timezone: 'UTC',
              apikey: apiKey
            }
          })
        ]);

        const parsedH4 = this.parseTwelveData(h4Response.data);
        const parsedM15 = this.parseTwelveData(m15Response.data);
        const parsedM5 = this.parseTwelveData(m5Response.data);

        const nowMs = Date.now();
        const H4_DURATION = 4 * 60 * 60 * 1000;
        const M15_DURATION = 15 * 60 * 1000;
        const M5_DURATION = 5 * 60 * 1000;

        // If the last candle belongs to the currently forming interval (not fully closed), slice it off.
        const fullyClosedH4 = parsedH4.length > 0 && (parsedH4[parsedH4.length - 1].timestamp + H4_DURATION > nowMs)
          ? parsedH4.slice(0, -1)
          : parsedH4;

        const fullyClosedM15 = parsedM15.length > 0 && (parsedM15[parsedM15.length - 1].timestamp + M15_DURATION > nowMs)
          ? parsedM15.slice(0, -1)
          : parsedM15;

        const fullyClosedM5 = parsedM5.length > 0 && (parsedM5[parsedM5.length - 1].timestamp + M5_DURATION > nowMs)
          ? parsedM5.slice(0, -1)
          : parsedM5;

        // Slice to the requested sizes from the end of the arrays
        const finalH4 = fullyClosedH4.slice(-h4Size);
        const finalM15 = fullyClosedM15.slice(-m15Size);
        const finalM5 = fullyClosedM5.slice(-m5Size);

        console.log('\n=== DEBUG: LAST 3 CANDLES SENT TO LLM (H4) ===');
        console.log(JSON.stringify(finalH4.slice(-3), null, 2));
        console.log('========================================\n');

        console.log('\n=== DEBUG: LAST 3 CANDLES SENT TO LLM (M15) ===');
        console.log(JSON.stringify(finalM15.slice(-3), null, 2));
        console.log('========================================\n');

        console.log('\n=== DEBUG: LAST 3 CANDLES SENT TO LLM (M5) ===');
        console.log(JSON.stringify(finalM5.slice(-3), null, 2));
        console.log('========================================\n');

        // Write the data to a JSON file for manual LLM analysis
        try {
          await fs.mkdir('data', { recursive: true });
          const fetchedAtKyiv = new Date().toLocaleString('uk-UA', {
            timeZone: 'Europe/Kyiv'
          });
          const deterministicData = calculateStructuralData({
            candlesH4: finalH4,
            candlesM15: finalM15,
            candlesM5: finalM5
          });
          const fileContent = {
            info: "This file contains the latest market data for EUR/USD. Only fully closed candles are included. Time is formatted in Europe/Kyiv timezone.",
            symbol: "EUR/USD",
            fetched_at: fetchedAtKyiv,
            candles_h4_count: finalH4.length,
            candles_m15_count: finalM15.length,
            candles_m5_count: finalM5.length,
            deterministic_structural_data: deterministicData,
            candles_h4: finalH4,
            candles_m15: finalM15,
            candles_m5: finalM5
          };
          await fs.writeFile('data/latest_candles.json', JSON.stringify(fileContent, null, 2), 'utf-8');
          logInfo('Latest candlestick data written to data/latest_candles.json');
        } catch (writeError: any) {
          logError('Failed to write market data to data/latest_candles.json:', writeError.message);
        }

        return { candlesH4: finalH4, candlesM15: finalM15, candlesM5: finalM5 };
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

    const len = candles.length;
    for (let i = 2; i < len; i++) {
      // 5-candle Fractal calculation (requires i-2, i-1, i, i+1, i+2)
      if (i < len - 2) {
        if (
          candles[i].high > candles[i - 2].high &&
          candles[i].high > candles[i - 1].high &&
          candles[i].high > candles[i + 1].high &&
          candles[i].high > candles[i + 2].high
        ) {
          candles[i].isFractalHigh = true;
        }

        if (
          candles[i].low < candles[i - 2].low &&
          candles[i].low < candles[i - 1].low &&
          candles[i].low < candles[i + 1].low &&
          candles[i].low < candles[i + 2].low
        ) {
          candles[i].isFractalLow = true;
        }
      }

      // FVG check (requires index i and i-2 to exist, stores in i-1)
      if (candles[i].low > candles[i - 2].high) {
        candles[i - 1].fvg = {
          type: 'Bullish',
          top: candles[i].low,
          bottom: candles[i - 2].high
        };
      } else if (candles[i].high < candles[i - 2].low) {
        candles[i - 1].fvg = {
          type: 'Bearish',
          top: candles[i - 2].low,
          bottom: candles[i].high
        };
      }
    }

    return candles;
  }
}
