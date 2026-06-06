import { ITriTimeframeMarketData, IDeterministicStructuralData } from '../types.js';

export function calculateStructuralData(marketData: ITriTimeframeMarketData): IDeterministicStructuralData {
  const candlesH4 = marketData.candlesH4 || [];
  const candlesM15 = marketData.candlesM15 || [];
  const candlesM5 = marketData.candlesM5 || [];

  if (candlesH4.length === 0 || candlesM15.length === 0 || candlesM5.length === 0) {
    return {
      htf_macro_high: 0,
      htf_macro_low: 0,
      htf_equilibrium: 0,
      mtf_dealing_high: 0,
      mtf_dealing_low: 0,
      mtf_equilibrium: 0,
      ltf_local_high: 0,
      ltf_local_low: 0,
      current_market_zone: 'Discount'
    };
  }

  // 1. HTF (4h) calculations
  const htf_macro_high = Number(Math.max(...candlesH4.map(c => c.high)).toFixed(5));
  const htf_macro_low = Number(Math.min(...candlesH4.map(c => c.low)).toFixed(5));
  const htf_equilibrium = Number(((htf_macro_high + htf_macro_low) / 2).toFixed(5));

  // 2. MTF (15min) core intraday calculations
  const mtf_dealing_high = Number(Math.max(...candlesM15.map(c => c.high)).toFixed(5));
  const mtf_dealing_low = Number(Math.min(...candlesM15.map(c => c.low)).toFixed(5));
  const mtf_equilibrium = Number(((mtf_dealing_high + mtf_dealing_low) / 2).toFixed(5));

  // 3. LTF (5min) local execution limits
  const ltf_local_high = Number(Math.max(...candlesM5.map(c => c.high)).toFixed(5));
  const ltf_local_low = Number(Math.min(...candlesM5.map(c => c.low)).toFixed(5));

  // 4. Current Market Zone evaluation against MTF Equilibrium
  const current_close = candlesM5[candlesM5.length - 1].close;
  const current_market_zone = current_close > mtf_equilibrium ? 'Premium' : 'Discount';

  return {
    htf_macro_high,
    htf_macro_low,
    htf_equilibrium,
    mtf_dealing_high,
    mtf_dealing_low,
    mtf_equilibrium,
    ltf_local_high,
    ltf_local_low,
    current_market_zone
  };
}
