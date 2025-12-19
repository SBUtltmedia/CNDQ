<?php
// Handle Login Selection
if (isset($_GET['user'])) {
    $user = $_GET['user'];
    // Set cookie for 30 days
    setcookie('mock_mail', $user, time() + (86400 * 30), "/");
    header("Location: index.html");
    exit;
}

// Handle Logout / Reset
if (isset($_GET['reset'])) {
    setcookie('mock_mail', '', time() - 3600, "/");
    header("Location: index.html");
    exit;
}

$currentUser = $_COOKIE['mock_mail'] ?? $_SERVER['mail'] ?? 'Unknown';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dev Login Switcher</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 min-h-screen flex items-center justify-center p-4">
    <div class="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h1 class="text-2xl font-bold text-slate-800 mb-2">Dev User Switcher</h1>
        <p class="text-slate-500 mb-6">Current User: <span class="font-mono bg-slate-100 px-2 py-1 rounded text-indigo-600"><?php echo htmlspecialchars($currentUser); ?></span></p>
        
        <div class="space-y-3">
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Select a Test Persona:</p>
            
            <a href="?user=test_mail1@stonybrook.edu" class="block w-full p-4 border border-slate-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 transition-all flex items-center gap-3 group">
                <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors">1</div>
                <div class="font-medium text-slate-700">Team 1 (Primary)</div>
            </a>

            <a href="?user=test_mail2@stonybrook.edu" class="block w-full p-4 border border-slate-200 rounded-lg hover:bg-emerald-50 hover:border-emerald-200 transition-all flex items-center gap-3 group">
                <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold group-hover:bg-emerald-600 group-hover:text-white transition-colors">2</div>
                <div class="font-medium text-slate-700">Team 2</div>
            </a>

            <a href="?user=test_mail3@stonybrook.edu" class="block w-full p-4 border border-slate-200 rounded-lg hover:bg-amber-50 hover:border-amber-200 transition-all flex items-center gap-3 group">
                <div class="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold group-hover:bg-amber-600 group-hover:text-white transition-colors">3</div>
                <div class="font-medium text-slate-700">Team 3</div>
            </a>
            
             <a href="?user=test_mail4@stonybrook.edu" class="block w-full p-4 border border-slate-200 rounded-lg hover:bg-rose-50 hover:border-rose-200 transition-all flex items-center gap-3 group">
                <div class="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold group-hover:bg-rose-600 group-hover:text-white transition-colors">4</div>
                <div class="font-medium text-slate-700">Team 4</div>
            </a>
        </div>

        <div class="mt-8 pt-6 border-t border-slate-100">
            <a href="?reset=1" class="text-sm text-red-500 hover:text-red-700 font-medium flex items-center gap-1 justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                Reset to Default (.htaccess)
            </a>
        </div>
    </div>
</body>
</html>
