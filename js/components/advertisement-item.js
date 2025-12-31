/**
 * Advertisement Item Web Component
 *
 * Displays a single advertisement (buy or sell interest) for a chemical.
 * Shows team name and negotiation button.
 *
 * Usage:
 *   <advertisement-item
 *       team-name="Team Alpha"
 *       team-id="team@example.com"
 *       type="sell"
 *       chemical="C"
 *       is-my-ad>
 *   </advertisement-item>
 *
 * Events:
 *   - negotiate: Dispatched when user clicks negotiate button
 *     detail: { teamId, teamName, chemical, type }
 */

import { tailwindStyles } from './shared-styles.js';

class AdvertisementItem extends HTMLElement {
    constructor() {
        super();
        // Use light DOM to work with global Tailwind styles
    }

    static get observedAttributes() {
        return ['team-name', 'team-id', 'type', 'is-my-ad', 'chemical'];
    }

    get teamName() { return this.getAttribute('team-name'); }
    set teamName(val) { this.setAttribute('team-name', val); }

    get teamId() { return this.getAttribute('team-id'); }
    set teamId(val) { this.setAttribute('team-id', val); }

    get type() { return this.getAttribute('type'); } // 'buy' or 'sell'
    set type(val) { this.setAttribute('type', val); }

    get isMyAd() { return this.hasAttribute('is-my-ad'); }
    set isMyAd(val) {
        if (val) this.setAttribute('is-my-ad', '');
        else this.removeAttribute('is-my-ad');
    }

    get chemical() { return this.getAttribute('chemical'); }
    set chemical(val) { this.setAttribute('chemical', val); }

    connectedCallback() {
        this.render();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue && this.firstChild) {
            this.render();
        }
    }

    render() {
        // In the simplified model, all advertisements are BUY requests
        // So we always want to "Sell to" them.
        const buttonText = 'Sell to';
        const bgColor = 'bg-blue-700';

        this.innerHTML = `
            <div class="bg-gray-700 rounded p-3 border border-gray-600">
                <div class="flex items-center justify-between">
                    <div>
                        <div class="font-semibold text-sm text-white">${this.teamName}</div>
                        <div class="text-xs text-gray-300">Wants to buy</div>
                    </div>
                    ${!this.isMyAd ? `
                        <button
                            class="negotiate-btn ${bgColor} hover:opacity-90 text-white px-3 py-1 rounded text-xs font-semibold transition"
                            part="button">
                            ${buttonText}
                        </button>
                    ` : '<span class="text-xs text-gray-400 italic">Your ad</span>'}
                </div>
            </div>
        `;

        if (!this.isMyAd) {
            this.querySelector('.negotiate-btn')
                .addEventListener('click', () => this.handleNegotiate());
        }
    }

    handleNegotiate() {
        this.dispatchEvent(new CustomEvent('negotiate', {
            bubbles: true,
            composed: true, // CRITICAL: Crosses shadow DOM boundary
            detail: {
                teamId: this.teamId,
                teamName: this.teamName,
                chemical: this.chemical,
                type: this.type
            }
        }));
    }
}

customElements.define('advertisement-item', AdvertisementItem);
