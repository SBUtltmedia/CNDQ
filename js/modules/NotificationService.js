/**
 * NotificationService
 * Handles toast notifications
 */
export class NotificationService {
    constructor() {
        this.containerId = 'toast-container';
    }

    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - 'success', 'error', 'info', 'warning', 'excellent', 'bad', 'hot', 'cold'
     * @param {number} duration - Duration in milliseconds
     */
    showToast(message, type = 'info', duration = 3000) {
        const colors = {
            success: 'bg-green-600',
            error: 'bg-red-600',
            info: 'bg-blue-600',
            warning: 'bg-yellow-600',
            excellent: 'bg-gradient-to-r from-green-500 to-emerald-600',
            bad: 'bg-gradient-to-r from-red-500 to-rose-600',
            hot: 'bg-gradient-to-r from-orange-500 to-red-600 shadow-orange-500/50',
            cold: 'bg-gradient-to-r from-cyan-400 to-blue-600 shadow-blue-500/50'
        };

        const icons = {
            success: '✓',
            error: '✗',
            info: 'ℹ',
            warning: '⚠',
            excellent: '🎉',
            bad: '⚠️',
            hot: '🔥',
            cold: '❄️'
        };

        const container = document.getElementById(this.containerId);
        if (!container) {
            console.warn(`Toast container #${this.containerId} not found`);
            return;
        }

        const toast = document.createElement('div');
        toast.className = `${colors[type] || colors.info} text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out flex items-center gap-2`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');

        // Add icon if special type
        if (icons[type]) {
            const iconSpan = document.createElement('span');
            iconSpan.textContent = icons[type];
            iconSpan.className = 'text-xl';
            toast.appendChild(iconSpan);
        }

        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;
        toast.appendChild(messageSpan);

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            requestAnimationFrame(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(0)';
            });
        });

        // Remove after specified duration
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    }
}

// Export singleton
export const notifications = new NotificationService();
