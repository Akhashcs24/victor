declare module 'fyers-api-v3' {
  export class fyersModel {
    setAppId(appId: string): void;
    setAccessToken(accessToken: string): void;
    setRedirectUrl(url: string): void;
    generate_access_token(params: {
      client_id: string;
      secret_key: string;
      auth_code: string;
    }): Promise<any>;
    get_profile(): Promise<any>;
    getMarketDepth(params: { symbol: string[]; ohlcv_flag: number }): Promise<any>;
    getHistory(params: {
      symbol: string;
      resolution: string;
      date_format: string;
      range_from: string;
      range_to: string;
      cont_flag: string;
    }): Promise<any>;
  }
} 