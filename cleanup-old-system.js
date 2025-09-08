#!/usr/bin/env node

/**
 * Cleanup Script: Remove Old System Files and References
 * 
 * This script removes all old proxy-based API files and updates references to use the new system.
 * Run this script after successful migration to clean up the old system.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Files to delete (old system)
const filesToDelete = [
  // Old API endpoints
  'api/mlb/schedule.ts',
  'api/mlb/game.ts',
  'api/mlb/live.ts',
  'api/mlb/game-state.ts',
  'api/mlb/refresh-cache.ts',
  'api/mlb/game/[gamePk].ts',
  'api/mlb/live/[gamePk].ts',
  
  // Old service files (after migration)
  'src/lib/mlbService.ts',
  'src/lib/predictionService.ts',
  'src/lib/leaderboardService.ts',
  'src/lib/useGameState.ts',
  'src/lib/useRealtimePredictions.ts',
  
  // Old documentation
  'CACHING_IMPLEMENTATION.md',
  
  // Old test files
  'test-api-endpoints.js',
  'test-caching.js',
  'test-mlb-service.js',
  'test-new-outcomes.js',
  'test-pacific-fix.js',
  'test-production-local.js',
  'test-scoring-simple.js',
  'test-scoring.js',
  'test-timezone.js'
]

// Directories to remove if empty
const directoriesToCheck = [
  'api/mlb',
  'api/mlb/game',
  'api/mlb/live'
]

// Files to update (remove old references)
const filesToUpdate = [
  'src/components/GameState.tsx',
  'src/components/PredictionForm.tsx',
  'src/components/PredictionResults.tsx',
  'src/components/Leaderboard.tsx',
  'src/components/UserProfile.tsx',
  'src/components/DebugPredictions.tsx',
  'src/App.tsx'
]

// Old import patterns to replace
const oldImportPatterns = [
  { from: './mlbService', to: './mlbServiceNew' },
  { from: './predictionService', to: './predictionServiceNew' },
  { from: './leaderboardService', to: './leaderboardServiceNew' },
  { from: './useGameState', to: './useGameStateNew' },
  { from: './useRealtimePredictions', to: './useRealtimePredictionsNew' }
]

// Old service usage patterns to replace
const oldServicePatterns = [
  { from: 'mlbService', to: 'mlbServiceNew' },
  { from: 'predictionService', to: 'predictionServiceNew' },
  { from: 'leaderboardService', to: 'leaderboardServiceNew' },
  { from: 'useGameState', to: 'useGameStateNew' },
  { from: 'useRealtimePredictions', to: 'useRealtimePredictionsNew' }
]

let deletedFiles = 0
let updatedFiles = 0
let errors = []

function log(message, type = 'info') {
  const timestamp = new Date().toISOString()
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️'
  console.log(`${prefix} [${timestamp}] ${message}`)
}

function deleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      log(`Deleted: ${filePath}`, 'success')
      return true
    } else {
      log(`File not found: ${filePath}`, 'warning')
      return false
    }
  } catch (error) {
    log(`Error deleting ${filePath}: ${error.message}`, 'error')
    errors.push(`Failed to delete ${filePath}: ${error.message}`)
    return false
  }
}

function updateFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      log(`File not found: ${filePath}`, 'warning')
      return false
    }

    let content = fs.readFileSync(filePath, 'utf8')
    let updated = false

    // Update imports
    oldImportPatterns.forEach(({ from, to }) => {
      const oldPattern = new RegExp(`from '${from.replace('./', '')}'`, 'g')
      if (content.includes(from)) {
        content = content.replace(oldPattern, `from '${to.replace('./', '')}'`)
        updated = true
        log(`Updated import: ${from} → ${to}`, 'success')
      }
    })

    // Update service usage
    oldServicePatterns.forEach(({ from, to }) => {
      const oldPattern = new RegExp(`\\b${from}\\b`, 'g')
      if (content.includes(from)) {
        content = content.replace(oldPattern, to)
        updated = true
        log(`Updated service usage: ${from} → ${to}`, 'success')
      }
    })

    if (updated) {
      // Create backup
      const backupPath = `${filePath}.backup`
      fs.writeFileSync(backupPath, fs.readFileSync(filePath))
      log(`Created backup: ${backupPath}`)

      // Write updated content
      fs.writeFileSync(filePath, content)
      log(`Updated: ${filePath}`, 'success')
      return true
    } else {
      log(`No changes needed: ${filePath}`, 'info')
      return false
    }
  } catch (error) {
    log(`Error updating ${filePath}: ${error.message}`, 'error')
    errors.push(`Failed to update ${filePath}: ${error.message}`)
    return false
  }
}

function removeEmptyDirectory(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath)
      if (files.length === 0) {
        fs.rmdirSync(dirPath)
        log(`Removed empty directory: ${dirPath}`, 'success')
        return true
      } else {
        log(`Directory not empty: ${dirPath}`, 'warning')
        return false
      }
    }
    return false
  } catch (error) {
    log(`Error removing directory ${dirPath}: ${error.message}`, 'error')
    errors.push(`Failed to remove directory ${dirPath}: ${error.message}`)
    return false
  }
}

function cleanupOldSystem() {
  log('🧹 Starting cleanup of old system...')
  
  console.log('\n' + '='.repeat(60))
  console.log('DELETING OLD FILES')
  console.log('='.repeat(60))
  
  // Delete old files
  filesToDelete.forEach(filePath => {
    if (deleteFile(filePath)) {
      deletedFiles++
    }
  })
  
  console.log('\n' + '='.repeat(60))
  console.log('REMOVING EMPTY DIRECTORIES')
  console.log('='.repeat(60))
  
  // Remove empty directories
  directoriesToCheck.forEach(dirPath => {
    removeEmptyDirectory(dirPath)
  })
  
  console.log('\n' + '='.repeat(60))
  console.log('UPDATING REFERENCES')
  console.log('='.repeat(60))
  
  // Update file references
  filesToUpdate.forEach(filePath => {
    if (updateFile(filePath)) {
      updatedFiles++
    }
  })
  
  // Print summary
  console.log('\n' + '='.repeat(60))
  console.log('CLEANUP SUMMARY')
  console.log('='.repeat(60))
  
  log(`Files deleted: ${deletedFiles}`)
  log(`Files updated: ${updatedFiles}`)
  log(`Errors: ${errors.length}`)
  
  if (errors.length > 0) {
    console.log('\n❌ Errors encountered:')
    errors.forEach(error => {
      console.log(`   - ${error}`)
    })
  }
  
  if (errors.length === 0) {
    log('\n🎉 Cleanup completed successfully!', 'success')
    log('\n📋 Next steps:')
    log('   1. Test your application to ensure everything works')
    log('   2. Check for any TypeScript errors')
    log('   3. Run your tests to verify functionality')
    log('   4. If everything works, you can delete the backup files')
    log('   5. Commit your changes to version control')
  } else {
    log('\n⚠️  Cleanup completed with errors. Please review the issues above.', 'warning')
  }
}

// Run the cleanup
cleanupOldSystem()

export { deleteFile, updateFile, removeEmptyDirectory }
