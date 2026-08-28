'use client';

import { Aircraft } from './MapComponent';

interface FlightListProps {
  aircraft: Aircraft[];
  selectedAircraft: Aircraft | null;
  onSelectAircraft: (aircraft: Aircraft) => void;
}

export default function FlightList({ aircraft, selectedAircraft, onSelectAircraft }: FlightListProps) {
  return (
    <div className="h-full overflow-y-auto bg-white border-r border-gray-200">
      <div className="p-4 bg-blue-600 text-white sticky top-0">
        <h2 className="text-lg font-bold">Loty w zasięgu</h2>
        <p className="text-sm opacity-90">{aircraft.length} samolotów</p>
      </div>
      <div className="divide-y">
        {aircraft.map((ac) => (
          <div
            key={ac.hex}
            onClick={() => onSelectAircraft(ac)}
            className={`p-3 cursor-pointer hover:bg-blue-50 transition-colors ${
              selectedAircraft?.hex === ac.hex ? 'bg-blue-100 border-l-4 border-blue-600' : ''
            }`}
          >
            <div className="font-semibold text-gray-900">
              {ac.callsign || ac.hex}
            </div>
            <div className="text-sm text-gray-600 space-y-1 mt-1">
              {ac.reg && <div>Rej: {ac.reg}</div>}
              {ac.typeCode && <div>Typ: {ac.typeCode}</div>}
              {ac.alt !== undefined && !ac.onGround && (
                <div>Wys: {ac.alt} ft</div>
              )}
              {ac.onGround && (
                <div className="text-orange-600 font-medium">Na ziemi</div>
              )}
              {ac.gs !== undefined && (
                <div>Prędkość: {ac.gs} kt</div>
              )}
            </div>
          </div>
        ))}
        {aircraft.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            Brak samolotów w zasięgu
          </div>
        )}
      </div>
    </div>
  );
}
