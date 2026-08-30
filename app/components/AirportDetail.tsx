'use client';

import AtcPlayer, { type AtcStatus } from './AtcPlayer';
import { EPWA } from '../lib/epwa';

interface AirportDetailProps {
  status: AtcStatus;
  onToggleAtc: () => void;
  onClose: () => void;
}

export default function AirportDetail({ status, onToggleAtc, onClose }: AirportDetailProps) {
  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex-shrink-0 p-4 border-b border-zinc-200">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">{EPWA.icao}</h2>
            <p className="text-sm text-zinc-600 mt-0.5">
              {EPWA.name} · {EPWA.iata}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-11 h-11 -mt-1 -mr-1 flex items-center justify-center text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors"
            aria-label="Zamknij"
          >
            <svg className="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-3">
          <DetailRow label="Miasto" value={EPWA.city} />
          <DetailRow label="ICAO / IATA" value={`${EPWA.icao} / ${EPWA.iata}`} />
          <DetailRow label="Lat / Lon" value={`${EPWA.lat.toFixed(4)} / ${EPWA.lon.toFixed(4)}`} />
        </div>
        <AtcPlayer status={status} onToggle={onToggleAtc} />
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 text-sm">
      <span className="text-zinc-600">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
