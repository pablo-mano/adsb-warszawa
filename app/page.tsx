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
  const [loading, setLoading] = useState(true);
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
      } finally {
        setLoading(false);
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

      {loading && (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="text-4xl mb-4">✈️</div>
            <div className="text-gray-600">Ładowanie danych...</div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center text-red-600">
            <div className="text-4xl mb-4">⚠️</div>
            <div className="font-semibold">Błąd</div>
            <div className="text-sm mt-2">{error}</div>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="flex-1 flex overflow-hidden">
          <div className="w-80 flex-shrink-0">
            <FlightList
              aircraft={aircraft}
              selectedAircraft={selectedAircraft}
              onSelectAircraft={handleSelectAircraft}
            />
          </div>
          <div className="flex-1">
            <MapComponent
              aircraft={aircraft}
              selectedAircraft={selectedAircraft}
              onSelectAircraft={handleSelectAircraft}
            />
          </div>
          <div className="w-80 flex-shrink-0 border-l border-gray-200">
            <FlightDetail aircraft={selectedAircraft} />
          </div>
        </div>
      )}

      <footer className="bg-gray-100 border-t border-gray-200 p-3 text-center text-sm text-gray-600">
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
