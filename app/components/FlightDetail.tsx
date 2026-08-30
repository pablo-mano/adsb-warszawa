'use client';

import { Aircraft } from './MapComponent';
import { typeDisplayName } from '../lib/aircraftTypes';
import { getEmergencyInfo } from '../lib/emergencySquawk';

interface FlightDetailProps {
  aircraft: Aircraft;
  onClose: () => void;
}

export default function FlightDetail({ aircraft, onClose }: FlightDetailProps) {
  const emergencyInfo = getEmergencyInfo(aircraft.squawk);
  
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header with X button */}
      <div className="flex-shrink-0 p-4 border-b border-zinc-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">
              {aircraft.callsign || aircraft.hex.toUpperCase()}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-11 h-11 -mt-1 -mr-1 flex items-center justify-center text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Detail content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Emergency banner */}
        {emergencyInfo && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-sm font-medium text-gray-900">
            {emergencyInfo.code} · {emergencyInfo.description}
          </div>
        )}
        
        <div className="space-y-3">
          <DetailRow label="Hex" value={aircraft.hex.toUpperCase()} />
          <DetailRow label="Rejestracja" value={aircraft.reg} />
          <DetailRow label="Typ" value={typeDisplayName(aircraft.typeCode) || aircraft.typeCode} />
          <DetailRow 
            label="Wysokość" 
            value={aircraft.onGround ? 'Na ziemi' : (aircraft.alt !== undefined ? `${aircraft.alt} ft` : undefined)} 
          />
          <DetailRow 
            label="Wys. geom" 
            value={aircraft.altGeom !== undefined ? `${aircraft.altGeom} ft` : undefined} 
          />
          <DetailRow 
            label="Prędkość" 
            value={aircraft.gs !== undefined ? `${aircraft.gs} kt` : undefined} 
          />
          <DetailRow 
            label="Kurs" 
            value={aircraft.track !== undefined ? `${aircraft.track}°` : undefined} 
          />
          <DetailRow label="Squawk" value={aircraft.squawk} />
          <DetailRow label="Lat / Lon" value={`${aircraft.lat.toFixed(4)} / ${aircraft.lon.toFixed(4)}`} />
          <DetailRow 
            label="Wylot" 
            value={formatAirport(aircraft.originIata, aircraft.originIcao, aircraft.originName)} 
          />
          <DetailRow 
            label="Cel" 
            value={formatAirport(aircraft.destIata, aircraft.destIcao, aircraft.destName)} 
          />
          <DetailRow 
            label="Od EPWA" 
            value={aircraft.dstNm !== undefined ? `${aircraft.dstNm} NM` : undefined} 
          />
          <DetailRow 
            label="Widziano" 
            value={aircraft.seen !== undefined ? `${Math.floor(aircraft.seen)}s temu` : undefined} 
          />
          <DetailRow 
            label="Źródło" 
            value={aircraft.src ? formatSource(aircraft.src) : undefined} 
          />
        </div>
      </div>
    </div>
  );
}

function formatAirport(iata?: string, icao?: string, name?: string): string | undefined {
  const code = iata || icao;
  if (!code && !name) return undefined;
  if (code && name) return `${code} · ${name}`;
  return code || name;
}

function formatSource(src: string): string {
  const lower = src.toLowerCase();
  if (lower.includes('mlat')) {
    return 'MLAT';
  }
  if (lower.includes('adsb')) {
    return 'ADS-B';
  }
  return src;
}

function DetailRow({ label, value }: { label: string; value?: string | number }) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return (
    <div className="flex justify-between py-2 text-sm">
      <span className="text-zinc-600">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
