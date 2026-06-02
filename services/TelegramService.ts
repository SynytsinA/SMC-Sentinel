import TelegramBot from 'node-telegram-bot-api';
import { logInfo, logError } from '../utils/logger.js';

export class TelegramService {
  private bot: TelegramBot;
  private chatId: string;

  constructor(token: string, chatId: string) {
    if (!token) {
      logError('Telegram token not found!');
    }
    
    this.chatId = chatId;
    // Initialize bot in polling mode
    this.bot = new TelegramBot(token, { polling: true });
    logInfo('Telegram bot successfully initialized.');
  }

  /**
   * Sends a message to the specified chat.
   * @param message Message text
   */
  public async sendMessage(message: string, useMarkdown: boolean = true): Promise<void> {
    if (!this.chatId) {
      logError('CHAT_ID is not specified for sending messages.');
      return;
    }

    try {
      const options = useMarkdown ? { parse_mode: 'Markdown' as const } : {};
      await this.bot.sendMessage(this.chatId, message, options);
      logInfo('Message sent to Telegram.');
    } catch (error) {
      logError('Error sending message to Telegram:', error);
    }
  }

  /**
   * Registers a handler for the on-demand analysis command.
   * @param callback Function to be called upon receiving the /analyze command
   */
  public registerAnalyzeCommand(callback: (chatId: number) => Promise<void>): void {
    this.bot.onText(/\/analyze/, async (msg) => {
      const chatId = msg.chat.id;
      logInfo(`Received /analyze command from chat ${chatId}`);
      
      try {
        await this.bot.sendMessage(chatId, '🔍 Reading the terminal, please wait a second...');
        await callback(chatId);
      } catch (error) {
        logError('Error in /analyze handler:', error);
        await this.bot.sendMessage(chatId, 'An error occurred during analysis.');
      }
    });
  }

  /**
   * Registers a handler for general text messages (custom prompts).
   * @param callback Function to be called upon receiving a non-command text message
   */
  public registerCustomPromptHandler(callback: (chatId: number, text: string) => Promise<void>): void {
    this.bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;

      // Ignore if there is no text or if it is a command starting with '/'
      if (!text || text.startsWith('/')) {
        return;
      }

      logInfo(`Received custom prompt from chat ${chatId}: "${text}"`);
      
      try {
        await this.bot.sendMessage(chatId, '🤖 Processing your custom request with Gemma 4...');
        await callback(chatId, text);
      } catch (error) {
        logError('Error in custom prompt handler:', error);
        await this.bot.sendMessage(chatId, 'An error occurred while processing your custom request.');
      }
    });
  }
}
