'use client';

import { Aircraft } from './MapComponent';

interface FlightListProps {
  aircraft: Aircraft[];
  selectedAircraft: Aircraft | null;
  onSelectAircraft: (aircraft: Aircraft) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  militaryEnabled: boolean;
  onMilitaryToggle: () => void;
  militaryLoaded: boolean;
  hasSearchQuery: boolean;
}

export default function FlightList({ 
  aircraft, 
  selectedAircraft, 
  onSelectAircraft,
  searchQuery,
  onSearchChange,
  militaryEnabled,
  onMilitaryToggle,
  militaryLoaded,
  hasSearchQuery
}: FlightListProps) {
  // Determine empty state message
  let emptyMessage = 'Brak samolotów w zasięgu';
  
  if (hasSearchQuery && aircraft.length === 0) {
    emptyMessage = `Brak lotów dla «${searchQuery}»`;
  } else if (militaryEnabled && militaryLoaded && aircraft.length === 0 && !hasSearchQuery) {
    emptyMessage = 'Brak wojskowych w zasięgu';
  }

  return (
    <div className="h-full flex flex-col">
      {/* Search and Military Controls */}
      <div className="flex-shrink-0 p-3 border-b border-zinc-200 space-y-2">
        {/* Search Input */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Callsign, hex, reg, typ"
          className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        
        {/* Military Chip */}
        <button
          onClick={onMilitaryToggle}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
            militaryEnabled
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
          }`}
        >
          Wojskowe
        </button>
      </div>

      {/* Aircraft List */}
      {aircraft.length === 0 ? (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 text-center text-zinc-500 text-sm">
            {emptyMessage}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-zinc-100">
            {aircraft.map((ac) => (
              <div
                key={ac.hex}
                onClick={() => onSelectAircraft(ac)}
                className={`px-4 py-3 cursor-pointer hover:bg-zinc-50 transition-colors ${
                  selectedAircraft?.hex === ac.hex ? 'bg-blue-50 border-l-2 border-blue-600' : ''
                }`}
              >
                <div className="font-semibold text-gray-900 text-sm">
                  {ac.callsign || ac.hex}
                </div>
                <div className="text-xs text-zinc-600 mt-1 space-y-0.5">
                  {ac.typeCode && <div>{ac.typeCode}</div>}
                  {ac.alt !== undefined && !ac.onGround ? (
                    <div>{ac.alt} ft • {ac.gs || 0} kt</div>
                  ) : ac.onGround ? (
                    <div className="text-orange-600">Na ziemi</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
