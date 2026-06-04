import axios from 'axios';
import * as fs from 'fs/promises';
import { IForexNewsEvent, ITodaysNewsFile } from '../types.js';
import { logInfo, logError } from '../utils/logger.js';

export class NewsService {
  private readonly NEWS_FILE = 'todays_high_impact_news.json';
  private readonly API_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

  private getKyivDateString(date: Date): string {
    return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' });
  }

  /**
   * Fetches the weekly calendar and filters for today's high and medium impact news.
   * Uses local cache todays_high_impact_news.json to avoid rate limits (runs once per day).
   */
  public async fetchAndCacheNews(): Promise<IForexNewsEvent[]> {
    const todayStr = this.getKyivDateString(new Date());

    // 1. Try to read from cache
    try {
      const cacheContent = await fs.readFile(this.NEWS_FILE, 'utf-8');
      const parsed: ITodaysNewsFile = JSON.parse(cacheContent);

      if (parsed.fetchedForDate === todayStr) {
        logInfo(`[News] Loaded cached high/medium-impact news for date: ${todayStr}`);
        return parsed.news;
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        logError('[News] Error reading news cache:', err);
      }
    }

    // 2. Cache miss -> Fetch from API
    logInfo(`[News] Cache miss or date mismatch for ${todayStr}. Fetching latest calendar...`);
    try {
      const response = await axios.get<IForexNewsEvent[]>(this.API_URL, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!Array.isArray(response.data)) {
        throw new Error('API did not return an array of events.');
      }

      // Filter: only EUR and USD, only High and Medium impact, only occurring today
      const filtered = response.data.filter(event => {
        if (event.country !== 'USD' && event.country !== 'EUR') return false;
        if (event.impact !== 'High' && event.impact !== 'Medium') return false;

        const eventDate = new Date(event.date);
        return this.getKyivDateString(eventDate) === todayStr;
      });

      // 3. Update cache file
      const fileData: ITodaysNewsFile = {
        fetchedForDate: todayStr,
        news: filtered
      };

      await fs.writeFile(this.NEWS_FILE, JSON.stringify(fileData, null, 2), 'utf-8');
      logInfo(`[News] Successfully updated ${this.NEWS_FILE} with ${filtered.length} high/medium-impact news events.`);

      return filtered;
    } catch (err: any) {
      logError('[News] Failed to fetch economic calendar from API:', err.message);
      return [];
    }
  }
}
