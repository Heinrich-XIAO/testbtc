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
  private discordEmail: string | null = null;
  private discordPassword: string | null = null;

  setDiscordCredentials(email: string, password: string): void {
    this.discordEmail = email;
    this.discordPassword = password;
  }

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

    // Check if already logged in
    const balanceEl = await this.page.locator('[class*="balance"], [class*="Balance"]').first();
    const alreadyLoggedIn = await balanceEl.isVisible().catch(() => false);
    if (alreadyLoggedIn) {
      console.log('Already authenticated!');
      this.session.isAuthenticated = true;
      return true;
    }

    const signInButton = await this.page.$('text=Sign In');
    if (!signInButton) {
      this.session.isAuthenticated = true;
      return true;
    }
    
    // Auto-login with Discord if credentials provided
    if (this.discordEmail && this.discordPassword) {
      console.log('Attempting Discord auto-login...');
      return await this.loginWithDiscord();
    }
    
    // Manual login fallback
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

  private async loginWithDiscord(): Promise<boolean> {
    if (!this.page || !this.discordEmail || !this.discordPassword) return false;
    
    try {
      console.log('Clicking Sign In...');
      const signInButton = await this.page.$('text=Sign In');
      if (signInButton) {
        await signInButton.click();
        await this.page.waitForTimeout(2000);
      }
      
      // Wait for auth modal/page
      await this.page.waitForTimeout(2000);
      
      // Look for Discord button - try multiple selectors
      console.log('Looking for Discord login option...');
      const discordSelectors = [
        'button:has-text("Discord")',
        'button:has-text("discord")',
        '[class*="discord"]',
        'img[alt*="Discord"]',
        'img[alt*="discord"]',
        'svg[class*="discord"]',
      ];
      
      let discordButton = null;
      for (const selector of discordSelectors) {
        discordButton = await this.page.$(selector);
        if (discordButton) {
          console.log(`Found Discord button with: ${selector}`);
          break;
        }
      }
      
      if (!discordButton) {
        // Check all buttons on the page
        const allButtons = await this.page.$$('button');
        console.log(`Found ${allButtons.length} buttons on auth page`);
        for (let i = 0; i < allButtons.length; i++) {
          const text = await allButtons[i].textContent();
          const html = await allButtons[i].innerHTML();
          console.log(`  Button ${i}: "${text?.trim()}"`);
          if (text?.toLowerCase().includes('discord') || html.toLowerCase().includes('discord')) {
            discordButton = allButtons[i];
            console.log(`  -> Using this button for Discord`);
            break;
          }
        }
      }
      
      if (discordButton) {
        await discordButton.click();
        await this.page.waitForTimeout(3000);
        
        // Check if we're on Discord login page or if a popup appeared
        const currentUrl = this.page.url();
        console.log(`Current URL: ${currentUrl}`);
        
        // Handle Discord OAuth in same tab
        if (currentUrl.includes('discord.com')) {
          return await this.handleDiscordLoginPage();
        }
        
        // Check for popup
        const pages = this.browser?.contexts()[0]?.pages() ?? [];
        const discordPage = pages.find(p => p.url().includes('discord.com'));
        if (discordPage) {
          console.log('Found Discord popup/tab');
          this.page = discordPage;
          return await this.handleDiscordLoginPage();
        }
        
        // Wait for redirect to Discord
        console.log('Waiting for Discord redirect...');
        await this.page.waitForTimeout(3000);
        const newUrl = this.page.url();
        if (newUrl.includes('discord.com')) {
          return await this.handleDiscordLoginPage();
        }
        
        // Might already be logged in
        const balanceEl = await this.page.locator('[class*="balance"], [class*="Balance"]').first();
        const isLoggedIn = await balanceEl.isVisible().catch(() => false);
        if (isLoggedIn) {
          this.session.isAuthenticated = true;
          console.log('Already authenticated!');
          return true;
        }
      } else {
        console.log('Discord button not found');
      }
      
      return false;
    } catch (error) {
      console.error('Discord auto-login error:', error);
      return false;
    }
  }

  private async handleDiscordLoginPage(): Promise<boolean> {
    if (!this.page || !this.discordEmail || !this.discordPassword) return false;
    
    console.log('On Discord login page, filling credentials...');
    
    // Wait for page to load
    await this.page.waitForTimeout(2000);
    
    // Fill email
    const emailSelectors = [
      'input[name="email"]',
      'input[type="email"]',
      'input[id="uid_5"]',
      'input[autocomplete="email"]',
      'input[placeholder*="email"]',
    ];
    
    let emailInput = null;
    for (const selector of emailSelectors) {
      emailInput = await this.page?.$(selector);
      if (emailInput) break;
    }
    
    if (emailInput) {
      await emailInput.fill(this.discordEmail);
      console.log('Filled email');
    } else {
      console.log('Email input not found');
    }
    
    // Fill password
    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      'input[id="uid_7"]',
      'input[autocomplete="current-password"]',
    ];
    
    let passwordInput = null;
    for (const selector of passwordSelectors) {
      passwordInput = await this.page?.$(selector);
      if (passwordInput) break;
    }
    
    if (passwordInput) {
      await passwordInput.fill(this.discordPassword);
      console.log('Filled password');
    } else {
      console.log('Password input not found');
    }
    
    await this.page.waitForTimeout(500);
    
    // Click login
    const loginSelectors = [
      'button[type="submit"]',
      'button:has-text("Login")',
      'button:has-text("Log In")',
      'button:has-text("Sign in")',
    ];
    
    for (const selector of loginSelectors) {
      const loginButton = await this.page?.$(selector);
      if (loginButton) {
        await loginButton.click();
        console.log('Clicked login button');
        break;
      }
    }
    
    await this.page.waitForTimeout(5000);
    
    // Check for 2FA
    const twoFASelectors = [
      'input[name="mfaCode"]',
      'input[placeholder*="code"]',
      'input[maxlength="6"]',
      'input[inputmode="numeric"]',
    ];
    
    for (const selector of twoFASelectors) {
      const twoFAInput = await this.page?.$(selector);
      if (twoFAInput) {
        console.log('2FA required - please enter code manually in browser...');
        // Wait for user to enter 2FA
        for (let i = 0; i < 60; i++) {
          await this.page.waitForTimeout(2000);
          const url = this.page.url();
          if (!url.includes('discord.com/login') && !url.includes('discord.com/oauth2')) {
            break;
          }
        }
        break;
      }
    }
    
    // Handle authorize button (on Discord OAuth page)
    console.log('Looking for Authorize button...');
    
    // Discord OAuth has a scrollable container - use wheel events
    const scrollable = await this.page.$('[class*="scroll"], [class*="Scroll"], .scroller, .content');
    if (scrollable) {
      console.log('Found scrollable element, scrolling...');
      await scrollable.hover();
      for (let i = 0; i < 10; i++) {
        await this.page.mouse.wheel(0, 500);
        await this.page.waitForTimeout(200);
      }
    } else {
      // Try clicking directly in the content area and scrolling
      await this.page.click('body');
      for (let i = 0; i < 10; i++) {
        await this.page.keyboard.press('ArrowDown');
        await this.page.waitForTimeout(100);
      }
    }
    
    await this.page.waitForTimeout(1000);
    
    // Debug: log all buttons on the page
    const allButtons = await this.page.$$('button');
    console.log(`Found ${allButtons.length} buttons on authorize page`);
    for (let i = 0; i < allButtons.length; i++) {
      const text = await allButtons[i].textContent();
      const isDisabled = await allButtons[i].isDisabled().catch(() => true);
      const isVisible = await allButtons[i].isVisible().catch(() => false);
      console.log(`  Button ${i}: "${text?.trim()}" (disabled: ${isDisabled}, visible: ${isVisible})`);
    }
    
    // Find and click Authorize button
    for (const btn of allButtons) {
      const text = await btn.textContent();
      if (text?.toLowerCase().includes('authorize')) {
        await btn.scrollIntoViewIfNeeded();
        await btn.click({ force: true });
        console.log('Clicked Authorize button');
        break;
      }
    }
    
    // Wait for redirect back to PolySimulator
    console.log('Waiting for redirect to PolySimulator...');
    await this.page.waitForTimeout(3000);
    
    // Check if back on PolySimulator and logged in
    const currentUrl = this.page.url();
    console.log(`Final URL: ${currentUrl}`);
    
    // Wait for page to load
    if (currentUrl.includes('polysimulator.com')) {
      console.log('On PolySimulator, waiting for authentication...');
      await this.page.waitForTimeout(5000);
    }
    
    // Multiple selectors for balance/auth indicators
    const balanceSelectors = [
      '[class*="balance"]',
      '[class*="Balance"]',
      '[class*="usdc"]',
      '[class*="USDC"]',
      'text=/\\$[0-9,.]+/',
      'text=/[0-9,.]+ USDC/',
      '[data-testid="balance"]',
      '[class*="portfolio"]',
      '[class*="Portfolio"]',
    ];
    
    let isLoggedIn = false;
    
    // Try each selector
    for (const selector of balanceSelectors) {
      try {
        const el = await this.page.locator(selector).first();
        const visible = await el.isVisible().catch(() => false);
        if (visible) {
          console.log(`Found auth indicator with: ${selector}`);
          isLoggedIn = true;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    // Also check for absence of Sign In button
    if (!isLoggedIn) {
      const signInButton = await this.page.$('text=Sign In');
      if (!signInButton) {
        console.log('No Sign In button found, likely logged in');
        isLoggedIn = true;
      }
    }
    
    // Try waiting more time for page load
    if (!isLoggedIn) {
      console.log('Auth indicators not found yet, waiting more...');
      for (let i = 0; i < 10; i++) {
        await this.page.waitForTimeout(2000);
        
        for (const selector of balanceSelectors) {
          try {
            const el = await this.page.locator(selector).first();
            const visible = await el.isVisible().catch(() => false);
            if (visible) {
              console.log(`Found auth indicator after waiting with: ${selector}`);
              isLoggedIn = true;
              break;
            }
          } catch (e) {
            // Continue
          }
        }
        
        if (isLoggedIn) break;
      }
    }
    
    if (isLoggedIn) {
      this.session.isAuthenticated = true;
      console.log('Discord auto-login successful!');
      return true;
    }
    
    console.log('Discord auto-login failed, falling back to manual...');
    return false;
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
