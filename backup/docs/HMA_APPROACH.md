🛠 Rewrite and enhance the HMAService in this trading app:

🎯 Goal:
- Rebuild the HMA calculation service to handle PE & CE symbols simultaneously.
- It must gracefully handle cases where symbols are invalid, expired, or don't have enough candle data.

📥 Input:
- Two option symbols (e.g. `NSE:NIFTY24500CE` and `NSE:NIFTY24500PE`)
- 5-min OHLCV data from Fyers API
- Must calculate HMA(55) using the same logic as defined in the `@HMA_calculation_pine.md`.

✅ Features to include:
1. **Market-Aware Time Logic**:
   - Know if current time is within market hours (9:15 AM to 3:30 PM IST).
   - Calculate last 300 market minutes (60 x 5-min candles) backward from now.
   - If current time is before market open or after close, use the latest full market day.
   - Include fallback to fetch across multiple dates (ignore weekends/holidays).

2. **Dual Symbol Handling**:
   - Accept both CE and PE symbols.
   - Calculate and return both HMA values.
   - Errors from one symbol should not block the other.

3. **Error Detection**:
   - Clearly log and throw errors if:
     - The symbol is invalid
     - Fyers returns 422
     - Less than 60 candles are found
   - Include which symbol failed and why.

4. **Smart Retry and Fallback**:
   - Retry across 5 past trading days (at max) to accumulate 60 valid 5-min candles.
   - Skip holidays and weekends.

5. **Caching**:
   - Cache candles and HMA value per symbol.
   - Cache expiry after 5 minutes or on symbol change.

6. **Live Monitoring**:
   - When within market hours, keep updating every 5 minutes using new data.
   - If symbol changes or component unmounts, cancel monitoring.

💡 Expected Output:
A cleanly separated HMAService class with:
- `fetchAndCalculateHMA(symbol)`
- `fetchHMAForSymbols(ceSymbol, peSymbol)`
- `fetchMarketAwareCandles(symbol)`
- Error logs and clean return interface

💬 Notes:
- Use detailed logging (e.g., "⛔ Invalid symbol", "⚠️ Found only 45 candles, need 60")
- Do not crash if only one of CE or PE fails; return partial result + reason
