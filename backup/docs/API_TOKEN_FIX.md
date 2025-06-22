# API Token Format Fix

## Issue
The application was encountering errors when trying to fetch historical data from the Fyers API. The specific error was:

```
Invalid access token format - expected appId:token
```

This error occurred because the server expected the token in the format `appId:token`, but the client was only sending the token without the appId.

## Solution

### 1. Updated MarketDataService.ts

Modified the `getHistoricalData` method in `client/src/services/marketDataService.ts` to format the token correctly:

```typescript
// Before
const accessToken = getAccessToken();
// ...
headers: {
  'Authorization': accessToken
}

// After
const accessToken = getAccessToken();
const appId = getAppId();
      
// Format the token correctly as appId:token
const formattedToken = appId && accessToken ? `${appId}:${accessToken}` : accessToken;
// ...
headers: {
  'Authorization': formattedToken
}
```

### 2. Exported getAppId Method

Added the missing export for the `getAppId` method in `client/src/services/authService.ts`:

```typescript
export const getAppId = () => AuthService.getAppId();
```

## Benefits

1. **Fixed API Errors**: Resolved the "Invalid access token format" errors when fetching historical data
2. **Consistent Token Format**: Ensured the token is consistently formatted as `appId:token` across the application
3. **Improved Error Handling**: Added logging to help diagnose any future token-related issues

## Testing

The changes were tested by:
1. Restarting the server and client
2. Selecting option contracts in the trading interface
3. Fetching HMA data for the selected options
4. Verifying that the historical data is successfully retrieved

The fix ensures that the application can now properly fetch historical data from the Fyers API for option contracts. 