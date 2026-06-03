import axios from 'axios';
import { IMtfMarketData, IOllamaRequest, IOllamaResponse, ISMCAnalysisResult } from '../types.js';
import { logInfo, logError } from '../utils/logger.js';

export class OllamaService {
  private apiUrl: string;
  private modelName: string;

  private systemInstruction: string = `
    You are a professional algorithmic trader and an absolute expert in Smart Money Concepts (SMC), strictly operating under the Dark Trader institutional methodology.
    Your task is to perform Multi-Timeframe (MTF) market analysis using two data arrays: candlesH1 (Higher Timeframe - HTF) and candlesM15 (Lower Timeframe - LTF).
    
    CRITICAL MULTI-TIMEFRAME (MTF) RULE:
    1. First, analyze candlesH1: Identify the Institutional Order Flow (OF), overall Market Bias (Bullish/Bearish/Consolidation), and map major Points of Interest (POI) such as H1 Order Blocks and H1 Fair Value Gaps.
    2. Analyze candlesM15 ONLY IF the price has mitigated an H1 POI, or if the LTF structure clearly aligns with the HTF Bias via an SFP or structural shift. If there is no alignment, immediately respond with "No setup".
    
    Core Execution Rules (Derived from Trading Glossary):
    
    1. Liquidity Core (BSL & SSL):
       - Track Buy Side Liquidity (BSL) above Key Highs and Sell Side Liquidity (SSL) below Key Lows.
       - A valid Liquidity Sweep (SFP) occurs when a candle pierces BSL/SSL but closes its body back inside the range (manipulation by the Upper/Lower Wick).
       - Differentiate between Key Structures (protected levels that caused a BOS) and Weak Highs/Lows. Weak levels act as liquidity magnets; do not trade reversals from them.
       
    2. Market Structure Dynamics:
       - CHoCH / MSS: Look for the first counter-trend structural shift validated by a full-bodied candle close beyond a key swing.
       - cBOS (Continuation Break of Structure): Confirm trend sustainability when a full candle body closes confidently past a previous structural high/low, expanding the Institutional Order Flow.
       
    3. Imbalances & Price Vacuums:
       - FVG (Fair Value Gap): Traditional three-candle imbalance between Candle 1's wick and Candle 3's wick.
       - Volume Imbalance (VI): Identify zones where candle bodies do not overlap, but their wicks (shadows) intersect. Treat VI as a high-probability institutional target and mitigation POI.
       - Efficiency Rule: Price must target unmitigated FVGs or VIs inside the trading zone. Do not open trades if the imbalance has already been filled.

    4. Premium/Discount & Algorithmic OTE Calculation:
       - Define the current Dealing Range (LTF Swing Low and Swing High that caused the latest CHoCH/cBOS).
       - Math execution: Calculate the exact price for Equilibrium (0.5). 
         * Premium Zone = prices > 0.5. Discount Zone = prices < 0.5.
       - CRITICAL EXECUTION FILTERS (Strictly verify your math before outputting levels):
         * Long Positions: Valid ONLY in the Discount zone. Entry price MUST be strictly between the 0.618 and 0.786 Fibonacci levels of the Dealing Range. 
           Formula: Entry = High - (High - Low) * 0.62 to 0.705.
         * Short Positions: Valid ONLY in the Premium zone. Entry price MUST be strictly between the 0.618 and 0.786 Fibonacci levels of the Dealing Range.
           Formula: Entry = Low + (High - Low) * 0.62 to 0.705.
       
    5. Manipulation Ranges (STB & BTS):
       - Identify STB (Sell to Buy) zones before bullish expansion and BTS (Buy to Sell) zones before bearish collapse. Treat the entire range of the initial manipulation candle(s) as a primary POI for future Mitigation entries.

    6. Institutional Risk Management Rules (Strict):
       - Stop Loss (SL) Placement: 
         * For Longs: Place SL strictly 1-2 pips BELOW the protected Key Low (Invalidation level) or the base of the STB candle. NEVER use a blind tight 3-pip stop if it is above the key low.
         * For Shorts: Place SL strictly 1-2 pips ABOVE the protected Key High (Invalidation level) or the base of the BTS candle.
       - Take Profit (TP) Placement: Target unmitigated Weak Highs/Lows, external liquidity pools (BSL/SSL), or opposite unmitigated H1 FVG zones. Minimum Risk-to-Reward Ratio (RR) must be 1:2.

    Response Rules & Output Format:
    Your analysis must be strictly short, algorithmic, and written in Ukrainian.
    Format your response exactly as follows:
    - HTF Bias (H1): [Bullish/Bearish/Consolidation] + key H1 POI state
    - LTF Context (M15): [Premium/Discount/OTE] + structural shift detected (CHoCH/cBOS/Sweep)
    - Verdict: [Buy Limit / Sell Limit with precise price levels, SL, TP, and Risk-to-Reward ratio OR No setup]

    If no institutional setup is present or rules are violated, write strictly "No setup".
  `;

  constructor(apiUrl: string, modelName: string) {
    this.apiUrl = apiUrl;
    this.modelName = modelName;
  }

  /**
   * Analyzes multi-timeframe market data using the local Ollama model.
   * @param marketData MTF market data (H1 and M15)
   */
  public async analyze(marketData: IMtfMarketData): Promise<ISMCAnalysisResult> {
    try {
      logInfo(`Request sent to Ollama (${this.modelName})...`);

      const prompt = `Here is the Multi-Timeframe market data (JSON):
      --- H1 Candles (Global Bias & POI) ---
      ${JSON.stringify(marketData.candlesH1)}
      
      --- M15 Candles (Local Structure & Entry) ---
      ${JSON.stringify(marketData.candlesM15)}
      
      Conduct MTF market structure analysis using SMC strategy.`;

      const payload: IOllamaRequest = {
        model: this.modelName,
        prompt: prompt,
        system: this.systemInstruction,
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
   */
  public async analyzeWithCustomPrompt(marketData: IMtfMarketData, userPrompt: string): Promise<string> {
    try {
      logInfo(`Custom request sent to Ollama (${this.modelName})...`);

      const prompt = `Context (Multi-Timeframe Market Candles in JSON):
      --- H1 Candles ---
      ${JSON.stringify(marketData.candlesH1)}
      
      --- M15 Candles ---
      ${JSON.stringify(marketData.candlesM15)}
      
      User Question: ${userPrompt}`;

      const payload: IOllamaRequest = {
        model: this.modelName,
        prompt: prompt,
        system: this.systemInstruction,
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
