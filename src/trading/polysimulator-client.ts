import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import type { LivePosition, LiveOrder, TradingAccount, PolySimulatorSession } from './types';

export class PolySimulatorClient {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private session: PolySimulatorSession = {
    isAuthenticated: false,
    balance: 0,
    lastUpdate: 0,
  };

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: false,
      args: ['--disable-blink-features=AutomationControlled'],
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });
    this.page = await this.context.newPage();
    console.log('PolySimulator client initialized');
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  async navigateToMarket(marketSlug: string): Promise<void> {
    if (!this.page) throw new Error('Client not initialized');
    const url = `https://polysimulator.com/markets/${marketSlug}`;
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await this.page.waitForTimeout(2000);
  }

  async navigateToMarkets(): Promise<void> {
    if (!this.page) throw new Error('Client not initialized');
    await this.page.goto('https://polysimulator.com/markets', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await this.page.waitForTimeout(2000);
  }

  async login(): Promise<boolean> {
    if (!this.page) throw new Error('Client not initialized');
    
    await this.page.goto('https://polysimulator.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await this.page.waitForTimeout(3000);

    const signInButton = await this.page.$('text=Sign In');
    if (signInButton) {
      console.log('Please sign in manually in the browser window...');
      console.log('Waiting for authentication (checking every 5 seconds)...');
      
      for (let i = 0; i < 60; i++) {
        await this.page.waitForTimeout(5000);
        const balanceEl = await this.page.locator('[class*="balance"], [class*="Balance"]').first();
        const isVisible = await balanceEl.isVisible().catch(() => false);
        if (isVisible) {
          this.session.isAuthenticated = true;
          console.log('Authentication detected!');
          return true;
        }
        const dollarText = await this.page.locator('text=/\\$[0-9]/').first();
        const dollarVisible = await dollarText.isVisible().catch(() => false);
        if (dollarVisible) {
          this.session.isAuthenticated = true;
          console.log('Authentication detected!');
          return true;
        }
      }
      return false;
    }
    
    this.session.isAuthenticated = true;
    return true;
  }

  async getBalance(): Promise<number> {
    if (!this.page) throw new Error('Client not initialized');
    
    const balanceSelectors = [
      '[class*="balance"]',
      '[class*="Balance"]',
      'text=/\\$[0-9,.]+/',
      '[data-testid="balance"]',
    ];

    for (const selector of balanceSelectors) {
      const el = await this.page.$(selector);
      if (el) {
        const text = await el.textContent();
        if (text) {
          const match = text.match(/\$?([0-9,.]+)/);
          if (match) {
            const balance = parseFloat(match[1].replace(/,/g, ''));
            this.session.balance = balance;
            return balance;
          }
        }
      }
    }
    return this.session.balance;
  }

  async getPositions(): Promise<LivePosition[]> {
    if (!this.page) throw new Error('Client not initialized');
    
    const positions: LivePosition[] = [];
    
    const positionSelectors = [
      '[class*="position"]',
      '[class*="Position"]',
      '[data-testid*="position"]',
    ];

    for (const selector of positionSelectors) {
      const elements = await this.page.$$(selector);
      for (const el of elements) {
        const text = await el.textContent();
        if (text && text.includes('$')) {
          const sizeMatch = text.match(/([0-9.]+)\s*(shares?|tokens?)/i);
          const priceMatch = text.match(/\$?([0-9.]+)\s*(avg|entry)/i);
          const pnlMatch = text.match(/([+-]?\$?[0-9.]+)\s*(pnl|profit|loss)/i);
          
          if (sizeMatch) {
            positions.push({
              tokenId: '',
              marketQuestion: text.slice(0, 100),
              outcome: '',
              size: parseFloat(sizeMatch[1]),
              avgPrice: priceMatch ? parseFloat(priceMatch[1]) : 0,
              currentPrice: 0,
              value: 0,
              pnl: pnlMatch ? parseFloat(pnlMatch[1].replace('$', '')) : 0,
              pnlPercent: 0,
            });
          }
        }
      }
    }
    
    return positions;
  }

  async placeBuyOrder(tokenId: string, amount: number, maxPrice?: number, marketSlug?: string, conditionId?: string): Promise<LiveOrder> {
    if (!this.page) throw new Error('Client not initialized');

    const order: LiveOrder = {
      id: `order_${Date.now()}`,
      tokenId,
      side: 'BUY',
      size: amount,
      price: maxPrice ?? 1,
      status: 'pending',
      timestamp: Date.now(),
    };

    try {
      // Navigate to market page using conditionId (PolySimulator uses this format)
      if (conditionId) {
        await this.page.goto(`https://polysimulator.com/markets/${conditionId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await this.page.waitForTimeout(3000);
      } else {
        throw new Error('conditionId required for PolySimulator navigation');
      }
      
      // Check if page loaded correctly (not a 404)
      const notFoundText = await this.page.$('text=/not found|404/i');
      if (notFoundText) {
        throw new Error('Market not found on PolySimulator');
      }
      
      // Click Buy button (green button with specific class)
      // First, find all green buttons and pick the visible one
      const greenButtons = await this.page.$$('button[class*="accent-green"]');
      let clicked = false;
      
      for (const btn of greenButtons) {
        const isVisible = await btn.isVisible();
        if (isVisible) {
          await btn.scrollIntoViewIfNeeded();
          await btn.click({ force: true });
          clicked = true;
          break;
        }
      }
      
      if (!clicked) {
        throw new Error('No visible Buy button found on market page');
      }
      await this.page.waitForTimeout(1500);

      // Find and fill amount input
      const amountInput = await this.page.$(
        'input[type="number"], input[placeholder*="amount"], input[placeholder*="Amount"], input[placeholder*="Shares"]'
      );
      if (amountInput) {
        await amountInput.fill(String(amount));
        await this.page.waitForTimeout(500);
      }

      // Click confirm Buy button (in the modal, different from Buy Yes)
      const confirmButton = await this.page.$('button:has-text("Buy"):not(:has-text("Yes"))');
      if (confirmButton) {
        await confirmButton.click();
        await this.page.waitForTimeout(3000);
      }

      order.status = 'filled';

    } catch (error) {
      order.status = 'failed';
      console.error('Order failed:', error);
    }

    return order;
  }

  async placeSellOrder(tokenId: string, amount: number, minPrice?: number, marketSlug?: string, conditionId?: string): Promise<LiveOrder> {
    if (!this.page) throw new Error('Client not initialized');

    const order: LiveOrder = {
      id: `order_${Date.now()}`,
      tokenId,
      side: 'SELL',
      size: amount,
      price: minPrice ?? 0,
      status: 'pending',
      timestamp: Date.now(),
    };

try {
      if (conditionId) {
        await this.page.goto(`https://polysimulator.com/markets/${conditionId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await this.page.waitForTimeout(3000);
      } else {
        throw new Error('conditionId required for PolySimulator navigation');
      }
      
      // Check if page loaded correctly (not a 404)
      const notFoundText = await this.page.$('text=/not found|404/i');
      if (notFoundText) {
        throw new Error('Market not found on PolySimulator');
      }
      
      // Click Sell button (red button)
      const redButtons = await this.page.$$('button[class*="accent-red"]');
      let clicked = false;
      
      for (const btn of redButtons) {
        const isVisible = await btn.isVisible();
        if (isVisible) {
          await btn.scrollIntoViewIfNeeded();
          await btn.click({ force: true });
          clicked = true;
          break;
        }
      }
      
      if (!clicked) {
        throw new Error('No visible Sell button found on market page');
      }
      await this.page.waitForTimeout(1500);

      // Find and fill amount input
      const amountInput = await this.page.$(
        'input[type="number"], input[placeholder*="amount"], input[placeholder*="Amount"], input[placeholder*="Shares"]'
      );
      if (amountInput) {
        await amountInput.fill(String(amount));
        await this.page.waitForTimeout(500);
      }

      // Click confirm Sell button
      const confirmButton = await this.page.$('button:has-text("Sell"):not(:has-text("No"))');
      if (confirmButton) {
        await confirmButton.click();
        await this.page.waitForTimeout(3000);
      }

      order.status = 'filled';

    } catch (error) {
      order.status = 'failed';
      console.error('Order failed:', error);
    }

    return order;
  }

  async getAccountInfo(): Promise<TradingAccount> {
    const balance = await this.getBalance();
    const positions = await this.getPositions();
    
    const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);
    
    return {
      balance,
      availableBalance: balance,
      totalPnL,
      positions,
      openOrders: [],
    };
  }

  async getCurrentPrice(): Promise<number | null> {
    if (!this.page) throw new Error('Client not initialized');
    
    const priceSelectors = [
      '[class*="price"]',
      '[class*="Price"]',
      'text=/[0-9]\\.[0-9]+/',
    ];

    for (const selector of priceSelectors) {
      const el = await this.page.$(selector);
      if (el) {
        const text = await el.textContent();
        if (text) {
          const match = text.match(/([0-9]\.[0-9]+)/);
          if (match) {
            const price = parseFloat(match[1]);
            if (price > 0 && price < 1.5) {
              return price;
            }
          }
        }
      }
    }
    return null;
  }

  getSession(): PolySimulatorSession {
    return { ...this.session };
  }
}
