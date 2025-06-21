import { SymbolConfigService } from './symbolConfig';

// Fyers API Order Types
export interface FyersOrderData {
  symbol: string;           // Trading symbol (e.g., "NSE:NIFTY25JUN24550CE")
  qty: number;             // Quantity (lots × lot_size)
  type: number;            // 1=Limit, 2=Market, 3=SL-M, 4=SL-L
  side: number;            // 1=Buy, -1=Sell
  productType: string;     // "INTRADAY", "CNC", "MARGIN", "CO", "BO", "MTF"
  limitPrice: number;      // Price for limit orders (0 for market)
  stopPrice: number;       // Stop price for stop orders (0 for market/limit)
  validity: string;        // "DAY", "IOC"
  disclosedQty: number;    // Disclosed quantity (0 for options)
  offlineOrder: boolean;   // false during market hours, true for AMO
  orderTag?: string;       // Optional custom tag
}

// Order response from Fyers API
export interface FyersOrderResponse {
  s: string;              // "ok" or "error"
  code: number;           // Response code
  message: string;        // Response message
  id?: string;            // Order ID if successful
}

export class OrderService {
  
  /**
   * Extract lot size from symbol by identifying the index
   */
  private static getLotSizeFromSymbol(symbol: string): number {
    // Extract index name from symbol (e.g., "NSE:NIFTY25JUN24550CE" -> "NIFTY")
    const match = symbol.match(/^[A-Z]+:([A-Z]+)/);
    if (!match) {
      console.warn(`Could not extract index from symbol: ${symbol}, using default lot size`);
      return 50; // Default lot size
    }
    
    const indexName = match[1];
    
    // Handle different index names
    let configKey = indexName;
    if (indexName.startsWith('NIFTYBANK')) {
      configKey = 'BANKNIFTY';
    } else if (indexName.startsWith('NIFTY')) {
      configKey = 'NIFTY';
    } else if (indexName === 'SENSEX') {
      configKey = 'SENSEX';
    } else if (indexName === 'BANKEX') {
      configKey = 'BANKEX';
    }
    
    const config = SymbolConfigService.getIndexConfig(configKey);
    return config?.lotSize || 50; // Default to 50 if not found
  }
  
  /**
   * Format order data according to Fyers API requirements
   */
  static formatOrderData(
    symbol: string,
    lots: number,
    side: 'BUY' | 'SELL',
    orderType: 'MARKET' | 'LIMIT' = 'MARKET',
    limitPrice: number = 0,
    productType: string = 'INTRADAY',
    orderTag?: string
  ): FyersOrderData {
    // Get lot size for the symbol by extracting index name
    const lotSize = this.getLotSizeFromSymbol(symbol);
    const quantity = lots * lotSize;
    
    // Generate default order tag if not provided
    const defaultTag = `Victor2.0-${side}-${Date.now()}`;
    
    return {
      symbol: symbol,
      qty: quantity,
      type: orderType === 'MARKET' ? 2 : 1,
      side: side === 'BUY' ? 1 : -1,
      productType: productType,
      limitPrice: orderType === 'LIMIT' ? limitPrice : 0,
      stopPrice: 0, // Not used for basic market/limit orders
      validity: "DAY",
      disclosedQty: 0, // Standard for options
      offlineOrder: false, // Assuming market hours
      orderTag: orderTag || defaultTag
    };
  }

  /**
   * Format bracket order (BO) data with target and stop loss
   */
  static formatBracketOrder(
    symbol: string,
    lots: number,
    side: 'BUY' | 'SELL',
    limitPrice: number,
    targetPrice: number,
    stopLossPrice: number,
    orderTag?: string
  ): FyersOrderData {
    const lotSize = this.getLotSizeFromSymbol(symbol);
    const quantity = lots * lotSize;
    
    const defaultTag = `Victor2.0-BO-${side}-${Date.now()}`;
    
    return {
      symbol: symbol,
      qty: quantity,
      type: 1, // Limit order for BO
      side: side === 'BUY' ? 1 : -1,
      productType: "BO", // Bracket Order
      limitPrice: limitPrice,
      stopPrice: 0,
      validity: "DAY",
      disclosedQty: 0,
      offlineOrder: false,
      orderTag: orderTag || defaultTag
      // Note: BO requires additional fields (takeProfit, stopLoss) 
      // which should be added based on Fyers documentation
    };
  }

  /**
   * Format cover order (CO) data with stop loss
   */
  static formatCoverOrder(
    symbol: string,
    lots: number,
    side: 'BUY' | 'SELL',
    limitPrice: number,
    stopLossPrice: number,
    orderTag?: string
  ): FyersOrderData {
    const lotSize = this.getLotSizeFromSymbol(symbol);
    const quantity = lots * lotSize;
    
    const defaultTag = `Victor2.0-CO-${side}-${Date.now()}`;
    
    return {
      symbol: symbol,
      qty: quantity,
      type: 1, // Limit order for CO
      side: side === 'BUY' ? 1 : -1,
      productType: "CO", // Cover Order
      limitPrice: limitPrice,
      stopPrice: 0,
      validity: "DAY",
      disclosedQty: 0,
      offlineOrder: false,
      orderTag: orderTag || defaultTag
      // Note: CO requires stopLoss field based on Fyers documentation
    };
  }

  /**
   * Create market buy order
   */
  static createMarketBuyOrder(
    symbol: string,
    lots: number,
    orderTag?: string
  ): FyersOrderData {
    return this.formatOrderData(symbol, lots, 'BUY', 'MARKET', 0, 'INTRADAY', orderTag);
  }

  /**
   * Create market sell order
   */
  static createMarketSellOrder(
    symbol: string,
    lots: number,
    orderTag?: string
  ): FyersOrderData {
    return this.formatOrderData(symbol, lots, 'SELL', 'MARKET', 0, 'INTRADAY', orderTag);
  }

  /**
   * Create limit buy order
   */
  static createLimitBuyOrder(
    symbol: string,
    lots: number,
    limitPrice: number,
    orderTag?: string
  ): FyersOrderData {
    return this.formatOrderData(symbol, lots, 'BUY', 'LIMIT', limitPrice, 'INTRADAY', orderTag);
  }

  /**
   * Create limit sell order
   */
  static createLimitSellOrder(
    symbol: string,
    lots: number,
    limitPrice: number,
    orderTag?: string
  ): FyersOrderData {
    return this.formatOrderData(symbol, lots, 'SELL', 'LIMIT', limitPrice, 'INTRADAY', orderTag);
  }

  /**
   * Validate order data before sending to API
   */
  static validateOrderData(orderData: FyersOrderData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validations
    if (!orderData.symbol || orderData.symbol.trim() === '') {
      errors.push('Symbol is required');
    }

    if (orderData.qty <= 0) {
      errors.push('Quantity must be greater than 0');
    }

    if (![1, 2, 3, 4].includes(orderData.type)) {
      errors.push('Invalid order type');
    }

    if (![1, -1].includes(orderData.side)) {
      errors.push('Invalid order side');
    }

    if (!['INTRADAY', 'CNC', 'MARGIN', 'CO', 'BO', 'MTF'].includes(orderData.productType)) {
      errors.push('Invalid product type');
    }

    if (orderData.type === 1 && orderData.limitPrice <= 0) {
      errors.push('Limit price is required for limit orders');
    }

    if (!['DAY', 'IOC'].includes(orderData.validity)) {
      errors.push('Invalid validity');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate order value (for margin/fund requirements)
   */
  static calculateOrderValue(orderData: FyersOrderData, currentPrice: number): number {
    const price = orderData.type === 2 ? currentPrice : orderData.limitPrice;
    return orderData.qty * price;
  }

  /**
   * Get order summary for display
   */
  static getOrderSummary(orderData: FyersOrderData): string {
    const sideText = orderData.side === 1 ? 'BUY' : 'SELL';
    const typeText = orderData.type === 2 ? 'MARKET' : 'LIMIT';
    const priceText = orderData.type === 2 ? 'at Market Price' : `at ₹${orderData.limitPrice}`;
    
    return `${sideText} ${orderData.qty} qty of ${orderData.symbol} (${typeText} ${priceText})`;
  }

  /**
   * Log order for debugging (development mode)
   */
  static logOrderData(orderData: FyersOrderData, prefix: string = 'Order'): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`📋 ${prefix} Data:`, orderData);
      console.log(`📋 ${prefix} JSON:`, JSON.stringify(orderData, null, 2));
      console.log(`📋 ${prefix} Summary:`, this.getOrderSummary(orderData));
    }
  }
} 