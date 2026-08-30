'use client';

import { Aircraft } from './MapComponent';
import { typeDisplayName } from '../lib/aircraftTypes';

export interface FilterState {
  onGround: boolean;
  altBand: 'all' | 'low' | 'mid' | 'high';
  gsBand: 'all' | 'slow' | 'mid' | 'fast';
  typeCode: string;
}

interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  aircraft: Aircraft[];
  onClose?: () => void;
}

export default function FilterPanel({ 
  filters, 
  onFiltersChange, 
  aircraft,
  onClose 
}: FilterPanelProps) {
  // Get unique type codes from current aircraft
  const uniqueTypes = Array.from(
    new Set(
      aircraft
        .map(ac => ac.typeCode)
        .filter((code): code is string => !!code)
    )
  ).sort();

  return (
    <div className="flex flex-col max-h-full">
      {/* Header for mobile - sticky at top */}
      {onClose && (
        <div className="flex-shrink-0 sticky top-0 bg-white z-10 px-4 pt-4 pb-3 border-b border-zinc-200">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Filtry</h3>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-700 p-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
        {/* Na ziemi toggle */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.onGround}
              onChange={(e) => onFiltersChange({ ...filters, onGround: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-900">Na ziemi</span>
          </label>
        </div>

        {/* Altitude band */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Wysokość
          </label>
          <div className="space-y-1.5">
            {[
              { value: 'all', label: 'Wszystkie' },
              { value: 'low', label: '< 10 000 ft' },
              { value: 'mid', label: '10 000–30 000 ft' },
              { value: 'high', label: '> 30 000 ft' }
            ].map(option => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="altBand"
                  value={option.value}
                  checked={filters.altBand === option.value}
                  onChange={(e) => onFiltersChange({ ...filters, altBand: e.target.value as FilterState['altBand'] })}
                  className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Ground speed band */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Prędkość
          </label>
          <div className="space-y-1.5">
            {[
              { value: 'all', label: 'Wszystkie' },
              { value: 'slow', label: '< 250 kt' },
              { value: 'mid', label: '250–450 kt' },
              { value: 'fast', label: '> 450 kt' }
            ].map(option => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gsBand"
                  value={option.value}
                  checked={filters.gsBand === option.value}
                  onChange={(e) => onFiltersChange({ ...filters, gsBand: e.target.value as FilterState['gsBand'] })}
                  className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Type selector */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Typ
          </label>
          <select
            value={filters.typeCode}
            onChange={(e) => onFiltersChange({ ...filters, typeCode: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Wszystkie</option>
            {uniqueTypes.map(code => (
              <option key={code} value={code}>
                {typeDisplayName(code)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
