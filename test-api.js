// Quick test for the consolidated API
const BASE_URL = 'https://www.choggers.com/api'

async function testAPI() {
  console.log('🧪 Testing consolidated API...\n')
  
  try {
    // Test system health endpoint
    console.log('📍 Testing system health...')
    const healthResponse = await fetch(`${BASE_URL}/game?action=system-health`)
    
    console.log('Status:', healthResponse.status)
    console.log('Headers:', Object.fromEntries(healthResponse.headers.entries()))
    
    const healthText = await healthResponse.text()
    console.log('Raw response:', healthText)
    
    try {
      const healthData = JSON.parse(healthText)
      if (healthResponse.ok) {
        console.log('✅ System health: OK')
        console.log('📊 Response:', JSON.stringify(healthData, null, 2))
      } else {
        console.log('❌ System health failed:', healthData)
      }
    } catch (parseError) {
      console.log('❌ JSON parse error:', parseError.message)
    }
    
    // Test cache stats endpoint
    console.log('\n📍 Testing cache stats...')
    const cacheResponse = await fetch(`${BASE_URL}/game?action=cache-stats`)
    const cacheData = await cacheResponse.json()
    
    if (cacheResponse.ok) {
      console.log('✅ Cache stats: OK')
      console.log('📊 Response:', JSON.stringify(cacheData, null, 2))
    } else {
      console.log('❌ Cache stats failed:', cacheData)
    }
    
  } catch (error) {
    console.log('💥 Error:', error.message)
  }
}

testAPI()
