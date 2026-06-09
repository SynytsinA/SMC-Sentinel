import express from 'express';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { MarketDataService } from '../services/MarketDataService.js';
import { NewsService } from '../services/NewsService.js';
import { calculateStructuralData } from '../utils/trading.js';
import { logInfo, logError } from '../utils/logger.js';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const marketDataService = new MarketDataService();
const newsService = new NewsService();

const cacheDir = path.join(process.cwd(), 'data');
const cacheFilePath = path.join(cacheDir, 'htf_analysis_cache.json');

app.post('/api/market-data/cache', express.json(), async (req: express.Request, res: express.Response) => {
  try {
    logInfo('POST /api/market-data/cache request received.');
    const { last_h4_timestamp, htf_bias_text } = req.body;

    if (last_h4_timestamp === undefined || !htf_bias_text) {
      res.status(400).json({ error: 'Missing last_h4_timestamp or htf_bias_text in request body.' });
      return;
    }

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const cacheData = {
      last_h4_timestamp,
      htf_bias_text
    };

    fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2), 'utf-8');
    logInfo(`Successfully saved HTF bias cache for timestamp ${last_h4_timestamp}.`);

    res.json({ success: true, message: 'Cache updated successfully.' });
  } catch (error: any) {
    logError('Error handling POST /api/market-data/cache:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

app.get('/api/market-data', async (req, res) => {
  try {
    logInfo('GET /api/market-data request received.');

    const data = await marketDataService.fetchMarketData(20, 50, 35);

    if (data.candlesH4.length === 0 || data.candlesM15.length === 0 || data.candlesM5.length === 0) {
      res.status(500).json({ error: 'Failed to fetch market data from provider.' });
      return;
    }

    const deterministicData = calculateStructuralData({
      candlesH4: data.candlesH4,
      candlesM15: data.candlesM15,
      candlesM5: data.candlesM5
    });

    const fetchedAtKyiv = new Date().toLocaleString('uk-UA', {
      timeZone: 'Europe/Kyiv'
    });

    let candlesH4Response = data.candlesH4;
    let cachedHtfBias: string | undefined = undefined;
    let cacheNote = "";

    if (fs.existsSync(cacheFilePath)) {
      try {
        const cacheRaw = fs.readFileSync(cacheFilePath, 'utf-8');
        const cacheData = JSON.parse(cacheRaw);
        const latestH4Candle = data.candlesH4[data.candlesH4.length - 1];
        
        if (latestH4Candle && cacheData.last_h4_timestamp === latestH4Candle.timestamp && cacheData.htf_bias_text) {
          candlesH4Response = [];
          cachedHtfBias = cacheData.htf_bias_text;
          cacheNote = " Note: candles_h4 list was omitted because the HTF analysis for the current H4 candle is already cached in cached_htf_bias." + " " + latestH4Candle.timestamp;
          logInfo(`HTF Bias Cache hit for timestamp ${cacheData.last_h4_timestamp}. Omiting H4 candles.`);
        }
      } catch (cacheError) {
        logError('Error reading/parsing HTF bias cache:', cacheError);
      }
    }

    const responseJSON: any = {
      info: "This file contains the latest market data for EUR/USD. Only fully closed candles are included. Time is formatted in Europe/Kyiv timezone." + cacheNote,
      symbol: "EUR/USD",
      fetched_at: fetchedAtKyiv,
      candles_h4_count: candlesH4Response.length,
      candles_m15_count: data.candlesM15.length,
      candles_m5_count: data.candlesM5.length,
      deterministic_structural_data: deterministicData,
      candles_h4: candlesH4Response,
      candles_m15: data.candlesM15,
      candles_m5: data.candlesM5
    };

    if (cachedHtfBias) {
      responseJSON.cached_htf_bias = cachedHtfBias;
    }

    res.json(responseJSON);
  } catch (error: any) {
    logError('Error handling GET /api/market-data:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

app.get('/api/todays-high-impact-news', async (req, res) => {
  try {
    logInfo('GET /api/todays-high-impact-news request received.');
    const news = await newsService.fetchAndCacheNews();
    res.json({
      info: "This file contains high and medium impact economic news events for EUR/USD scheduled for today.",
      fetched_at: new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' }),
      news
    });
  } catch (error: any) {
    logError('Error handling GET /api/todays-high-impact-news:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Start the server
app.listen(Number(port), '0.0.0.0', () => {
  logInfo(`Market data API server listening at http://0.0.0.0:${port}`);

  // Fetch and cache news on startup
  newsService.fetchAndCacheNews().catch((error) => {
    logError('Failed to fetch and cache news on startup:', error);
  });

  // Periodically check/update news cache every 1 hour
  setInterval(() => {
    newsService.fetchAndCacheNews().catch((error) => {
      logError('Failed to periodically fetch and cache news:', error);
    });
  }, 60 * 60 * 1000);
});

