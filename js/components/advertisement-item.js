import { LitElement, html, css } from 'lit';

const componentStyles = css`
    :host {
        display: block;
        margin-bottom: 0.5rem;
    }
    .ad-item {
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
    .ad-item:hover {
        background-color: #4b5563; /* Slightly lighter */
    }
    .ad-item-mine {
        background-color: var(--color-bg-ad-mine, #422006);
        border: 1px solid var(--color-border-ad-mine, #d97706);
    }
    .ad-item-mine:hover {
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
    .your-ad {
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

class AdvertisementItem extends LitElement {
    static styles = componentStyles;

    static properties = {
        adId: { type: String, reflect: true },
        teamName: { type: String, reflect: true },
        teamId: { type: String, reflect: true },
        type: { type: String, reflect: true },
        chemical: { type: String, reflect: true },
        isMyAd: { type: Boolean, reflect: true },
        disabled: { type: Boolean, reflect: true }
    };

    constructor() {
        super();
        this.isMyAd = false;
        this.disabled = false;
    }

    handleNegotiate() {
        if (this.disabled) return;
        this.dispatchEvent(new CustomEvent('negotiate', {
            detail: {
                adId: this.adId,
                teamId: this.teamId,
                teamName: this.teamName,
                chemical: this.chemical,
                type: this.type
            },
            bubbles: true,
            composed: true
        }));
    }

    render() {
        console.log(`🎪 Rendering ad-item: ${this.teamName} (${this.adId}), isMyAd=${this.isMyAd}, disabled=${this.disabled}`);
        return html`
            <div class="ad-item ${this.isMyAd ? 'ad-item-mine' : ''}">
                <div class="team-info">
                    <span class="team-name">${this.teamName}</span>
                    ${this.isMyAd ? html`<span class="your-ad"> (Your Request)</span>` : ''}
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

customElements.define('advertisement-item', AdvertisementItem);