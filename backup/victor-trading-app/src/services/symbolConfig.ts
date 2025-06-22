import { IndexConfig, IndexType } from '../types';

const INDEX_CONFIGS: Record<IndexType, IndexConfig> = {
  NIFTY: {
    key: 'NIFTY',
    name: 'Nifty 50',
    index: 'NSE:NIFTY50-INDEX',
    futures: 'NSE:NIFTY25JUNFUT',
    strikeInterval: 50,
    expiryType: 'weekly',
    lotSize: 75
  },
  BANKNIFTY: {
    key: 'BANKNIFTY',
    name: 'Bank Nifty',
    index: 'NSE:NIFTYBANK-INDEX',
    futures: 'NSE:BANKNIFTY25JUNFUT',
    strikeInterval: 100,
    expiryType: 'monthly',
    lotSize: 30
  },
  SENSEX: {
    key: 'SENSEX',
    name: 'Sensex',
    index: 'BSE:SENSEX-INDEX',
    futures: 'BSE:SENSEX25617FUT',
    strikeInterval: 100,
    expiryType: 'weekly',
    lotSize: 20
  }
};

export const DEFAULT_INDEX: IndexType = 'NIFTY';

export class SymbolConfigService {
  static getAvailableIndices(): IndexType[] {
    return Object.keys(INDEX_CONFIGS) as IndexType[];
  }

  static getSymbolConfig(indexKey: IndexType = DEFAULT_INDEX): IndexConfig {
    const config = INDEX_CONFIGS[indexKey];
    if (!config) {
      throw new Error(`Invalid index key: ${indexKey}`);
    }
    return config;
  }

  static getMarketDepthSymbols(indexKey: IndexType): string[] {
    const config = this.getSymbolConfig(indexKey);
    return [config.index, config.futures];
  }

  static calculateATMStrike(currentPrice: number, indexKey: IndexType = DEFAULT_INDEX): number {
    const config = this.getSymbolConfig(indexKey);
    return Math.round(currentPrice / config.strikeInterval) * config.strikeInterval;
  }

  static generateOptionSymbol(
    indexKey: IndexType,
    strike: number,
    optionType: 'CE' | 'PE',
    expiry: string
  ): string {
    const config = this.getSymbolConfig(indexKey);
    
    // Format based on index
    switch (indexKey) {
      case 'NIFTY':
        return `NSE:NIFTY${expiry}${strike}${optionType}`;
      case 'BANKNIFTY':
        return `NSE:BANKNIFTY${expiry}${strike}${optionType}`;
      case 'SENSEX':
        return `BSE:SENSEX${expiry}${strike}${optionType}`;
      default:
        throw new Error(`Unsupported index: ${indexKey}`);
    }
  }

  static getExpiryDate(indexKey: IndexType = DEFAULT_INDEX): string {
    const config = this.getSymbolConfig(indexKey);
    
    // For now, return a placeholder - this should be calculated based on current date
    // and expiry rules (weekly/monthly)
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    
    if (config.expiryType === 'weekly') {
      // Weekly expiry - use date format
      return `${year}${month}${day}`;
    } else {
      // Monthly expiry - use month code
      const monthCodes = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 
                         'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      return `${year}${monthCodes[now.getMonth()]}`;
    }
  }

  static calculateQuantityFromLots(lots: number, indexKey: IndexType = DEFAULT_INDEX): number {
    const config = this.getSymbolConfig(indexKey);
    return lots * config.lotSize;
  }

  static calculateLotsFromQuantity(quantity: number, indexKey: IndexType = DEFAULT_INDEX): number {
    const config = this.getSymbolConfig(indexKey);
    return Math.floor(quantity / config.lotSize);
  }

  static getLotSize(indexKey: IndexType = DEFAULT_INDEX): number {
    const config = this.getSymbolConfig(indexKey);
    return config.lotSize;
  }
} 