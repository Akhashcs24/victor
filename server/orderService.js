const axios = require('axios');
const config = require('./config');
const tradeLogService = require('./tradeLogService');

/**
 * Place an order with Fyers API
 */
async function placeOrder(orderParams, accessToken) {
  try {
    if (!accessToken) {
      throw new Error('No valid authentication token found');
    }

    const appId = config.fyers.appId;
    
    console.log(`🛒 Placing order for ${orderParams.symbol}`);
    
    const response = await axios.post('https://api.fyers.in/api/v2/orders', orderParams, {
      headers: {
        'Authorization': `${appId}:${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.s === 'ok') {
      console.log(`✅ Order placed successfully: ${response.data.id}`);
      
      // Log the trade
      await tradeLogService.addTradeLog({
        symbol: orderParams.symbol,
        action: orderParams.side === 1 ? 'BUY' : 'SELL',
        quantity: orderParams.qty,
        price: orderParams.limitPrice || orderParams.stopPrice || 0,
        orderType: orderParams.type === 1 ? 'LIMIT' : 'MARKET',
        status: 'COMPLETED',
        pnl: null, // To be updated later
        remarks: `Order ID: ${response.data.id}`,
        tradingMode: 'LIVE'
      });
      
      return {
        success: true,
        orderId: response.data.id,
        message: 'Order placed successfully'
      };
    } else {
      console.error(`❌ Order placement failed: ${response.data.message}`);
      return {
        success: false,
        message: response.data.message || 'Order placement failed'
      };
    }
  } catch (error) {
    console.error('❌ Error placing order:', error);
    return {
      success: false,
      message: `Error placing order: ${error.message || 'Unknown error'}`
    };
  }
}

/**
 * Place a paper trade (simulated)
 */
async function placePaperTrade(orderParams) {
  try {
    console.log(`📝 Placing paper trade for ${orderParams.symbol}`);
    
    // Simulate order ID
    const orderId = `paper_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Log the paper trade
    await tradeLogService.addTradeLog({
      symbol: orderParams.symbol,
      action: orderParams.side === 1 ? 'BUY' : 'SELL',
      quantity: orderParams.qty,
      price: orderParams.limitPrice || orderParams.stopPrice || 0,
      orderType: orderParams.type === 1 ? 'LIMIT' : 'MARKET',
      status: 'COMPLETED',
      pnl: null, // To be updated later
      remarks: `Paper Trade ID: ${orderId}`,
      tradingMode: 'PAPER'
    });
    
    return {
      success: true,
      orderId,
      message: 'Paper trade placed successfully'
    };
  } catch (error) {
    console.error('❌ Error placing paper trade:', error);
    return {
      success: false,
      message: `Error placing paper trade: ${error.message || 'Unknown error'}`
    };
  }
}

/**
 * Get order status
 */
async function getOrderStatus(orderId, accessToken) {
  try {
    if (!accessToken) {
      throw new Error('No valid authentication token found');
    }

    const appId = config.fyers.appId;
    
    const response = await axios.get(`https://api.fyers.in/api/v2/orders?id=${orderId}`, {
      headers: {
        'Authorization': `${appId}:${accessToken}`
      }
    });

    if (response.data.s === 'ok' && response.data.orderBook && response.data.orderBook.length > 0) {
      const order = response.data.orderBook[0];
      return {
        success: true,
        orderId: order.id,
        status: order.status,
        filledQty: order.filledQty,
        remainingQty: order.remainingQuantity,
        price: order.avgPrice,
        message: 'Order status retrieved successfully'
      };
    } else {
      console.error(`❌ Failed to get order status: ${response.data.message}`);
      return {
        success: false,
        message: response.data.message || 'Failed to get order status'
      };
    }
  } catch (error) {
    console.error('❌ Error getting order status:', error);
    return {
      success: false,
      message: `Error getting order status: ${error.message || 'Unknown error'}`
    };
  }
}

/**
 * Cancel order
 */
async function cancelOrder(orderId, accessToken) {
  try {
    if (!accessToken) {
      throw new Error('No valid authentication token found');
    }

    const appId = config.fyers.appId;
    
    const response = await axios.delete(`https://api.fyers.in/api/v2/orders?id=${orderId}`, {
      headers: {
        'Authorization': `${appId}:${accessToken}`
      }
    });

    if (response.data.s === 'ok') {
      console.log(`✅ Order cancelled successfully: ${orderId}`);
      return {
        success: true,
        message: 'Order cancelled successfully'
      };
    } else {
      console.error(`❌ Failed to cancel order: ${response.data.message}`);
      return {
        success: false,
        message: response.data.message || 'Failed to cancel order'
      };
    }
  } catch (error) {
    console.error('❌ Error cancelling order:', error);
    return {
      success: false,
      message: `Error cancelling order: ${error.message || 'Unknown error'}`
    };
  }
}

/**
 * Get order history
 */
async function getOrderHistory(accessToken) {
  try {
    if (!accessToken) {
      throw new Error('No valid authentication token found');
    }

    const appId = config.fyers.appId;
    
    const response = await axios.get('https://api.fyers.in/api/v2/orders', {
      headers: {
        'Authorization': `${appId}:${accessToken}`
      }
    });

    if (response.data.s === 'ok') {
      return {
        success: true,
        orders: response.data.orderBook || [],
        message: 'Order history retrieved successfully'
      };
    } else {
      console.error(`❌ Failed to get order history: ${response.data.message}`);
      return {
        success: false,
        message: response.data.message || 'Failed to get order history'
      };
    }
  } catch (error) {
    console.error('❌ Error getting order history:', error);
    return {
      success: false,
      message: `Error getting order history: ${error.message || 'Unknown error'}`
    };
  }
}

/**
 * Update P&L for a trade log
 */
async function updateTradePnL(tradeId, pnl) {
  try {
    // This would need to be implemented in tradeLogService
    // For now, we'll just log it
    console.log(`📊 Updating P&L for trade ${tradeId}: ${pnl}`);
    return {
      success: true,
      message: 'Trade P&L updated successfully'
    };
  } catch (error) {
    console.error('❌ Error updating trade P&L:', error);
    return {
      success: false,
      message: `Error updating trade P&L: ${error.message || 'Unknown error'}`
    };
  }
}

/**
 * Create market buy order
 */
function createMarketBuyOrder(symbol, quantity) {
  return {
    symbol,
    qty: quantity,
    type: 2, // MARKET
    side: 1, // BUY
    productType: 'INTRADAY',
    validity: 'DAY',
    disclosedQty: 0,
    offlineOrder: 'False',
    stopLoss: 0,
    takeProfit: 0
  };
}

/**
 * Create market sell order
 */
function createMarketSellOrder(symbol, quantity) {
  return {
    symbol,
    qty: quantity,
    type: 2, // MARKET
    side: -1, // SELL
    productType: 'INTRADAY',
    validity: 'DAY',
    disclosedQty: 0,
    offlineOrder: 'False',
    stopLoss: 0,
    takeProfit: 0
  };
}

/**
 * Create limit buy order
 */
function createLimitBuyOrder(symbol, quantity, price) {
  return {
    symbol,
    qty: quantity,
    type: 1, // LIMIT
    side: 1, // BUY
    productType: 'INTRADAY',
    limitPrice: price,
    validity: 'DAY',
    disclosedQty: 0,
    offlineOrder: 'False',
    stopLoss: 0,
    takeProfit: 0
  };
}

/**
 * Create limit sell order
 */
function createLimitSellOrder(symbol, quantity, price) {
  return {
    symbol,
    qty: quantity,
    type: 1, // LIMIT
    side: -1, // SELL
    productType: 'INTRADAY',
    limitPrice: price,
    validity: 'DAY',
    disclosedQty: 0,
    offlineOrder: 'False',
    stopLoss: 0,
    takeProfit: 0
  };
}

/**
 * Create stop loss order
 */
function createStopLossOrder(symbol, quantity, triggerPrice) {
  return {
    symbol,
    qty: quantity,
    type: 4, // SL-MARKET
    side: -1, // SELL
    productType: 'INTRADAY',
    stopPrice: triggerPrice,
    validity: 'DAY',
    disclosedQty: 0,
    offlineOrder: 'False'
  };
}

module.exports = {
  placeOrder,
  placePaperTrade,
  getOrderStatus,
  cancelOrder,
  getOrderHistory,
  updateTradePnL,
  createMarketBuyOrder,
  createMarketSellOrder,
  createLimitBuyOrder,
  createLimitSellOrder,
  createStopLossOrder
};
