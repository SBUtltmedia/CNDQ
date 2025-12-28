/**
 * Offer Bubble Web Component
 *
 * Displays a single offer in the negotiation history.
 * Styled differently for offers from current user vs other party.
 *
 * Usage:
 *   const bubble = document.createElement('offer-bubble');
 *   bubble.offer = { fromTeamName, quantity, price, createdAt };
 *   bubble.isFromMe = true;
 *
 * Properties:
 *   - offer: Object - offer data
 *   - isFromMe: Boolean - alignment and color
 */

import { tailwindStyles } from './shared-styles.js';

class OfferBubble extends HTMLElement {
    constructor() {
        super();
        // Use light DOM to work with global Tailwind styles
        this._offer = null;
    }

    get offer() { return this._offer; }
    set offer(val) {
        this._offer = val;
        if (this.firstChild) this.render();
    }

    get isFromMe() { return this.hasAttribute('is-from-me'); }
    set isFromMe(val) {
        if (val) this.setAttribute('is-from-me', '');
        else this.removeAttribute('is-from-me');
        if (this.firstChild) this.render();
    }

    connectedCallback() {
        this.render();
    }

    render() {
        if (!this._offer) {
            this.innerHTML = '';
            return;
        }

        const alignment = this.isFromMe ? 'ml-auto' : 'mr-auto';
        const bgColor = this.isFromMe ? 'bg-blue-700' : 'bg-gray-600';
        const total = this._offer.quantity * this._offer.price;
        const date = new Date(this._offer.createdAt * 1000).toLocaleString();

        this.innerHTML = `
            <div class="max-w-xs ${alignment} ${bgColor} rounded-lg p-3 text-white">
                <div class="font-semibold text-sm">${this._offer.fromTeamName}</div>
                <div class="text-xs text-gray-200">
                    ${this._offer.quantity} gal @ $${this._offer.price.toFixed(2)}/gal
                </div>
                <div class="text-xs font-bold text-green-400">
                    Total: $${total.toFixed(2)}
                </div>
                <div class="text-xs text-gray-300 mt-1">
                    ${date}
                </div>
            </div>
        `;
    }
}

customElements.define('offer-bubble', OfferBubble);
