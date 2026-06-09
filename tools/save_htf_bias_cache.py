import sys
import urllib.request
import json

def save_cache(timestamp: int, bias_text: str):
    url = "http://localhost:3000/api/market-data/cache"
    data = {
        "last_h4_timestamp": timestamp,
        "htf_bias_text": bias_text
    }
    req_body = json.dumps(data).encode("utf-8")
    
    try:
        req = urllib.request.Request(
            url, 
            data=req_body, 
            headers={"Content-Type": "application/json"}, 
            method="POST"
        )
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            print(json.dumps(res_data))
    except Exception as e:
        print(json.dumps({"error": f"Failed to save cache: {str(e)}"}))

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python3 save_htf_bias_cache.py <timestamp> <bias_text>"}))
        sys.exit(1)
        
    try:
        ts = int(sys.argv[1])
    except ValueError:
        print(json.dumps({"error": "Timestamp must be an integer"}))
        sys.exit(1)
        
    text = sys.argv[2]
    save_cache(ts, text)
