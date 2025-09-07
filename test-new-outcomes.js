// Test script to verify the new outcome system works correctly
const { getOutcomeCategory, getOutcomePoints } = require('./src/lib/types.ts');

// Test cases for the new outcome system
const testCases = [
  // Hits
  { outcome: 'single', expectedCategory: 'hit', expectedPoints: 5 },
  { outcome: 'double', expectedCategory: 'hit', expectedPoints: 10 },
  { outcome: 'triple', expectedCategory: 'hit', expectedPoints: 15 },
  { outcome: 'home_run', expectedCategory: 'hit', expectedPoints: 20 },
  
  // Walks
  { outcome: 'walk', expectedCategory: 'walk', expectedPoints: 4 },
  { outcome: 'intent_walk', expectedCategory: 'walk', expectedPoints: 4 },
  
  // Strikeouts
  { outcome: 'strikeout', expectedCategory: 'strikeout', expectedPoints: 3 },
  { outcome: 'strike_out', expectedCategory: 'strikeout', expectedPoints: 3 },
  
  // Field Outs
  { outcome: 'field_out', expectedCategory: 'out', expectedPoints: 1 },
  { outcome: 'fielders_choice', expectedCategory: 'out', expectedPoints: 1 },
  { outcome: 'force_out', expectedCategory: 'out', expectedPoints: 1 },
  
  // Sacrifice Plays
  { outcome: 'sac_fly', expectedCategory: 'sacrifice', expectedPoints: 3 },
  { outcome: 'sac_bunt', expectedCategory: 'sacrifice', expectedPoints: 2 },
  
  // Errors
  { outcome: 'field_error', expectedCategory: 'error', expectedPoints: 1 },
  { outcome: 'catcher_interf', expectedCategory: 'error', expectedPoints: 2 },
  
  // Hit by Pitch
  { outcome: 'hit_by_pitch', expectedCategory: 'hit_by_pitch', expectedPoints: 3 },
  
  // Non-at-bat events (should have 0 points)
  { outcome: 'stolen_base', expectedCategory: 'baserunning', expectedPoints: 0 },
  { outcome: 'wild_pitch', expectedCategory: 'baserunning', expectedPoints: 0 },
  { outcome: 'batter_timeout', expectedCategory: 'administrative', expectedPoints: 0 }
];

console.log('Testing new outcome system...\n');

let passed = 0;
let failed = 0;

testCases.forEach(({ outcome, expectedCategory, expectedPoints }) => {
  try {
    const actualCategory = getOutcomeCategory(outcome);
    const actualPoints = getOutcomePoints(outcome).base;
    
    const categoryMatch = actualCategory === expectedCategory;
    const pointsMatch = actualPoints === expectedPoints;
    
    if (categoryMatch && pointsMatch) {
      console.log(`✅ ${outcome}: Category=${actualCategory}, Points=${actualPoints}`);
      passed++;
    } else {
      console.log(`❌ ${outcome}: Expected Category=${expectedCategory}, Points=${expectedPoints}, Got Category=${actualCategory}, Points=${actualPoints}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${outcome}: Error - ${error.message}`);
    failed++;
  }
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('🎉 All tests passed! The new outcome system is working correctly.');
} else {
  console.log('⚠️ Some tests failed. Please check the implementation.');
}
