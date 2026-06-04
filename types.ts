export interface ICandle {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface IMtfMarketData {
  candlesH1: ICandle[];
  candlesM15: ICandle[];
}

export interface IOllamaRequest {
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
