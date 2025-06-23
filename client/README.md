# Victor 3.0 Frontend Client

This is the frontend client for the Victor 3.0 trading application. It's built with React, TypeScript, and Vite.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file in the client directory with the following variables:
   ```
   VITE_API_URL=http://localhost:5000
   ```

3. Start the development server:
   ```
   npm run dev
   ```

## Development

The development server will run on port 3000 by default. You can access it at [http://localhost:3000](http://localhost:3000).

## Building for Production

To build the application for production:
```
npm run build
```

This will create a `dist` directory with the compiled assets.

## Deployment

### Vercel

1. Connect your GitHub repository to Vercel
2. Configure the following:
   - Framework Preset: Vite
   - Root Directory: client
   - Build Command: npm run build
   - Output Directory: dist
3. Add environment variables in the Vercel dashboard:
   - VITE_API_URL: URL of your backend API (e.g., https://victor-backend.onrender.com)
4. Deploy

### Netlify

1. Connect your GitHub repository to Netlify
2. Configure the following:
   - Base directory: client
   - Build command: npm run build
   - Publish directory: dist
3. Add environment variables in the Netlify dashboard
4. Deploy

## Environment Variables

- `VITE_API_URL` - URL of the backend API server

## Notes
- The frontend will talk to the backend using the API URL set in `.env.local` (e.g., `
- Updated with critical market data streaming fixes (v2.0.1)