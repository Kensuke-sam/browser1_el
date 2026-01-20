#!/bin/bash

# Zen Browser Rust Migration Setup Script

echo "=== Zen Browser - Rust Migration Setup ==="
echo ""

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "Rust is not installed. Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
else
    echo "✓ Rust is already installed"
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "⚠ Node.js is not installed. Please install Node.js 18+ first."
    echo "Visit: https://nodejs.org/"
    exit 1
else
    echo "✓ Node.js is installed: $(node --version)"
fi

# Install frontend dependencies
echo ""
echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo ""
echo "=== Setup Complete! ==="
echo ""
echo "Next steps:"
echo "1. Run 'cargo check --workspace' to verify Rust code"
echo "2. Run 'cd frontend && npm run dev' to start frontend dev server"
echo "3. Run 'cargo tauri dev' to launch the application"
echo ""
