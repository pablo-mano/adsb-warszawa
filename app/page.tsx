'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import FlightList from './components/FlightList';
import FlightDetail from './components/FlightDetail';
import { Aircraft } from './components/MapComponent';

const MapComponent = dynamic(() => import('./components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-gray-100">
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
      <header className="bg-blue-600 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">ADS-B Warszawa</h1>
            <p className="text-sm opacity-90">Mapa lotów wokół EPWA (80 NM)</p>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-90">Samolotów w zasięgu:</div>
            <div className="text-3xl font-bold">{aircraft.length}</div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Map - Primary view */}
        <div className="relative flex-1 min-h-0 min-w-0 h-[70vh] lg:h-full">
          {error && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg max-w-md">
              <div className="font-semibold">Błąd</div>
              <div className="text-sm">{error}</div>
            </div>
          )}
          <MapComponent
            aircraft={aircraft}
            selectedAircraft={selectedAircraft}
            onSelectAircraft={handleSelectAircraft}
          />
        </div>

        {/* Sidebar - List and Detail */}
        <div className="flex-shrink-0 w-full lg:w-96 h-[30vh] lg:h-full flex flex-col lg:flex-row border-t lg:border-t-0 lg:border-l border-gray-200 overflow-hidden">
          <div className="flex-1 lg:flex-shrink-0 lg:w-full overflow-y-auto">
            <FlightList
              aircraft={aircraft}
              selectedAircraft={selectedAircraft}
              onSelectAircraft={handleSelectAircraft}
            />
          </div>
          {selectedAircraft && (
            <div className="hidden lg:block lg:w-80 border-l border-gray-200 overflow-y-auto">
              <FlightDetail aircraft={selectedAircraft} />
            </div>
          )}
        </div>
      </div>

      <footer className="bg-gray-100 border-t border-gray-200 p-3 text-center text-sm text-gray-600 flex-shrink-0">
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
