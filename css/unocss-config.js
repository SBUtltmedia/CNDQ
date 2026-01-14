/**
 * UnoCSS Runtime Configuration
 *
 * This configuration integrates UnoCSS with the existing CSS variable-based theme system.
 * Include this in any page that needs utility-first styling without a build step.
 *
 * Usage in PHP/HTML:
 *
 * <script src="https://cdn.jsdelivr.net/npm/@unocss/runtime@0.58.5/uno.global.js"></script>
 * <script src="./css/unocss-config.js"></script>
 *
 * Benefits:
 * - Zero build step during development
 * - Just-in-time compilation in browser
 * - ~10KB runtime vs 2.8MB precompiled CSS
 * - Standard Tailwind syntax (AI-friendly)
 * - Works seamlessly with CSS variables
 * - Shadow DOM compatible
 */

window.__unocss = {
    // Presets - enables standard Tailwind classes
    presets: [],  // Empty array means use defaults (includes all Tailwind utilities)

    theme: {
        colors: {
            // Background colors mapped to CSS variables
            'bg-primary': 'var(--color-bg-primary)',
            'bg-secondary': 'var(--color-bg-secondary)',
            'bg-tertiary': 'var(--color-bg-tertiary)',
            'bg-modal': 'var(--color-bg-modal)',

            // Text colors
            'text-primary': 'var(--color-text-primary)',
            'text-secondary': 'var(--color-text-secondary)',
            'text-tertiary': 'var(--color-text-tertiary)',

            // Brand colors
            'brand-primary': 'var(--color-brand-primary)',
            'brand-secondary': 'var(--color-brand-secondary)',
            'accent': 'var(--color-accent)',

            // Semantic colors
            'success': 'var(--color-success)',
            'error': 'var(--color-error)',
            'warning': 'var(--color-warning)',
            'info': 'var(--color-info)',

            // Chemical-specific colors
            'chemical-c': 'var(--color-chemical-c)',
            'chemical-n': 'var(--color-chemical-n)',
            'chemical-d': 'var(--color-chemical-d)',
            'chemical-q': 'var(--color-chemical-q)',

            // Border colors
            'border': 'var(--color-border)',
            'border-light': 'var(--color-border-light)',

            // Ad background colors
            'bg-ad-mine': 'var(--color-bg-ad-mine)',
            'border-ad-mine': 'var(--color-border-ad-mine)',
        },
        boxShadow: {
            'sm': 'var(--shadow-sm)',
            'md': 'var(--shadow-md)',
            'lg': 'var(--shadow-lg)',
            'xl': 'var(--shadow-xl)',
        }
    },
    // Shortcuts for commonly used patterns
    shortcuts: {
        // Card components
        'card': 'bg-bg-secondary rounded-lg border-2 border-border shadow-md',
        'card-header': 'p-4 bg-bg-tertiary border-b border-border',
        'card-body': 'p-4',

        // Button variants
        'btn': 'inline-flex items-center justify-center px-4 py-2 rounded-lg font-semibold cursor-pointer transition-all duration-200',
        'btn-primary': 'btn bg-brand-primary text-white hover:bg-brand-secondary',
        'btn-secondary': 'btn bg-bg-tertiary text-text-primary hover:bg-border',
        'btn-danger': 'btn bg-error text-white hover:brightness-90',
        'btn-success': 'btn bg-success text-white hover:brightness-90',

        // Status badges
        'badge': 'inline-flex items-center px-2 py-1 rounded text-xs font-semibold',
        'badge-success': 'badge bg-success text-white',
        'badge-error': 'badge bg-error text-white',
        'badge-warning': 'badge bg-warning text-gray-900',
        'badge-info': 'badge bg-info text-white',

        // Chemical badges
        'badge-chemical-c': 'badge bg-chemical-c text-gray-900',
        'badge-chemical-n': 'badge bg-chemical-n text-white',
        'badge-chemical-d': 'badge bg-chemical-d text-gray-900',
        'badge-chemical-q': 'badge bg-chemical-q text-white',
    }
};
