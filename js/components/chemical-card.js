/**
 * Chemical Card Web Component
 *
 * Displays a chemical column with inventory, shadow price, post buttons,
 * and lists of buy/sell advertisements.
 *
 * Usage:
 *   <chemical-card chemical="C"></chemical-card>
 *
 * Properties (set via JavaScript):
 *   - inventory: Number - current inventory amount
 *   - shadowPrice: Number - calculated shadow price
 *   - sellAds: Array - advertisements of teams wanting to sell
 *   - buyAds: Array - advertisements of teams wanting to buy
 *   - currentUserId: String - to identify own advertisements
 *
 * Events:
 *   - post-interest: Dispatched when post sell/buy button clicked
 *     detail: { chemical, type }
 *   - negotiate: Proxied from child advertisement-item components
 *     detail: { teamId, teamName, chemical, type }
 */

import { tailwindStyles } from './shared-styles.js';
import './advertisement-item.js';

class ChemicalCard extends HTMLElement {
    constructor() {
        super();
        // Use light DOM to work with global Tailwind styles
        this._data = {
            inventory: 0,
            shadowPrice: 0,
            sellAds: [],
            buyAds: []
        };
    }

    static get observedAttributes() {
        return ['chemical', 'current-user-id'];
    }

    get chemical() { return this.getAttribute('chemical'); }
    set chemical(val) { this.setAttribute('chemical', val); }

    get currentUserId() { return this.getAttribute('current-user-id'); }
    set currentUserId(val) { this.setAttribute('current-user-id', val); }

    // Use properties for complex data (arrays/objects)
    get inventory() { return this._data.inventory; }
    set inventory(val) {
        this._data.inventory = val;
        this.updateInventory();
    }

    get shadowPrice() { return this._data.shadowPrice; }
    set shadowPrice(val) {
        this._data.shadowPrice = val;
        this.updateShadowPrice();
    }

    get sellAds() { return this._data.sellAds; }
    set sellAds(val) {
        this._data.sellAds = val || [];
        this.renderAdvertisements();
    }

    get buyAds() { return this._data.buyAds; }
    set buyAds(val) {
        this._data.buyAds = val || [];
        this.renderAdvertisements();
    }

    connectedCallback() {
        this.render();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue && this.firstChild) {
            if (name === 'chemical') {
                this.render(); // Full re-render if chemical changes
            } else if (name === 'current-user-id') {
                this.renderAdvertisements(); // Re-render ads to update "Your ad" labels
            }
        }
    }

    render() {
        const colors = {
            C: { border: 'border-blue-500', header: 'bg-blue-600' },
            N: { border: 'border-purple-500', header: 'bg-purple-600' },
            D: { border: 'border-yellow-500', header: 'bg-yellow-600' },
            Q: { border: 'border-red-500', header: 'bg-red-600' }
        };

        const { border, header } = colors[this.chemical] || colors.C;

        this.innerHTML = `
            <div class="bg-gray-800 rounded-lg border-2 ${border} shadow-xl">
                <div class="${header} p-4 text-center">
                    <h2 class="font-bold text-xl text-white">Chemical ${this.chemical}</h2>
                </div>
                <div class="p-4">
                    <!-- Inventory Display -->
                    <div class="bg-gray-700 rounded-lg p-3 mb-4">
                        <div class="text-sm text-gray-300">Your Inventory</div>
                        <div class="text-2xl font-bold text-white" id="inventory">0</div>
                        <div class="text-xs text-gray-300 mt-1">
                            Shadow Price:
                            <span class="text-success font-bold" id="shadow-price-container">
                                $<span id="shadow-price">0</span>
                            </span>
                        </div>
                    </div>

                    <!-- Post Interest Buttons -->
                    <div class="grid grid-cols-2 gap-2 mb-4">
                        <button class="bg-green-600 hover:bg-green-700 text-white py-2 rounded font-semibold transition text-sm"
                                id="post-sell-btn">
                            Post Sell Interest
                        </button>
                        <button class="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-semibold transition text-sm"
                                id="post-buy-btn">
                            Post Buy Interest
                        </button>
                    </div>

                    <!-- Teams Wanting to Sell -->
                    <div class="mb-4">
                        <h4 class="text-xs font-bold text-gray-300 mb-2 uppercase tracking-wide">
                            Teams Wanting to Sell
                        </h4>
                        <div id="sell-ads" class="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
                            <p class="text-xs text-gray-300 text-center py-4">No sellers</p>
                        </div>
                    </div>

                    <!-- Teams Wanting to Buy -->
                    <div>
                        <h4 class="text-xs font-bold text-gray-300 mb-2 uppercase tracking-wide">
                            Teams Wanting to Buy
                        </h4>
                        <div id="buy-ads" class="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
                            <p class="text-xs text-gray-300 text-center py-4">No buyers</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Setup event listeners
        this.querySelector('#post-sell-btn')
            .addEventListener('click', () => this.handlePostInterest('sell'));
        this.querySelector('#post-buy-btn')
            .addEventListener('click', () => this.handlePostInterest('buy'));

        // Initial render of data
        this.updateInventory();
        this.updateShadowPrice();
        this.renderAdvertisements();
    }

    updateInventory() {
        const el = this.querySelector('#inventory');
        if (el) el.textContent = this.formatNumber(this.inventory);
    }

    updateShadowPrice() {
        const el = this.querySelector('#shadow-price');
        if (el) el.textContent = this.formatNumber(this.shadowPrice);
    }

    renderAdvertisements() {
        if (!this.firstChild) return;

        const sellContainer = this.querySelector('#sell-ads');
        const buyContainer = this.querySelector('#buy-ads');

        // Render sell advertisements
        if (this.sellAds.length === 0) {
            sellContainer.innerHTML = '<p class="text-xs text-gray-300 text-center py-4">No sellers</p>';
        } else {
            sellContainer.innerHTML = '';
            this.sellAds.forEach(ad => {
                const item = document.createElement('advertisement-item');
                item.teamName = ad.teamName;
                item.teamId = ad.teamId;
                item.type = 'sell';
                item.chemical = this.chemical;
                item.isMyAd = ad.teamId === this.currentUserId;
                sellContainer.appendChild(item);
            });
        }

        // Render buy advertisements
        if (this.buyAds.length === 0) {
            buyContainer.innerHTML = '<p class="text-xs text-gray-300 text-center py-4">No buyers</p>';
        } else {
            buyContainer.innerHTML = '';
            this.buyAds.forEach(ad => {
                const item = document.createElement('advertisement-item');
                item.teamName = ad.teamName;
                item.teamId = ad.teamId;
                item.type = 'buy';
                item.chemical = this.chemical;
                item.isMyAd = ad.teamId === this.currentUserId;
                buyContainer.appendChild(item);
            });
        }
    }

    handlePostInterest(type) {
        this.dispatchEvent(new CustomEvent('post-interest', {
            bubbles: true,
            composed: true,
            detail: {
                chemical: this.chemical,
                type: type
            }
        }));
    }

    formatNumber(num) {
        if (num === null || num === undefined) return '0';
        return parseFloat(num).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    }
}

customElements.define('chemical-card', ChemicalCard);
