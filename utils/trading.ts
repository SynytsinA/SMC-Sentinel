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

  // 5. OTE levels, SL, TP, and Risk-to-Reward ratio calculations
  const mtf_range = Number((mtf_dealing_high - mtf_dealing_low).toFixed(5));

  // Long OTE calculations (0.62 and 0.705 Fibonacci levels measured from high downwards)
  const ote_long_entry_062 = Number((mtf_dealing_high - mtf_range * 0.62).toFixed(5));
  const ote_long_entry_0705 = Number((mtf_dealing_high - mtf_range * 0.705).toFixed(5));
  const ote_long_sl = Number((mtf_dealing_low - 0.00015).toFixed(5));
  const ote_long_tp = mtf_dealing_high;

  const long_risk_062 = ote_long_entry_062 - ote_long_sl;
  const long_reward_062 = ote_long_tp - ote_long_entry_062;
  const ote_long_rr_062 = long_risk_062 > 0 ? Number((long_reward_062 / long_risk_062).toFixed(2)) : 0;

  const long_risk_0705 = ote_long_entry_0705 - ote_long_sl;
  const long_reward_0705 = ote_long_tp - ote_long_entry_0705;
  const ote_long_rr_0705 = long_risk_0705 > 0 ? Number((long_reward_0705 / long_risk_0705).toFixed(2)) : 0;

  // Short OTE calculations (0.62 and 0.705 Fibonacci levels measured from low upwards)
  const ote_short_entry_062 = Number((mtf_dealing_low + mtf_range * 0.62).toFixed(5));
  const ote_short_entry_0705 = Number((mtf_dealing_low + mtf_range * 0.705).toFixed(5));
  const ote_short_sl = Number((mtf_dealing_high + 0.00015).toFixed(5));
  const ote_short_tp = mtf_dealing_low;

  const short_risk_062 = ote_short_sl - ote_short_entry_062;
  const short_reward_062 = ote_short_entry_062 - ote_short_tp;
  const ote_short_rr_062 = short_risk_062 > 0 ? Number((short_reward_062 / short_risk_062).toFixed(2)) : 0;

  const short_risk_0705 = ote_short_sl - ote_short_entry_0705;
  const short_reward_0705 = ote_short_entry_0705 - ote_short_tp;
  const ote_short_rr_0705 = short_risk_0705 > 0 ? Number((short_reward_0705 / short_risk_0705).toFixed(2)) : 0;

  // Determine order types based on current close price (last closed M5 candle)
  const ote_long_order_type_062 = ote_long_entry_062 < current_close ? 'Buy Limit' : 'Buy Stop';
  const ote_long_order_type_0705 = ote_long_entry_0705 < current_close ? 'Buy Limit' : 'Buy Stop';
  const ote_short_order_type_062 = ote_short_entry_062 > current_close ? 'Sell Limit' : 'Sell Stop';
  const ote_short_order_type_0705 = ote_short_entry_0705 > current_close ? 'Sell Limit' : 'Sell Stop';

  return {
    htf_macro_high,
    htf_macro_low,
    htf_equilibrium,
    mtf_dealing_high,
    mtf_dealing_low,
    mtf_equilibrium,
    ltf_local_high,
    ltf_local_low,
    current_market_zone,
    ote_long_entry_062,
    ote_long_entry_0705,
    ote_long_sl,
    ote_long_tp,
    ote_long_rr_062,
    ote_long_rr_0705,
    ote_long_order_type_062,
    ote_long_order_type_0705,
    ote_short_entry_062,
    ote_short_entry_0705,
    ote_short_sl,
    ote_short_tp,
    ote_short_rr_062,
    ote_short_rr_0705,
    ote_short_order_type_062,
    ote_short_order_type_0705
  };
}
