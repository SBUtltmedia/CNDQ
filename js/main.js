import { Router } from './router.js';
import DashboardView from './views/dashboard.js';
import MarketView from './views/market.js';
import CalculatorView from './views/calculator.js';
import { marketPoller } from './marketPolling.js';
import { state, updateState } from './state.js';

// DOM Elements (Header)
const headerEls = {
    teamName: document.getElementById('team-name'),
    teamFunds: document.getElementById('team-funds'),
    notificationBtn: document.getElementById('notification-btn'),
    notificationCount: document.getElementById('notification-count'),
    notificationPanel: document.getElementById('notification-panel'),
    notificationList: document.getElementById('notification-list'),
};

// Router Setup
const routes = {
    '#dashboard': { view: DashboardView },
    '#market': { view: MarketView },
    '#calculator': { view: CalculatorView }
};

const router = new Router(routes);

// Global Polling & State
function handleGlobalUpdate(data) {
    if (!data.success) return;

    // Update Global State
    const newState = {
        displayName: data.display_name,
        startingFund: data.user_fund,
        initialCapital: data.initial_capital,
        inventory: data.user_inventory,
        initialInventory: data.initial_inventory,
        sessionState: data.session_state ? data.session_state.state : 'UNKNOWN'
    };
    updateState(newState);

    // Update Header
    if (headerEls.teamName) headerEls.teamName.textContent = state.displayName || 'Loading...';
    
    const phaseBadge = document.getElementById('session-phase-badge');
    if (phaseBadge) {
        const phase = state.sessionState;
        phaseBadge.textContent = `Phase: ${phase}`;
        phaseBadge.className = 'px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider transition-colors duration-300 ';
        switch(phase) {
            case 'SETUP': phaseBadge.className += 'bg-slate-200 text-slate-600'; break;
            case 'PRODUCTION': phaseBadge.className += 'bg-blue-200 text-blue-800'; break;
            case 'TRADING': phaseBadge.className += 'bg-emerald-200 text-emerald-800'; break;
            case 'DAY_END': phaseBadge.className += 'bg-amber-200 text-amber-800'; break;
            default: phaseBadge.className += 'bg-gray-200 text-gray-800';
        }
    }
    
    // Notifications
    updateNotifications(data.notifications, data.notification_count);
}

let notifications = [];
function updateNotifications(list, count) {
    if (list && list.length > 0) {
        const newIds = new Set(list.map(n => n.id));
        const oldFiltered = notifications.filter(n => !newIds.has(n.id));
        notifications = [...list, ...oldFiltered];
        notifications.sort((a, b) => b.timestamp - a.timestamp);
        if (notifications.length > 50) notifications = notifications.slice(0, 50);
    }
    
    if (headerEls.notificationCount) {
        headerEls.notificationCount.textContent = count;
        headerEls.notificationCount.classList.toggle('hidden', count === 0);
    }
    
    if (headerEls.notificationList) {
        headerEls.notificationList.innerHTML = notifications.map(n => `
            <div class="p-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                <p class="text-sm text-slate-800">${n.message}</p>
                <p class="text-xs text-slate-400 mt-1">${new Date(n.timestamp * 1000).toLocaleTimeString()}</p>
            </div>
        `).join('') || '<div class="p-4 text-center text-sm text-slate-400">No notifications</div>';
    }
}

// Global Event Listeners
if (headerEls.notificationBtn) {
    headerEls.notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        headerEls.notificationPanel.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!headerEls.notificationPanel.contains(e.target) && !headerEls.notificationBtn.contains(e.target)) {
            headerEls.notificationPanel.classList.add('hidden');
        }
    });
}

// Init
marketPoller.subscribe(handleGlobalUpdate);
marketPoller.start();
router.init();
