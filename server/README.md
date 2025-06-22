# Victor 3.0 Backend Server

This is the backend server for the Victor 3.0 trading application. It provides API endpoints for authentication, market data, trading, and more.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file in the server directory with the following variables:
   ```
   PORT=5000
   CLIENT_URL=http://localhost:3000
   FYERS_APP_ID=your_fyers_app_id
   FYERS_APP_SECRET=your_fyers_app_secret
   ```

3. Start the server:
   ```
   npm start
   ```

## Development

For development with auto-reload:
```
npm run dev
```

## API Endpoints

- `GET /api/health` - Check if the server is running
- `POST /api/login` - Generate Fyers OAuth URL
- `POST /api/fyers-callback` - Handle Fyers OAuth callback
- `GET /api/profile` - Get user profile
- `GET /api/market-data/historical` - Get historical market data
- `GET /api/market-data/quotes` - Get market quotes
- `GET /api/market-data/depth` - Get market depth
- `GET /api/hma-calc` - Calculate HMA for a symbol
- `GET /api/symbols/index-config` - Get index configuration
- `GET /api/symbols/strike-symbols` - Generate strike symbols
- `GET /api/symbols/expiry-dates` - Get expiry dates
- `GET /api/trade-logs/today` - Get today's trade logs
- `POST /api/orders` - Place an order
- `GET /api/orders` - Get order history

## Deployment

### Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure the following:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Add environment variables in the Render dashboard
5. Deploy

### Railway

1. Create a new project on Railway
2. Connect your GitHub repository
3. Add environment variables in the Railway dashboard
4. Deploy

## Environment Variables

- `PORT` - Port to run the server on (default: 5000)
- `CLIENT_URL` - URL of the frontend client (for CORS)
- `FYERS_APP_ID` - Your Fyers API app ID
- `FYERS_APP_SECRET` - Your Fyers API app secret

## Notes
- The backend will expose API endpoints for the frontend (e.g., `/api/login`, `/api/fyers-callback`).
- Make sure to keep your `.env` file safe and never commit it to GitHub.
- All commands use `;` instead of `&&` for PowerShell compatibility.

---

*For any issues, check the frontend README or ask for help!* 