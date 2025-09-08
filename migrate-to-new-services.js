#!/usr/bin/env node

/**
 * Migration Script: Old Services to New Services
 * 
 * This script helps migrate from the old proxy-based services to the new unified API services.
 * Run this script to update your codebase to use the new services.
 */

const fs = require('fs')
const path = require('path')

// Files to update
const filesToUpdate = [
  'src/lib/mlbService.ts',
  'src/lib/predictionService.ts', 
  'src/lib/leaderboardService.ts',
  'src/lib/useGameState.ts',
  'src/lib/useRealtimePredictions.ts'
]

// Service mappings
const serviceMappings = {
  'mlbService': 'mlbServiceNew',
  'predictionService': 'predictionServiceNew',
  'leaderboardService': 'leaderboardServiceNew',
  'useGameState': 'useGameStateNew',
  'useRealtimePredictions': 'useRealtimePredictionsNew'
}

// Import mappings
const importMappings = {
  './mlbService': './mlbServiceNew',
  './predictionService': './predictionServiceNew',
  './leaderboardService': './leaderboardServiceNew',
  './useGameState': './useGameStateNew',
  './useRealtimePredictions': './useRealtimePredictionsNew'
}

function updateFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`)
      return false
    }

    let content = fs.readFileSync(filePath, 'utf8')
    let updated = false

    // Update imports
    Object.entries(importMappings).forEach(([oldImport, newImport]) => {
      const oldPattern = new RegExp(`from '${oldImport.replace('./', '')}'`, 'g')
      if (content.includes(oldImport)) {
        content = content.replace(oldPattern, `from '${newImport.replace('./', '')}'`)
        updated = true
        console.log(`✅ Updated import: ${oldImport} → ${newImport}`)
      }
    })

    // Update service usage
    Object.entries(serviceMappings).forEach(([oldService, newService]) => {
      const oldPattern = new RegExp(`\\b${oldService}\\b`, 'g')
      if (content.includes(oldService)) {
        content = content.replace(oldPattern, newService)
        updated = true
        console.log(`✅ Updated service usage: ${oldService} → ${newService}`)
      }
    })

    if (updated) {
      // Create backup
      const backupPath = `${filePath}.backup`
      fs.writeFileSync(backupPath, fs.readFileSync(filePath))
      console.log(`📁 Created backup: ${backupPath}`)

      // Write updated content
      fs.writeFileSync(filePath, content)
      console.log(`✅ Updated: ${filePath}`)
      return true
    } else {
      console.log(`ℹ️  No changes needed: ${filePath}`)
      return false
    }
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message)
    return false
  }
}

function main() {
  console.log('🚀 Starting migration to new services...\n')

  let updatedFiles = 0
  let totalFiles = filesToUpdate.length

  filesToUpdate.forEach(filePath => {
    console.log(`\n📝 Processing: ${filePath}`)
    if (updateFile(filePath)) {
      updatedFiles++
    }
  })

  console.log(`\n📊 Migration Summary:`)
  console.log(`   Files processed: ${totalFiles}`)
  console.log(`   Files updated: ${updatedFiles}`)
  console.log(`   Files unchanged: ${totalFiles - updatedFiles}`)

  if (updatedFiles > 0) {
    console.log(`\n✅ Migration completed successfully!`)
    console.log(`\n📋 Next steps:`)
    console.log(`   1. Test your application to ensure everything works`)
    console.log(`   2. Check for any TypeScript errors`)
    console.log(`   3. Run your tests to verify functionality`)
    console.log(`   4. If everything works, you can delete the backup files`)
    console.log(`   5. Eventually remove the old service files`)
  } else {
    console.log(`\nℹ️  No files needed updating.`)
  }

  console.log(`\n🔧 Manual steps you may need to do:`)
  console.log(`   - Update any custom components that import the old services`)
  console.log(`   - Update any test files that reference the old services`)
  console.log(`   - Check for any hardcoded service names in your code`)
  console.log(`   - Update your environment variables if needed`)
}

// Run the migration
if (require.main === module) {
  main()
}

module.exports = { updateFile, serviceMappings, importMappings }
