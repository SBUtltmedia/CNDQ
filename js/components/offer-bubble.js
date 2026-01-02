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
        
        const isHot = this._offer.heat && this._offer.heat.isHot;
        const hotBadge = isHot ? `
            <div class="mt-2 py-1 px-2 bg-orange-500 text-white text-[10px] font-bold uppercase rounded flex items-center gap-1 animate-pulse">
                <span>🔥 Hot Trade</span>
                <span class="text-[9px] font-normal opacity-90">(Beneficial for both)</span>
            </div>
        ` : '';

        this.innerHTML = `
            <div class="max-w-xs ${alignment} ${bgColor} rounded-lg p-3 text-white shadow-lg relative overflow-hidden">
                ${isHot ? '<div class="absolute top-0 right-0 w-16 h-16 bg-orange-400 opacity-10 rotate-45 translate-x-8 -translate-y-8"></div>' : ''}
                <div class="font-semibold text-sm flex justify-between items-center">
                    <span>${this._offer.fromTeamName}</span>
                </div>
                <div class="text-xs text-gray-200">
                    ${this._offer.quantity} gal @ $${this._offer.price.toFixed(2)}/gal
                </div>
                <div class="text-xs font-bold text-green-400">
                    Total: $${total.toFixed(2)}
                </div>
                ${hotBadge}
                <div class="text-[10px] text-gray-400 mt-1 italic">
                    ${date}
                </div>
            </div>
        `;
    }
}

customElements.define('offer-bubble', OfferBubble);
