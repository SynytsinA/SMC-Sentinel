import { MarketDataService } from './MarketDataService.js';
import { OllamaService } from './OllamaService.js';
import { TelegramService } from './TelegramService.js';
import { NewsService } from './NewsService.js';
import { logInfo, logError } from '../utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export class AppEngine {
  private marketDataService: MarketDataService;
  private ollamaService: OllamaService;
  private telegramService: TelegramService;
  private newsService: NewsService;
  private scanIntervalMs: number;
  private subscribers: Set<number> = new Set();
  private readonly SUBSCRIBERS_FILE = './data/subscribers.json';

  constructor(
    marketDataService: MarketDataService,
    ollamaService: OllamaService,
    telegramService: TelegramService,
    scanIntervalMs: number = 15 * 60 * 1000 // Default 15 minutes
  ) {
    this.marketDataService = marketDataService;
    this.ollamaService = ollamaService;
    this.telegramService = telegramService;
    this.newsService = new NewsService();
    this.scanIntervalMs = scanIntervalMs;
  }

  /**
   * Loads the saved subscribers from the local JSON file.
   */
  private async loadSubscribers(): Promise<void> {
    try {
      await fs.mkdir('data', { recursive: true });
      const data = await fs.readFile(this.SUBSCRIBERS_FILE, 'utf-8');
      const ids: number[] = JSON.parse(data);
      this.subscribers = new Set(ids);
      logInfo(`Loaded ${this.subscribers.size} subscribers from ${this.SUBSCRIBERS_FILE}`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logInfo('No subscribers file found. Starting with an empty subscription list.');
      } else {
        logError('Error loading subscribers:', error);
      }
    }
  }

  /**
   * Saves the current subscribers list to the local JSON file.
   */
  private async saveSubscribers(): Promise<void> {
    try {
      await fs.mkdir('data', { recursive: true });
      const ids = Array.from(this.subscribers);
      await fs.writeFile(this.SUBSCRIBERS_FILE, JSON.stringify(ids, null, 2), 'utf-8');
    } catch (error) {
      logError('Error saving subscribers:', error);
    }
  }

  /**
   * Initializes and starts the bot engine.
   */
  public async start(): Promise<void> {
    logInfo('Starting App Engine...');

    // Restore persistent state
    await this.loadSubscribers();

    // Fetch and cache daily high-impact news on startup
    await this.newsService.fetchAndCacheNews();

    // Register /analyze command in Telegram
    this.telegramService.registerAnalyzeCommand(async (chatId: number) => {
      const data = await this.marketDataService.fetchMarketData();
      if (data.candlesH1.length === 0 || data.candlesM15.length === 0) {
        this.telegramService.sendMessageToChat(chatId, 'Error: failed to fetch market data.');
        return;
      }

      const todayNews = await this.newsService.fetchAndCacheNews();
      const activeNews = this.newsService.getNewsInTimeWindow(todayNews, new Date(), 30);
      const newsContext = this.newsService.formatNewsContext(activeNews) || undefined;

      const result = await this.ollamaService.analyze(data, newsContext);
      this.telegramService.sendMessageToChat(chatId, `**On-demand Analysis:**\n\n${result.verdict}`);
    });

    // Register /news command in Telegram
    this.telegramService.registerNewsCommand(async (chatId: number) => {
      const todayNews = await this.newsService.fetchAndCacheNews();

      if (todayNews.length === 0) {
        await this.telegramService.sendMessageToChat(
          chatId,
          "📅 **Економічний календар на сьогодні:**\n\nВажливих новин (High/Medium impact) по USD або EUR на сьогодні не заплановано. Очікується відносно спокійна поведінка ринку."
        );
        return;
      }

      let newsListText = "📅 **Економічний календар на сьогодні (EUR/USD):**\n\n";
      for (const event of todayNews) {
        const eventDate = new Date(event.date);
        const timeStr = eventDate.toLocaleTimeString('uk-UA', {
          timeZone: 'Europe/Kyiv',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        const impactEmoji = event.impact === 'High' ? '🔴' : '🟡';
        const forecastStr = event.forecast ? ` (Прогноз: ${event.forecast}, Попереднє: ${event.previous})` : '';
        newsListText += `${impactEmoji} **[${timeStr} (Kyiv)]** [${event.country}] ${event.title}${forecastStr}\n`;
      }

      await this.telegramService.sendMessageToChat(chatId, newsListText);
    });


    // Register /subscribe command
    this.telegramService.registerSubscribeCommand(async (chatId: number) => {
      if (this.subscribers.has(chatId)) {
        this.telegramService.sendMessageToChat(chatId, 'You are already subscribed!');
        return;
      }
      this.subscribers.add(chatId);
      await this.saveSubscribers();
      logInfo(`Chat ${chatId} subscribed to updates.`);
      this.telegramService.sendMessageToChat(chatId, '🔔 You have successfully subscribed to 15-minute SMC market updates!');
    });

    // Register /unsubscribe command
    this.telegramService.registerUnsubscribeCommand(async (chatId: number) => {
      if (!this.subscribers.has(chatId)) {
        this.telegramService.sendMessageToChat(chatId, 'You are not subscribed.');
        return;
      }
      this.subscribers.delete(chatId);
      await this.saveSubscribers();
      logInfo(`Chat ${chatId} unsubscribed from updates.`);
      this.telegramService.sendMessageToChat(chatId, '🔕 You have unsubscribed from market updates.');
    });

    // Register custom prompt handler in Telegram
    this.telegramService.registerCustomPromptHandler(async (chatId: number, text: string) => {
      const data = await this.marketDataService.fetchMarketData();
      if (data.candlesH1.length === 0 || data.candlesM15.length === 0) {
        this.telegramService.sendMessageToChat(chatId, 'Error: failed to fetch market data for your query.');
        return;
      }

      const todayNews = await this.newsService.fetchAndCacheNews();
      const activeNews = this.newsService.getNewsInTimeWindow(todayNews, new Date(), 30);
      const newsContext = this.newsService.formatNewsContext(activeNews) || undefined;

      const reply = await this.ollamaService.analyzeWithCustomPrompt(data, text, newsContext);
      this.telegramService.sendMessageToChat(chatId, `**Custom Response:**\n\n${reply}`, false);
    });

    // Start the smart periodic cycle synchronized with market 15-minute marks
    this.scheduleNextCycle();
  }

  /**
   * Smart scheduler to synchronize execution exactly with the close of 15m candles
   * (00, 15, 30, 45 minutes) + 5 seconds offset.
   */
  private scheduleNextCycle(): void {
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const milliseconds = now.getMilliseconds();

    // Calculate how many minutes until the next target (0, 15, 30, 45)
    const nextTargetMinutes = Math.ceil((minutes + 1) / 15) * 15;
    const minutesRemaining = nextTargetMinutes - minutes;

    // Convert total remaining time to milliseconds and add a 5-second offset
    const delay = (minutesRemaining * 60 * 1000) - (seconds * 1000) - milliseconds + 5000;

    logInfo(`Next market scanning cycle scheduled in ${Math.round(delay / 1000)} seconds...`);

    setTimeout(async () => {
      await this.runTradingBotCycle();
      this.scheduleNextCycle(); // Recursively schedule the next cycle
    }, delay);
  }

  /**
   * One bot operating cycle: fetch -> analyze -> notify subscribers
   */
  private async runTradingBotCycle(): Promise<void> {
    logInfo('⚡️ Market scanning activated...');
    try {
      const now = new Date();
      const day = now.getDay(); // 0 = Неділя, 5 = П'ятниця, 6 = Субота
      const hour = now.getHours();

      // Форекс закритий: п'ятниця після 23:00, вся субота, і неділя до 23:00
      const isWeekend = (day === 5 && hour >= 23) || day === 6 || (day === 0 && hour < 23);

      if (isWeekend) {
        logInfo('Forex market is closed for the weekend. Skipping scanning cycle to save resources.');
        return;
      }

      // Check and fetch daily high-impact news
      const todayNews = await this.newsService.fetchAndCacheNews();

      const activeNews = this.newsService.getNewsInTimeWindow(todayNews, new Date(), 30);
      const newsContext = this.newsService.formatNewsContext(activeNews) || undefined;

      const data = await this.marketDataService.fetchMarketData();
      if (data.candlesH1.length === 0 || data.candlesM15.length === 0) {
        logInfo('Market data not received, cycle skipped.');
        return;
      }

      const result = await this.ollamaService.analyze(data, newsContext);

      const message = `**SMC Periodic Update:**\n\n${result.verdict}`;

      // If no subscribers, just log it
      if (this.subscribers.size === 0) {
        logInfo('😴 No subscribers to notify.');
        return;
      }

      // Notify all active subscribers
      for (const chatId of this.subscribers) {
        logInfo(`Sending periodic update to chat ${chatId}`);
        await this.telegramService.sendMessageToChat(chatId, message);
      }
    } catch (error) {
      logError('Critical error in the scanning cycle:', error);
    }
  }
}
