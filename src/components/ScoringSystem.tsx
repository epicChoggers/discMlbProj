import { AtBatOutcome, getOutcomePoints } from '../lib/types'

export const ScoringSystem = () => {
  const outcomes: AtBatOutcome[] = [
    'home_run', 'triple', 'double', 'single', 'walk', 'strikeout', 'field_out', 'fielders_choice', 'hit_by_pitch', 'field_error', 'sac_fly', 'sac_bunt', 'double_play', 'other_out'
  ]

  const getOutcomeLabel = (outcome: AtBatOutcome): string => {
    const labels: Partial<Record<AtBatOutcome, string>> = {
      'home_run': 'Home Run',
      'triple': 'Triple',
      'double': 'Double',
      'single': 'Single',
      'walk': 'Walk',
      'strikeout': 'Strikeout',
      'field_out': 'Out',
      'fielders_choice': "Fielder's Choice",
      'hit_by_pitch': 'Hit by Pitch',
      'field_error': 'Error',
      'sac_fly': 'Sacrifice Fly',
      'sac_bunt': 'Sacrifice Bunt',
      'double_play': 'Double Play',
      'other_out': 'Other Out'
    }
    return labels[outcome] || outcome
  }

  const getOutcomeEmoji = (outcome: AtBatOutcome): string => {
    const emojis: Partial<Record<AtBatOutcome, string>> = {
      'home_run': '💥',
      'triple': '🏃🏃🏃',
      'double': '🏃🏃',
      'single': '🏃',
      'walk': '🚶',
      'strikeout': '❌',
      'field_out': '⚾',
      'fielders_choice': '🤔',
      'hit_by_pitch': '💢',
      'field_error': '😅',
      'sac_fly': '🙏',
      'sac_bunt': '🙏',
      'double_play': '2️⃣',
      'other_out': '❓'
    }
    return emojis[outcome] || '❓'
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-4">
      <h3 className="text-white text-lg font-semibold mb-4">🎯 Scoring System</h3>
      
      <div className="space-y-4">
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <h4 className="text-blue-300 font-medium mb-2">📊 Exact Predictions</h4>
          <p className="text-gray-300 text-sm mb-3">
            Predict the exact outcome to earn base points + risk bonuses for rare outcomes!
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {outcomes.map((outcome) => {
              const points = getOutcomePoints(outcome)
              return (
                <div key={outcome} className="bg-gray-700 rounded p-2 text-center">
                  <div className="text-lg mb-1">{getOutcomeEmoji(outcome)}</div>
                  <div className="text-xs font-medium text-white mb-1">{getOutcomeLabel(outcome)}</div>
                  <div className="text-xs text-yellow-400 font-bold">
                    {points.withBonus} pts
                    {points.bonusPercent > 0 && (
                      <div className="text-green-400 text-xs">+{points.bonusPercent}%</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
          <h4 className="text-green-300 font-medium mb-2">🎯 Category Predictions</h4>
          <p className="text-gray-300 text-sm mb-3">
            Predict the general category for fewer points but higher accuracy.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-700 rounded p-3 text-center">
              <div className="text-lg mb-1">🏃</div>
              <div className="text-sm font-medium text-white mb-1">Hit</div>
              <div className="text-xs text-yellow-400 font-bold">2 pts</div>
            </div>
            <div className="bg-gray-700 rounded p-3 text-center">
              <div className="text-lg mb-1">⚾</div>
              <div className="text-sm font-medium text-white mb-1">Out</div>
              <div className="text-xs text-yellow-400 font-bold">1 pt</div>
            </div>
            <div className="bg-gray-700 rounded p-3 text-center">
              <div className="text-lg mb-1">🚶</div>
              <div className="text-sm font-medium text-white mb-1">Walk</div>
              <div className="text-xs text-yellow-400 font-bold">3 pts</div>
            </div>
            <div className="bg-gray-700 rounded p-3 text-center">
              <div className="text-lg mb-1">❌</div>
              <div className="text-sm font-medium text-white mb-1">Strikeout</div>
              <div className="text-xs text-yellow-400 font-bold">2 pts</div>
            </div>
          </div>
        </div>

        <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-4">
          <h4 className="text-purple-300 font-medium mb-2">⚡ Risk & Reward</h4>
          <div className="text-gray-300 text-sm space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-green-400">+100% Bonus:</span>
              <span>Home Run</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-blue-400">+80% Bonus:</span>
              <span>Triple</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-blue-400">+50% Bonus:</span>
              <span>Double</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-blue-400">+20% Bonus:</span>
              <span>Single</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">No Bonus:</span>
              <span>Walk, Strikeout, Outs (common outcomes)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
