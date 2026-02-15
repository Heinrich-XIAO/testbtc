"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Portfolio = void 0;
class Portfolio {
    constructor(initialCapital, feeRate = 0) {
        this.positions = new Map();
        this.tradeHistory = [];
        this.capital = initialCapital;
        this.initialCapital = initialCapital;
        this.feeRate = feeRate;
    }
    buy(tokenId, size, price, timestamp) {
        const totalCost = size * price;
        const fee = totalCost * this.feeRate;
        const totalWithFee = totalCost + fee;
        if (totalWithFee > this.capital + 0.001) {
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
        }
        else {
            this.positions.set(tokenId, {
                tokenId,
                size,
                avgPrice: price,
                currentValue: size * price,
                pnl: 0,
                buyPrice: price,
            });
        }
        const record = {
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
    sell(tokenId, size, price, timestamp) {
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
        }
        else {
            position.currentValue = position.size * price;
        }
        const record = {
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
    close(tokenId, price, timestamp) {
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
    updatePositionValues(prices) {
        for (const [tokenId, position] of this.positions) {
            const price = prices.get(tokenId);
            if (price !== undefined) {
                position.currentValue = position.size * price;
                position.pnl = position.currentValue - position.size * position.avgPrice;
            }
        }
    }
    getPosition(tokenId) {
        return this.positions.get(tokenId);
    }
    getAllPositions() {
        return Array.from(this.positions.values());
    }
    getCapital() {
        return this.capital;
    }
    getTotalValue(prices) {
        let total = this.capital;
        for (const [tokenId, position] of this.positions) {
            const price = prices.get(tokenId);
            if (price !== undefined) {
                total += position.size * price;
            }
        }
        return total;
    }
    getPnL(prices) {
        return this.getTotalValue(prices) - this.initialCapital;
    }
    getTradeHistory() {
        return [...this.tradeHistory];
    }
    getInitialCapital() {
        return this.initialCapital;
    }
}
exports.Portfolio = Portfolio;
