#!/usr/bin/env node

/**
 * Test Script for New API Endpoints
 * 
 * This script tests all the new unified API endpoints to ensure they're working correctly.
 * Run this script after deploying to verify the new API is functioning.
 */

import https from 'https'
import http from 'http'

// Configuration
const config = {
  baseUrl: process.env.API_BASE_URL || 'http://[::1]:3000',
  timeout: 10000,
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v')
}

// Test results
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
}

function log(message, type = 'info') {
  const timestamp = new Date().toISOString()
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️'
  console.log(`${prefix} [${timestamp}] ${message}`)
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const isHttps = urlObj.protocol === 'https:'
    const client = isHttps ? https : http
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: config.timeout
    }

    const req = client.request(requestOptions, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {}
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData
          })
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          })
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })

    if (options.body) {
      req.write(JSON.stringify(options.body))
    }

    req.end()
  })
}

async function runTest(testName, testFunction) {
  testResults.total++
  log(`Running test: ${testName}`)
  
  try {
    const startTime = Date.now()
    const result = await testFunction()
    const duration = Date.now() - startTime
    
    testResults.passed++
    testResults.details.push({
      name: testName,
      status: 'passed',
      duration,
      result
    })
    
    log(`✅ ${testName} passed (${duration}ms)`, 'success')
    
    if (config.verbose && result) {
      console.log('   Result:', JSON.stringify(result, null, 2))
    }
  } catch (error) {
    testResults.failed++
    testResults.details.push({
      name: testName,
      status: 'failed',
      error: error.message
    })
    
    log(`❌ ${testName} failed: ${error.message}`, 'error')
    if (config.verbose) {
      console.log('   Error details:', error)
    }
  }
}

// Test functions
async function testGameStateEndpoint() {
  const response = await makeRequest(`${config.baseUrl}/api/game/state`)
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`)
  }
  
  if (!response.data.success) {
    throw new Error(`API returned success: false - ${response.data.error}`)
  }
  
  return {
    hasGame: !!response.data.game,
    hasCurrentAtBat: !!response.data.currentAtBat,
    source: response.data.source,
    lastUpdated: response.data.lastUpdated
  }
}

async function testGameStateWithForceRefresh() {
  const response = await makeRequest(`${config.baseUrl}/api/game/state?forceRefresh=true`)
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`)
  }
  
  if (!response.data.success) {
    throw new Error(`API returned success: false - ${response.data.error}`)
  }
  
  return {
    source: response.data.source,
    forceRefresh: true
  }
}

async function testPredictionsEndpoint() {
  const response = await makeRequest(`${config.baseUrl}/api/game/predictions?gamePk=123`)
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`)
  }
  
  if (!response.data.success) {
    throw new Error(`API returned success: false - ${response.data.error}`)
  }
  
  return {
    predictionsCount: response.data.count,
    hasPredictions: Array.isArray(response.data.predictions)
  }
}

async function testPredictionsWithAtBatIndex() {
  const response = await makeRequest(`${config.baseUrl}/api/game/predictions?gamePk=123&atBatIndex=5`)
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`)
  }
  
  if (!response.data.success) {
    throw new Error(`API returned success: false - ${response.data.error}`)
  }
  
  return {
    gamePk: response.data.gamePk,
    atBatIndex: response.data.atBatIndex,
    predictionsCount: response.data.count
  }
}

async function testLeaderboardEndpoint() {
  const response = await makeRequest(`${config.baseUrl}/api/game/leaderboard`)
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`)
  }
  
  if (!response.data.success) {
    throw new Error(`API returned success: false - ${response.data.error}`)
  }
  
  return {
    totalUsers: response.data.leaderboard.total_users,
    entriesCount: response.data.leaderboard.entries.length,
    hasEntries: Array.isArray(response.data.leaderboard.entries)
  }
}

async function testLeaderboardWithGamePk() {
  const response = await makeRequest(`${config.baseUrl}/api/game/leaderboard?gamePk=123&limit=5`)
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`)
  }
  
  if (!response.data.success) {
    throw new Error(`API returned success: false - ${response.data.error}`)
  }
  
  return {
    gamePk: response.data.gamePk,
    limit: response.data.limit,
    entriesCount: response.data.leaderboard.entries.length
  }
}

async function testSystemHealthEndpoint() {
  const response = await makeRequest(`${config.baseUrl}/api/system/health`)
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`)
  }
  
  if (!response.data.success) {
    throw new Error(`API returned success: false - ${response.data.error}`)
  }
  
  return {
    status: response.data.status,
    services: response.data.services,
    uptime: response.data.uptime,
    version: response.data.version
  }
}

async function testSystemHealthDetailed() {
  const response = await makeRequest(`${config.baseUrl}/api/system/health?detailed=true`)
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`)
  }
  
  if (!response.data.success) {
    throw new Error(`API returned success: false - ${response.data.error}`)
  }
  
  return {
    status: response.data.status,
    hasDetails: !!response.data.services.details,
    servicesCount: response.data.services.total
  }
}

async function testSystemStatsEndpoint() {
  const response = await makeRequest(`${config.baseUrl}/api/system/stats`)
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`)
  }
  
  if (!response.data.success) {
    throw new Error(`API returned success: false - ${response.data.error}`)
  }
  
  return {
    timeframe: response.data.timeframe,
    hasStats: !!response.data.stats,
    statsCategories: Object.keys(response.data.stats)
  }
}

async function testSystemStatsWithTimeframe() {
  const response = await makeRequest(`${config.baseUrl}/api/system/stats?timeframe=1h`)
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`)
  }
  
  if (!response.data.success) {
    throw new Error(`API returned success: false - ${response.data.error}`)
  }
  
  return {
    timeframe: response.data.timeframe,
    expectedTimeframe: '1h'
  }
}

async function testCronStatusEndpoint() {
  const response = await makeRequest(`${config.baseUrl}/api/system/cron`)
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`)
  }
  
  if (!response.data.success) {
    throw new Error(`API returned success: false - ${response.data.error}`)
  }
  
  return {
    hasJobs: !!response.data.jobs,
    jobsCount: Object.keys(response.data.jobs || {}).length,
    hasSystemHealth: !!response.data.systemHealth
  }
}

async function testCorsHeaders() {
  const response = await makeRequest(`${config.baseUrl}/api/game/state`, {
    method: 'OPTIONS'
  })
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200 for OPTIONS request, got ${response.status}`)
  }
  
  const corsHeaders = {
    'access-control-allow-origin': response.headers['access-control-allow-origin'],
    'access-control-allow-methods': response.headers['access-control-allow-methods'],
    'access-control-allow-headers': response.headers['access-control-allow-headers']
  }
  
  return corsHeaders
}

async function testErrorHandling() {
  const response = await makeRequest(`${config.baseUrl}/api/game/predictions`)
  
  if (response.status !== 400) {
    throw new Error(`Expected status 400 for missing gamePk, got ${response.status}`)
  }
  
  return {
    errorHandling: true,
    status: response.status
  }
}

// Main test runner
async function runAllTests() {
  log('🚀 Starting API tests...')
  log(`Base URL: ${config.baseUrl}`)
  log(`Timeout: ${config.timeout}ms`)
  log(`Verbose: ${config.verbose}`)
  
  console.log('\n' + '='.repeat(60))
  console.log('GAME ENDPOINTS')
  console.log('='.repeat(60))
  
  await runTest('Game State Endpoint', testGameStateEndpoint)
  await runTest('Game State with Force Refresh', testGameStateWithForceRefresh)
  await runTest('Predictions Endpoint', testPredictionsEndpoint)
  await runTest('Predictions with At-Bat Index', testPredictionsWithAtBatIndex)
  await runTest('Leaderboard Endpoint', testLeaderboardEndpoint)
  await runTest('Leaderboard with Game PK', testLeaderboardWithGamePk)
  
  console.log('\n' + '='.repeat(60))
  console.log('SYSTEM ENDPOINTS')
  console.log('='.repeat(60))
  
  await runTest('System Health Endpoint', testSystemHealthEndpoint)
  await runTest('System Health Detailed', testSystemHealthDetailed)
  await runTest('System Stats Endpoint', testSystemStatsEndpoint)
  await runTest('System Stats with Timeframe', testSystemStatsWithTimeframe)
  await runTest('Cron Status Endpoint', testCronStatusEndpoint)
  
  console.log('\n' + '='.repeat(60))
  console.log('INTEGRATION TESTS')
  console.log('='.repeat(60))
  
  await runTest('CORS Headers', testCorsHeaders)
  await runTest('Error Handling', testErrorHandling)
  
  // Print summary
  console.log('\n' + '='.repeat(60))
  console.log('TEST SUMMARY')
  console.log('='.repeat(60))
  
  log(`Total Tests: ${testResults.total}`)
  log(`Passed: ${testResults.passed}`, 'success')
  log(`Failed: ${testResults.failed}`, testResults.failed > 0 ? 'error' : 'success')
  
  const successRate = ((testResults.passed / testResults.total) * 100).toFixed(1)
  log(`Success Rate: ${successRate}%`)
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:')
    testResults.details
      .filter(test => test.status === 'failed')
      .forEach(test => {
        console.log(`   - ${test.name}: ${test.error}`)
      })
  }
  
  if (testResults.passed === testResults.total) {
    log('\n🎉 All tests passed! The new API is working correctly.', 'success')
    process.exit(0)
  } else {
    log('\n⚠️  Some tests failed. Please check the issues above.', 'warning')
    process.exit(1)
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
API Test Script

Usage: node test-new-api.js [options]

Options:
  --verbose, -v    Show detailed test results
  --url <url>      Set base URL (default: http://localhost:3000)
  --timeout <ms>   Set request timeout (default: 10000)
  --help, -h       Show this help message

Environment Variables:
  API_BASE_URL     Base URL for the API (overrides --url)

Examples:
  node test-new-api.js
  node test-new-api.js --verbose
  node test-new-api.js --url https://your-app.vercel.app
  API_BASE_URL=https://your-app.vercel.app node test-new-api.js
`)
  process.exit(0)
}

// Run the tests
runAllTests().catch(error => {
  log(`Fatal error: ${error.message}`, 'error')
  process.exit(1)
})

export { runAllTests, makeRequest, config }
