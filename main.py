import requests
import time

# Configuration
MARKETS_BASE_URL = "https://gamma-api.polymarket.com"
CLOB_BASE_URL = "https://clob.polymarket.com"


def get_market_price_histories():
    # 1. Fetch the first 50 markets ordered by lowerBound ascending
    # Note: 'lowerBound' is the field, 'ascending=True' is the direction
    market_params = {"limit": 50, "order": "lowerBound", "ascending": "true"}

    print(f"Fetching markets ordered by lowerBound...")
    markets_response = requests.get(f"{MARKETS_BASE_URL}/markets", params=market_params)
    markets_response.raise_for_status()
    markets = markets_response.json()

    results = []

    # 2. Iterate through markets and fetch 24h history for each
    # The 'interval' parameter '1d' covers the last 24 hours
    for market in markets:
        market_id = market.get("id")
        question = market.get("question")

        # We need the CLOB token ID to fetch price history
        # Markets can have multiple tokens; we'll check clobTokenIds
        token_ids = market.get("clobTokenIds")
        if not token_ids:
            continue

        # clobTokenIds is often a stringified list like '["123", "456"]'
        # We'll take the first one available
        import json

        try:
            tokens = json.loads(token_ids)
            target_token = tokens[0]
        except:
            continue
        print(tokens, target_token)

        history_params = {
            "market": target_token,
            "interval": "1h",
            "fidelity": 1,  # Data points every 60 minutes
        }

        try:
            history_response = requests.get(
                f"{CLOB_BASE_URL}/prices-history", params=history_params
            )
            if history_response.status_code == 200:
                history_data = history_response.json()
                results.append(
                    {
                        "market_id": market_id,
                        "question": question,
                        "history": history_data.get("history", []),
                    }
                )
                print(f"Retrieved history for: {question[:50]}...")
            else:
                print(f"Could not fetch history for token {target_token}")
        except Exception as e:
            print(f"Error fetching history for market {market_id}: {e}")
    print(results)
    return results


def analyze_profit_potential(history_data):
    """
    Analyze if buying at the start of the 60-minute period would be profitable.
    Returns tuple: (would_make_money, profit_amount, start_price, end_price)
    """
    history = history_data.get("history", [])

    if len(history) < 2:
        return None, None, None, None

    # Get first (start) and last (end) price points
    start_price = history[0].get("price", 0)
    end_price = history[-1].get("price", 0)

    # Calculate profit (assuming $1 invested)
    # If price goes from 0.30 to 0.40, profit is (0.40 - 0.30) / 0.30 = 33.33%
    if start_price > 0:
        profit_amount = end_price - start_price
        would_make_money = profit_amount > 0
        return would_make_money, profit_amount, start_price, end_price

    return None, None, None, None


if __name__ == "__main__":
    data = get_market_price_histories()
    print(f"\nSuccessfully processed {len(data)} markets.")

    print("\n" + "=" * 80)
    print("PROFITABILITY ANALYSIS (60-minute period)")
    print("=" * 80)

    profitable_count = 0
    total_analyzed = 0

    for market_data in data:
        market_id = market_data.get("market_id")
        question = market_data.get("question", "Unknown")

        would_make_money, profit_amount, start_price, end_price = (
            analyze_profit_potential(market_data)
        )

        if would_make_money is not None:
            total_analyzed += 1
            status = "PROFIT" if would_make_money else "LOSS"
            profit_pct = (profit_amount / start_price * 100) if start_price > 0 else 0

            if would_make_money:
                profitable_count += 1

            print(f"\nMarket: {question[:60]}...")
            print(f"  Start Price: ${start_price:.4f}")
            print(f"  End Price:   ${end_price:.4f}")
            print(
                f"  Result:      {status} of ${profit_amount:.4f} ({profit_pct:+.2f}%)"
            )

    print("\n" + "=" * 80)
    print(
        f"SUMMARY: {profitable_count}/{total_analyzed} markets would have been profitable"
    )
    print("=" * 80)
