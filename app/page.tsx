'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import FlightList from './components/FlightList';
import { Aircraft } from './components/MapComponent';
import { getAltitudeLegendGradient } from './lib/colorByAlt';

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
  alt: number | null;
}

export default function Home() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrail, setSelectedTrail] = useState<TrailPoint[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [militaryEnabled, setMilitaryEnabled] = useState<boolean>(false);
  const [militaryHexes, setMilitaryHexes] = useState<Set<string>>(new Set());
  const [militaryLoaded, setMilitaryLoaded] = useState<boolean>(false);
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
            
            // Append new sample (include altitude for coloring)
            history.push({ lat: ac.lat, lon: ac.lon, ts, alt: ac.alt ?? null });
            
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

  useEffect(() => {
    if (!militaryEnabled) {
      setMilitaryLoaded(false);
      return;
    }

    const fetchMilitary = async () => {
      try {
        const response = await fetch('/api/mil');
        if (!response.ok) {
          throw new Error('Military data fetch failed');
        }
        const data = await response.json();
        setMilitaryHexes(new Set(data.hexes || []));
        setMilitaryLoaded(true);
      } catch (err) {
        console.error('Error fetching military data:', err);
        setMilitaryHexes(new Set());
        setMilitaryLoaded(true);
      }
    };

    fetchMilitary();
    const interval = setInterval(fetchMilitary, 45000);

    return () => clearInterval(interval);
  }, [militaryEnabled]);

  useEffect(() => {
    if (!selectedAircraft) {
      setSelectedTrail([]);
      return;
    }

    const fetchTrail = async () => {
      try {
        const now = Math.floor(Date.now() / 1000);
        const from = now - 3600;
        const response = await fetch(`/api/aircraft/${selectedAircraft.hex}/trail?from=${from}`);
        if (!response.ok) {
          throw new Error('Trail fetch failed');
        }
        const data = await response.json();
        const apiPoints = data.points || [];
        
        // If API returns points, use them (DB is source of truth)
        // If API returns empty, fallback to session buffer
        if (apiPoints.length > 0) {
          setSelectedTrail(apiPoints);
        } else {
          const sessionTrail = trailHistoryRef.current.get(selectedAircraft.hex) || [];
          setSelectedTrail(sessionTrail);
        }
      } catch (err) {
        console.error('Error fetching trail:', err);
        // Fallback to session buffer if API fails
        const sessionTrail = trailHistoryRef.current.get(selectedAircraft.hex) || [];
        setSelectedTrail(sessionTrail);
      }
    };

    fetchTrail();
    const interval = setInterval(fetchTrail, 2500);

    return () => clearInterval(interval);
  }, [selectedAircraft]);

  const handleSelectAircraft = (aircraft: Aircraft) => {
    setSelectedAircraft(aircraft);
  };

  // Filter aircraft based on search and military
  const filteredAircraft = aircraft.filter((ac) => {
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        (ac.hex && ac.hex.toLowerCase().includes(query)) ||
        (ac.callsign && ac.callsign.toLowerCase().includes(query)) ||
        (ac.reg && ac.reg.toLowerCase().includes(query)) ||
        (ac.typeCode && ac.typeCode.toLowerCase().includes(query));
      
      if (!matchesSearch) {
        return false;
      }
    }

    // Apply military filter
    if (militaryEnabled && militaryLoaded) {
      if (!militaryHexes.has(ac.hex.toLowerCase())) {
        return false;
      }
    }

    return true;
  });

  // Deselect aircraft if it's no longer in the filtered set
  useEffect(() => {
    if (selectedAircraft && !filteredAircraft.some(ac => ac.hex === selectedAircraft.hex)) {
      setSelectedAircraft(null);
      setSelectedTrail([]);
    }
  }, [filteredAircraft, selectedAircraft]);

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
              {filteredAircraft.length}
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
        {/* Desktop: Map + Sidebar row */}
        {/* Mobile: Map → Toolbar → List column */}
        
        {/* Map - fills remaining space, clipped to its box */}
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
          <MapComponent
            aircraft={filteredAircraft}
            selectedAircraft={selectedAircraft}
            onSelectAircraft={handleSelectAircraft}
            selectedTrail={selectedTrail}
            trailHistory={trailHistoryRef.current}
          />
        </div>

        {/* Mobile Filter Toolbar - between map and list, normal flow */}
        <div className="md:hidden flex-shrink-0 bg-white border-t border-zinc-200">
          <div className="p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Callsign, hex, rej, typ"
                className="flex-1 px-3 py-2 text-sm border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={() => setMilitaryEnabled(!militaryEnabled)}
                className={`flex-shrink-0 px-3 py-2 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
                  militaryEnabled
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                Wojskowe
              </button>
            </div>
          </div>
          {/* Mobile altitude legend - 4px bar when aircraft selected */}
          {selectedAircraft && selectedTrail.length >= 2 && (
            <div 
              style={{ 
                height: '4px', 
                background: getAltitudeLegendGradient() 
              }}
            />
          )}
        </div>

        {/* List - quiet card/column, 340px on desktop */}
        <div className="flex-1 md:flex-none md:w-[340px] bg-white md:border-l border-zinc-200 min-h-0 overflow-hidden">
          <FlightList
            aircraft={filteredAircraft}
            selectedAircraft={selectedAircraft}
            onSelectAircraft={handleSelectAircraft}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            militaryEnabled={militaryEnabled}
            onMilitaryToggle={() => setMilitaryEnabled(!militaryEnabled)}
            militaryLoaded={militaryLoaded}
            hasSearchQuery={searchQuery.trim().length > 0}
            showToolbar={true}
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
