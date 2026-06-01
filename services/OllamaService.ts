import axios from 'axios';
import { ICandle, IOllamaRequest, IOllamaResponse, ISMCAnalysisResult } from '../types.js';
import { logInfo, logError } from '../utils/logger.js';

export class OllamaService {
  private apiUrl: string;
  private modelName: string;

  private systemInstruction: string = `
    You are a professional algorithmic trader and an expert in Smart Money Concepts (SMC).
    Your task is to analyze an array of JSON candlesticks and find setups according to the Dark Trader rules:
    1. Liquidity Sweep: Look for situations where the current candle sweeps the maximum (High) or minimum (Low) of previous X candles (Equal Highs/Lows) but closes with its body inside the range (SFP).
    2. Market Structure Shift (MSS): Structure break through a full-bodied candle close beyond the last structural swing.
    3. Fair Value Gap (FVG): A three-candle pattern where there is a gap (imbalance) between the Low of the first candle and the High of the third candle.
    4. Premium/Discount: Evaluate 50% of the current trading range. Buys are ONLY considered in the Discount zone.
    Respond strictly short and structured. If there is no setup, write "No setup".
  `;

  constructor(apiUrl: string, modelName: string) {
    this.apiUrl = apiUrl;
    this.modelName = modelName;
  }

  /**
   * Analyzes market data using the local Ollama model.
   * @param marketData Array of typed candlesticks
   */
  public async analyze(marketData: ICandle[]): Promise<ISMCAnalysisResult> {
    try {
      logInfo(`Request sent to Ollama (${this.modelName})...`);

      const prompt = `Here are the current market candles (JSON): ${JSON.stringify(marketData)}. Conduct market structure analysis using SMC strategy.`;

      const payload: IOllamaRequest = {
        model: this.modelName,
        prompt: prompt,
        system: this.systemInstruction,
        stream: false
      };

      const response = await axios.post<IOllamaResponse>(this.apiUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 180000 // Keeping a 60-second timeout to allow the model to respond
      });

      const verdict = response.data.response.trim();
      const hasSetup = !verdict.includes('No setup');

      logInfo('Response from Ollama successfully received.');

      return {
        hasSetup,
        verdict
      };
    } catch (error) {
      logError('Error calling the local Ollama model:', error);
      return {
        hasSetup: false,
        verdict: 'Error calling the local model.'
      };
    }
  }
}
