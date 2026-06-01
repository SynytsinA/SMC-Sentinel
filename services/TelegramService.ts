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
  public async sendMessage(message: string): Promise<void> {
    if (!this.chatId) {
      logError('CHAT_ID is not specified for sending messages.');
      return;
    }

    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
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
}
