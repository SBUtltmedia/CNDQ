import { LitElement, html, css } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

// Since we can't use Tailwind inside the Shadow DOM directly,
// we define our styles here. These are inspired by your existing styles.
const componentStyles = css`
    :host {
        display: block;
    }
    .card {
        background-color: var(--color-bg-secondary, #1f2937);
        border-radius: 0.5rem;
        border: 2px solid var(--border-color, #4b5563);
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        color: var(--color-text-primary, #f9fafb);
    }
    .header {
        padding: 1rem;
        text-align: center;
        background-color: var(--header-bg-color, #374151);
    }
    .header h2 {
        font-weight: 700;
        font-size: 1.25rem;
        color: white;
    }
    .content {
        padding: 1rem;
    }
    .info-box {
        background-color: var(--color-bg-tertiary, #374151);
        border-radius: 0.5rem;
        padding: 0.75rem;
        margin-bottom: 1rem;
    }
    .info-label {
        font-size: 0.875rem;
        color: var(--color-text-secondary, #e5e7eb);
    }
    .info-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-text-primary, white);
    }
    .shadow-price {
        font-size: 0.75rem;
        color: var(--color-text-secondary, #e5e7eb);
        margin-top: 0.25rem;
    }
    .shadow-price span {
        color: var(--color-success, #10b981);
        font-weight: 700;
    }
    .btn {
        width: 100%;
        background-color: #2563eb;
        color: white;
        padding: 0.75rem;
        border-radius: 0.5rem;
        font-weight: 600;
        border: none;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .btn:hover {
        background-color: #1d4ed8;
    }
    .btn-revise {
        background-color: #d97706;
    }
    .btn-revise:hover {
        background-color: #b45309;
    }
    .btn-disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .listings-header {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--color-text-secondary, #e5e7eb);
        margin-bottom: 0.5rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .listings-container {
        max-height: 24rem;
        overflow-y: auto;
        padding-right: 0.25rem; /* for scrollbar */
    }
    .empty-listings {
        font-size: 0.75rem;
        color: var(--color-text-tertiary, #d1d5db);
        text-align: center;
        padding: 1rem 0;
    }
`;

class ChemicalCard extends LitElement {
    static styles = componentStyles;

    static properties = {
        chemical: { type: String },
        inventory: { type: Number },
        shadowPrice: { type: Number },
        ranges: { type: Object },
        buyAds: { type: Array },
        currentUserId: { type: String },
        hasActiveNegotiation: { type: Boolean }
    };

    constructor() {
        super();
        this.chemical = '';
        this.inventory = 0;
        this.shadowPrice = 0;
        this.ranges = { allowableIncrease: 0, allowableDecrease: 0 };
        this.buyAds = [];
        this.currentUserId = '';
        this.hasActiveNegotiation = false;
    }

    getChemicalColor(chemical) {
        const colors = {
            C: { border: 'var(--color-chemical-c, #6eb5ff)', header: '#1d4ed8' },
            N: { border: 'var(--color-chemical-n, #d4a8fc)', header: '#7c3aed' },
            D: { border: 'var(--color-chemical-d, #fcd34d)', header: '#b45309' },
            Q: { border: 'var(--color-chemical-q, #ffa0a0)', header: '#b91c1c' }
        };
        return colors[chemical] || colors.C;
    }

    handlePostBuyRequest() {
        this.dispatchEvent(new CustomEvent('post-interest', {
            detail: { chemical: this.chemical, type: 'buy' },
            bubbles: true,
            composed: true
        }));
    }

    formatCurrency(num) {
        if (num === null || num === undefined || isNaN(num)) return '$0.00';
        const parsed = parseFloat(num);
        const value = Object.is(parsed, -0) ? 0 : parsed;
        const formatted = Math.abs(value).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return (value < 0 ? '-$' : '$') + formatted;
    }

    render() {
        const { border, header } = this.getChemicalColor(this.chemical);
        const hasActiveBuyAd = this.buyAds.some(ad => ad.teamId === this.currentUserId);
        
        const increase = this.ranges?.allowableIncrease ?? 0;
        const decrease = this.ranges?.allowableDecrease ?? 0;
        const isRangeZero = (increase + decrease) < 1;

        return html`
            <div class="card" style="--border-color: ${border};">
                <div class="header" style="--header-bg-color: ${header};">
                    <h2>Chemical ${this.chemical}</h2>
                </div>
                <div class="content">
                    <div class="info-box">
                        <div class="info-label">Your Inventory</div>
                        <div id="inventory" class="info-value">${this.inventory.toLocaleString()}</div>
                        
                        <div class="shadow-price" title="This is the internal value of 1 gallon to YOUR team. Buying below this or selling above this increases your potential profit.">
                            Shadow Price: <span id="shadow-price">${this.formatCurrency(this.shadowPrice)}</span>
                        </div>

                        <div style="font-size: 0.65rem; color: var(--color-text-secondary); margin-top: 0.5rem; line-height: 1.2;">
                            <div class="flex justify-between">
                                <span>Range:</span>
                                <span class="text-success font-bold">
                                    ${isRangeZero 
                                        ? 'N/A (Low Inv)' 
                                        : `-${decrease.toFixed(0)} / +${increase >= 9000 ? '∞' : increase.toFixed(0)} gal`
                                    }
                                </span>
                            </div>
                            <div style="opacity: 0.7; font-style: italic;">(Price stable within this range)</div>
                        </div>
                    </div>

                    <div style="margin-bottom: 1rem;">
                        <button
                            id="post-buy-btn"
                            class="btn ${hasActiveBuyAd ? 'btn-revise' : ''}"
                            @click=${this.handlePostBuyRequest}>
                            ${hasActiveBuyAd ? '✏️ Revise Buy Request' : '📋 Post Buy Request'}
                        </button>
                        <p class="empty-listings" style="margin: 0.5rem 0 0; text-align: center;">
                            ${hasActiveBuyAd ? 'Click to update or remove your request.' : 'Post what you need, teams will offer to sell.'}
                        </p>
                    </div>

                    <div>
                        <h4 class="listings-header">Buy Requests</h4>
                        <div class="listings-container">
                            ${this.buyAds.length === 0
                                ? html`<p class="empty-listings">${this.inventory > 0 ? 'No buy requests yet' : 'Get inventory to see buy requests'}</p>`
                                : this.buyAds.map(ad => {
                                    console.log(`🔧 Creating listing-item for ${this.chemical}:`, ad.teamName, ad.id, ad.teamId === this.currentUserId ? '(MINE)' : '');
                                    return html`
                                        <listing-item
                                            .adId=${ad.id}
                                            .teamName=${ad.teamName}
                                            .teamId=${ad.teamId}
                                            type="buy"
                                            .chemical=${this.chemical}
                                            .quantity=${ad.quantity}
                                            .maxPrice=${ad.maxPrice}
                                            ?isMyAd=${ad.teamId === this.currentUserId}
                                            ?disabled=${this.hasActiveNegotiation}
                                        ></listing-item>
                                    `;
                                })
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('chemical-card', ChemicalCard);