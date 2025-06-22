# Deployment Guide for Victor 3.0

This guide provides detailed instructions for deploying the Victor 3.0 trading application to various hosting platforms.

## Architecture

Victor 3.0 is split into two parts:
- **Frontend Client**: React application built with Vite
- **Backend Server**: Express.js API server

These components need to be deployed separately, and the frontend needs to be configured to communicate with the backend.

## Backend Deployment

### Option 1: Render

1. **Create a new Web Service on Render**
   - Sign up or log in to [Render](https://render.com/)
   - Click "New" and select "Web Service"
   - Connect your GitHub repository
   - Select the branch to deploy

2. **Configure the service**
   - Name: `victor-backend` (or your preferred name)
   - Root Directory: `server` (if your server code is in a subdirectory)
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Select the appropriate instance type (Free tier works for testing)

3. **Set up environment variables**
   - Click on "Environment" tab
   - Add the following variables:
     - `PORT`: 10000 (Render uses this port internally)
     - `CLIENT_URL`: URL of your frontend (e.g., https://victor-trading.vercel.app)
     - `FYERS_APP_ID`: Your Fyers API app ID
     - `FYERS_APP_SECRET`: Your Fyers API app secret

4. **Deploy**
   - Click "Create Web Service"
   - Wait for the deployment to complete
   - Note the URL of your backend service (e.g., https://victor-backend.onrender.com)

### Option 2: Railway

1. **Create a new project on Railway**
   - Sign up or log in to [Railway](https://railway.app/)
   - Click "New Project" and select "Deploy from GitHub repo"
   - Connect your GitHub repository
   - Select the branch to deploy

2. **Configure the service**
   - Set the root directory to `server` (if your server code is in a subdirectory)
   - Set the start command to `npm start`

3. **Set up environment variables**
   - Go to the "Variables" tab
   - Add the same environment variables as listed for Render

4. **Deploy**
   - Railway will automatically deploy your application
   - Note the URL of your backend service

## Frontend Deployment

### Option 1: Vercel

1. **Create a new project on Vercel**
   - Sign up or log in to [Vercel](https://vercel.com/)
   - Click "New Project" and select your GitHub repository
   - Select the branch to deploy

2. **Configure the project**
   - Framework Preset: Vite
   - Root Directory: `client` (if your client code is in a subdirectory)
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. **Set up environment variables**
   - Click on "Environment Variables"
   - Add the following variable:
     - `VITE_API_URL`: URL of your backend service (e.g., https://victor-backend.onrender.com)

4. **Deploy**
   - Click "Deploy"
   - Wait for the deployment to complete
   - Your frontend will be available at the provided Vercel URL

### Option 2: Netlify

1. **Create a new site on Netlify**
   - Sign up or log in to [Netlify](https://netlify.com/)
   - Click "New site from Git" and select your GitHub repository
   - Select the branch to deploy

2. **Configure the build settings**
   - Base directory: `client` (if your client code is in a subdirectory)
   - Build command: `npm run build`
   - Publish directory: `dist`

3. **Set up environment variables**
   - Go to "Site settings" > "Environment variables"
   - Add the following variable:
     - `VITE_API_URL`: URL of your backend service

4. **Deploy**
   - Click "Deploy site"
   - Wait for the deployment to complete
   - Your frontend will be available at the provided Netlify URL

## Verifying the Deployment

1. **Test the backend**
   - Navigate to your backend URL + `/api/health` (e.g., https://victor-backend.onrender.com/api/health)
   - You should see a JSON response indicating the server is running

2. **Test the frontend**
   - Navigate to your frontend URL
   - The application should load and be able to connect to the backend

3. **Test authentication**
   - Try logging in with your Fyers credentials
   - The authentication flow should work correctly

## Troubleshooting

### CORS Issues
If you encounter CORS errors, ensure that:
- The `CLIENT_URL` environment variable on the backend is set correctly
- The backend's CORS configuration allows requests from your frontend domain

### Authentication Issues
If authentication fails:
- Check that your Fyers API credentials are correct
- Verify that the redirect URI in your Fyers app settings matches the one used in your application

### Connection Issues
If the frontend cannot connect to the backend:
- Verify that the `VITE_API_URL` is set correctly
- Check that the backend server is running
- Test the backend API directly using a tool like Postman

## Updating the Deployment

Both Vercel and Render support automatic deployments when you push changes to your GitHub repository. To update your application:

1. Push changes to your GitHub repository
2. The hosting platforms will automatically detect the changes and rebuild your application
3. Once the build is complete, your changes will be live 