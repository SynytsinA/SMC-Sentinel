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
   * @param chatId The Telegram chat ID
   * @param message Message text
   * @param useMarkdown Whether to use Markdown parsing
   */
  public async sendMessageToChat(chatId: number | string, message: string, useMarkdown: boolean = true): Promise<void> {
    try {
      const options = useMarkdown ? { parse_mode: 'Markdown' as const } : {};
      await this.bot.sendMessage(chatId, message, options);
      logInfo(`Message sent to Telegram chat ${chatId}.`);
    } catch (error) {
      logError(`Error sending message to Telegram chat ${chatId}:`, error);
    }
  }

  /**
   * Sends a message to the default admin chat.
   * @param message Message text
   * @param useMarkdown Whether to use Markdown parsing
   */
  public async sendMessage(message: string, useMarkdown: boolean = true): Promise<void> {
    if (!this.chatId) {
      logError('CHAT_ID is not specified for sending messages.');
      return;
    }
    await this.sendMessageToChat(this.chatId, message, useMarkdown);
  }

  /**
   * Registers a handler for the on-demand analysis command.
   * @param callback Function to be called upon receiving the /analyze command
   */
  public registerAnalyzeCommand(callback: (chatId: number) => Promise<void>): void {
    this.bot.onText(/^\/analyze/, async (msg) => {
      const chatId = msg.chat.id;
      logInfo(`Received /analyze command from chat ${chatId}`);
      
      try {
        await callback(chatId);
      } catch (error) {
        logError('Error in /analyze command handler:', error);
        await this.sendMessageToChat(chatId, 'An error occurred while analyzing the market.');
      }
    });
  }

  /**
   * Registers a handler for the subscribe command.
   * @param callback Function to be called upon receiving the /subscribe command
   */
  public registerSubscribeCommand(callback: (chatId: number) => Promise<void>): void {
    this.bot.onText(/^\/subscribe/, async (msg) => {
      const chatId = msg.chat.id;
      logInfo(`Received /subscribe command from chat ${chatId}`);
      try {
        await callback(chatId);
      } catch (error) {
        logError('Error in /subscribe command handler:', error);
        await this.sendMessageToChat(chatId, 'An error occurred while subscribing.');
      }
    });
  }

  /**
   * Registers a handler for the unsubscribe command.
   * @param callback Function to be called upon receiving the /unsubscribe command
   */
  public registerUnsubscribeCommand(callback: (chatId: number) => Promise<void>): void {
    this.bot.onText(/^\/unsubscribe/, async (msg) => {
      const chatId = msg.chat.id;
      logInfo(`Received /unsubscribe command from chat ${chatId}`);
      try {
        await callback(chatId);
      } catch (error) {
        logError('Error in /unsubscribe command handler:', error);
        await this.sendMessageToChat(chatId, 'An error occurred while unsubscribing.');
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
        await this.sendMessageToChat(chatId, '🤖 Processing your custom request with Gemma 4...');
        await callback(chatId, text);
      } catch (error) {
        logError('Error in custom prompt handler:', error);
        await this.sendMessageToChat(chatId, 'An error occurred while processing your custom request.');
      }
    });
  }
}
