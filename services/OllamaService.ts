import axios from 'axios';
import { IMtfMarketData, IOllamaRequest, IOllamaResponse, ISMCAnalysisResult } from '../types.js';
import { logInfo, logError } from '../utils/logger.js';

export class OllamaService {
  private apiUrl: string;
  private modelName: string;
  private systemInstruction: string;
  private responseFormat: string;

  constructor(apiUrl: string, modelName: string, systemInstruction?: string, responseFormat?: string) {
    this.apiUrl = apiUrl;
    this.modelName = modelName;
    this.systemInstruction = systemInstruction || 'You are a professional assistant. Analyze the input data and provide structured insights.';
    this.responseFormat = responseFormat || `
    Response Rules & Output Format:
      Provide a structured summary of your analysis based on the input data.
    `;
  }

  /**
   * Analyzes multi-timeframe market data using the local Ollama model.
   * @param marketData MTF market data (H1 and M15)
   * @param newsContext Optional active news context to warn the model
   */
  public async analyze(marketData: IMtfMarketData, newsContext?: string): Promise<ISMCAnalysisResult> {
    try {
      logInfo(`Request sent to Ollama (${this.modelName})...`);

      let prompt = `Here is the Multi-Timeframe market data (JSON):
      --- H1 Candles (Global Bias & POI) ---
      ${JSON.stringify(marketData.candlesH1)}
      
      --- M15 Candles (Local Structure & Entry) ---
      ${JSON.stringify(marketData.candlesM15)}
      
      Conduct market analysis based on the provided data.`;

      if (newsContext) {
        prompt = `⚠️ ECONOMIC NEWS ALERT:\n${newsContext}\n\n${prompt}`;
      }
      let activeSystemInstruction = this.systemInstruction + this.responseFormat;

      if (newsContext) {
        activeSystemInstruction += `
        
        CRITICAL ECONOMIC NEWS RULE:
        There are active high/medium impact economic news events near the current time.
        1. You MUST explicitly warn the user about these news events inside the "Verdict" or "LTF Context" field (e.g., listing the news events and warning about high volatility and potential liquidity sweeps).
        2. Adjust your risk assessment accordingly. If the news is extremely close (e.g., within 15-30 minutes), prefer "No setup" due to high risk of slippage and unpredictable news wicks, or clearly label the setup as HIGH RISK.
        `;
      }

      const payload: IOllamaRequest = {
        model: this.modelName,
        prompt: prompt,
        system: activeSystemInstruction,
        stream: false
      };

      const response = await axios.post<IOllamaResponse>(this.apiUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 0 // Unlimited timeout for local LLM to process large MTF context
      });

      const verdict = response.data.response.trim();
      const hasSetup = !verdict.includes('No setup');

      logInfo('Response from Ollama successfully received.');

      return {
        hasSetup,
        verdict
      };
    } catch (error: any) {
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        logError('Ollama request timed out or was aborted. The model might be overloaded.', error.message);
      } else {
        logError('Error calling the local Ollama model:', error);
      }
      return {
        hasSetup: false,
        verdict: 'Error calling the local model.'
      };
    }
  }

  /**
   * Analyzes multi-timeframe market data along with a custom user prompt using the local Ollama model.
   * @param marketData MTF market data (H1 and M15)
   * @param userPrompt The custom question or prompt from the user
   * @param newsContext Optional active news context to warn the model
   */
  public async analyzeWithCustomPrompt(marketData: IMtfMarketData, userPrompt: string, newsContext?: string): Promise<string> {
    try {
      logInfo(`Custom request sent to Ollama (${this.modelName})...`);

      let prompt = `Context (Multi-Timeframe Market Candles in JSON):
      --- H1 Candles ---
      ${JSON.stringify(marketData.candlesH1)}
      
      --- M15 Candles ---
      ${JSON.stringify(marketData.candlesM15)}`;

      if (newsContext) {
        prompt = `⚠️ ECONOMIC NEWS ALERT:\n${newsContext}\n\n${prompt}`;
      }

      prompt += `\n\nUser Question: ${userPrompt}`;

      const responseFormat = `
    Response Rules & Output Format:
      Answer the user's custom question or prompt directly and concisely in Ukrainian, using the market data as context.
      Do NOT use the standard three-field format ("HTF Bias", "LTF Context", "Verdict") unless specifically requested by the user.
      Answer in a free-form, conversational but professional trading response tailored exactly to the user's question.
      `;

      let activeSystemInstruction = this.systemInstruction + responseFormat;

      if (newsContext) {
        activeSystemInstruction += `
        
        CRITICAL ECONOMIC NEWS RULE:
        There are active high/medium impact economic news events. You MUST explicitly mention/warn the user about these news events in your response, listing the events and warning about high volatility.
        `;
      }

      const payload: IOllamaRequest = {
        model: this.modelName,
        prompt: prompt,
        system: activeSystemInstruction,
        stream: false
      };

      const response = await axios.post<IOllamaResponse>(this.apiUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 0
      });

      logInfo('Custom response from Ollama successfully received.');
      return response.data.response.trim();
    } catch (error: any) {
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        logError('Custom Ollama request timed out or was aborted.', error.message);
      } else {
        logError('Error processing custom prompt with local Ollama model:', error);
      }
      return 'Error processing your custom request.';
    }
  }
}
