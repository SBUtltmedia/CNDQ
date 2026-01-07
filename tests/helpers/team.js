/**
 * Team Helper - Team actions and trading operations
 * Updated for Lit Components and No-M Architecture
 */

const CHEMICALS = ['C', 'N', 'D', 'Q'];

class TeamHelper {
    constructor(browserHelper) {
        this.browser = browserHelper;
    }

    /**
     * Get shadow prices from page
     */
    async getShadowPrices(page) {
        return await page.evaluate(() => {
            const prices = {};
            ['C', 'N', 'D', 'Q'].forEach(chem => {
                const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
                if (card && card.shadowRoot) {
                    const el = card.shadowRoot.querySelector('#shadow-price');
                    const text = el?.textContent?.trim() || '$0';
                    const priceMatch = text.match(/\$([\d.]+)/);
                    prices[chem] = priceMatch ? parseFloat(priceMatch[1]) : 0;
                } else {
                    prices[chem] = 0;
                }
            });
            return prices;
        });
    }

    /**
     * Get team name from page
     */
    async getTeamName(page) {
        return await page.$eval('#team-name', el => el.textContent.trim());
    }

    /**
     * Get inventory from page
     */
    async getInventory(page) {
        // Wait for at least one inventory item to be non-zero (assuming initial inventory is > 0)
        try {
            await page.waitForFunction(() => {
                const card = document.querySelector('chemical-card[chemical="C"]');
                if (!card || !card.shadowRoot) return false;
                const el = card.shadowRoot.querySelector('#inventory');
                const val = parseFloat(el?.textContent.replace(/,/g, '') || '0');
                return val > 0;
            }, { timeout: 5000 });
        } catch (e) {
            // If timeout, just proceed (maybe inventory really is 0)
        }

        return await page.evaluate(() => {
            const inventory = {};
            ['C', 'N', 'D', 'Q'].forEach(chem => {
                const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
                if (card && card.shadowRoot) {
                    const el = card.shadowRoot.querySelector('#inventory');
                    inventory[chem] = parseFloat(el?.textContent.replace(/,/g, '') || '0');
                } else {
                    inventory[chem] = 0;
                }
            });
            return inventory;
        });
    }

    /**
     * Post buy request using the modal interface
     */
    async postBuyRequest(page, chemical, shadowPrice) {
        // Force refresh to ensure button state is accurate
        await page.reload({ waitUntil: 'networkidle2' });
        await this.browser.sleep(1000);
        
        await page.waitForSelector('#app:not(.hidden)', { timeout: 10000 });
        
        // Check if button is already disabled (meaning we already have an ad)
        const canPost = await page.evaluate((chem) => {
            const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
            if (!card || !card.shadowRoot) return false;
            const button = card.shadowRoot.querySelector('#post-buy-btn');
            return button && !button.classList.contains('btn-disabled') && !button.disabled;
        }, chemical);

        if (!canPost) {
            return; // Skip if already posted or card missing
        }

        // Click the buy button inside the chemical card's shadow DOM
        await page.evaluate((chem) => {
            const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
            if (card && card.shadowRoot) {
                const button = card.shadowRoot.querySelector('#post-buy-btn');
                if (button) button.click();
            }
        }, chemical);

        await this.browser.sleep(800);

        // Fill in the modal (Main DOM)
        await page.evaluate((sp) => {
            const quantity = 100;
            const price = (sp * 1.2).toFixed(2);

            const qtyInput = document.getElementById('offer-quantity');
            const priceInput = document.getElementById('offer-price');
            
            if (qtyInput && priceInput) {
                qtyInput.value = quantity;
                priceInput.value = price;
                // Trigger input event for validation logic
                qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
                priceInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }, shadowPrice);

        await this.browser.sleep(500);
        await page.click('#offer-submit-btn');
        await this.browser.sleep(1000);
    }

    /**
     * Find buyer for a chemical (checks ads in shadow DOM)
     */
    async findBuyer(page, chemical) {
        // Force refresh to bypass stale cache/polling
        await page.reload({ waitUntil: 'networkidle2' });
        await this.browser.sleep(2000);
        
        return await page.evaluate((chem) => {
            const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
            if (!card || !card.shadowRoot) return null;

            const adItems = card.shadowRoot.querySelectorAll('advertisement-item');
            
            for (const item of adItems) {
                const type = item.type || item.getAttribute('type');
                const teamId = item.teamId || item.getAttribute('teamid') || item.getAttribute('teamId');
                const teamName = item.teamName || item.getAttribute('teamname') || item.getAttribute('teamName');
                const isMyAd = item.isMyAd || item.hasAttribute('ismyad') || item.hasAttribute('isMyAd');

                if (type === 'buy' && !isMyAd) {
                    return { teamId, teamName, chemical: chem };
                }
            }
            return null;
        }, chemical);
    }

    /**
     * Respond to a buy request using the respond modal
     */
    async respondToBuyRequest(page, buyRequest, chemical, shadowPrice, inventory) {
        // Click "Sell to" button in the specific ad item's shadow DOM
        const clicked = await page.evaluate((chem, targetTeamId) => {
            const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
            if (!card || !card.shadowRoot) return false;

            const adItems = card.shadowRoot.querySelectorAll('advertisement-item');
            for (const item of adItems) {
                const teamId = item.teamId || item.getAttribute('teamid') || item.getAttribute('teamId');
                if (teamId === targetTeamId) {
                    const btn = item.shadowRoot?.querySelector('.btn');
                    if (btn) {
                        btn.click();
                        return true;
                    }
                }
            }
            return false;
        }, chemical, buyRequest.teamId);

        if (!clicked) return;

        // Wait for the modal
        await page.waitForSelector('#respond-modal', { visible: true, timeout: 5000 });
        await this.browser.sleep(1000);

        // Fill in respond modal (Main DOM)
        const subResult = await page.evaluate((sp) => {
            const modalInv = parseFloat(document.getElementById('respond-your-inventory').textContent.replace(/,/g, '')) || 0;
            const qtyInput = document.getElementById('respond-quantity');
            const priceInput = document.getElementById('respond-price');
            
            if (modalInv < 1) return { success: false, reason: "No inventory" };

            const quantity = Math.min(50, Math.floor(modalInv));
            const price = 5.00;

            if (qtyInput && priceInput) {
                qtyInput.value = quantity;
                priceInput.value = price;
                qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
                priceInput.dispatchEvent(new Event('input', { bubbles: true }));
                return { success: true, quantity, price };
            }
            return { success: false, reason: "Inputs missing" };
        }, shadowPrice);

        if (!subResult.success) {
            await page.click('#respond-cancel-btn');
            return;
        }

        await this.browser.sleep(500);
        await page.click('#respond-submit-btn');
        await this.browser.sleep(1500);
    }

    /**
     * Respond to pending negotiations
     */
    async respondToNegotiations(page, shadowPrices, acceptanceRate = 0.7) {
        // Force refresh
        await page.reload({ waitUntil: 'networkidle2' });
        await this.browser.sleep(2000);

        // 1. Open Negotiation Modal
        const modalOpen = await page.evaluate(() => {
            const btn = document.getElementById('view-all-negotiations-btn');
            if (btn) { 
                console.log('   [TeamHelper] Clicking View All Negotiations button');
                btn.click(); 
                return true; 
            } 
            console.log('   [TeamHelper] View All Negotiations button not found');
            return false;
        });

        if (!modalOpen) return null;
        await this.browser.sleep(1500);

        // 2. Look for "Your Turn"
        const negData = await page.evaluate(() => {
            const pendingContainer = document.getElementById('pending-negotiations');
            if (!pendingContainer) {
                console.log('   [TeamHelper] Pending negotiations container not found');
                return null;
            }
            const cards = pendingContainer.querySelectorAll('negotiation-card');
            console.log(`   [TeamHelper] Found ${cards.length} negotiation cards`);
            
            for (const card of cards) {
                if (card.innerText.includes('Your Turn')) {
                    const id = card.getAttribute('negotiation-id');
                    console.log(`   [TeamHelper] Found active negotiation: ${id}`);
                    return { id, text: card.innerText.replace(/\n/g, ' ') };
                }
            }
            console.log('   [TeamHelper] No cards marked "Your Turn" found');
            return null;
        });

        if (!negData) {
            await page.click('#negotiation-modal-close-btn').catch(() => {});
            return null;
        }

        // 3. Open Detail View
        console.log(`   [TeamHelper] Attempting to open detail view for negotiation: ${negData.id}`);
        const clicked = await page.evaluate((id) => {
            const card = document.querySelector(`negotiation-card[negotiation-id="${id}"]`);
            const btn = card?.querySelector('[role="button"]');
            if (btn) { 
                btn.click(); 
                return true; 
            } 
            return false;
        }, negData.id);

        if (!clicked) {
            console.log('   [TeamHelper] Could not click card button for detail view');
            return null;
        }
        await this.browser.sleep(2000);

        // 4. Get current data
        const details = await page.evaluate(() => {
            const chemText = document.getElementById('detail-chemical')?.textContent || '';
            const chemical = chemText.match(/Chemical ([CNDQ])/)?.[1];
            const history = document.getElementById('offer-history');
            const bubbles = history?.querySelectorAll('offer-bubble');
            
            if (bubbles && bubbles.length > 0) {
                const lastBubble = bubbles[bubbles.length - 1];
                const text = lastBubble.innerText || '';
                const qtyMatch = text.match(/(\d+)\s*gal/);
                const priceMatch = text.match(/\$\s*([\d,.]+)/);
                console.log(`   [TeamHelper] Current offer: ${qtyMatch?.[1]} gal @ $${priceMatch?.[1]}`);
                return {
                    chemical,
                    quantity: qtyMatch ? parseInt(qtyMatch[1]) : 0,
                    price: priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0
                };
            }
            console.log('   [TeamHelper] History or bubbles not found in detail view');
            return { chemical, error: "History not found" };
        });

        if (acceptanceRate <= 0 || (details && !details.error && Math.random() > acceptanceRate)) {
            // We want to HAGGLE, so we stay in the detail view
            console.log('   [TeamHelper] Decided to HAGGLE');
            return { action: 'haggle', ...details };
        }

        console.log('   [TeamHelper] Decided to ACCEPT');
        const shouldAccept = true; 
        if (shouldAccept) {
            await this.explicitAccept(page);
            return { action: 'accepted', ...details };
        }
        return null;
    }

    /**
     * Accepts the offer currently open in the detail view
     */
    async explicitAccept(page) {
        await page.evaluate(() => {
            const btn = document.getElementById('accept-offer-btn');
            if (btn && !btn.classList.contains('hidden')) {
                console.log('   [TeamHelper] Clicking Accept Offer button');
                btn.click();
            }
        });
        await this.browser.sleep(1000);
        await page.evaluate(() => {
            const btn = document.getElementById('confirm-ok');
            if (btn) {
                console.log('   [TeamHelper] Clicking Confirm button');
                btn.click();
            }
        });
        await this.browser.sleep(2000);
    }

    /**
     * Witcher 3 Style Haggling
     * Uses sliders to send a counter-offer and logs patience
     */
    async haggleWithMerchant(page, chemical, shadowPrice) {
        console.log(`      - [HAGGLE] Starting negotiation for ${chemical}...`);
        
        // 1. Open Haggle Sliders (assuming detail view is already open)
        const openHaggle = await page.evaluate(() => {
            const btn = document.getElementById('show-counter-form-btn');
            if (btn && !btn.classList.contains('hidden')) {
                console.log('   [TeamHelper] Clicking Counter-Offer button');
                btn.click();
                return true;
            }
            console.log('   [TeamHelper] Counter-offer form button not found or hidden');
            return false;
        });

        if (!openHaggle) {
            return null;
        }
        await this.browser.sleep(1500);

        // 2. Adjust Sliders (Witcher 3 Style)
        const result = await page.evaluate((sp) => {
            const priceSlider = document.getElementById('haggle-price-slider');
            const qtySlider = document.getElementById('haggle-qty-slider');
            const targetPrice = (sp * 0.85).toFixed(2);
            
            if (priceSlider && qtySlider) {
                console.log(`   [TeamHelper] Adjusting sliders: Price=${targetPrice}`);
                priceSlider.value = targetPrice;
                priceSlider.dispatchEvent(new Event('input', { bubbles: true }));
                const patience = document.getElementById('patience-value')?.textContent || '???';
                return { price: targetPrice, quantity: qtySlider.value, patienceAtOffer: patience };
            }
            console.log('   [TeamHelper] Sliders not found in counter form');
            return { error: "Sliders not found" };
        }, shadowPrice);

        if (result.error) {
            console.log(`   [TeamHelper] Haggle error: ${result.error}`);
            return null;
        }

        console.log(`      - [HAGGLE] Set price to $${result.price} (Merchant Patience: ${result.patienceAtOffer})`);
        
        // 3. Send Offer
        const sent = await page.evaluate(() => {
            const btn = document.getElementById('submit-counter-btn');
            if (btn && !btn.disabled) {
                console.log('   [TeamHelper] Clicking Submit Counter button');
                btn.click();
                return true;
            }
            console.log('   [TeamHelper] Submit button missing or disabled');
            return false;
        });

        if (sent) {
            await this.browser.sleep(2000);
            // Close modal
            await page.click('#negotiation-modal-close-btn').catch(() => {});
        }
        
        return result;
    }

    /**
     * Get leaderboard data
     */
    async getLeaderboard() {
        const page = await this.browser.newPage();
        try {
            await page.goto(`${this.browser.config.baseUrl}api/leaderboard/standings.php`);
            const content = await page.evaluate(() => document.body.innerText);
            const data = JSON.parse(content);
            return data.success ? data.standings : [];
        } catch (e) {
            return [];
        } finally {
            await page.close();
        }
    }
}

module.exports = TeamHelper;
