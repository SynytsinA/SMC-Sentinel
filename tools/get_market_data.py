import urllib.request
import json

def get_market_data() -> dict:
    """
    Fetches the latest 3-timeframe (H4, M15, M5) candlestick data and pre-calculated deterministic structural data for EUR/USD from the SMC backend.
    
    Returns:
        dict: A dictionary containing market metadata, structural data, and enriched candles.
    """
    url = "http://localhost:3000/api/market-data"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        return {"error": f"Failed to fetch market data from SMC backend: {str(e)}"}

if __name__ == "__main__":
    print(json.dumps(get_market_data()))
