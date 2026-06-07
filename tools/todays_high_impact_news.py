import urllib.request
import json

def get_todays_news() -> dict:
    """
    Fetches the today's high and medium impact economic news for EUR/USD.
    
    Returns:
        dict: A dictionary containing high/medium-impact news events.
    """
    url = "http://localhost:3000/api/todays-high-impact-news"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        return {"error": f"Failed to fetch todays news: {str(e)}"}

if __name__ == "__main__":
    print(json.dumps(get_todays_news()))
