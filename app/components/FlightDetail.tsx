'use client';

import { Aircraft } from './MapComponent';

interface FlightDetailProps {
  aircraft: Aircraft | null;
}

export default function FlightDetail({ aircraft }: FlightDetailProps) {
  if (!aircraft) {
    return (
      <div className="h-full bg-white p-6 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">✈️</div>
          <p>Wybierz samolot, aby zobaczyć szczegóły</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {aircraft.callsign || 'Bez znaku'}
        </h2>
        <div className="text-sm text-gray-500">ICAO: {aircraft.hex.toUpperCase()}</div>
      </div>

      <div className="space-y-4">
        <DetailRow label="Rejestracja" value={aircraft.reg} />
        <DetailRow label="Typ statku" value={aircraft.typeCode} />
        
        <div className="border-t pt-4">
          <h3 className="font-semibold text-gray-900 mb-3">Pozycja</h3>
          <DetailRow label="Szerokość" value={aircraft.lat.toFixed(4)} />
          <DetailRow label="Długość" value={aircraft.lon.toFixed(4)} />
        </div>

        <div className="border-t pt-4">
          <h3 className="font-semibold text-gray-900 mb-3">Lot</h3>
          {aircraft.onGround ? (
            <div className="bg-orange-50 border border-orange-200 rounded p-3 text-orange-800">
              <span className="font-medium">Na ziemi</span>
            </div>
          ) : (
            <>
              <DetailRow 
                label="Wysokość (baro)" 
                value={aircraft.alt !== undefined ? `${aircraft.alt} ft` : undefined} 
              />
              <DetailRow 
                label="Wysokość (geom)" 
                value={aircraft.altGeom !== undefined ? `${aircraft.altGeom} ft` : undefined} 
              />
            </>
          )}
          <DetailRow 
            label="Prędkość naziemna" 
            value={aircraft.gs !== undefined ? `${aircraft.gs} kt` : undefined} 
          />
          <DetailRow 
            label="Kurs" 
            value={aircraft.track !== undefined ? `${aircraft.track}°` : undefined} 
          />
          <DetailRow label="Squawk" value={aircraft.squawk} />
        </div>

        <div className="border-t pt-4">
          <h3 className="font-semibold text-gray-900 mb-3">Techniczne</h3>
          <DetailRow label="Źródło" value={aircraft.src} />
          <DetailRow 
            label="Widziano" 
            value={aircraft.seen !== undefined ? `${aircraft.seen.toFixed(1)}s temu` : undefined} 
          />
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | number }) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return (
    <div className="flex justify-between py-2">
      <span className="text-gray-600">{label}:</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
