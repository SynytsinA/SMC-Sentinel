import * as dotenv from 'dotenv';
import { MarketDataService } from './services/MarketDataService.js';
import { OllamaService } from './services/OllamaService.js';
import { TelegramService } from './services/TelegramService.js';
import { AppEngine } from './services/AppEngine.js';
import { logInfo, logError } from './utils/logger.js';

// Load environment variables
dotenv.config();

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434/api/generate';
const MODEL_NAME = process.env.MODEL_NAME || 'gemma4:26b-mlx';
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const OLLAMA_SYSTEM_INSTRUCTION = process.env.OLLAMA_SYSTEM_INSTRUCTION;
const OLLAMA_RESPONSE_FORMAT = process.env.OLLAMA_RESPONSE_FORMAT;

function bootstrap() {
  try {
    logInfo('Initializing SMC Local Bot...');

    if (!TELEGRAM_TOKEN || !CHAT_ID) {
      logError('Missing critical settings (TELEGRAM_TOKEN or TELEGRAM_CHAT_ID). The bot will not be able to send notifications.');
    }

    // Initialize services
    const marketDataService = new MarketDataService();
    const ollamaService = new OllamaService(OLLAMA_API_URL, MODEL_NAME, OLLAMA_SYSTEM_INSTRUCTION, OLLAMA_RESPONSE_FORMAT);
    const telegramService = new TelegramService(TELEGRAM_TOKEN, CHAT_ID);

    // Initialize the main engine (15 minutes)
    const scanIntervalMs = 15 * 60 * 1000;
    const engine = new AppEngine(
      marketDataService,
      ollamaService,
      telegramService,
      scanIntervalMs
    );

    // Start the system
    engine.start();

  } catch (error) {
    logError('Critical error when starting the application:', error);
    process.exit(1);
  }
}

bootstrap();
