import urllib.request
import json
import os

def get_market_data() -> dict:
    """
    Fetches the latest 3-timeframe (H4, M15, M5) candlestick data and pre-calculated deterministic structural data for EUR/USD from the SMC backend.
    Optimizes token context by loading cached HTF analysis if the H4 candle timestamp has not changed.
    
    Returns:
        dict: A dictionary containing market metadata, structural data, and enriched candles.
    """
    url = "http://localhost:3000/api/market-data"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req) as response:
            api_data = json.loads(response.read().decode("utf-8"))
    except Exception as e:
        return {"error": f"Failed to fetch market data from SMC backend: {str(e)}"}
    
    # Path to HTF analysis cache (written by the agent)
    cache_path = "data/htf_analysis_cache.json"
    
    if "candles_h4" in api_data and len(api_data["candles_h4"]) > 0:
        latest_h4 = api_data["candles_h4"][-1]
        latest_timestamp = latest_h4.get("timestamp")
        
        if os.path.exists(cache_path):
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    cache_data = json.load(f)
                
                # Omit full candles_h4 array to save tokens if cached timestamp matches the latest closed H4 candle
                if cache_data.get("last_h4_timestamp") == latest_timestamp and cache_data.get("htf_bias_text"):
                    api_data["candles_h4"] = []
                    api_data["cached_htf_bias"] = cache_data["htf_bias_text"]
                    if "info" in api_data:
                        api_data["info"] += " Note: candles_h4 list was omitted because the HTF analysis for the current H4 candle is already cached in cached_htf_bias."
            except Exception:
                # If parsing/reading cache fails, fallback to passing full candles_h4 list
                pass
                
    return api_data

if __name__ == "__main__":
    print(json.dumps(get_market_data()))
