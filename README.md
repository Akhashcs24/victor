# Victor 3.0

A trading application for automated strategy monitoring and execution.

## Project Structure

- **client**: Frontend React application built with Vite, TypeScript, and Tailwind CSS
- **server**: Backend Node.js server providing API services
- **backup**: Reference materials and previous versions

## Features

- Authentication with Fyers API
- Real-time market data monitoring
- Strategy implementation with HMA (Hull Moving Average)
- Trade execution and logging
- Multiple symbol monitoring

## Setup

### Prerequisites

- Node.js (v14+)
- npm or yarn

### Client Setup

```bash
cd client
npm install
npm run dev
```

### Server Setup

```bash
cd server
npm install
npm start
```

## Environment Variables

### Backend

- `PORT` - Port to run the server on (default: 5000)
- `CLIENT_URL` - URL of the frontend client (for CORS)
- `FYERS_APP_ID` - Your Fyers API app ID
- `FYERS_APP_SECRET` - Your Fyers API app secret

### Frontend

- `VITE_API_URL` - URL of the backend API server

## Development

The application uses:
- React for the frontend UI
- TypeScript for type safety
- Tailwind CSS for styling
- Node.js for the backend
- Fyers API for market data and trading

## Deployment

### Backend (Server)

The backend can be deployed to platforms like Render or Railway. See the [server README](./server/README.md) for detailed instructions.

### Frontend (Client)

The frontend can be deployed to platforms like Vercel or Netlify. See the [client README](./client/README.md) for detailed instructions.

## License

[MIT](LICENSE)
