/**
 * Shared Styles Manager for Web Components
 *
 * SIMPLIFIED APPROACH: Don't use Shadow DOM for styling
 * Instead, components will use light DOM or slot-based styling with global Tailwind
 *
 * This module is kept for compatibility but returns an empty stylesheet
 */

class TailwindStyleManager {
    constructor() {
        this.stylesheet = null;
    }

    /**
     * Returns an empty stylesheet immediately
     * Components will use global Tailwind styles instead
     */
    async load() {
        if (!this.stylesheet) {
            this.stylesheet = new CSSStyleSheet();
        }
        return this.stylesheet;
    }
}

// Export singleton instance
export const tailwindStyles = new TailwindStyleManager();
