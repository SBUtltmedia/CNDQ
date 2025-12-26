import { getMarketUpdates } from './api.js';

class MarketPoller {
    constructor() {
        this.interval = 3000; // 3 seconds
        this.lastPoll = 0;
        this.subscribers = [];
        this.isPolling = false;
        this.timer = null;
    }

    subscribe(callback) {
        this.subscribers.push(callback);
    }

    unsubscribe(callback) {
        this.subscribers = this.subscribers.filter(cb => cb !== callback);
    }

    async start() {
        if (this.isPolling) return;
        this.isPolling = true;
        this.poll();
    }

    stop() {
        this.isPolling = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    async poll() {
        if (!this.isPolling) return;

        try {
            const data = await getMarketUpdates(this.lastPoll);
            // Even if success is false, we keep polling (maybe server error)
            // But we only update lastPoll if we got a valid timestamp back
            if (data && data.success) {
                this.lastPoll = data.timestamp;
                this.notifySubscribers(data);
            }
        } catch (error) {
            console.error('Polling error:', error);
        }

        this.timer = setTimeout(() => this.poll(), this.interval);
    }

    notifySubscribers(data) {
        this.subscribers.forEach(cb => cb(data));
    }
}

export const marketPoller = new MarketPoller();