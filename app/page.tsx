'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import FlightList from './components/FlightList';
import FlightDetail from './components/FlightDetail';
import { Aircraft } from './components/MapComponent';

const MapComponent = dynamic(() => import('./components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="adsb-map flex items-center justify-center bg-gray-100">
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

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 text-center">
          <div className="font-semibold">Błąd: {error}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Map FIRST in DOM - Primary view */}
        <div className="adsb-map">
          <MapComponent
            aircraft={aircraft}
            selectedAircraft={selectedAircraft}
            onSelectAircraft={handleSelectAircraft}
          />
        </div>

        {/* List below map */}
        <div className="flex-shrink-0 border-t border-gray-200 overflow-y-auto bg-white" style={{ maxHeight: '30vh' }}>
          <FlightList
            aircraft={aircraft}
            selectedAircraft={selectedAircraft}
            onSelectAircraft={handleSelectAircraft}
          />
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
