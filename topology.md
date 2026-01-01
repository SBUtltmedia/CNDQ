# CNDQ Development Topology

This document describes the local development environment setup required to accurately emulate the production server, where the application resides in a subdirectory.

## Production vs. Development Parity

- **Production Environment**: The live application is not hosted at the domain root. Instead, it lives inside a subdirectory named `CNDQ`.
  - *Example URL*: `https://production.server.com/CNDQ/index.php`

- **Local (Herd) Environment**: To mirror this, the Herd web server root points to `C:\Users\pauls\Herd`. The entire CNDQ application is located within a subfolder at `C:\Users\pauls\Herd\CNDQ`.
  - *Emulated URL*: `http://herd.test/CNDQ/`

This subdirectory setup is the most critical factor affecting development. **All asset paths and API requests must be prefixed with `/CNDQ/` to function correctly.**

## Implications for Development

### 1. Asset & API Pathing (`basePath`)

The entire application—both frontend and backend—must be aware that it lives inside `/CNDQ/`. Hardcoding absolute paths like `/css/styles.css` or `/api/status.php` will fail, as the server will look for them at the domain root, which is incorrect.

- **The Solution**: We use a dynamically calculated `$basePath` variable in `config.php`. This variable inspects the server environment and resolves to `/CNDQ` (or whatever the current subdirectory is named).
  
  ```php
  // in config.php
  $basePath = ... // Resolves to /CNDQ
  ```

- **Frontend Usage**: This PHP variable is then injected into `index.php` to inform the JavaScript application of its root.
  
  ```html
  <!-- in index.php -->
  <script id="main-app-script" 
          type="module" 
          src="<?php echo htmlspecialchars($basePath); ?>/js/marketplace.js"
          data-base-path="<?php echo htmlspecialchars($basePath); ?>">
  </script>
  ```

  The `ApiClient` in `js/api.js` reads this `data-base-path` attribute to correctly prefix all `fetch()` requests, ensuring they are always sent to `http://herd.test/CNDQ/api/...`.

### 2. Case-Sensitivity (The "CNDQ" vs. "cndq" Problem)

A significant challenge in this setup is URL case sensitivity. While your Windows filesystem might treat `CNDQ` and `cndq` as the same, the **Nginx server used by Herd can be configured to treat them differently**.

- **The Problem**: If a developer accesses `http://herd.test/cndq` (lowercase) in their browser, but the code generates asset paths using `/CNDQ` (uppercase), API calls can fail with a 404 Not Found error because the server sees them as different locations.
- **The Solution**: The `basePath` logic must be robust enough to detect the casing used in the browser's request URI and use that exact casing for all subsequent path generation.

### 3. Testing (Puppeteer)

Automated tests must also respect this topology.
- **`baseUrl` Configuration**: All Puppeteer test configurations (`run-tests.js`, `haggle-test.js`, etc.) must set their `baseUrl` to `http://herd.test/CNDQ`.
- **Authentication**: Cookie paths must be set to `/` or `/CNDQ/` correctly to ensure the login state is maintained as the test navigates between pages within the subdirectory (e.g., `/CNDQ/` and `/CNDQ/admin/`).
- **Debugging**: When a test fails with a 404, the first suspect is always a pathing mismatch between what the test requested and what the server expected (e.g., a missing `/CNDQ` prefix).
