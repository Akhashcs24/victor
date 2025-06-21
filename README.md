# Victor HMA-55 Trading App

A personal-use web and mobile trading application built with React and TypeScript, designed to monitor HMA-55 crossover strategies on ATM options of Nifty 50, Bank Nifty, and Sensex using the Fyers API.

## Features

### 🔐 Authentication
- Secure authentication via Fyers API
- Token management with automatic refresh
- User profile validation

### 📊 Manual Data Control
- Manual contract symbol input (CE/PE)
- Historical data fetching for HMA calculation
- Open price locking for all indices
- Rate limit compliance (10/sec, 200/min, 100k/day)

### 📈 Strategy Monitoring
- HMA-55 crossover detection
- Real-time LTP monitoring
- Automatic trade execution on crossover
- Target and Stop Loss tracking
- Real-time P&L calculation

### 🎯 Trade Management
- Market and Limit order support
- Paper and Live trading modes
- Comprehensive trade logging
- Status tracking and error recovery

### 📱 Modern UI
- Responsive design with Tailwind CSS
- Real-time status indicators
- Clean, intuitive interface
- Mobile-ready layout

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Icons**: Lucide React
- **API**: Fyers v3 API
- **HTTP Client**: Axios

## Project Structure

```
src/
├── components/          # React components
│   ├── Header.tsx      # Status header with indicators
│   ├── AuthPanel.tsx   # Authentication interface
│   ├── TradingInterface.tsx # Main trading interface
│   ├── StrategyMonitoringCard.tsx # Individual contract monitoring
│   └── TradeLog.tsx    # Trade history display
├── services/           # Business logic services
│   ├── authService.ts  # Fyers authentication
│   ├── marketDataService.ts # Market data fetching
│   ├── hmaService.ts   # HMA calculations
│   └── symbolConfig.ts # Index and symbol configuration
├── types/              # TypeScript type definitions
│   └── index.ts        # All app types and interfaces
├── App.tsx             # Main application component
├── main.tsx            # Application entry point
└── index.css           # Global styles and Tailwind imports
```

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd victor-trading-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

## Configuration

### Fyers API Setup

1. Create a Fyers API application at [Fyers Developer Portal](https://api-docs.fyers.in/)
2. Note down your App ID and Secret
3. Set up your redirect URI
4. Configure the app with your credentials

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_FYERS_APP_ID=your_app_id
VITE_FYERS_SECRET=your_secret
VITE_REDIRECT_URI=your_redirect_uri
```

## Usage

### 1. Authentication
- Enter your Fyers API credentials
- Generate authentication URL
- Complete login in the new tab
- Paste the auth code to validate

### 2. Contract Setup
- Select your preferred index (Nifty/Bank Nifty/Sensex)
- Enter CE and PE option symbols manually
- Set quantities, target, and stop loss points
- Choose entry method (Market/Limit)

### 3. HMA Data Fetching
- Click "Fetch HMA Data" to get historical data
- App calculates HMA-55 for both contracts
- Verify HMA values are displayed correctly

### 4. Monitoring
- Click "Start Monitoring" to begin strategy monitoring
- App monitors 1-minute candle closes
- Triggers trades on HMA crossover
- Tracks target and stop loss automatically

### 5. Trade Management
- Monitor real-time P&L in strategy cards
- View trade history in the log panel
- Track entry/exit times and prices

## Strategy Logic

### HMA-55 Crossover
- Monitors 1-minute candle close LTPs
- Compares with 5-minute HMA-55 value
- Triggers entry when price crosses above HMA
- Places Market or Limit order based on selection

### Risk Management
- Configurable target and stop loss points
- Automatic exit on target/SL hit
- Real-time P&L tracking
- Trade logging for analysis

## API Rate Limits

The app respects Fyers API rate limits:
- **Per Second**: 10 requests
- **Per Minute**: 200 requests  
- **Per Day**: 100,000 requests

Manual control features help avoid hitting these limits.

## Safety Features

- **Token Validation**: Automatic token expiry checking
- **Error Recovery**: Retry mechanisms for failed API calls
- **Rate Limiting**: Built-in API call tracking
- **Manual Control**: User-initiated actions only
- **Status Monitoring**: Real-time system health tracking

## Development

### Running Tests
```bash
npm test
```

### Code Quality
- TypeScript for type safety
- ESLint for code linting
- Prettier for code formatting

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is for personal use only. Please ensure compliance with Fyers API terms of service and local trading regulations.

## Disclaimer

This application is for educational and personal use only. Trading involves substantial risk of loss and is not suitable for all investors. Past performance does not guarantee future results. Always consult with a qualified financial advisor before making trading decisions.

## Support

For issues and questions:
1. Check the documentation
2. Review the test files for expected behavior
3. Open an issue with detailed information

---

**Built with ❤️ for personal trading automation** 