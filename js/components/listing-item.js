import { LitElement, html, css } from 'lit';

const componentStyles = css`
    :host {
        display: block;
        margin-bottom: 0.5rem;
    }
    .listing-item {
        background: #374151 !important; /* Force background color */
        border-radius: 0.375rem;
        padding: 0.75rem;
        transition: background-color 0.2s;
        display: flex;
        justify-content: space-between;
        align-items: center;
        min-height: 2.5rem;
        border: 1px solid #4b5563; /* Add visible border */
    }
    .listing-item:hover {
        background-color: #4b5563; /* Slightly lighter */
    }
    .listing-item-mine {
        background-color: var(--color-bg-ad-mine, #422006);
        border: 1px solid var(--color-border-ad-mine, #d97706);
    }
    .listing-item-mine:hover {
        filter: brightness(1.1);
    }
    .team-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .team-name {
        font-weight: 600;
        color: #f9fafb !important; /* Force white text */
    }
    .your-listing {
        font-size: 0.75rem;
        font-style: italic;
        color: var(--color-text-tertiary, #d1d5db);
    }
    .btn {
        background-color: #10b981;
        color: white;
        padding: 0.5rem 0.75rem;
        border-radius: 0.375rem;
        font-weight: 600;
        font-size: 0.75rem;
        border: none;
        cursor: pointer;
    }
    .btn:hover:not(:disabled) {
        background-color: #059669;
    }
    .btn:disabled {
        background-color: #4b5563;
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

class ListingItem extends LitElement {
    static styles = componentStyles;

    static properties = {
        adId: { type: String, reflect: true },
        teamName: { type: String, reflect: true },
        teamId: { type: String, reflect: true },
        type: { type: String, reflect: true },
        chemical: { type: String, reflect: true },
        quantity: { type: Number },
        maxPrice: { type: Number },
        isMyAd: { type: Boolean, reflect: true },
        disabled: { type: Boolean, reflect: true }
    };

    constructor() {
        super();
        this.isMyAd = false;
        this.disabled = false;
        this.quantity = null;
        this.maxPrice = null;
    }

    handleNegotiate() {
        if (this.disabled) return;
        this.dispatchEvent(new CustomEvent('negotiate', {
            detail: {
                adId: this.adId,
                teamId: this.teamId,
                teamName: this.teamName,
                chemical: this.chemical,
                type: this.type,
                quantity: this.quantity,
                maxPrice: this.maxPrice
            },
            bubbles: true,
            composed: true
        }));
    }

    render() {
        console.log(`🎪 Rendering listing-item: ${this.teamName} (${this.adId}), isMyAd=${this.isMyAd}, disabled=${this.disabled}`);
        
        const showDetails = this.quantity && this.maxPrice;

        return html`
            <div class="listing-item ${this.isMyAd ? 'listing-item-mine' : ''}">
                <div class="team-info">
                    <div style="display: flex; flex-direction: column;">
                        <span class="team-name">${this.teamName}</span>
                        ${showDetails ? html`
                            <span style="font-size: 0.65rem; color: var(--color-text-secondary, #9ca3af);">
                                Wants ${this.quantity} gal @ ${this.maxPrice.toFixed(2)}/gal
                            </span>
                        ` : ''}
                    </div>
                    ${this.isMyAd ? html`<span class="your-listing"> (Your Request)</span>` : ''}
                </div>
                ${!this.isMyAd ? html`
                    <button class="btn" @click=${this.handleNegotiate} ?disabled=${this.disabled}>
                        ${this.disabled ? 'Negotiating...' : 'Sell to'}
                    </button>
                ` : ''}
            </div>
        `;
    }
}

customElements.define('listing-item', ListingItem);