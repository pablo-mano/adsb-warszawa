'use client';

import { Aircraft } from './MapComponent';

interface FlightListProps {
  aircraft: Aircraft[];
  selectedAircraft: Aircraft | null;
  onSelectAircraft: (aircraft: Aircraft) => void;
}

export default function FlightList({ aircraft, selectedAircraft, onSelectAircraft }: FlightListProps) {
  if (aircraft.length === 0) {
    return (
      <div className="h-full overflow-y-auto bg-white">
        <div className="p-4 text-center text-gray-500">
          Brak samolotów w zasięgu
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="divide-y divide-gray-200">
        {aircraft.map((ac) => (
          <div
            key={ac.hex}
            onClick={() => onSelectAircraft(ac)}
            className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
              selectedAircraft?.hex === ac.hex ? 'bg-blue-100 border-l-4 border-blue-600' : ''
            }`}
          >
            <div className="font-semibold text-gray-900 text-sm">
              {ac.callsign || ac.hex}
            </div>
            <div className="text-xs text-gray-600 mt-1 space-y-0.5">
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
  );
}
