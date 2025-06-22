import { IndexConfig } from '../types';

export const INDEX_CONFIGS: Record<string, IndexConfig> = {
  'NIFTY': {
    name: 'Nifty 50',
    symbol: 'NSE:NIFTY',
    lotSize: 75,
    tickSize: 0.05,
    strikeInterval: 50
  },
  'BANKNIFTY': {
    name: 'Bank Nifty',
    symbol: 'NSE:NIFTYBANK',
    lotSize: 30,
    tickSize: 0.05,
    strikeInterval: 100
  },
  'NIFTYMIDCAPSELECT': {
    name: 'Nifty Midcap Select',
    symbol: 'NSE:NIFTYMIDCPSELECT',
    lotSize: 120,
    tickSize: 0.05,
    strikeInterval: 25
  },
  'NIFTYFINSERVICE': {
    name: 'Nifty Financial Services',
    symbol: 'NSE:NIFTYFINSERVICE',
    lotSize: 65,
    tickSize: 0.05,
    strikeInterval: 50
  },
  'NIFTYNEXT50': {
    name: 'Nifty Next 50',
    symbol: 'NSE:NIFTYNEXT50',
    lotSize: 25,
    tickSize: 0.05,
    strikeInterval: 25
  },
  'SENSEX': {
    name: 'BSE Sensex',
    symbol: 'BSE:SENSEX',
    lotSize: 20,
    tickSize: 0.01,
    strikeInterval: 100
  },
  'BANKEX': {
    name: 'BSE Bankex',
    symbol: 'BSE:BANKEX',
    lotSize: 30,
    tickSize: 0.01,
    strikeInterval: 100
  },
  'SENSEX50': {
    name: 'BSE Sensex 50',
    symbol: 'BSE:SENSEX50',
    lotSize: 60,
    tickSize: 0.01,
    strikeInterval: 50
  }
};

export class SymbolConfigService {
  static getIndexConfig(indexName: string): IndexConfig | undefined {
    return INDEX_CONFIGS[indexName];
  }

  static getAllIndexConfigs(): IndexConfig[] {
    return Object.values(INDEX_CONFIGS);
  }

  static getIndexNames(): string[] {
    return Object.keys(INDEX_CONFIGS);
  }

  static calculateATMStrike(currentPrice: number, strikeInterval: number): number {
    return Math.round(currentPrice / strikeInterval) * strikeInterval;
  }

  static generateOptionSymbol(
    indexSymbol: string,
    strike: number,
    expiry: string,
    optionType: 'CE' | 'PE'
  ): string {
    // Format: NSE:NIFTY24500CE
    const expiryDate = expiry.replace(/-/g, '');
    return `${indexSymbol}${strike}${optionType}`;
  }

  static parseOptionSymbol(symbol: string): {
    indexSymbol: string;
    strike: number;
    expiry: string;
    optionType: 'CE' | 'PE';
  } | null {
    // Parse symbol like "NSE:NIFTY24500CE"
    const match = symbol.match(/^([A-Z]+:[A-Z]+)(\d+)(CE|PE)$/);
    if (!match) return null;

    const [, indexSymbol, strikeStr, optionType] = match;
    const strike = parseInt(strikeStr);
    
    // Extract expiry from strike (assuming format: YYMMDD)
    const expiry = this.extractExpiryFromStrike(strike);

    return {
      indexSymbol,
      strike,
      expiry,
      optionType: optionType as 'CE' | 'PE'
    };
  }

  private static extractExpiryFromStrike(strike: number): string {
    // This is a simplified implementation
    // In a real scenario, you'd need to map strikes to actual expiry dates
    const today = new Date();
    const nextThursday = this.getNextThursday(today);
    return nextThursday.toISOString().split('T')[0];
  }

  private static getNextThursday(date: Date): Date {
    const daysUntilThursday = (4 - date.getDay() + 7) % 7;
    const nextThursday = new Date(date);
    nextThursday.setDate(date.getDate() + daysUntilThursday);
    return nextThursday;
  }

  static calculateQuantityFromLots(indexName: string, lots: number): number {
    const config = this.getIndexConfig(indexName);
    if (!config) {
      throw new Error(`Index configuration not found for: ${indexName}`);
    }
    return lots * config.lotSize;
  }

  static calculateLotsFromQuantity(indexName: string, quantity: number): number {
    const config = this.getIndexConfig(indexName);
    if (!config) {
      throw new Error(`Index configuration not found for: ${indexName}`);
    }
    return Math.floor(quantity / config.lotSize);
  }
} 