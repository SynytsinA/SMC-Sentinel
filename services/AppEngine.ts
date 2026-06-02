import { MarketDataService } from './MarketDataService.js';
import { OllamaService } from './OllamaService.js';
import { TelegramService } from './TelegramService.js';
import { logInfo, logError } from '../utils/logger.js';

export class AppEngine {
  private marketDataService: MarketDataService;
  private ollamaService: OllamaService;
  private telegramService: TelegramService;
  private scanIntervalMs: number;

  constructor(
    marketDataService: MarketDataService,
    ollamaService: OllamaService,
    telegramService: TelegramService,
    scanIntervalMs: number = 15 * 60 * 1000 // Default 15 minutes
  ) {
    this.marketDataService = marketDataService;
    this.ollamaService = ollamaService;
    this.telegramService = telegramService;
    this.scanIntervalMs = scanIntervalMs;
  }

  /**
   * Initializes and starts the bot engine.
   */
  public start(): void {
    logInfo('Starting App Engine...');
    
    // Register /analyze command in Telegram
    this.telegramService.registerAnalyzeCommand(async (chatId: number) => {
      const data = await this.marketDataService.fetchMarketData();
      if (data.length === 0) {
        this.telegramService.sendMessage('Error: failed to fetch market data.');
        return;
      }

      const result = await this.ollamaService.analyze(data);
      this.telegramService.sendMessage(`**On-demand Analysis:**\n\n${result.verdict}`);
    });

    // Register custom prompt handler in Telegram
    this.telegramService.registerCustomPromptHandler(async (chatId: number, text: string) => {
      const data = await this.marketDataService.fetchMarketData();
      if (data.length === 0) {
        this.telegramService.sendMessage('Error: failed to fetch market data for your query.');
        return;
      }

      const reply = await this.ollamaService.analyzeWithCustomPrompt(data, text);
      this.telegramService.sendMessage(`**Custom Response:**\n\n${reply}`, false);
    });

    // Run the first cycle immediately
    this.runTradingBotCycle();

    // Start the periodic cycle
    setInterval(() => this.runTradingBotCycle(), this.scanIntervalMs);
  }

  /**
   * One bot operating cycle: fetch -> analyze -> notify
   */
  private async runTradingBotCycle(): Promise<void> {
    logInfo('⚡️ Market scanning activated...');
    try {
      const data = await this.marketDataService.fetchMarketData();
      if (data.length === 0) {
        logInfo('Market data not received, cycle skipped.');
        return;
      }

      const result = await this.ollamaService.analyze(data);

      if (result.hasSetup) {
        const message = `⚠️ **SMC Notifier Bot**\n\n${result.verdict}`;
        await this.telegramService.sendMessage(message);
      } else {
        logInfo('😴 The market is asleep, the model does not see any setups.');
      }
    } catch (error) {
      logError('Critical error in the scanning cycle:', error);
    }
  }
}
