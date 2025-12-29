/**
 * Team Helper - Team actions and trading operations
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
                if (card) {
                    const el = card.querySelector('#shadow-price');
                    prices[chem] = parseFloat(el?.textContent || '0');
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
        return await page.$eval('#team-name', el => el.textContent);
    }

    /**
     * Post advertisement for a chemical
     */
    async postAdvertisement(page, chemical, type) {
        await page.evaluate((chem, adType) => {
            const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
            if (card) {
                const button = card.querySelector(`#post-${adType}-btn`);
                if (button) {
                    button.click();
                }
            }
        }, chemical, type);
        await this.browser.sleep(500);
    }

    /**
     * Find seller for a chemical
     */
    async findSeller(page, chemical) {
        return await page.evaluate((chem) => {
            const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
            if (!card) return null;

            const adItems = card.querySelectorAll('advertisement-item');
            for (const item of adItems) {
                if (item.type === 'sell' && !item.isMyAd) {
                    return {
                        teamId: item.teamId,
                        teamName: item.teamName,
                        chemical: chem
                    };
                }
            }
            return null;
        }, chemical);
    }

    /**
     * Find buyer for a chemical
     */
    async findBuyer(page, chemical) {
        return await page.evaluate((chem) => {
            const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
            if (!card) return null;

            const adItems = card.querySelectorAll('advertisement-item');
            for (const item of adItems) {
                if (item.type === 'buy' && !item.isMyAd) {
                    return {
                        teamId: item.teamId,
                        teamName: item.teamName,
                        chemical: chem
                    };
                }
            }
            return null;
        }, chemical);
    }

    /**
     * Initiate negotiation with another team
     */
    async initiateNegotiation(page, counterparty, chemical, myShadowPrice) {
        try {
            // Click negotiate button
            const clicked = await page.evaluate((teamId, chem) => {
                const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
                if (!card) return false;

                const adItems = card.querySelectorAll('advertisement-item');
                for (const item of adItems) {
                    if (item.teamId === teamId) {
                        const btn = item.querySelector('.negotiate-btn');
                        if (btn) {
                            btn.click();
                            return true;
                        }
                    }
                }
                return false;
            }, counterparty.teamId, chemical);

            if (clicked) {
                await this.browser.sleep(1000);

                // Fill in negotiation form
                const quantity = Math.floor(Math.random() * 50) + 10; // 10-60 gallons
                const priceOffset = (Math.random() * 2) - 1; // -1 to +1
                const price = Math.max(0.1, myShadowPrice + priceOffset).toFixed(2);

                await page.type('#new-quantity', quantity.toString());
                await page.type('#new-price', price);
                await page.click('#submit-new-negotiation-btn');
                await this.browser.sleep(500);

                return true;
            }
        } catch (error) {
            // Negotiation might fail - that's okay
        }
        return false;
    }

    /**
     * Respond to pending negotiations
     */
    async respondToNegotiations(page, shadowPrices, acceptanceRate = 0.7) {
        const hasNegotiations = await page.evaluate(() => {
            const container = document.querySelector('#my-negotiations');
            return container && container.children.length > 1;
        });

        if (!hasNegotiations) return null;

        // Click first negotiation
        const clicked = await page.evaluate(() => {
            const container = document.querySelector('#my-negotiations');
            const firstNeg = container?.querySelector('.negotiation-item');
            if (firstNeg) {
                firstNeg.click();
                return true;
            }
            return false;
        });

        if (!clicked) return null;

        await this.browser.sleep(1000);

        // Get negotiation details
        const negDetails = await page.evaluate(() => {
            const chemEl = document.querySelector('#detail-chemical');
            const chemical = chemEl?.textContent?.match(/Chemical ([CNDQ])/)?.[1];

            const offers = document.querySelectorAll('#offer-history .offer-item');
            if (offers.length > 0) {
                const lastOffer = offers[offers.length - 1];
                const quantity = parseInt(lastOffer.querySelector('.quantity')?.textContent || '0');
                const price = parseFloat(lastOffer.querySelector('.price')?.textContent?.replace('$', '') || '0');
                return { chemical, quantity, price };
            }
            return null;
        });

        if (!negDetails || !negDetails.chemical) return null;

        const shouldAccept = Math.random() < acceptanceRate;

        if (shouldAccept) {
            // Accept
            const accepted = await page.evaluate(() => {
                const btn = document.querySelector('#accept-offer-btn');
                if (btn && !btn.classList.contains('hidden')) {
                    btn.click();
                    return true;
                }
                return false;
            });

            if (accepted) {
                await this.browser.sleep(1000);
                return { action: 'accepted', ...negDetails };
            }
        } else {
            // Counter or reject
            if (Math.random() > 0.5) {
                // Counter-offer
                const myShadowPrice = shadowPrices[negDetails.chemical];
                const counterPrice = (myShadowPrice * 0.9 + negDetails.price * 0.1).toFixed(2);
                const counterQuantity = Math.max(1, Math.floor(negDetails.quantity * 0.8));

                await page.evaluate(() => {
                    const showCounterBtn = document.querySelector('#show-counter-form-btn');
                    if (showCounterBtn && !showCounterBtn.classList.contains('hidden')) {
                        showCounterBtn.click();
                    }
                }, counterQuantity, counterPrice);

                await this.browser.sleep(500);

                const countered = await page.evaluate((qty, price) => {
                    const qtyInput = document.querySelector('#counter-quantity');
                    const priceInput = document.querySelector('#counter-price');
                    const submitBtn = document.querySelector('#submit-counter-btn');
                    if (qtyInput && priceInput && submitBtn) {
                        qtyInput.value = qty;
                        priceInput.value = price;
                        submitBtn.click();
                        return true;
                    }
                    return false;
                }, counterQuantity, counterPrice);

                if (countered) {
                    await this.browser.sleep(1500);
                    return { action: 'countered', quantity: counterQuantity, price: counterPrice, ...negDetails };
                }
            } else {
                // Reject
                const rejected = await page.evaluate(() => {
                    const btn = document.querySelector('#reject-offer-btn');
                    if (btn && !btn.classList.contains('hidden')) {
                        btn.click();
                        return true;
                    }
                    return false;
                });

                if (rejected) {
                    await this.browser.sleep(1000);
                    return { action: 'rejected', ...negDetails };
                }
            }
        }

        return null;
    }

    /**
     * Get leaderboard
     */
    async getLeaderboard() {
        const page = await this.browser.newPage();
        try {
            const response = await page.goto(`${this.browser.config.baseUrl}/api/team/leaderboard.php`);
            const data = await response.json();
            return data.success ? data.teams : [];
        } finally {
            await page.close();
        }
    }
}

module.exports = TeamHelper;
