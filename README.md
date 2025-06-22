# Victor 3.0

Victor 3.0 is a trading application for the Fyers platform, featuring HMA-based option trading strategy monitoring and execution.

## Project Structure

The application is split into two parts:

- **Client**: React frontend application (in `/client`)
- **Server**: Express backend API (in `/server`)

## Quick Start

### Using the restart-servers.bat script (Windows)

The easiest way to start both the client and server is to run the `restart-servers.bat` script:

```
./restart-servers.bat
```

This will start both the backend server on port 5000 and the frontend client on port 3000.

### Manual Setup

#### Backend Server

1. Navigate to the server directory:
   ```
   cd server
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
   PORT=5000
   CLIENT_URL=http://localhost:3000
   FYERS_APP_ID=your_fyers_app_id
   FYERS_APP_SECRET=your_fyers_app_secret
   ```

4. Start the server:
   ```
   npm start
   ```

#### Frontend Client

1. Navigate to the client directory:
   ```
   cd client
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
   VITE_API_URL=http://localhost:5000
   ```

4. Start the development server:
   ```
   npm run dev
   ```

## Deployment

### Backend (Server)

The backend can be deployed to platforms like Render or Railway. See the [server README](./server/README.md) for detailed instructions.

### Frontend (Client)

The frontend can be deployed to platforms like Vercel or Netlify. See the [client README](./client/README.md) for detailed instructions.

## Environment Variables

### Backend

- `PORT` - Port to run the server on (default: 5000)
- `CLIENT_URL` - URL of the frontend client (for CORS)
- `FYERS_APP_ID` - Your Fyers API app ID
- `FYERS_APP_SECRET` - Your Fyers API app secret

### Frontend

- `VITE_API_URL` - URL of the backend API server 
