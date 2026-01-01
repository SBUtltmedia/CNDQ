<?php require_once 'config.php'; ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CNDQ Marketplace</title>
    <link rel="stylesheet" href="<?php echo htmlspecialchars($basePath); ?>/css/styles.css">
    <style>
        /* Page-specific animations */
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .animate-spin {
            animation: spin 1s linear infinite;
        }
        @keyframes pulse-green {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .pulse-green {
            animation: pulse-green 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        /* Scrollbar */
        .scrollbar-thin::-webkit-scrollbar {
            width: 8px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
            background: var(--color-bg-secondary);
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
            background: var(--color-border);
            border-radius: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
            background: var(--color-border-light);
        }
        /* Focus styles */
        *:focus-visible {
            outline: 2px solid var(--color-brand-primary);
            outline-offset: 2px;
        }
        /* Loading spinner colors */
        .border-r-transparent {
            border-right-color: transparent;
        }
        .h-16 { height: 4rem; }
        .w-16 { width: 4rem; }
        .border-4 { border-width: 4px; }
        .border-solid { border-style: solid; }
        .min-h-screen { min-height: 100vh; }
    </style>
</head>
<body class="bg-gray-900 text-gray-100 min-h-screen">

    <!-- Skip Navigation Link -->
    <a href="#main-content" class="skip-link">Skip to main content</a>

    <!-- Production Phase Overlay -->
    <div id="production-overlay" class="hidden fixed inset-0 flex items-center justify-center z-[120]">
        <div class="text-center">
            <div class="cog-container mx-auto mb-8">
                <svg class="cog cog-1" viewBox="0 0 24 24"><path d="M19.44 12.99l-.01.02c.04-.33.08-.67.08-1.01 0-.34-.03-.66-.07-.99l.01.02 2.44-1.92-2.43-4.22-2.87.96.01.02c-.48-.42-1.03-.77-1.62-1.01l.02-.01L14.58 2h-4.85L9.32 4.86l.02.01c-.59.24-1.14.59-1.62 1.01l.01-.02-2.87-.96-2.43 4.22 2.44 1.92-.01-.02c-.04.33-.07.65-.07.99 0 .34.03.68.08 1.01l-.01-.02-2.44 1.92 2.43 4.22 2.87-.96-.01-.02c.48.42 1.03.77 1.62 1.01l-.02.01L9.73 22h4.85l.41-2.86-.02-.01c.59-.24 1.14-.59 1.62-1.01l-.01.02 2.87.96 2.43-4.22-2.44-1.9zm-7.44 3c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/></svg>
                <svg class="cog cog-2" viewBox="0 0 24 24"><path d="M19.44 12.99l-.01.02c.04-.33.08-.67.08-1.01 0-.34-.03-.66-.07-.99l.01.02 2.44-1.92-2.43-4.22-2.87.96.01.02c-.48-.42-1.03-.77-1.62-1.01l.02-.01L14.58 2h-4.85L9.32 4.86l.02.01c-.59.24-1.14.59-1.62 1.01l.01-.02-2.87-.96-2.43 4.22 2.44 1.92-.01-.02c-.04.33-.07.65-.07.99 0 .34.03.68.08 1.01l-.01-.02-2.44 1.92 2.43 4.22 2.87-.96-.01-.02c.48.42 1.03.77 1.62 1.01l-.02.01L9.73 22h4.85l.41-2.86-.02-.01c.59-.24 1.14-.59 1.62-1.01l-.01.02 2.87.96 2.43-4.22-2.44-1.9zm-7.44 3c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/></svg>
                <svg class="cog cog-3" viewBox="0 0 24 24"><path d="M19.44 12.99l-.01.02c.04-.33.08-.67.08-1.01 0-.34-.03-.66-.07-.99l.01.02 2.44-1.92-2.43-4.22-2.87.96.01.02c-.48-.42-1.03-.77-1.62-1.01l.02-.01L14.58 2h-4.85L9.32 4.86l.02.01c-.59.24-1.14.59-1.62 1.01l.01-.02-2.87-.96-2.43 4.22 2.44 1.92-.01-.02c-.04.33-.07.65-.07.99 0 .34.03.68.08 1.01l-.01-.02-2.44 1.92 2.43 4.22 2.87-.96-.01-.02c.48.42 1.03.77 1.62 1.01l-.02.01L9.73 22h4.85l.41-2.86-.02-.01c.59-.24 1.14-.59 1.62-1.01l-.01.02 2.87.96 2.43-4.22-2.44-1.9zm-7.44 3c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/></svg>
            </div>
            <h2 class="text-4xl font-bold text-green-500 font-mono animate-pulse uppercase tracking-tighter">Automatic Production Running</h2>
            <p class="text-gray-400 mt-4 text-xl">Linear Programming solvers are optimizing your profit...</p>
        </div>
    </div>

    <!-- Loading Overlay -->
    <div id="loading-overlay" class="fixed inset-0 bg-gray-900 bg-opacity-95 flex items-center justify-center z-50">
        <div class="text-center">
            <div class="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-green-500 border-r-transparent"></div>
            <p class="mt-4 text-green-500 font-mono text-lg">Loading Marketplace...</p>
        </div>
    </div>

    <!-- Confirmation Dialog -->
    <div id="confirm-dialog" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110] p-4">
        <div class="bg-gray-800 rounded-lg p-4 md:p-6 max-w-md w-full border border-gray-700 shadow-xl">
            <h3 class="text-xl font-bold mb-4 text-white" id="confirm-title">Confirm Action</h3>
            <p class="text-gray-300 mb-6" id="confirm-message"></p>
            <div class="flex gap-3 justify-end">
                <button id="confirm-cancel" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-semibold transition">
                    Cancel
                </button>
                <button id="confirm-ok" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold transition">
                    Confirm
                </button>
            </div>
        </div>
    </div>

    <!-- Toast Notifications Container -->
    <div id="toast-container" class="fixed bottom-4 right-4 z-[9999] space-y-2" role="region" aria-live="polite" aria-atomic="false" aria-label="Notifications"></div>

    <!-- Main App Container -->
    <div id="app" class="hidden">

        <!-- Header -->
        <header class="bg-gray-800 border-b-2 border-green-500 shadow-lg">
            <div class="container mx-auto px-4 py-3 md:py-4">
                <div class="flex items-center justify-between flex-wrap gap-3 md:gap-4">
                    <div>
                        <h1 class="text-xl md:text-2xl lg:text-3xl font-bold text-green-500 font-mono">CNDQ MARKETPLACE</h1>
                        <p class="text-xs md:text-sm text-gray-300 mt-1">Team: <span id="team-name" class="text-white font-semibold"></span></p>
                    </div>

                    <div class="flex items-center gap-2 md:gap-4">
                        <!-- Funds Display -->
                        <div class="bg-gray-700 px-3 py-2 md:px-6 md:py-3 rounded-lg border border-gray-600">
                            <span class="text-gray-300 text-xs md:text-sm block">Current Funds</span>
                            <span class="text-success font-bold text-lg md:text-2xl" id="current-funds">$0</span>
                        </div>

                        <!-- Notifications -->
                        <button id="notifications-btn" class="relative bg-gray-700 hover:bg-gray-600 p-2 md:p-3 rounded-lg transition" aria-label="View notifications">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 md:w-6 md:h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                            </svg>
                            <span id="notif-badge" class="hidden absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center" aria-label="unread notifications"></span>
                        </button>

                        <!-- Leaderboard -->
                        <button id="leaderboard-btn" class="bg-yellow-600 hover:bg-yellow-700 p-2 md:p-3 rounded-lg transition" aria-label="View leaderboard">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                            </svg>
                        </button>

                        <!-- Production Guide -->
                        <button id="production-guide-btn" class="bg-blue-600 hover:bg-blue-700 p-2 md:p-3 rounded-lg transition" aria-label="View production formulas">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
                            </svg>
                        </button>

                        <!-- Settings -->
                        <button id="settings-btn" class="bg-gray-700 hover:bg-gray-600 p-2 md:p-3 rounded-lg transition" aria-label="Open settings">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 md:w-6 md:h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Shadow Prices & Recalculate -->
                <div class="mt-3 md:mt-4 bg-gray-700 rounded-lg p-3 md:p-4 border border-gray-600">
                    <div class="flex items-center justify-between flex-wrap gap-3 md:gap-4">
                        <div class="flex items-center gap-3 md:gap-6 flex-wrap w-full lg:w-auto">
                            <div class="text-xs md:text-sm w-full lg:w-auto">
                                <span class="text-gray-200 font-semibold">Shadow Prices</span>
                                <span id="staleness-indicator" class="ml-2 text-xs"></span>
                            </div>
                            <div class="grid grid-cols-2 lg:flex gap-2 md:gap-3 font-mono text-sm md:text-base lg:text-lg w-full lg:w-auto">
                                <span class="bg-blue-600 text-white px-2 md:px-3 py-1 rounded min-w-[90px] md:min-w-[110px] text-center">C: $<span id="shadow-C">0</span></span>
                                <span class="bg-purple-600 text-white px-2 md:px-3 py-1 rounded min-w-[90px] md:min-w-[110px] text-center">N: $<span id="shadow-N">0</span></span>
                                <span class="bg-yellow-600 text-white px-2 md:px-3 py-1 rounded min-w-[90px] md:min-w-[110px] text-center">D: $<span id="shadow-D">0</span></span>
                                <span class="bg-red-600 text-white px-2 md:px-3 py-1 rounded min-w-[90px] md:min-w-[110px] text-center">Q: $<span id="shadow-Q">0</span></span>
                            </div>
                        </div>
                        <button id="recalc-shadow-btn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 md:px-6 md:py-2 rounded-lg text-sm md:text-base font-semibold transition shadow-lg w-full md:w-auto flex items-center justify-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                            </svg>
                            Recalculate Shadow Prices
                        </button>
                    </div>
                    <div id="staleness-warning" class="hidden mt-3 p-3 rounded text-sm"></div>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <main id="main-content" class="container mx-auto px-4 py-4 md:py-6" role="main">

            <!-- Session Status Bar -->
            <div class="bg-gray-800 border-l-4 border-purple-500 p-4 mb-6 rounded shadow-lg flex flex-wrap items-center justify-between gap-4">
                <div class="flex items-center gap-4">
                    <div class="bg-purple-900/30 px-3 py-1 rounded border border-purple-500/50">
                        <span class="text-xs text-purple-300 uppercase font-bold">Session</span>
                        <span id="session-num-display" class="text-lg font-mono ml-2">1</span>
                    </div>
                    <div>
                        <span id="phase-badge" class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-blue-600 text-white">Production</span>
                    </div>
                </div>
                
                <div class="flex items-center gap-3">
                    <span class="text-gray-400 text-xs uppercase font-bold">Time Remaining</span>
                    <div class="bg-gray-900 px-4 py-2 rounded font-mono text-xl text-yellow-400 border border-gray-700 w-24 text-center" id="session-timer">
                        00:00
                    </div>
                </div>
            </div>

            <!-- 4-Column Chemical Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
                <chemical-card chemical="C"></chemical-card>
                <chemical-card chemical="N"></chemical-card>
                <chemical-card chemical="D"></chemical-card>
                <chemical-card chemical="Q"></chemical-card>
            </div>

            <!-- My Negotiations -->
            <div class="bg-gray-800 rounded-lg p-4 md:p-6 border-2 border-gray-700 shadow-xl">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-2xl font-bold text-green-500 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                        </svg>
                        MY NEGOTIATIONS
                    </h3>
                    <button id="view-all-negotiations-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold transition flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                        </svg>
                        View All
                    </button>
                </div>
                <div id="my-negotiations" class="space-y-3">
                    <p class="text-gray-300 text-center py-8">You have no active negotiations</p>
                </div>
            </div>
        </main>

    </div>

    <!-- Post Buy Request Modal -->
    <div id="offer-modal" class="hidden fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="offer-modal-title">
        <div class="bg-gray-800 rounded-lg p-4 md:p-6 w-full max-w-md border-2 border-blue-500 shadow-2xl">
            <h3 class="text-xl md:text-2xl font-bold mb-4 text-blue-400" id="offer-modal-title">📋 Post Buy Request</h3>
            <p class="text-sm text-gray-300 mb-4">Request to buy chemicals. Other teams will offer to sell to you.</p>

            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-semibold mb-2 text-gray-300">Chemical</label>
                    <input type="text" id="offer-chemical" readonly class="w-full bg-gray-700 border border-gray-600 rounded px-4 py-3 text-white font-bold text-xl">
                </div>

                <div>
                    <label for="offer-quantity" class="block text-sm font-semibold mb-2 text-gray-300">Quantity Needed (gallons)</label>
                    <input type="range" id="offer-quantity-slider" min="0" max="1000" step="10" value="100" class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
                    <div class="flex items-center gap-2 mt-2">
                        <button type="button" id="quantity-minus" class="w-10 h-10 bg-gray-600 hover:bg-gray-500 rounded font-bold text-lg transition" aria-label="Decrease quantity">−</button>
                        <input type="number" id="offer-quantity" min="1" step="10" value="100" class="flex-1 bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white text-lg text-center font-bold" aria-label="Quantity in gallons">
                        <button type="button" id="quantity-plus" class="w-10 h-10 bg-gray-600 hover:bg-gray-500 rounded font-bold text-lg transition" aria-label="Increase quantity">+</button>
                    </div>
                </div>

                <div>
                    <label for="offer-price" class="block text-sm font-semibold mb-2 text-gray-300" id="offer-price-label">Maximum Price You'll Pay ($ per gallon)</label>
                    <div class="flex items-center gap-2">
                        <button type="button" id="price-minus" class="w-10 h-10 bg-gray-600 hover:bg-gray-500 rounded font-bold text-lg transition" aria-label="Decrease price">−</button>
                        <input type="number" id="offer-price" min="0" step="0.50" value="5.00" class="flex-1 bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white text-lg text-center font-bold" aria-label="Max price per gallon">
                        <button type="button" id="price-plus" class="w-10 h-10 bg-gray-600 hover:bg-gray-500 rounded font-bold text-lg transition" aria-label="Increase price">+</button>
                    </div>
                    <p class="text-xs text-gray-300 mt-1">💡 Your Shadow Price: <span class="text-green-400 font-semibold">$<span id="offer-shadow-hint">0</span></span> (value to you)</p>
                </div>

                <div class="bg-gray-700 p-4 rounded-lg border border-gray-600">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-sm text-gray-300"><strong>Total Cost:</strong></span>
                        <span class="text-blue-400 font-bold text-xl">$<span id="offer-total">0.00</span></span>
                    </div>
                    <div class="flex justify-between items-center text-xs">
                        <span class="text-gray-400">Your Available Funds:</span>
                        <span class="font-semibold" id="offer-current-funds">$0.00</span>
                    </div>
                </div>

                <!-- Warning if insufficient funds -->
                <div id="insufficient-funds-warning" class="hidden bg-red-900 bg-opacity-30 border border-red-500 rounded-lg p-3">
                    <p class="text-red-400 text-sm font-semibold">⚠️ Insufficient funds! Reduce quantity or max price.</p>
                </div>
            </div>

            <div class="flex gap-3 mt-6">
                <button id="offer-submit-btn" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed">Post Request</button>
                <button id="offer-cancel-btn" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded font-semibold transition">Cancel</button>
            </div>
        </div>
    </div>

    <!-- Respond to Buy Request Modal -->
    <div id="respond-modal" class="hidden fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="respond-modal-title">
        <div class="bg-gray-800 rounded-lg p-4 md:p-6 w-full max-w-md border-2 border-green-500 shadow-2xl">
            <h3 class="text-xl md:text-2xl font-bold mb-4 text-green-500" id="respond-modal-title">💰 Respond to Buy Request</h3>
            <p class="text-sm text-gray-300 mb-4"><strong id="respond-buyer-name">Team</strong> wants to buy <strong id="respond-chemical">Chemical</strong></p>

            <div class="space-y-4">
                <!-- Buy Request Details -->
                <div class="bg-gray-700 p-3 rounded-lg border border-gray-600">
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div class="text-gray-300">They want:</div>
                        <div class="text-white font-semibold"><span id="respond-requested-qty">0</span> gallons</div>
                        <div class="text-gray-300">Max price:</div>
                        <div class="text-blue-400 font-semibold">$<span id="respond-max-price">0</span>/gal</div>
                    </div>
                </div>

                <!-- Your Inventory -->
                <div class="bg-blue-900 bg-opacity-30 border border-blue-500 rounded-lg p-3">
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-300">Your Inventory:</span>
                        <span class="text-white font-bold"><span id="respond-your-inventory">0</span> gallons</span>
                    </div>
                    <div class="flex justify-between text-xs mt-1">
                        <span class="text-gray-400">Your Shadow Price:</span>
                        <span class="text-green-400 font-semibold">$<span id="respond-shadow-price">0</span>/gal</span>
                    </div>
                </div>

                <!-- Quantity to Sell (Slider) -->
                <div>
                    <label for="respond-quantity" class="block text-sm font-semibold mb-2 text-gray-300">Quantity You'll Sell (gallons)</label>
                    <input type="range" id="respond-quantity-slider" min="0" max="1000" step="10" value="100" class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-green-500">
                    <div class="flex items-center gap-2 mt-2">
                        <button type="button" id="respond-qty-minus" class="w-10 h-10 bg-gray-600 hover:bg-gray-500 rounded font-bold text-lg transition">−</button>
                        <input type="number" id="respond-quantity" min="1" step="10" value="100" class="flex-1 bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white text-lg text-center font-bold">
                        <button type="button" id="respond-qty-plus" class="w-10 h-10 bg-gray-600 hover:bg-gray-500 rounded font-bold text-lg transition">+</button>
                    </div>
                    <p class="text-xs text-gray-400 mt-1">💡 Sell only what you don't need for production</p>
                </div>

                <!-- Your Price -->
                <div>
                    <label for="respond-price" class="block text-sm font-semibold mb-2 text-gray-300">Your Price ($ per gallon)</label>
                    <div class="flex items-center gap-2">
                        <button type="button" id="respond-price-minus" class="w-10 h-10 bg-gray-600 hover:bg-gray-500 rounded font-bold text-lg transition">−</button>
                        <input type="number" id="respond-price" min="0" step="0.50" value="5.00" class="flex-1 bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white text-lg text-center font-bold">
                        <button type="button" id="respond-price-plus" class="w-10 h-10 bg-gray-600 hover:bg-gray-500 rounded font-bold text-lg transition">+</button>
                    </div>
                    <p class="text-xs text-gray-400 mt-1">💡 Lower than their max price to be competitive</p>
                </div>

                <!-- Total Revenue -->
                <div class="bg-gray-700 p-4 rounded-lg border border-gray-600">
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-300"><strong>Your Revenue:</strong></span>
                        <span class="text-green-400 font-bold text-xl">$<span id="respond-total">0.00</span></span>
                    </div>
                </div>

                <!-- Warning if exceeds inventory -->
                <div id="insufficient-inventory-warning" class="hidden bg-red-900 bg-opacity-30 border border-red-500 rounded-lg p-3">
                    <p class="text-red-400 text-sm font-semibold">⚠️ You don't have enough inventory! Reduce quantity.</p>
                </div>
            </div>

            <div class="flex gap-3 mt-6">
                <button id="respond-submit-btn" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed">Make Offer</button>
                <button id="respond-cancel-btn" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded font-semibold transition">Cancel</button>
            </div>
        </div>
    </div>

    <!-- Settings Modal -->
    <div id="settings-modal" class="hidden fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
        <div class="bg-gray-800 rounded-lg p-4 md:p-6 w-full max-w-md border-2 border-green-500 shadow-2xl">
            <h3 class="text-xl md:text-2xl font-bold mb-4 text-green-500" id="settings-modal-title">Settings</h3>

            <div class="space-y-6">
                <!-- Theme Selector -->
                <div class="flex items-start justify-between gap-4">
                    <div class="flex-1">
                        <label for="theme-selector" class="block text-sm font-semibold mb-1">Color Theme</label>
                        <p class="text-xs text-gray-300">Choose your preferred color scheme</p>
                    </div>
                    <select id="theme-selector" class="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500">
                        <option value="dark">Dark</option>
                        <option value="light">Light</option>
                        <option value="high-contrast">High Contrast</option>
                    </select>
                </div>
            </div>

            <div class="mt-6">
                <button id="settings-close-btn" class="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 rounded font-semibold transition">Close</button>
            </div>
        </div>
    </div>

    <!-- Negotiation Modal -->
    <div id="negotiation-modal" class="hidden fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="negotiation-modal-title">
        <div class="bg-gray-800 rounded-lg p-4 md:p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto border-2 border-green-500 shadow-2xl">
            <div class="flex items-center justify-between mb-4 md:mb-6">
                <h3 class="text-xl md:text-2xl font-bold text-green-500" id="negotiation-modal-title">Negotiations</h3>
                <button id="negotiation-modal-close-btn" class="text-gray-700 hover:text-gray-900 transition" aria-label="Close negotiations">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>

            <!-- Negotiation List View -->
            <div id="negotiation-list-view">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div class="bg-gray-700 rounded-lg p-4">
                        <h4 class="font-bold text-lg mb-2 text-green-400">Pending Negotiations</h4>
                        <div id="pending-negotiations" class="space-y-2 max-h-96 overflow-y-auto">
                            <p class="text-gray-300 text-center py-4">No pending negotiations</p>
                        </div>
                    </div>
                    <div class="bg-gray-700 rounded-lg p-4">
                        <h4 class="font-bold text-lg mb-2 text-gray-400">Completed Negotiations</h4>
                        <div id="completed-negotiations" class="space-y-2 max-h-96 overflow-y-auto">
                            <p class="text-gray-300 text-center py-4">No completed negotiations</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Negotiation Detail View -->
            <div id="negotiation-detail-view" class="hidden">
                <button id="back-to-list-btn" class="mb-4 text-blue-400 hover:text-blue-300 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                    </svg>
                    Back to list
                </button>

                <div class="bg-gray-700 rounded-lg p-6 mb-4">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h4 class="text-xl font-bold" id="detail-chemical">Chemical C</h4>
                            <p class="text-sm text-gray-300">
                                <span id="detail-participants"></span>
                            </p>
                        </div>
                        <div class="text-right">
                            <span id="detail-status-badge" class="px-3 py-1 rounded-full text-sm font-semibold"></span>
                        </div>
                    </div>

                    <!-- Offer History -->
                    <div class="mb-4">
                        <h5 class="font-bold mb-3 text-gray-300">Offer History</h5>
                        <div id="offer-history" class="space-y-2 max-h-64 overflow-y-auto">
                            <!-- Offers will be dynamically added here -->
                        </div>
                    </div>

                    <!-- Witcher 3 Style Counter-Offer Form -->
                    <div id="counter-offer-form" class="hidden bg-gray-800 rounded-lg p-4 border border-blue-500 shadow-inner">
                        <h5 class="font-bold mb-4 text-blue-400 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Haggle with Merchant
                        </h5>
                        
                        <div class="space-y-6">
                            <!-- Quantity Slider -->
                            <div>
                                <div class="flex justify-between text-sm mb-2">
                                    <label class="text-gray-300 font-semibold">Quantity</label>
                                    <span class="text-white font-mono"><span id="haggle-qty-display">0</span> gal</span>
                                </div>
                                <input type="range" id="haggle-qty-slider" class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500">
                                <div class="flex justify-between text-[10px] text-gray-500 mt-1">
                                    <span>Min: 1</span>
                                    <span>Max: <span id="haggle-qty-max">0</span></span>
                                </div>
                            </div>

                            <!-- Price Slider (The Greed Bar) -->
                            <div>
                                <div class="flex justify-between text-sm mb-2">
                                    <label class="text-gray-300 font-semibold">Offer Price</label>
                                    <span class="text-white font-mono">$<span id="haggle-price-display">0.00</span>/gal</span>
                                </div>
                                <input type="range" id="haggle-price-slider" class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500">
                                <div class="flex justify-between text-[10px] text-gray-500 mt-1">
                                    <span>Generous</span>
                                    <span>Greedy</span>
                                </div>
                            </div>

                            <!-- Player Reaction (Your Annoyance) -->
                            <div>
                                <div class="flex justify-between text-sm mb-2">
                                    <label class="text-blue-300 font-semibold">Your Reaction to Counter-Offer</label>
                                    <span id="reaction-label" class="text-blue-400 font-bold">Neutral</span>
                                </div>
                                <input type="range" id="haggle-reaction-slider" min="0" max="100" value="0" class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500">
                                <div class="flex justify-between text-[10px] text-gray-500 mt-1">
                                    <span>Accepting</span>
                                    <span>Displeased</span>
                                </div>
                            </div>

                            <!-- Persistent NPC Patience Meter -->
                            <div class="pt-2 border-t border-gray-700">
                                <div class="flex justify-between text-[10px] uppercase tracking-wider mb-1">
                                    <span class="text-gray-400">Merchant Patience</span>
                                    <span id="patience-value" class="text-white font-bold">100%</span>
                                </div>
                                <div class="w-full h-2 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                                    <div id="patience-bar" class="h-full bg-emerald-500 transition-all duration-500" style="width: 100%"></div>
                                </div>
                                <p class="text-[10px] text-gray-500 mt-1">If patience runs out, the deal is cancelled.</p>
                            </div>

                            <div class="bg-gray-900 p-3 rounded flex justify-between items-center">
                                <span class="text-xs text-gray-400">Total Transaction:</span>
                                <span class="text-lg font-bold text-blue-400">$<span id="haggle-total">0.00</span></span>
                            </div>
                        </div>

                        <div class="flex gap-2 mt-6">
                            <button id="submit-counter-btn" class="flex-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded font-bold transition flex items-center justify-center gap-2">
                                Send Offer
                            </button>
                            <button id="cancel-counter-btn" class="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-3 rounded font-semibold transition">
                                Back
                            </button>
                        </div>
                    </div>

                    <!-- Action Buttons (only shown when it's user's turn to respond) -->
                    <div id="negotiation-actions" class="hidden flex gap-3">
                        <button id="accept-offer-btn" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded font-semibold transition">
                            Accept Offer
                        </button>
                        <button id="reject-offer-btn" class="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded font-semibold transition">
                            Reject / Cancel
                        </button>
                        <button id="show-counter-form-btn" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded font-semibold transition">
                            Counter-Offer
                        </button>
                    </div>

                    <!-- Waiting message (shown when waiting for other team) -->
                    <div id="waiting-message" class="hidden text-center p-4 bg-gray-600 rounded">
                        <p class="text-gray-300">Waiting for other team to respond...</p>
                    </div>
                </div>
            </div>

            <!-- Start New Negotiation View -->
            <div id="start-negotiation-view" class="hidden">
                <button id="back-from-new-btn" class="mb-4 text-blue-400 hover:text-blue-300 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                    </svg>
                    Back
                </button>

                <div class="bg-gray-700 rounded-lg p-6">
                    <h4 class="text-xl font-bold mb-4 text-green-400">Start New Negotiation</h4>
                    <div class="space-y-4">
                        <div>
                            <label for="new-neg-team" class="block text-sm font-semibold mb-2 text-gray-300">Select Team</label>
                            <input type="text" id="new-neg-team" readonly class="w-full bg-gray-600 border border-gray-500 rounded px-4 py-2 text-white cursor-not-allowed">
                        </div>
                        <div>
                            <label for="new-neg-chemical" class="block text-sm font-semibold mb-2 text-gray-300">Chemical</label>
                            <input type="text" id="new-neg-chemical" readonly class="w-full bg-gray-600 border border-gray-500 rounded px-4 py-2 text-white cursor-not-allowed">
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label for="new-neg-quantity" class="block text-sm font-semibold mb-2 text-gray-300">Quantity (gallons)</label>
                                <input type="number" id="new-neg-quantity" min="1" step="1" class="w-full bg-gray-600 border border-gray-500 rounded px-4 py-2 text-white">
                            </div>
                            <div>
                                <label for="new-neg-price" class="block text-sm font-semibold mb-2 text-gray-300">Your Offer Price ($)</label>
                                <input type="number" id="new-neg-price" min="0" step="0.01" class="w-full bg-gray-600 border border-gray-500 rounded px-4 py-2 text-white">
                            </div>
                        </div>
                        <p class="text-xs text-gray-300">Your Shadow Price: <span class="text-green-400 font-semibold">$<span id="new-neg-shadow-hint">0</span></span></p>
                        <button id="submit-new-negotiation-btn" class="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded font-semibold transition">
                            Send Initial Offer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Notifications Panel -->
    <div id="notifications-panel" class="hidden fixed right-4 top-20 bg-gray-800 rounded-lg border-2 border-green-500 w-96 max-h-96 overflow-hidden z-50 shadow-2xl">
        <div class="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
            <h3 class="text-lg font-bold text-green-500">Notifications</h3>
            <button id="close-notif-btn" class="text-gray-400 hover:text-white transition">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
        <div id="notifications-list" class="p-4 space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
            <p class="text-gray-300 text-center py-8">No notifications</p>
        </div>
    </div>

    <!-- Leaderboard Modal -->
    <div id="leaderboard-modal" class="hidden fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="leaderboard-modal-title">
        <div class="bg-gray-800 rounded-lg p-4 md:p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto border-2 border-yellow-500 shadow-2xl">
            <div class="flex items-center justify-between mb-4 md:mb-6">
                <h3 class="text-xl md:text-2xl lg:text-3xl font-bold text-yellow-500" id="leaderboard-modal-title">Leaderboard</h3>
                <button id="leaderboard-modal-close-btn" class="text-gray-700 hover:text-gray-900 transition" aria-label="Close leaderboard">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>

            <div class="mb-4 text-gray-300 text-center">
                <span>Session <span id="leaderboard-session" class="font-bold text-yellow-400">-</span></span>
                <span class="mx-2">•</span>
                <span id="leaderboard-phase" class="capitalize">-</span>
            </div>

            <div id="leaderboard-content" class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead class="bg-gray-700 border-b-2 border-yellow-500">
                        <tr>
                            <th class="px-4 py-3 text-yellow-100 font-bold">Rank</th>
                            <th class="px-4 py-3 text-yellow-100 font-bold">Team</th>
                            <th class="px-4 py-3 text-yellow-100 font-bold text-right">Current</th>
                            <th class="px-4 py-3 text-yellow-100 font-bold text-right">Profit/Loss</th>
                            <th class="px-4 py-3 text-yellow-100 font-bold text-right">ROI %</th>
                        </tr>
                    </thead>
                    <tbody id="leaderboard-body" class="divide-y divide-gray-700">
                        <tr>
                            <td colspan="5" class="text-center py-8 text-gray-300">Loading...</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="mt-6 text-sm text-gray-300 bg-gray-700 p-4 rounded">
                <strong class="text-yellow-400">How scoring works:</strong> Teams are ranked by <strong>Return on Investment (ROI %)</strong> — percentage gain or loss relative to initial production revenue. This ensures fair competition regardless of starting inventory.
            </div>
        </div>
    </div>

    <!-- Production Guide Modal -->
    <div id="production-guide-modal" class="hidden fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="production-guide-modal-title">
        <div class="bg-gray-800 rounded-lg p-4 md:p-6 w-full max-w-2xl border-2 border-blue-500 shadow-2xl">
            <div class="flex items-center justify-between mb-4 md:mb-6">
                <h3 class="text-xl md:text-2xl font-bold text-blue-500" id="production-guide-modal-title">Production Formulas</h3>
                <button id="production-guide-close-btn" class="text-gray-700 hover:text-gray-900 transition" aria-label="Close production guide">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>

            <div class="space-y-6">
                <!-- Deicer Formula -->
                <div class="bg-gray-700 rounded-lg p-4 border-2 border-blue-400">
                    <h4 class="text-lg font-bold text-blue-400 mb-3">Deicer Production</h4>
                    <div class="grid grid-cols-2 gap-4 mb-3">
                        <div>
                            <p class="text-sm text-gray-300 mb-2">Chemicals Required (per 50-gal barrel):</p>
                            <div class="space-y-1 font-mono">
                                <div class="flex justify-between text-white">
                                    <span class="text-blue-400">Chemical C:</span>
                                    <span class="font-bold">25 gal</span>
                                </div>
                                <div class="flex justify-between text-white">
                                    <span class="text-purple-400">Chemical N:</span>
                                    <span class="font-bold">15 gal</span>
                                </div>
                                <div class="flex justify-between text-white">
                                    <span class="text-yellow-400">Chemical D:</span>
                                    <span class="font-bold">10 gal</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <p class="text-sm text-gray-300 mb-2">Revenue:</p>
                            <div class="font-mono text-green-400 font-bold text-2xl">$100</div>
                            <p class="text-xs text-gray-300 mt-1">(per 50-gal barrel)</p>
                        </div>
                    </div>
                </div>

                <!-- Solvent Formula -->
                <div class="bg-gray-700 rounded-lg p-4 border-2 border-purple-400">
                    <h4 class="text-lg font-bold text-purple-400 mb-3">Solvent Production</h4>
                    <div class="grid grid-cols-2 gap-4 mb-3">
                        <div>
                            <p class="text-sm text-gray-300 mb-2">Chemicals Required (per 20-gal barrel):</p>
                            <div class="space-y-1 font-mono">
                                <div class="flex justify-between text-white">
                                    <span class="text-purple-400">Chemical N:</span>
                                    <span class="font-bold">5 gal</span>
                                </div>
                                <div class="flex justify-between text-white">
                                    <span class="text-yellow-400">Chemical D:</span>
                                    <span class="font-bold">7 gal</span>
                                </div>
                                <div class="flex justify-between text-white">
                                    <span class="text-red-400">Chemical Q:</span>
                                    <span class="font-bold">8 gal</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <p class="text-sm text-gray-300 mb-2">Revenue:</p>
                            <div class="font-mono text-green-400 font-bold text-2xl">$60</div>
                            <p class="text-xs text-gray-300 mt-1">(per 20-gal barrel)</p>
                        </div>
                    </div>
                </div>

                <!-- Strategy Tips -->
                <div class="bg-blue-900 bg-opacity-20 border border-blue-500 rounded-lg p-4">
                    <h4 class="font-bold text-white-always mb-2">💡 Trading Strategy Tips</h4>
                    <ul class="text-sm text-white-always space-y-2">
                        <li>• <strong class="text-white-always">Shadow Prices</strong> show how much your profit increases per additional gallon of each chemical</li>
                        <li>• Buy chemicals with high shadow prices to maximize production profit</li>
                        <li>• Sell chemicals with low/zero shadow prices - you don't need them!</li>
                        <li>• Your production automatically runs each session using these formulas</li>
                    </ul>
                </div>
            </div>

            <div class="mt-6">
                <button id="production-guide-ok-btn" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded font-semibold transition">Got It!</button>
            </div>
        </div>
    </div>

    <!-- Main JavaScript Application -->
    <script>
        window.APP_BASE_PATH = "<?php echo htmlspecialchars($basePath); ?>";
    </script>
    <script id="main-app-script" 
            type="module" 
            src="<?php echo htmlspecialchars($basePath); ?>/js/marketplace.js"
            data-base-path="<?php echo htmlspecialchars($basePath); ?>"></script>
</body>
</html>
