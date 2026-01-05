<?php
/**
 * Admin Dashboard - Access Control
 * Only authorized administrators can access this page
 */

require_once __DIR__ . '/../userData.php';
require_once __DIR__ . '/../config.php';

// Check if user is admin
if (!isAdmin()) {
    header('Location: ./access-denied.html');
    exit;
}

// User is authorized, show admin dashboard
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CNDQ Admin Dashboard</title>

    <!-- Import map for Lit web components -->
    <script type="importmap">
    {
        "imports": {
            "lit": "https://cdn.jsdelivr.net/npm/lit@3/index.js",
            "lit/": "https://cdn.jsdelivr.net/npm/lit@3/",
            "lit-element": "https://cdn.jsdelivr.net/npm/lit-element@4/index.js",
            "lit-element/": "https://cdn.jsdelivr.net/npm/lit-element@4/",
            "@lit/reactive-element": "https://cdn.jsdelivr.net/npm/@lit/reactive-element@2/reactive-element.js",
            "@lit/reactive-element/": "https://cdn.jsdelivr.net/npm/@lit/reactive-element@2/",
            "lit-html": "https://cdn.jsdelivr.net/npm/lit-html@3/lit-html.js",
            "lit-html/": "https://cdn.jsdelivr.net/npm/lit-html@3/"
        }
    }
    </script>

    <link rel="stylesheet" href="../css/styles.css">
    <style>
        /* Focus styles */
        *:focus-visible {
            outline: 2px solid var(--color-brand-primary);
            outline-offset: 2px;
        }
        .min-h-screen { min-height: 100vh; }
        .p-8 { padding: 2rem; }
    </style>
</head>
<body class="bg-gray-900 text-white min-h-screen p-8">
    <!-- Toast Container -->
    <div id="toast-container" class="fixed top-4 right-4 z-50 space-y-2"></div>

    <div class="max-w-4xl mx-auto">
        <header class="mb-8">
            <h1 class="text-3xl font-bold text-purple-400 mb-2">CNDQ Admin Dashboard</h1>
            <p class="text-gray-300">Session & Market Control</p>
        </header>

        <!-- Session Status Card -->
        <div class="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
            <h2 class="text-xl font-bold mb-4">Current Session</h2>

            <div class="grid grid-cols-2 gap-4 mb-6">
                <div class="bg-gray-700 p-4 rounded">
                    <div class="text-gray-300 text-sm">Session Number</div>
                    <div class="text-3xl font-bold text-purple-400" id="session-number">-</div>
                </div>
                <div class="bg-gray-700 p-4 rounded">
                    <div class="text-gray-300 text-sm">Current Phase</div>
                    <div class="text-3xl font-bold capitalize" id="current-phase">-</div>
                </div>
            </div>

            <div class="bg-gray-700 p-4 rounded mb-4" id="timer-container">
                <div class="text-gray-300 text-sm mb-2">Time Remaining</div>
                <div class="text-2xl font-mono font-bold text-yellow-400" id="time-remaining">--:--</div>
            </div>

            <!-- Phase Controls -->
            <div class="flex gap-3">
                <button id="start-stop-btn" onclick="toggleGameStop()" class="flex-1 bg-green-600 hover:bg-green-700 px-6 py-3 rounded font-bold transition">
                    Start Game
                </button>
                <button onclick="resetSession()" class="bg-red-600 hover:bg-red-700 px-6 py-3 rounded font-bold transition">
                    Reset to Session 1
                </button>
            </div>
        </div>

        <!-- Direct Phase Control -->
        <div class="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
            <h2 class="text-xl font-bold mb-4">Manual Session Advance</h2>

            <button onclick="advancePhase()" class="w-full bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded font-bold transition">
                Advance to Next Session →
            </button>
            <p class="text-xs text-gray-300 mt-2">
                Manually advances to the next session (runs production and increments session number)
            </p>
        </div>

        <!-- Auto-Advance Settings -->
        <div class="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
            <h2 class="text-xl font-bold mb-4">Auto-Advance Settings</h2>

            <div class="flex items-center justify-between mb-4">
                <label class="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" id="auto-advance" onchange="toggleAutoAdvance()" class="w-6 h-6 rounded">
                    <span class="text-lg">Enable Auto-Advance</span>
                </label>
            </div>

            <div class="bg-blue-900/30 border border-blue-500/50 rounded p-4 mb-6">
                <div class="text-sm text-blue-200 mb-2">
                    <strong>Auto-Advance Flow:</strong> Trading Session → Auto Production → Next Trading Session
                </div>
                <div class="text-xs text-blue-300 space-y-1">
                    <p><strong>Trading Phase:</strong> Teams buy/sell chemicals on the marketplace</p>
                    <p class="mt-2"><strong>Automatic Production:</strong> When trading time expires, LP solver runs automatically for all teams:</p>
                    <ul class="list-disc ml-5">
                        <li>Optimizes Deicer/Solvent production mix</li>
                        <li>Consumes chemicals from inventory</li>
                        <li>Credits revenue to team accounts</li>
                        <li>Shows results modal to players</li>
                        <li>Advances to next trading session</li>
                    </ul>
                </div>
            </div>

            <div>
                <label for="trading-duration-minutes" class="block text-sm text-gray-300 mb-2">Trading Session Duration</label>
                <div class="flex items-center gap-2">
                    <input type="number" id="trading-duration-minutes" value="10" min="0" max="60" class="bg-gray-700 border border-gray-600 rounded px-4 py-2 w-20 text-white" aria-label="Trading duration minutes">
                    <span class="text-gray-300">min</span>
                    <input type="number" id="trading-duration-seconds" value="0" min="0" max="59" class="bg-gray-700 border border-gray-600 rounded px-4 py-2 w-20 text-white" aria-label="Trading duration seconds">
                    <span class="text-gray-300">sec</span>
                </div>
                <button onclick="updateTradingDuration()" class="mt-2 bg-green-700 hover:bg-green-800 px-4 py-2 rounded font-bold transition w-full text-sm">
                    Update Session Duration
                </button>
                <div class="text-xs text-gray-300 mt-1">Time for each trading session (production runs automatically when time expires)</div>
            </div>
        </div>

        <!-- Danger Zone -->
        <div class="bg-red-900/20 border-2 border-red-600 rounded-lg p-6 mb-6">
            <h2 class="text-xl font-bold mb-2 text-red-400">⚠️ Danger Zone</h2>
            <p class="text-gray-300 text-sm mb-4">Irreversible action that completely wipes everything</p>

            <button onclick="resetGameData()" class="w-full bg-red-700 hover:bg-red-800 px-6 py-4 rounded font-bold transition border-2 border-red-500">
                🗑️ RESET GAME & TEAM DATA
            </button>
            <p class="text-xs text-gray-300 mt-2">
                <strong>Deletes ALL teams and game data.</strong> Connected players will automatically get new random team names when they refresh.
            </p>
        </div>

        <!-- Team Overview -->
        <div class="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
            <h2 class="text-xl font-bold mb-4">Team Overview</h2>
            <div id="team-list" class="space-y-2">
                <p class="text-gray-300">Loading teams...</p>
            </div>
        </div>

        <!-- NPC Management -->
        <div class="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-xl font-bold">NPC Management</h2>
                <label class="flex items-center gap-3 cursor-pointer">
                    <span class="text-sm text-gray-300">Enable NPCs</span>
                    <input type="checkbox" id="npc-system-enabled" onchange="toggleNPCSystem()" class="w-5 h-5 rounded">
                </label>
            </div>

            <!-- NPC Stats Dashboard -->
            <div class="grid grid-cols-4 gap-4 mb-6" id="npc-stats">
                <div class="bg-gray-700 p-4 rounded">
                    <div class="text-gray-300 text-sm">Total NPCs</div>
                    <div class="text-2xl font-bold text-purple-400" id="npc-total">0</div>
                </div>
                <div class="bg-gray-700 p-4 rounded">
                    <div class="text-gray-300 text-sm">Active NPCs</div>
                    <div class="text-2xl font-bold text-green-400" id="npc-active">0</div>
                </div>
                <div class="bg-gray-700 p-4 rounded">
                    <div class="text-gray-300 text-sm">Total Trades</div>
                    <div class="text-2xl font-bold text-blue-400" id="npc-trades">0</div>
                </div>
                <div class="bg-gray-700 p-4 rounded">
                    <div class="text-gray-300 text-sm">Net Profit</div>
                    <div class="text-2xl font-bold text-yellow-400" id="npc-profit">$0</div>
                </div>
            </div>

            <!-- Add NPC Form -->
            <div class="bg-gray-700 p-4 rounded mb-6">
                <h3 class="font-bold mb-3 text-purple-300">Add New NPC</h3>
                <div class="flex gap-3">
                    <select id="npc-skill-level" class="bg-gray-600 border border-gray-500 rounded px-4 py-2 text-white flex-1">
                        <option value="beginner">Beginner (Random trades, safety limits)</option>
                        <option value="novice">Novice (Threshold-based, methodical)</option>
                        <option value="expert">Expert (Shadow price-based, strategic)</option>
                    </select>
                    <button onclick="createNPC()" class="bg-green-600 hover:bg-green-700 px-6 py-2 rounded font-bold transition">
                        Add NPC
                    </button>
                </div>
            </div>

            <!-- NPC List -->
            <div>
                <h3 class="font-bold mb-3 text-purple-300">NPC Teams</h3>
                <div id="npc-list" class="space-y-2">
                    <p class="text-gray-400 text-sm">Loading NPCs...</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Custom Confirm Modal -->
    <div id="confirm-modal" class="hidden fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100] p-4">
        <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md border-2 border-purple-500 shadow-2xl">
            <h3 class="text-2xl font-bold mb-4 text-purple-400" id="confirm-modal-title">Confirm Action</h3>
            <p class="text-gray-300 mb-6" id="confirm-modal-message">Are you sure you want to proceed?</p>

            <div class="flex gap-3">
                <button id="confirm-modal-yes" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded font-bold transition">Yes, Proceed</button>
                <button id="confirm-modal-no" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded font-bold transition">Cancel</button>
            </div>
        </div>
    </div>

    <script>
        let sessionState = null;
        let updateInterval = null;

        // Helper to construct API URLs using relative paths
        function apiUrl(endpoint) {
            // Remove leading slash from endpoint if present
            const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
            // Admin is one level deep, so use ../ prefix
            return `../${cleanEndpoint}`;
        }

        // Custom Confirm Modal
        function showConfirm(message, title = 'Confirm Action') {
            return new Promise((resolve) => {
                const modal = document.getElementById('confirm-modal');
                const titleEl = document.getElementById('confirm-modal-title');
                const messageEl = document.getElementById('confirm-modal-message');
                const yesBtn = document.getElementById('confirm-modal-yes');
                const noBtn = document.getElementById('confirm-modal-no');

                titleEl.textContent = title;
                messageEl.textContent = message;
                modal.classList.remove('hidden');

                const handleYes = () => {
                    modal.classList.add('hidden');
                    cleanup();
                    resolve(true);
                };

                const handleNo = () => {
                    modal.classList.add('hidden');
                    cleanup();
                    resolve(false);
                };

                const cleanup = () => {
                    yesBtn.removeEventListener('click', handleYes);
                    noBtn.removeEventListener('click', handleNo);
                };

                yesBtn.addEventListener('click', handleYes, { once: true });
                noBtn.addEventListener('click', handleNo, { once: true });
            });
        }

        // Toast notification system
        function showToast(message, type = 'success') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');

            const bgColor = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';

            toast.className = `${bgColor} text-white px-6 py-3 rounded-lg shadow-lg min-w-[300px] max-w-md transform transition-all duration-300 ease-in-out`;
            toast.innerHTML = `
                <div class="flex items-center justify-between gap-3">
                    <span>${message}</span>
                    <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            `;

            container.appendChild(toast);

            // Auto-remove after 4 seconds
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => toast.remove(), 300);
            }, 4000);
        }

        async function loadSessionState() {
            try {
                const response = await fetch(apiUrl('/api/admin/session.php'));
                const data = await response.json();

                if (data.success) {
                    sessionState = data.session;
                    updateUI();
                }
            } catch (error) {
                console.error('Failed to load session state:', error);
            }
        }

        async function loadTeams() {
            try {
                const response = await fetch(apiUrl('/api/admin/list-teams.php'));
                const data = await response.json();

                if (data.teams) {
                    const teamList = document.getElementById('team-list');
                    teamList.innerHTML = data.teams.map(team => `
                        <div class="bg-gray-700 p-3 rounded flex justify-between items-center">
                            <div>
                                <div class="font-bold">${team.teamName}</div>
                                <div class="text-sm text-gray-300">${team.email}</div>
                            </div>
                            <div class="text-right">
                                <div class="text-green-400 font-bold">$${team.funds.toLocaleString()}</div>
                                <div class="text-xs text-gray-300">${team.activeOffers} offers, ${team.totalTrades} trades</div>
                            </div>
                        </div>
                    `).join('');
                }
            } catch (error) {
                console.error('Failed to load teams:', error);
            }
        }

        function updateUI() {
            if (!sessionState) return;

            document.getElementById('session-number').textContent = sessionState.currentSession;
            
            const phaseEl = document.getElementById('current-phase');
            if (sessionState.gameStopped) {
                phaseEl.textContent = 'STOPPED';
                phaseEl.className = 'text-3xl font-bold capitalize text-red-500';
                
                const btn = document.getElementById('start-stop-btn');
                btn.textContent = 'Start Game';
                btn.className = 'flex-1 bg-green-600 hover:bg-green-700 px-6 py-3 rounded font-bold transition';
            } else {
                phaseEl.textContent = 'Trading';
                phaseEl.className = 'text-3xl font-bold capitalize text-green-400';
                
                const btn = document.getElementById('start-stop-btn');
                btn.textContent = 'Stop Game';
                btn.className = 'flex-1 bg-red-600 hover:bg-red-700 px-6 py-3 rounded font-bold transition';
            }

            const autoAdvanceCheckbox = document.getElementById('auto-advance');
            if (document.activeElement !== autoAdvanceCheckbox) {
                autoAdvanceCheckbox.checked = sessionState.autoAdvance;
            }

            // Trading session duration
            const tradeDuration = sessionState.tradingDuration || 600;
            const minInput = document.getElementById('trading-duration-minutes');
            const secInput = document.getElementById('trading-duration-seconds');
            
            if (document.activeElement !== minInput) {
                minInput.value = Math.floor(tradeDuration / 60);
            }
            if (document.activeElement !== secInput) {
                secInput.value = tradeDuration % 60;
            }

            updateTimer();
        }

        function updateTimer() {
            if (!sessionState) return;

            if (sessionState.gameStopped) {
                 document.getElementById('time-remaining').textContent = "STOPPED";
                 return;
            }

            if (sessionState.timeRemaining !== undefined) {
                const minutes = Math.floor(sessionState.timeRemaining / 60);
                const seconds = sessionState.timeRemaining % 60;
                document.getElementById('time-remaining').textContent =
                    `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
        }

        async function toggleGameStop() {
            if (!sessionState) return;
            
            const newState = !sessionState.gameStopped;
            const action = newState ? 'Stop' : 'Start';
            
            // Only confirm for stopping
            if (newState) {
                const confirmed = await showConfirm('Stop the game? Market will be closed for all players.', 'Stop Game');
                if (!confirmed) return;
            }

            try {
                const response = await fetch(apiUrl('/api/admin/session.php'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'toggleGameStop', stopped: newState })
                });
                const data = await response.json();

                if (data.success) {
                    showToast(`Game ${newState ? 'Stopped' : 'Started'}`);
                    await loadSessionState();
                }
            } catch (error) {
                showToast(`Failed to ${action} game`, 'error');
            }
        }

        async function advancePhase() {
            try {
                const response = await fetch(apiUrl('/api/admin/session.php'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'advance' })
                });
                const data = await response.json();

                if (data.success) {
                    showToast(data.message);
                    await loadSessionState();
                }
            } catch (error) {
                showToast('Failed to advance phase', 'error');
            }
        }

        async function setPhase(phase) {
            try {
                const response = await fetch(apiUrl('/api/admin/session.php'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'setPhase', phase })
                });
                const data = await response.json();

                if (data.success) {
                    await loadSessionState();
                }
            } catch (error) {
                showToast('Failed to set phase', 'error');
            }
        }

        async function toggleAutoAdvance() {
            const enabled = document.getElementById('auto-advance').checked;

            try {
                const response = await fetch(apiUrl('/api/admin/session.php'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'setAutoAdvance', enabled })
                });
                const data = await response.json();

                if (data.success) {
                    await loadSessionState();
                }
            } catch (error) {
                showToast('Failed to toggle auto-advance', 'error');
            }
        }

        async function updateTradingDuration() {
            const minutes = parseInt(document.getElementById('trading-duration-minutes').value) || 0;
            const secs = parseInt(document.getElementById('trading-duration-seconds').value) || 0;
            const totalSeconds = (minutes * 60) + secs;

            try {
                const response = await fetch(apiUrl('/api/admin/session.php'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'setTradingDuration', seconds: totalSeconds })
                });
                const data = await response.json();

                if (data.success) {
                    showToast('Trading duration updated to ' + minutes + 'm ' + secs + 's');
                    await loadSessionState();
                }
            } catch (error) {
                showToast('Failed to update trading duration', 'error');
            }
        }

        async function resetSession() {
            const confirmed = await showConfirm('Reset to Session 1? This will clear all session history.');
            if (!confirmed) {
                return;
            }

            try {
                const response = await fetch(apiUrl('/api/admin/session.php'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'reset' })
                });
                const data = await response.json();

                if (data.success) {
                    showToast('Session reset to 1');
                    await loadSessionState();
                }
            } catch (error) {
                showToast('Failed to reset session', 'error');
            }
        }

        async function resetGameData() {
            const confirmed = await showConfirm(
                'RESET GAME & TEAM DATA? This will COMPLETELY DELETE all teams, inventories, funds, trades, and advertisements. Connected players will be assigned NEW random team names when they refresh. This cannot be undone!',
                '⚠️ DANGER: Delete Everything'
            );
            if (!confirmed) {
                return;
            }

            // Second confirmation for safety
            const doubleConfirmed = await showConfirm(
                'Are you ABSOLUTELY sure? This DELETES ALL TEAMS. Everyone gets a fresh start with new team names!',
                '⚠️ Final Confirmation'
            );
            if (!doubleConfirmed) {
                return;
            }

            try {
                const response = await fetch(apiUrl('/api/admin/reset-game.php'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await response.json();

                if (data.success) {
                    showToast(`Complete reset! ${data.teamsDeleted} teams deleted. Players will get new teams on refresh.`, 'success');
                    await loadSessionState();
                    await loadTeams();
                    await loadNPCs();
                } else {
                    showToast('Failed to reset: ' + (data.message || 'Unknown error'), 'error');
                }
            } catch (error) {
                console.error('Reset error:', error);
                showToast('Failed to reset game data', 'error');
            }
        }

        // ========== NPC Management Functions ==========

        async function loadNPCs() {
            try {
                const response = await fetch(apiUrl('/api/admin/npc/list.php'));
                const data = await response.json();

                if (data.success) {
                    // Update system toggle (only if not currently being interacted with)
                    const npcCheckbox = document.getElementById('npc-system-enabled');
                    if (document.activeElement !== npcCheckbox) {
                        npcCheckbox.checked = data.enabled;
                    }

                    // Update stats
                    const npcs = data.npcs || [];
                    const activeNPCs = npcs.filter(n => n.active).length;
                    const totalTrades = npcs.reduce((sum, n) => sum + (n.stats?.totalTrades || 0), 0);
                    const totalProfit = npcs.reduce((sum, n) => sum + (n.stats?.totalProfit || 0), 0);

                    document.getElementById('npc-total').textContent = npcs.length;
                    document.getElementById('npc-active').textContent = activeNPCs;
                    document.getElementById('npc-trades').textContent = totalTrades;
                    document.getElementById('npc-profit').textContent = '$' + totalProfit.toFixed(2);

                    // Render NPC list
                    const npcListEl = document.getElementById('npc-list');
                    if (npcs.length === 0) {
                        npcListEl.innerHTML = '<p class="text-gray-400 text-sm">No NPCs created yet. Use the form above to add NPCs.</p>';
                    } else {
                        npcListEl.innerHTML = npcs.map(npc => `
                            <div class="bg-gray-700 p-4 rounded flex items-center justify-between">
                                <div class="flex-1">
                                    <div class="flex items-center gap-3 mb-1">
                                        <span class="font-bold text-lg">${npc.teamName}</span>
                                        <span class="text-xs px-2 py-1 rounded ${
                                            npc.skillLevel === 'beginner' ? 'bg-gray-600 text-gray-300' :
                                            npc.skillLevel === 'novice' ? 'bg-blue-600 text-white' :
                                            'bg-purple-600 text-white'
                                        }">${npc.skillLevel.toUpperCase()}</span>
                                        <span class="text-xs px-2 py-1 rounded ${npc.active ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}">
                                            ${npc.active ? 'ACTIVE' : 'INACTIVE'}
                                        </span>
                                    </div>
                                    <div class="text-sm text-gray-300 flex gap-4">
                                        <span>Funds: $${((npc.currentFunds || 0)).toFixed(2)}</span>
                                        <span>Trades: ${npc.stats?.totalTrades || 0}</span>
                                        <span>Profit: $${((npc.stats?.totalProfit || 0)).toFixed(2)}</span>
                                    </div>
                                    <div class="text-xs text-gray-400 mt-1">
                                        Inventory: C=${Math.round(npc.inventory?.C || 0)} N=${Math.round(npc.inventory?.N || 0)}
                                        D=${Math.round(npc.inventory?.D || 0)} Q=${Math.round(npc.inventory?.Q || 0)}
                                    </div>
                                </div>
                                <div class="flex gap-2">
                                    <button onclick="toggleNPC('${npc.id}', ${!npc.active})"
                                            class="px-4 py-2 rounded font-bold transition ${
                                                npc.active ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'
                                            }">
                                        ${npc.active ? 'Deactivate' : 'Activate'}
                                    </button>
                                    <button onclick="deleteNPC('${npc.id}')"
                                            class="px-4 py-2 rounded font-bold transition bg-red-600 hover:bg-red-700">
                                        Delete
                                    </button>
                                </div>
                            </div>
                        `).join('');
                    }
                }
            } catch (error) {
                console.error('Failed to load NPCs:', error);
                document.getElementById('npc-list').innerHTML = '<p class="text-red-400 text-sm">Failed to load NPCs</p>';
            }
        }

        async function toggleNPCSystem() {
            const enabled = document.getElementById('npc-system-enabled').checked;

            try {
                const response = await fetch(apiUrl('/api/admin/npc/toggle-system.php'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled })
                });
                const data = await response.json();

                if (data.success) {
                    showToast('NPC system ' + (enabled ? 'enabled' : 'disabled'));
                    await loadNPCs();
                } else {
                    showToast('Failed to toggle NPC system', 'error');
                    // Revert checkbox
                    document.getElementById('npc-system-enabled').checked = !enabled;
                }
            } catch (error) {
                showToast('Failed to toggle NPC system', 'error');
                document.getElementById('npc-system-enabled').checked = !enabled;
            }
        }

        async function createNPC() {
            const skillLevel = document.getElementById('npc-skill-level').value;
            const countEl = document.getElementById('npc-count');
            const count = countEl ? parseInt(countEl.value) : 1; // Default to 1 if element is absent

            if (count < 1 || count > 10) {
                showToast('Count must be between 1 and 10', 'error');
                return;
            }

            try {
                const response = await fetch(apiUrl('/api/admin/npc/create.php'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ skillLevel, count })
                });
                const data = await response.json();

                if (data.success) {
                    showToast(`Created ${count} ${skillLevel} NPC(s)`);
                    await loadNPCs();
                } else {
                    showToast('Failed to create NPC: ' + (data.message || 'Unknown error'), 'error');
                }
            } catch (error) {
                showToast('Failed to create NPC', 'error');
            }
        }

        async function toggleNPC(npcId, active) {
            try {
                const response = await fetch(apiUrl('/api/admin/npc/toggle.php'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ npcId, active })
                });
                const data = await response.json();

                if (data.success) {
                    showToast('NPC ' + (active ? 'activated' : 'deactivated'));
                    await loadNPCs();
                } else {
                    showToast('Failed to toggle NPC', 'error');
                }
            } catch (error) {
                showToast('Failed to toggle NPC', 'error');
            }
        }

        async function deleteNPC(npcId) {
            const confirmed = await showConfirm(
                'Delete this NPC? This will remove it from the config but keep its team data. You can optionally delete team data in the confirmation.',
                'Delete NPC'
            );
            if (!confirmed) return;

            try {
                const response = await fetch(apiUrl('/api/admin/npc/delete.php'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ npcId, deleteTeamData: false })
                });
                const data = await response.json();

                if (data.success) {
                    showToast('NPC deleted');
                    await loadNPCs();
                } else {
                    showToast('Failed to delete NPC: ' + (data.message || 'Unknown error'), 'error');
                }
            } catch (error) {
                showToast('Failed to delete NPC', 'error');
            }
        }

        // ========== End NPC Management Functions ==========

        // Initialize
        loadSessionState();
        loadTeams();
        loadNPCs(); // Load NPCs on page load

        // Local timer update every second
        setInterval(() => {
            if (sessionState && typeof sessionState.timeRemaining === 'number') {
                sessionState.timeRemaining = Math.max(0, sessionState.timeRemaining - 1);
                updateTimer();
            }
        }, 1000);

        // Server state refresh every 3 seconds
        setInterval(loadSessionState, 3000);

        setInterval(loadTeams, 5000);
        setInterval(loadNPCs, 5000); // Refresh NPCs every 5 seconds
    </script>
</body>
</html>
