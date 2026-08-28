'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import FlightList from './components/FlightList';
import { Aircraft } from './components/MapComponent';

const MapComponent = dynamic(() => import('./components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
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
      {/* Header with single counter */}
      <header className="bg-blue-600 text-white shadow-lg flex-shrink-0">
        <div className="p-3 md:p-4 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg md:text-2xl font-bold truncate">ADS-B Warszawa</h1>
            <p className="text-xs md:text-sm opacity-90 hidden md:block">Mapa lotów wokół EPWA (80 NM)</p>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-2xl md:text-3xl font-bold">{aircraft.length}</div>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-red-100 border-b border-red-400 text-red-700 px-3 py-2 text-center text-sm flex-shrink-0">
          <span className="font-semibold">Błąd:</span> {error}
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* Map - fills remaining space on desktop, ~55vh on mobile */}
        <div className="flex-1 min-h-0 min-w-0 h-[55vh] md:h-full">
          <MapComponent
            aircraft={aircraft}
            selectedAircraft={selectedAircraft}
            onSelectAircraft={handleSelectAircraft}
          />
        </div>

        {/* List - 340px fixed width on desktop, below map on mobile */}
        <div className="flex-1 md:flex-none md:w-[340px] border-t md:border-t-0 md:border-l border-gray-200 overflow-hidden">
          <FlightList
            aircraft={aircraft}
            selectedAircraft={selectedAircraft}
            onSelectAircraft={handleSelectAircraft}
          />
        </div>
      </div>

      {/* Footer */}
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
