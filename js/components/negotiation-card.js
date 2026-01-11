/**
 * Negotiation Card Web Component
 *
 * Displays a negotiation summary card with status and latest offer.
 * Used in both summary view and modal list view.
 *
 * Usage:
 *   const card = document.createElement('negotiation-card');
 *   card.negotiation = { id, chemical, offers, status, ... };
 *   card.currentUserId = 'user@example.com';
 *   card.context = 'summary'; // or 'list'
 *
 * Properties:
 *   - negotiation: Object - negotiation data
 *   - currentUserId: String - to determine turn
 *   - context: String - 'summary' or 'list' (affects styling)
 *
 * Events:
 *   - view-detail: Dispatched when card is clicked
 *     detail: { negotiationId }
 */

import { tailwindStyles } from './shared-styles.js';

class NegotiationCard extends HTMLElement {
    constructor() {
        super();
        // Use light DOM to work with global Tailwind styles
        this._negotiation = null;
    }

    get negotiation() { return this._negotiation; }
    set negotiation(val) {
        this._negotiation = val;
        if (val && val.id) {
            this.setAttribute('negotiation-id', val.id);
        }
        if (this.firstChild) this.render();
    }

    get currentUserId() { return this.getAttribute('current-user-id'); }
    set currentUserId(val) {
        this.setAttribute('current-user-id', val);
    }

    get context() { return this.getAttribute('context') || 'summary'; } // 'summary' or 'list'
    set context(val) {
        this.setAttribute('context', val);
    }

    connectedCallback() {
        this.render();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue && this.firstChild) {
            this.render();
        }
    }

    static get observedAttributes() {
        return ['current-user-id', 'context'];
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
        if (!this._negotiation) {
            this.innerHTML = '';
            return;
        }

        const neg = this._negotiation;
        const otherTeam = neg.initiatorId === this.currentUserId ?
            neg.responderName : neg.initiatorName;
        const lastOffer = neg.offers[neg.offers.length - 1];
        const isMyTurn = neg.lastOfferBy !== this.currentUserId;

        // Determine if user is buying or selling
        const type = neg.type || 'buy';
        const isBuyer = (neg.initiatorId === this.currentUserId && type === 'buy') || 
                        (neg.responderId === this.currentUserId && type === 'sell');
        
        const roleBadge = isBuyer ? 
            '<span class="badge badge-info text-[10px] uppercase font-bold px-1.5 py-0.5">Buying</span>' : 
            '<span class="badge badge-success text-[10px] uppercase font-bold px-1.5 py-0.5">Selling</span>';

        let statusBadge = '';
        if (neg.status === 'pending') {
            statusBadge = isMyTurn ?
                '<span class="px-2 py-1 bg-green-600 text-white rounded text-xs font-semibold">Your Turn</span>' :
                '<span class="px-2 py-1 bg-gray-600 text-gray-300 rounded text-xs">Waiting</span>';
        } else if (neg.status === 'accepted') {
            statusBadge = '<span class="px-2 py-1 bg-green-600 text-white rounded text-xs font-semibold">Accepted</span>';
        } else {
            statusBadge = '<span class="px-2 py-1 bg-red-600 text-white rounded text-xs font-semibold">Rejected</span>';
        }

        const bgClass = this.context === 'summary' ?
            'bg-gray-700' : 'bg-gray-600 hover:bg-gray-550';

        this.innerHTML = `
            <div class="${bgClass} rounded p-4 border border-gray-600 cursor-pointer transition text-white"
                 role="button" tabindex="0">
                <div class="flex items-center justify-between">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <div class="font-semibold text-sm">Chemical ${neg.chemical} • ${otherTeam}</div>
                            ${roleBadge}
                        </div>
                        <div class="text-sm text-gray-300">
                            Latest: ${lastOffer.quantity} gal @ ${this.formatCurrency(lastOffer.price)}
                        </div>
                    </div>
                    ${statusBadge}
                </div>
            </div>
        `;

        const card = this.querySelector('[role="button"]');
        card.addEventListener('click', () => this.handleViewDetail());
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.handleViewDetail();
            }
        });
    }

    handleViewDetail() {
        this.dispatchEvent(new CustomEvent('view-detail', {
            bubbles: true,
            composed: true,
            detail: {
                negotiationId: this._negotiation.id
            }
        }));
    }
}

customElements.define('negotiation-card', NegotiationCard);
