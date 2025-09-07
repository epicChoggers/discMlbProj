#!/usr/bin/env node

// Local Production Simulation Script
// This script helps you test the production caching system locally

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('🧪 MLB Caching System - Local Production Simulation\n')

// Check if .env file exists
const envPath = path.join(process.cwd(), '.env')
const envExamplePath = path.join(process.cwd(), 'env.example')

if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file from env.example...')
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath)
    console.log('✅ .env file created')
  } else {
    console.log('❌ env.example not found')
    process.exit(1)
  }
}

// Read current .env file
let envContent = fs.readFileSync(envPath, 'utf8')

// Update the production mode setting
if (envContent.includes('VITE_FORCE_PRODUCTION_MODE=')) {
  envContent = envContent.replace(
    /VITE_FORCE_PRODUCTION_MODE=.*/,
    'VITE_FORCE_PRODUCTION_MODE=true'
  )
} else {
  envContent += '\n# Production Mode Simulation\nVITE_FORCE_PRODUCTION_MODE=true\n'
}

// Write updated .env file
fs.writeFileSync(envPath, envContent)
console.log('✅ Production mode enabled in .env file')

console.log('\n🚀 Starting development server with production caching...')
console.log('📊 This will simulate the production environment locally')
console.log('🔗 Open http://localhost:3000 to test')
console.log('⚡ API calls will now use the cached endpoint')
console.log('\n📝 To test caching:')
console.log('   1. Open browser dev tools')
console.log('   2. Check Network tab')
console.log('   3. Refresh page multiple times')
console.log('   4. Notice faster response times on subsequent requests')
console.log('\n🛑 Press Ctrl+C to stop\n')

// Start the development server
const devProcess = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true
})

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping development server...')
  
  // Restore original .env file
  if (envContent.includes('VITE_FORCE_PRODUCTION_MODE=true')) {
    envContent = envContent.replace(
      /VITE_FORCE_PRODUCTION_MODE=true/,
      'VITE_FORCE_PRODUCTION_MODE=false'
    )
    fs.writeFileSync(envPath, envContent)
    console.log('✅ Production mode disabled in .env file')
  }
  
  devProcess.kill()
  process.exit(0)
})

devProcess.on('error', (error) => {
  console.error('❌ Error starting development server:', error.message)
  process.exit(1)
})
