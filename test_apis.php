<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CNDQ API Tester</title>
    <style>
        body {
            font-family: monospace;
            max-width: 1200px;
            margin: 20px auto;
            padding: 20px;
            background: #1a1a1a;
            color: #0f0;
        }
        .test-section {
            background: #000;
            border: 1px solid #0f0;
            padding: 15px;
            margin: 10px 0;
        }
        .success { color: #0f0; }
        .error { color: #f00; }
        button {
            background: #0f0;
            color: #000;
            border: none;
            padding: 10px 20px;
            cursor: pointer;
            margin: 5px;
            font-family: monospace;
            font-weight: bold;
        }
        button:hover {
            background: #0a0;
        }
        pre {
            background: #111;
            padding: 10px;
            overflow-x: auto;
            border-left: 3px solid #0f0;
        }
        h2 {
            color: #0ff;
            border-bottom: 2px solid #0f0;
            padding-bottom: 5px;
        }
    </style>
</head>
<body>
    <h1>🚀 CNDQ API Testing Console</h1>
    <p>Current User: <strong><?php echo $_SERVER['mail'] ?? 'NOT SET'; ?></strong></p>

    <div class="test-section">
        <h2>1. Team Profile</h2>
        <button onclick="testAPI('GET', '/api/team/profile.php', null, 'profile-result')">GET Profile</button>
        <pre id="profile-result">Click button to test...</pre>
    </div>

    <div class="test-section">
        <h2>2. Shadow Prices (PRIVATE)</h2>
        <button onclick="testAPI('GET', '/api/production/shadow-prices.php', null, 'shadow-result')">Calculate Shadow Prices</button>
        <pre id="shadow-result">Click button to test...</pre>
    </div>

    <div class="test-section">
        <h2>3. Create Offer</h2>
        <button onclick="createTestOffer()">Create Sell Offer (100g of C @ $10)</button>
        <pre id="offer-result">Click button to test...</pre>
    </div>

    <div class="test-section">
        <h2>4. Marketplace</h2>
        <button onclick="testAPI('GET', '/api/marketplace/offers.php', null, 'marketplace-result')">View All Offers</button>
        <pre id="marketplace-result">Click button to test...</pre>
    </div>

    <div class="test-section">
        <h2>5. Notifications</h2>
        <button onclick="testAPI('GET', '/api/notifications/list.php', null, 'notif-result')">Get Notifications</button>
        <pre id="notif-result">Click button to test...</pre>
    </div>

    <div class="test-section">
        <h2>6. Settings</h2>
        <button onclick="testAPI('GET', '/api/team/settings.php', null, 'settings-result')">Get Settings</button>
        <pre id="settings-result">Click button to test...</pre>
    </div>

    <script>
        async function testAPI(method, url, body, resultId) {
            const resultEl = document.getElementById(resultId);
            resultEl.textContent = 'Loading...';
            resultEl.className = '';

            try {
                const options = {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };

                if (body) {
                    options.body = JSON.stringify(body);
                }

                const response = await fetch(url, options);
                const data = await response.json();

                if (data.success || response.ok) {
                    resultEl.className = 'success';
                    resultEl.textContent = JSON.stringify(data, null, 2);
                } else {
                    resultEl.className = 'error';
                    resultEl.textContent = 'ERROR: ' + JSON.stringify(data, null, 2);
                }
            } catch (error) {
                resultEl.className = 'error';
                resultEl.textContent = 'ERROR: ' + error.message;
            }
        }

        function createTestOffer() {
            testAPI('POST', '/api/offers/create.php', {
                chemical: 'C',
                quantity: 100,
                minPrice: 10.00
            }, 'offer-result');
        }
    </script>

    <div class="test-section">
        <h2>📋 Test Sequence</h2>
        <p>Recommended testing order:</p>
        <ol>
            <li>GET Profile - Verify user authentication and inventory</li>
            <li>Calculate Shadow Prices - Check privacy (only your prices)</li>
            <li>Create Offer - Test offer creation with inventory validation</li>
            <li>View Marketplace - See aggregated offers</li>
            <li>Get Notifications - Check notification system</li>
            <li>Toggle Settings - Test settings persistence</li>
        </ol>
    </div>

    <div class="test-section">
        <h2>🔒 Security Tests</h2>
        <p>Open browser console and try:</p>
        <pre>// This should FAIL (403 Forbidden):
fetch('/api/production/shadow-prices.php?team=someone@else.com')
  .then(r => r.json())
  .then(console.log)</pre>
    </div>
</body>
</html>
