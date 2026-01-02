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
        return await page.evaluate((chem) => {
            const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
            if (!card || !card.shadowRoot) return null;

            const adItems = card.shadowRoot.querySelectorAll('advertisement-item');
            console.log(`[DEBUG] findBuyer: found ${adItems.length} ads for ${chem}`);
            
            for (const item of adItems) {
                const type = item.type || item.getAttribute('type');
                const teamId = item.teamId || item.getAttribute('teamid') || item.getAttribute('teamId');
                const teamName = item.teamName || item.getAttribute('teamname') || item.getAttribute('teamName');
                const isMyAd = item.isMyAd || item.hasAttribute('ismyad') || item.hasAttribute('isMyAd');

                console.log(`[DEBUG] findBuyer ad entry: team=${teamName}, id=${teamId}, type=${type}, isMyAd=${isMyAd}`);

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
        console.log(`      - Attempting to click "Sell to" for ${buyRequest.teamName}...`);
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

        if (!clicked) {
            console.log('      [BROWSER] ✗ Failed to click "Sell to" button');
            return;
        }

        // Wait for the modal element itself to exist and be visible
        await page.waitForSelector('#respond-modal', { visible: true, timeout: 5000 });
        await this.browser.sleep(1000);

        // Fill in respond modal (Main DOM)
        console.log(`      - Filling in respond modal...`);
        await page.evaluate((inv, sp) => {
            const quantity = 50;
            const price = 5.00;

            const qtyInput = document.getElementById('respond-quantity');
            const priceInput = document.getElementById('respond-price');
            const modal = document.getElementById('respond-modal');
            
            console.log(`[DEBUG] respond modal visibility: ${modal.classList.contains('hidden') ? 'HIDDEN' : 'VISIBLE'}`);
            
            if (qtyInput && priceInput) {
                qtyInput.value = quantity;
                priceInput.value = price;
                qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
                priceInput.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                console.log(`[DEBUG] Failed to find inputs: qty=${!!qtyInput}, price=${!!priceInput}`);
            }
        }, inventory, shadowPrice);

        await this.browser.sleep(500);
        console.log(`      - Submitting offer...`);
        await page.click('#respond-submit-btn');
        
        // Wait for toast message to appear
        const toastText = await page.waitForFunction(() => {
            const el = document.querySelector('#toast-container div:last-child');
            return el ? el.textContent : null;
        }, { timeout: 5000 }).then(h => h.jsonValue()).catch(() => null);

        if (toastText) console.log(`      [BROWSER] Toast: ${toastText}`);
        await this.browser.sleep(1000);
    }

    /**
     * Respond to pending negotiations with more verbosity
     */
    async respondToNegotiations(page, shadowPrices, acceptanceRate = 0.7) {
        // 1. Open Negotiation Modal
        const modalOpen = await page.evaluate(() => {
            const btn = document.getElementById('view-all-negotiations-btn');
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        });

        if (!modalOpen) {
            console.log('      - Negotiation modal button not found');
            return null;
        }
        await this.browser.sleep(1000);

        // 2. Look for "Your Turn" negotiations
        const negData = await page.evaluate(() => {
            const pendingContainer = document.getElementById('pending-negotiations');
            const cards = pendingContainer?.querySelectorAll('negotiation-card');
            const results = [];
            for (const card of cards) {
                if (card.innerHTML.includes('Your Turn')) {
                    results.push({
                        id: card.getAttribute('negotiation-id'),
                        text: card.innerText.replace(/\n/g, ' ')
                    });
                }
            }
            return results;
        });

        if (negData.length === 0) {
            console.log('      - No negotiations waiting for action ("Your Turn" not found)');
            await page.click('#negotiation-modal-close-btn').catch(() => {});
            return null;
        }

        console.log(`      - Found ${negData.length} pending negotiations for this team.`);
        const firstNeg = negData[0];
        console.log(`      - Acting on: ${firstNeg.text}`);

        // 3. Click the card to open details
        await page.evaluate((id) => {
            const card = document.querySelector(`negotiation-card[negotiation-id="${id}"]`);
            card?.click();
        }, firstNeg.id);

        await this.browser.sleep(1000);

        // 4. Get details from detail view
        const negDetails = await page.evaluate(() => {
            const chemText = document.getElementById('detail-chemical')?.textContent || '';
            const chemical = chemText.match(/Chemical ([CNDQ])/)?.[1];
            
            const history = document.getElementById('offer-history');
            const lastBubble = history?.lastElementChild;
            if (lastBubble) {
                const text = lastBubble.textContent || '';
                // Look for patterns like "100 gal @ $5.50/gal"
                const qtyMatch = text.match(/(\d+)\s*gal/);
                const priceMatch = text.match(/\$\s*([\d.]+)/);
                return {
                    chemical,
                    quantity: qtyMatch ? parseInt(qtyMatch[1]) : 0,
                    price: priceMatch ? parseFloat(priceMatch[1]) : 0
                };
            }
            return { chemical };
        });

        if (!negDetails.price) {
            console.log('      - Could not parse price from offer history bubble');
        }

        const shouldAccept = Math.random() < acceptanceRate;

        if (shouldAccept) {
            console.log(`      - Decided to ACCEPT: ${negDetails.quantity} gal @ $${negDetails.price}/gal`);
            const accepted = await page.evaluate(() => {
                const btn = document.getElementById('accept-offer-btn');
                if (btn && !btn.classList.contains('hidden')) {
                    btn.click();
                    return true;
                }
                return false;
            });

            if (accepted) {
                await this.browser.sleep(500);
                await page.click('#confirm-ok');
                await this.browser.sleep(1000);
                return { action: 'accepted', ...negDetails };
            } else {
                console.log('      - Failed to find or click accept button');
            }
        } else {
            console.log(`      - Decided to REJECT.`);
            const rejected = await page.evaluate(() => {
                const btn = document.getElementById('reject-offer-btn');
                if (btn && !btn.classList.contains('hidden')) {
                    btn.click();
                    return true;
                }
                return false;
            });

            if (rejected) {
                await this.browser.sleep(500);
                await page.click('#confirm-ok');
                await this.browser.sleep(1000);
                return { action: 'rejected', ...negDetails };
            } else {
                console.log('      - Failed to find or click reject button');
            }
        }

        // Close modal
        await page.click('#negotiation-modal-close-btn').catch(() => {});
        return null;
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
