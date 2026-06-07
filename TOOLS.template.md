# TOOLS.md - Workspace Tools

This file registers the environment-specific tools available to the agent.

## Available Tools

### get_market_data

- **Description**: Fetches the latest 3-timeframe (H4, M15, M5) candlestick data and pre-calculated deterministic structural data for EUR/USD from the SMC backend.
- **Usage**: `python tools/get_market_data.py`
- **Output**: Returns a JSON object with market metadata, structural data, and enriched candles.

### todays_high_impact_news

- **Description**: Fetches today's high and medium impact economic news events for EUR/USD.
- **Usage**: `python tools/todays_high_impact_news.py`
- **Output**: Returns a JSON object containing a brief description of the news list, Kyiv fetch time, and today's news events.
