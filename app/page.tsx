'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import FlightList from './components/FlightList';
import { Aircraft } from './components/MapComponent';

const MapComponent = dynamic(() => import('./components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-zinc-100">
      <div className="text-zinc-500">Ładowanie mapy...</div>
    </div>
  ),
});

interface TrailPoint {
  lat: number;
  lon: number;
  ts: number;
}

export default function Home() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trailHistoryRef = useRef<Map<string, TrailPoint[]>>(new Map());

  useEffect(() => {
    const fetchAircraft = async () => {
      try {
        const response = await fetch('/api/aircraft');
        if (!response.ok) {
          throw new Error('Nie udało się pobrać danych');
        }
        const data = await response.json();
        const aircraftData = data.aircraft || [];
        setAircraft(aircraftData);
        setError(null);

        // Update trail history for all aircraft with valid positions
        const now = Math.floor(Date.now() / 1000);
        const oneHourAgo = now - 3600;
        
        aircraftData.forEach((ac: Aircraft) => {
          if (ac.hex && ac.lat != null && ac.lon != null) {
            const history = trailHistoryRef.current.get(ac.hex) || [];
            const ts = ac.ts || now;
            
            // Append new sample
            history.push({ lat: ac.lat, lon: ac.lon, ts });
            
            // Keep only samples from last hour
            const filtered = history.filter(point => point.ts >= oneHourAgo);
            trailHistoryRef.current.set(ac.hex, filtered);
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Wystąpił błąd');
      }
    };

    fetchAircraft();
    const interval = setInterval(fetchAircraft, 2500);

    return () => clearInterval(interval);
  }, []);

  const handleSelectAircraft = (aircraft: Aircraft) => {
    setSelectedAircraft(aircraft);
  };

  return (
    <div className="h-screen flex flex-col bg-zinc-50">
      {/* Thin header bar - title + live count */}
      <header className="bg-white border-b border-zinc-200 flex-shrink-0">
        <div className="px-4 py-2.5 flex items-center justify-between gap-3">
          <h1 className="text-base md:text-lg font-semibold text-gray-900">
            ADS-B Warszawa
          </h1>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
            <span className="text-sm md:text-base font-medium text-gray-900">
              {aircraft.length}
            </span>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 text-red-700 px-4 py-2 text-sm flex-shrink-0">
          <span className="font-medium">Błąd:</span> {error}
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* Map - fills remaining space */}
        <div className="flex-1 min-h-0 min-w-0 h-[55vh] md:h-full">
          <MapComponent
            aircraft={aircraft}
            selectedAircraft={selectedAircraft}
            onSelectAircraft={handleSelectAircraft}
            selectedTrail={selectedAircraft ? trailHistoryRef.current.get(selectedAircraft.hex) || [] : []}
          />
        </div>

        {/* List - quiet card/column, 340px on desktop */}
        <div className="flex-1 md:flex-none md:w-[340px] bg-white md:border-l border-t md:border-t-0 border-zinc-200 overflow-hidden">
          <FlightList
            aircraft={aircraft}
            selectedAircraft={selectedAircraft}
            onSelectAircraft={handleSelectAircraft}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-zinc-200 px-4 py-2 text-center text-xs text-zinc-600 flex-shrink-0">
        Dane z{' '}
        <a
          href="https://adsb.fi/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-900 hover:underline font-medium"
        >
          adsb.fi
        </a>
        {' '}• niekomercyjnie
      </footer>
    </div>
  );
}
