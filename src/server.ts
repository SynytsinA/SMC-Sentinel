import express from 'express';
import * as dotenv from 'dotenv';
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

    const responseJSON = {
      info: "This file contains the latest market data for EUR/USD. Only fully closed candles are included. Time is formatted in Europe/Kyiv timezone.",
      symbol: "EUR/USD",
      fetched_at: fetchedAtKyiv,
      candles_h4_count: data.candlesH4.length,
      candles_m15_count: data.candlesM15.length,
      candles_m5_count: data.candlesM5.length,
      deterministic_structural_data: deterministicData,
      candles_h4: data.candlesH4,
      candles_m15: data.candlesM15,
      candles_m5: data.candlesM5
    };

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

app.listen(Number(port), '0.0.0.0', () => {
  logInfo(`Market data API server listening at http://0.0.0.0:${port}`);
});
