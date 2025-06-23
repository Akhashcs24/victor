# Victor Trading App - Backend Server

This is the backend server for the Victor Trading App, a trading application that integrates with the Fyers API.

## Features

- Authentication with Fyers API
- Market data fetching
- Trading state management
- Trade logging
- HMA (Hull Moving Average) calculation service

## Environment Variables

The following environment variables are required:

- `NODE_ENV`: Set to `production` for production deployment
- `CLIENT_URL`: URL of the client application for CORS
- `PORT`: (Optional) Port to run the server on, defaults to 5000

## Deployment

This server is designed to be deployed on Render.com. The `render.yaml` file contains the configuration for deployment.

## Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the server: `npm start`
4. For development with hot reload: `npm run dev`

## API Endpoints

- `/api/health`: Health check endpoint
- `/api/login`: Generate Fyers auth URL
- `/api/fyers-callback`: Handle Fyers auth callback
- `/api/profile`: Get user profile
- `/api/market-data/historical`: Get historical market data
- `/api/market-data/quotes`: Get market quotes
- `/api/market-data/depth`: Get market depth
- `/api/trade-log`: Trade logging endpoints
- `/api/trading-state`: Trading state endpoints
