import { IMtfMarketData, IDeterministicStructuralData } from '../types.js';

/**
 * Calculates strict market ranges, equilibrium, and Premium/Discount zone deterministically.
 */
export function calculateStructuralData(marketData: IMtfMarketData): IDeterministicStructuralData {
  const candlesH1 = marketData.candlesH1;
  const candlesM15 = marketData.candlesM15;

  if (candlesH1.length === 0 || candlesM15.length === 0) {
    return {
      macro_key_high: 0,
      macro_key_low: 0,
      intraday_local_high: 0,
      intraday_local_low: 0,
      intraday_equilibrium: 0,
      current_market_zone: 'Discount'
    };
  }

  const macro_key_high = Number(Math.max(...candlesH1.map(c => c.high)).toFixed(5));
  const macro_key_low = Number(Math.min(...candlesH1.map(c => c.low)).toFixed(5));

  const intraday_local_high = Number(Math.max(...candlesM15.map(c => c.high)).toFixed(5));
  const intraday_local_low = Number(Math.min(...candlesM15.map(c => c.low)).toFixed(5));

  const intraday_equilibrium = Number(((intraday_local_high + intraday_local_low) / 2).toFixed(5));

  const latestM15 = candlesM15[candlesM15.length - 1];
  const current_close = latestM15.close;
  const current_market_zone = current_close > intraday_equilibrium ? 'Premium' : 'Discount';

  return {
    macro_key_high,
    macro_key_low,
    intraday_local_high,
    intraday_local_low,
    intraday_equilibrium,
    current_market_zone
  };
}
