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
        await page.waitForSelector('#app:not(.hidden)', { timeout: 10000 });
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
        const subResult = await page.evaluate((sp) => {
            const modalInv = parseFloat(document.getElementById('respond-your-inventory').textContent.replace(/,/g, '')) || 0;
            const qtyInput = document.getElementById('respond-quantity');
            const priceInput = document.getElementById('respond-price');
            
            if (modalInv < 1) {
                return { success: false, reason: "No inventory to sell (has " + modalInv + ")" };
            }

            const quantity = Math.min(50, Math.floor(modalInv));
            const price = 5.00;

            if (qtyInput && priceInput) {
                qtyInput.value = quantity;
                priceInput.value = price;
                qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
                priceInput.dispatchEvent(new Event('input', { bubbles: true }));
                return { success: true, quantity, price };
            }
            return { success: false, reason: "Inputs not found" };
        }, shadowPrice);

        if (!subResult.success) {
            console.log(`      ✗ Cannot submit offer: ${subResult.reason}`);
            await page.click('#respond-cancel-btn');
            return;
        }

        await this.browser.sleep(500);
        console.log(`      - Submitting offer for ${subResult.quantity} gal...`);
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
        // Force refresh to bypass stale cache/polling
        await page.reload({ waitUntil: 'networkidle2' });
        await this.browser.sleep(2000);

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

        // 2. Wait for list to load and look for "Your Turn" negotiations
        await page.waitForFunction(() => {
            const container = document.getElementById('pending-negotiations');
            return container && (container.children.length > 1 || container.innerText.includes('No pending'));
        }, { timeout: 5000 }).catch(() => {});

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

        // 3. Click the card to open details (click the internal button)
        const clicked = await page.evaluate((id) => {
            const card = document.querySelector(`negotiation-card[negotiation-id="${id}"]`);
            const btn = card?.querySelector('[role="button"]');
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        }, firstNeg.id);

        if (!clicked) {
            console.log('      ✗ Failed to click negotiation card button');
            return null;
        }

        await this.browser.sleep(2000); // Wait for detail view to render
        // Wait for at least one offer bubble (which uses class max-w-xs)
        await page.waitForSelector('#offer-history div.max-w-xs', { timeout: 10000 }).catch(() => {});

        // 4. Get details from detail view
        const negDetails = await page.evaluate(() => {
            const chemText = document.getElementById('detail-chemical')?.textContent || '';
            const chemical = chemText.match(/Chemical ([CNDQ])/)?.[1];
            
            const history = document.getElementById('offer-history');
            const bubbles = history?.querySelectorAll('.max-w-xs');
            const lastBubble = bubbles && bubbles.length > 0 ? bubbles[bubbles.length - 1] : null;
            
            if (lastBubble) {
                const text = lastBubble.textContent || '';
                // Detailed debug log inside browser
                console.log(`[DEBUG] Parsing bubble text: "${text}"`);
                
                const qtyMatch = text.match(/(\d+)\s*gal/);
                const priceMatch = text.match(/\$\s*([\d,.]+)/);
                
                return {
                    chemical,
                    quantity: qtyMatch ? parseInt(qtyMatch[1]) : 0,
                    price: priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0,
                    rawText: text
                };
            }
            return { chemical, error: "History bubble not found", historyHTML: history?.innerHTML };
        });

        if (!negDetails.price || negDetails.price === 0) {
            console.log(`      ✗ PARSE FAILURE: Could not extract price from bubble.`);
            console.log(`      [DEBUG] History HTML: "${negDetails.historyHTML}"`);
        }

        const shouldAccept = Math.random() < acceptanceRate;

        if (shouldAccept) {
            console.log(`      - Decided to ACCEPT: ${negDetails.quantity} gal @ $${negDetails.price}/gal`);
            
            // Trigger accept
            await page.evaluate(() => {
                const btn = document.getElementById('accept-offer-btn');
                if (btn && !btn.classList.contains('hidden')) btn.click();
            });

            await this.browser.sleep(1000);
            
            // Handle confirm
            await page.evaluate(() => {
                const btn = document.getElementById('confirm-ok');
                if (btn) btn.click();
            });

            // --- WAIT FOR TOAST RESPONSE ---
            const resultToast = await page.waitForFunction(() => {
                const el = document.querySelector('#toast-container div:last-child');
                return el ? el.textContent : null;
            }, { timeout: 8000 }).then(h => h.jsonValue()).catch(() => "No toast appeared");

            console.log(`      [BROWSER] Acceptance Result: ${resultToast}`);
            
            return { action: 'accepted', ...negDetails };
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
