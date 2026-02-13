import type { Position, OrderResult, TradeRecord } from '../types';

export class Portfolio {
  private capital: number;
  private initialCapital: number;
  private positions: Map<string, Position> = new Map();
  private tradeHistory: TradeRecord[] = [];
  private feeRate: number;

  constructor(initialCapital: number, feeRate: number = 0) {
    this.capital = initialCapital;
    this.initialCapital = initialCapital;
    this.feeRate = feeRate;
  }

  buy(tokenId: string, size: number, price: number, timestamp: number): OrderResult {
    const totalCost = size * price;
    const fee = totalCost * this.feeRate;
    const totalWithFee = totalCost + fee;

    if (totalWithFee > this.capital) {
      return {
        success: false,
        tokenId,
        side: 'BUY',
        size: 0,
        price,
        totalCost: 0,
        error: `Insufficient capital: need ${totalWithFee.toFixed(2)}, have ${this.capital.toFixed(2)}`,
      };
    }

    this.capital -= totalWithFee;

    const existing = this.positions.get(tokenId);
    if (existing) {
      const newSize = existing.size + size;
      const newAvgPrice = (existing.avgPrice * existing.size + price * size) / newSize;
      existing.size = newSize;
      existing.avgPrice = newAvgPrice;
      if (!existing.buyPrice) {
        existing.buyPrice = price;
      }
    } else {
      this.positions.set(tokenId, {
        tokenId,
        size,
        avgPrice: price,
        currentValue: size * price,
        pnl: 0,
        buyPrice: price,
      });
    }

    const record: TradeRecord = {
      timestamp,
      tokenId,
      side: 'BUY',
      size,
      price,
      totalCost: totalWithFee,
      positionSizeAfter: this.positions.get(tokenId)?.size ?? 0,
      capitalAfter: this.capital,
    };
    this.tradeHistory.push(record);

    return {
      success: true,
      tokenId,
      side: 'BUY',
      size,
      price,
      totalCost: totalWithFee,
    };
  }

  sell(tokenId: string, size: number, price: number, timestamp: number): OrderResult {
    const position = this.positions.get(tokenId);

    if (!position || position.size < size) {
      return {
        success: false,
        tokenId,
        side: 'SELL',
        size: 0,
        price,
        totalCost: 0,
        error: `Insufficient position: trying to sell ${size}, have ${position?.size ?? 0}`,
      };
    }

    const totalValue = size * price;
    const fee = totalValue * this.feeRate;
    const totalAfterFee = totalValue - fee;

    this.capital += totalAfterFee;
    position.size -= size;

    if (position.size === 0) {
      this.positions.delete(tokenId);
    } else {
      position.currentValue = position.size * price;
    }

    const record: TradeRecord = {
      timestamp,
      tokenId,
      side: 'SELL',
      size,
      price,
      totalCost: totalAfterFee,
      positionSizeAfter: position.size,
      capitalAfter: this.capital,
    };
    this.tradeHistory.push(record);

    return {
      success: true,
      tokenId,
      side: 'SELL',
      size,
      price,
      totalCost: totalAfterFee,
    };
  }

  close(tokenId: string, price: number, timestamp: number): OrderResult {
    const position = this.positions.get(tokenId);
    if (!position) {
      return {
        success: false,
        tokenId,
        side: 'SELL',
        size: 0,
        price,
        totalCost: 0,
        error: 'No position to close',
      };
    }
    return this.sell(tokenId, position.size, price, timestamp);
  }

  updatePositionValues(prices: Map<string, number>): void {
    for (const [tokenId, position] of this.positions) {
      const price = prices.get(tokenId);
      if (price !== undefined) {
        position.currentValue = position.size * price;
        position.pnl = position.currentValue - position.size * position.avgPrice;
      }
    }
  }

  getPosition(tokenId: string): Position | undefined {
    return this.positions.get(tokenId);
  }

  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  getCapital(): number {
    return this.capital;
  }

  getTotalValue(prices: Map<string, number>): number {
    let total = this.capital;
    for (const [tokenId, position] of this.positions) {
      const price = prices.get(tokenId);
      if (price !== undefined) {
        total += position.size * price;
      }
    }
    return total;
  }

  getPnL(prices: Map<string, number>): number {
    return this.getTotalValue(prices) - this.initialCapital;
  }

  getTradeHistory(): TradeRecord[] {
    return [...this.tradeHistory];
  }

  getInitialCapital(): number {
    return this.initialCapital;
  }
}
