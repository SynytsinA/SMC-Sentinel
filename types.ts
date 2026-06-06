export interface ICandle {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  isFractalHigh?: boolean;
  isFractalLow?: boolean;
  fvg?: { type: 'Bullish' | 'Bearish'; top: number; bottom: number } | null;
}

export interface ITriTimeframeMarketData {
  candlesH4: ICandle[];
  candlesM15: ICandle[];
  candlesM5: ICandle[];
}

export interface IDeterministicStructuralData {
  htf_macro_high: number;
  htf_macro_low: number;
  htf_equilibrium: number;
  mtf_dealing_high: number;
  mtf_dealing_low: number;
  mtf_equilibrium: number;
  ltf_local_high: number;
  ltf_local_low: number;
  current_market_zone: 'Premium' | 'Discount';
}

export interface IOllamaRequest {
  deterministic_structural_data?: IDeterministicStructuralData;
  model: string;
  prompt: string;
  system: string;
  stream: boolean;
}


export interface IOllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface ISMCAnalysisResult {
  hasSetup: boolean;
  verdict: string;
}

export interface IForexNewsEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
}

export interface ITodaysNewsFile {
  fetchedForDate: string; // 'YYYY-MM-DD'
  news: IForexNewsEvent[];
}
