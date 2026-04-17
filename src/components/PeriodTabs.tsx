import { PERIOD_LABEL, type PeriodKey } from '../types'

interface PeriodTabsProps {
  periods: PeriodKey[]
  selected: PeriodKey
  onChange: (period: PeriodKey) => void
}

export function PeriodTabs({ periods, selected, onChange }: PeriodTabsProps) {
  return (
    <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
      {periods.map((period) => (
        <button
          key={period}
          onClick={() => onChange(period)}
          className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-all ${
            selected === period
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {PERIOD_LABEL[period]}
        </button>
      ))}
    </div>
  )
}
