#!/bin/bash

# CNDQ Setup Script for macOS (Valet)
# This script sets up the local development environment for CNDQ.

echo "🚀 Starting CNDQ Setup..."

# 1. Check/Install Homebrew
if ! command -v brew &> /dev/null; then
    echo "📦 Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
    echo "✅ Homebrew is already installed."
fi

# 2. Install PHP and Composer
echo "📦 Installing PHP and Composer..."
brew install php composer

# 3. Install/Update Node.js
echo "📦 Installing Node.js..."
brew install node

# 4. Install Laravel Valet
if ! command -v valet &> /dev/null; then
    echo "📦 Installing Laravel Valet..."
    composer global require laravel/valet
    export PATH=$PATH:$HOME/.composer/vendor/bin
    valet install
else
    echo "✅ Valet is already installed."
fi

# 5. Project Setup
echo "📂 Setting up project dependencies..."
# Ensure we are in the script directory
cd "$(dirname "$0")"

# Install PHP dependencies
composer install

# Install Node dependencies
npm install

# 6. Configure Environment
echo "🔧 Configuring environment variables..."
if [ -f ".env.example" ]; then
    # Move/Copy logic: User requested moving/setting up .env in parent dir
    if [ ! -f "../.env" ]; then
        echo "   Creating ../.env from .env.example"
        cp .env.example ../.env
    else
        echo "   ../.env already exists. Skipping creation."
    fi
else
    echo "⚠️ .env.example not found in current directory!"
fi

# 7. Setup Valet Link for CNDQ_localroot
# We want the URL to be http://cndq.test/CNDQ/
# So we need to link the PARENT directory (CNDQ_localroot) as 'cndq'
echo "🔗 Configuring Valet link..."
cd ..
valet link cndq
valet secure cndq
cd CNDQ

echo "✅ Setup Complete!"
echo "🌐 Open https://cndq.test/CNDQ/ to view the application."
echo "ℹ️  Authentication is handled via dev.php in local development."
