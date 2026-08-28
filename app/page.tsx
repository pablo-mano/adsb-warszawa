'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import FlightList from './components/FlightList';
import FlightDetail from './components/FlightDetail';
import { Aircraft } from './components/MapComponent';

const MapComponent = dynamic(() => import('./components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center bg-gray-100" style={{ height: '55vh', minHeight: '320px' }}>
      <div className="text-gray-500">Ładowanie mapy...</div>
    </div>
  ),
});

export default function Home() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAircraft = async () => {
      try {
        const response = await fetch('/api/aircraft');
        if (!response.ok) {
          throw new Error('Nie udało się pobrać danych');
        }
        const data = await response.json();
        setAircraft(data.aircraft || []);
        setError(null);
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
    <div className="h-screen flex flex-col">
      {/* Compact header - single row on mobile, two rows on desktop */}
      <header className="bg-blue-600 text-white shadow-lg flex-shrink-0">
        <div className="p-3 md:p-4 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg md:text-2xl font-bold truncate">ADS-B Warszawa</h1>
            <p className="text-xs md:text-sm opacity-90 hidden md:block">Mapa lotów wokół EPWA (80 NM)</p>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-xs md:text-sm opacity-90 md:block hidden">Samolotów w zasięgu:</div>
            <div className="text-2xl md:text-3xl font-bold">{aircraft.length}</div>
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 text-center text-sm flex-shrink-0">
          <div className="font-semibold">Błąd: {error}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Map - ~55vh on mobile, ~70vh on desktop */}
        <div className="flex-shrink-0">
          <MapComponent
            aircraft={aircraft}
            selectedAircraft={selectedAircraft}
            onSelectAircraft={handleSelectAircraft}
          />
        </div>

        {/* List - takes remaining space (~1/3 on mobile) */}
        <div className="flex-1 border-t border-gray-200 overflow-y-auto bg-white min-h-0">
          <FlightList
            aircraft={aircraft}
            selectedAircraft={selectedAircraft}
            onSelectAircraft={handleSelectAircraft}
          />
        </div>
      </div>

      <footer className="bg-gray-100 border-t border-gray-200 p-2 md:p-3 text-center text-xs md:text-sm text-gray-600 flex-shrink-0">
        Dane z{' '}
        <a
          href="https://adsb.fi/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline font-medium"
        >
          adsb.fi
        </a>
        {' '}• Wyłącznie do użytku niekomercyjnego
      </footer>
    </div>
  );
}
