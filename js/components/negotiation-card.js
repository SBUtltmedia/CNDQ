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
        if (!this.querySelector('.card-wrapper')) {
            this.innerHTML = `
                <div class="card-wrapper bg-gray-800 rounded p-4 border-2 shadow-lg transition relative hover:border-gray-500 cursor-pointer" role="button" tabindex="0">
                </div>
            `;
            // Add global event listeners to the wrapper once
            const wrapper = this.querySelector('.card-wrapper');
            wrapper.addEventListener('click', (e) => {
                // Don't trigger view detail if clicking a button
                if (e.target.closest('button')) return;
                this.handleViewDetail();
            });
            wrapper.addEventListener('keydown', (e) => {
                if (e.target.closest('button')) return;
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.handleViewDetail();
                }
            });
        }
        this.render();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue && this.firstChild) {
            this.render();
        }
    }

    static get observedAttributes() {
        return ['current-user-id', 'context', 'show-synopsis'];
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
        if (!this._negotiation || !this.querySelector('.card-wrapper')) return;

        const isSynopsis = this.hasAttribute('show-synopsis');
        this.updateContent(isSynopsis);
    }

    updateContent(isSynopsis) {
        const wrapper = this.querySelector('.card-wrapper');
        const neg = this._negotiation;
        
        if (!wrapper || !neg) return;

        const offers = neg.offers || [];
        const lastOffer = offers.length > 0 ? offers[offers.length - 1] : { quantity: 0, price: 0 };
        const chemical = neg.chemical || '?';
        const currentUserId = this.currentUserId;
        
        // Common Data & Calculations
        const chemicalStyle = `background-color: var(--color-chemical-${chemical.toLowerCase()}); color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.3);`;
        const chemicalBadge = `<span class="font-bold px-2 py-0.5 rounded text-sm" style="${chemicalStyle}">Chemical ${chemical}</span>`;

        // Convert to strings for safe comparison
        const initiatorId = String(neg.initiatorId);
        const responderId = String(neg.responderId);
        const myId = String(currentUserId || '');

        const otherTeam = initiatorId === myId ? neg.responderName : neg.initiatorName;
        const isMyTurn = String(neg.lastOfferBy) !== myId;
        
        // Determine role
        const type = neg.type || 'buy';
        const isBuyer = (initiatorId === myId && type === 'buy') || 
                        (responderId === myId && type === 'sell');
        
        const otherRole = isBuyer ? 'Seller' : 'Buyer';
        const roleColorClass = isBuyer ? 'badge-warning' : 'badge-info';
        const roleBadge = `<span class="badge ${roleColorClass} text-[10px] uppercase font-bold px-1.5 py-0.5">${otherRole}</span>`;

        if (isSynopsis) {
            // SYNOPSIS STATE
            const isAccepted = neg.status === 'accepted';
            const titleColor = isAccepted ? 'text-green-400' : 'text-red-400';
            const borderColor = isAccepted ? 'border-green-500' : 'border-red-500';
            
            let statusBadge = '';
            if (isAccepted) {
                statusBadge = '<span class="px-2 py-1 bg-green-600 text-white rounded text-xs font-semibold">Accepted</span>';
            } else {
                statusBadge = '<span class="px-2 py-1 bg-red-600 text-white rounded text-xs font-semibold">Rejected</span>';
            }

            // Update wrapper classes
            wrapper.className = `card-wrapper bg-gray-800 rounded p-4 border-2 ${borderColor} shadow-lg transition relative synopsis-container`;
            
            // Synopsis Content - Matching Active Card Layout
            wrapper.innerHTML = `
                <button class="dismiss-btn absolute top-2 right-2 text-gray-400 hover:text-white transition" aria-label="Dismiss">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>

                <!-- Header Structure -->
                <div class="flex items-center justify-between mb-3 pr-6">
                    <div class="flex items-center gap-2">
                        ${chemicalBadge}
                        <span class="text-gray-400 text-sm">•</span>
                        <div class="font-semibold text-sm text-white">${otherTeam}</div>
                        ${roleBadge}
                    </div>
                </div>

                <!-- Body -->
                <div class="flex items-center justify-between">
                    <div class="text-sm text-gray-300">
                        ${isAccepted ? `
                            Final: <span class="font-mono font-bold text-white">${lastOffer.quantity} gal</span> @ <span class="font-mono font-bold text-white">${this.formatCurrency(lastOffer.price)}</span>
                        ` : `
                            <span class="italic opacity-60">Negotiation cancelled.</span>
                        `}
                    </div>
                    ${statusBadge}
                </div>
            `;

            // Bind events
            const dismissBtn = wrapper.querySelector('.dismiss-btn');
            if (dismissBtn) {
                dismissBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleDismiss();
                });
            }

        } else {
            // ACTIVE CARD STATE
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

            const borderColor = 'border-gray-600';
            
            // Update wrapper classes
            wrapper.className = `card-wrapper bg-gray-800 rounded p-4 border-2 ${borderColor} shadow-lg transition relative hover:border-gray-500 cursor-pointer`;

            // Card Content
            wrapper.innerHTML = `
                <button class="cancel-btn absolute top-2 right-2 text-gray-500 hover:text-white transition z-10" aria-label="Cancel Negotiation" title="Cancel/Reject Negotiation">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>
                <div class="flex items-center justify-between mb-2 pr-6">
                    <div class="flex items-center gap-2">
                        ${chemicalBadge}
                        <span class="text-gray-400 text-sm">•</span>
                        <div class="font-semibold text-sm text-white">${otherTeam}</div>
                        ${roleBadge}
                    </div>
                </div>
                <div class="flex items-center justify-between">
                    <div class="text-sm text-gray-300">
                        Latest: <span class="font-mono font-bold text-white">${lastOffer.quantity} gal</span> @ <span class="font-mono font-bold text-white">${this.formatCurrency(lastOffer.price)}</span>
                    </div>
                    ${statusBadge}
                </div>
            `;

            // Bind events
            const cancelBtn = wrapper.querySelector('.cancel-btn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleCancel();
                });
            }
        }
    }

    // Remove old render methods to prevent confusion
    renderSynopsis() {} 
    renderCard() {}


    handleDismiss() {
        this.dispatchEvent(new CustomEvent('dismiss-synopsis', {
            bubbles: true,
            composed: true,
            detail: {
                negotiationId: this._negotiation.id
            }
        }));
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('cancel-negotiation', {
            bubbles: true,
            composed: true,
            detail: {
                negotiationId: this._negotiation.id
            }
        }));
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
