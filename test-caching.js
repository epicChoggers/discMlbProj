// Test script to verify the new caching system works
// Run with: node test-caching.js

const API_BASE = 'http://localhost:3000/api/mlb'

async function testCaching() {
  console.log('🧪 Testing MLB Game State Caching System\n')

  try {
    // Test 1: First request (should fetch from MLB API)
    console.log('📡 Test 1: First request (should fetch from MLB API)')
    const start1 = Date.now()
    const response1 = await fetch(`${API_BASE}/game-state`)
    const data1 = await response1.json()
    const time1 = Date.now() - start1
    
    console.log(`✅ Response time: ${time1}ms`)
    console.log(`✅ Success: ${data1.success}`)
    console.log(`✅ Last updated: ${data1.lastUpdated}`)
    console.log(`✅ Game found: ${data1.game ? 'Yes' : 'No'}`)
    if (data1.game) {
      console.log(`✅ Game status: ${data1.game.status?.abstractGameState}`)
    }
    console.log('')

    // Test 2: Second request (should serve from cache)
    console.log('⚡ Test 2: Second request (should serve from cache)')
    const start2 = Date.now()
    const response2 = await fetch(`${API_BASE}/game-state`)
    const data2 = await response2.json()
    const time2 = Date.now() - start2
    
    console.log(`✅ Response time: ${time2}ms`)
    console.log(`✅ Success: ${data2.success}`)
    console.log(`✅ Last updated: ${data2.lastUpdated}`)
    console.log(`✅ Same timestamp: ${data1.lastUpdated === data2.lastUpdated}`)
    console.log(`✅ Faster response: ${time2 < time1 ? 'Yes' : 'No'}`)
    console.log('')

    // Test 3: Manual cache refresh
    console.log('🔄 Test 3: Manual cache refresh')
    const start3 = Date.now()
    const response3 = await fetch(`${API_BASE}/refresh-cache`, { method: 'POST' })
    const data3 = await response3.json()
    const time3 = Date.now() - start3
    
    console.log(`✅ Response time: ${time3}ms`)
    console.log(`✅ Success: ${data3.success}`)
    console.log(`✅ Message: ${data3.message}`)
    console.log('')

    // Test 4: Request after refresh (should have new timestamp)
    console.log('🆕 Test 4: Request after refresh (should have new timestamp)')
    const start4 = Date.now()
    const response4 = await fetch(`${API_BASE}/game-state`)
    const data4 = await response4.json()
    const time4 = Date.now() - start4
    
    console.log(`✅ Response time: ${time4}ms`)
    console.log(`✅ Success: ${data4.success}`)
    console.log(`✅ Last updated: ${data4.lastUpdated}`)
    console.log(`✅ New timestamp: ${data4.lastUpdated !== data2.lastUpdated}`)
    console.log('')

    console.log('🎉 All tests completed!')
    console.log('\n📊 Performance Summary:')
    console.log(`   First request: ${time1}ms`)
    console.log(`   Cached request: ${time2}ms`)
    console.log(`   Cache refresh: ${time3}ms`)
    console.log(`   Post-refresh: ${time4}ms`)
    console.log(`   Cache speedup: ${Math.round((time1 - time2) / time1 * 100)}%`)

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.log('\n💡 Make sure your development server is running on port 3000')
    console.log('   Run: npm run dev')
  }
}

// Run the test
testCaching()
