'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import FlightList from './components/FlightList';
import FlightDetail from './components/FlightDetail';
import FilterPanel, { FilterState } from './components/FilterPanel';
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
  const [filters, setFilters] = useState<FilterState>({
    onGround: false,
    altBand: 'all',
    gsBand: 'all',
    typeCode: ''
  });
  const [filterPanelOpen, setFilterPanelOpen] = useState<boolean>(false);
  const trailHistoryRef = useRef<Map<string, TrailPoint[]>>(new Map());
  const selectedHexRef = useRef<string | null>(null);

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

        // Update selected aircraft with fresh data from ref
        const selectedHex = selectedHexRef.current;
        if (selectedHex) {
          const updated = aircraftData.find((ac: Aircraft) => ac.hex === selectedHex);
          if (updated) {
            setSelectedAircraft(updated);
          } else {
            // Aircraft disappeared, clear selection
            setSelectedAircraft(null);
            setSelectedTrail([]);
            selectedHexRef.current = null;
          }
        }

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
    selectedHexRef.current = aircraft.hex;
  };

  const handleCloseDetail = () => {
    setSelectedAircraft(null);
    setSelectedTrail([]);
    selectedHexRef.current = null;
  };

  // Filter aircraft based on search, military, and filters
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

    // Apply onGround filter
    if (filters.onGround) {
      if (!ac.onGround) {
        return false;
      }
    }

    // Apply altitude band filter (only if not onGround)
    if (!filters.onGround && filters.altBand !== 'all') {
      if (ac.onGround) {
        // Ground aircraft don't match numeric altitude bands
        return false;
      }
      if (ac.alt == null) {
        // Missing altitude doesn't match numeric bands
        return false;
      }
      if (filters.altBand === 'low' && ac.alt >= 10000) {
        return false;
      }
      if (filters.altBand === 'mid' && (ac.alt < 10000 || ac.alt > 30000)) {
        return false;
      }
      if (filters.altBand === 'high' && ac.alt <= 30000) {
        return false;
      }
    }

    // Apply ground speed band filter
    if (filters.gsBand !== 'all') {
      if (ac.gs == null) {
        // Missing gs doesn't match numeric bands
        return false;
      }
      if (filters.gsBand === 'slow' && ac.gs >= 250) {
        return false;
      }
      if (filters.gsBand === 'mid' && (ac.gs < 250 || ac.gs > 450)) {
        return false;
      }
      if (filters.gsBand === 'fast' && ac.gs <= 450) {
        return false;
      }
    }

    // Apply type code filter
    if (filters.typeCode && ac.typeCode !== filters.typeCode) {
      return false;
    }

    return true;
  });

  // Check if selected aircraft is in filtered set
  useEffect(() => {
    if (selectedAircraft && !filteredAircraft.find(ac => ac.hex === selectedAircraft.hex)) {
      // Selected aircraft fell out of filtered set, clear selection
      setSelectedAircraft(null);
      setSelectedTrail([]);
      selectedHexRef.current = null;
    }
  }, [filteredAircraft, selectedAircraft]);

  // Check if any filters are active
  const hasActiveFilters = 
    filters.onGround ||
    filters.altBand !== 'all' ||
    filters.gsBand !== 'all' ||
    filters.typeCode !== '';


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
            onDeselectAircraft={handleCloseDetail}
            selectedTrail={selectedTrail}
            trailHistory={trailHistoryRef.current}
          />
        </div>

        {/* Mobile Filter Toolbar - between map and list, hidden when aircraft selected */}
        {!selectedAircraft && (
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
                <button
                  onClick={() => setFilterPanelOpen(!filterPanelOpen)}
                  className="relative flex-shrink-0 w-11 h-11 flex items-center justify-center text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors"
                  title="Filtry"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 4h16M5 10h10M8 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  {hasActiveFilters && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full"></span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile altitude legend - 4px bar when aircraft selected */}
        {selectedAircraft && selectedTrail.length >= 2 && (
          <div 
            className="md:hidden flex-shrink-0"
            style={{ 
              height: '4px', 
              background: getAltitudeLegendGradient() 
            }}
          />
        )}

        {/* List or Detail - quiet card/column, 340px on desktop */}
        <div className="flex-1 md:flex-none md:w-[340px] bg-white md:border-l border-zinc-200 min-h-0 overflow-hidden relative">
          {selectedAircraft ? (
            <FlightDetail
              aircraft={selectedAircraft}
              onClose={handleCloseDetail}
            />
          ) : (
            <>
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
                hasActiveFilters={hasActiveFilters}
                showToolbar={true}
                onFilterClick={() => setFilterPanelOpen(!filterPanelOpen)}
              />

              {/* Desktop Filter Popover */}
              {filterPanelOpen && (
                <>
                  {/* Backdrop */}
                  <div 
                    className="hidden md:block absolute inset-0 z-40"
                    onClick={() => setFilterPanelOpen(false)}
                  />
                  {/* Popover */}
                  <div className="hidden md:block absolute top-14 right-3 w-[340px] bg-white rounded-lg shadow-xl border border-zinc-200 z-50 max-h-[calc(100vh-200px)]">
                    <FilterPanel
                      filters={filters}
                      onFiltersChange={setFilters}
                      aircraft={aircraft}
                      onClose={() => setFilterPanelOpen(false)}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* Mobile Filter Bottom Sheet - over list only */}
          {filterPanelOpen && !selectedAircraft && (
            <div className="md:hidden absolute inset-0 z-50 flex flex-col">
              <div
                className="absolute inset-0 bg-black/20"
                onClick={() => setFilterPanelOpen(false)}
              />
              <div className="relative z-10 h-full min-h-0 flex flex-col">
                <div className="mt-auto w-full min-h-0 max-h-full overflow-hidden flex flex-col bg-white rounded-t-xl shadow-xl">
                  <FilterPanel
                    filters={filters}
                    onFiltersChange={setFilters}
                    aircraft={aircraft}
                    onClose={() => setFilterPanelOpen(false)}
                  />
                </div>
              </div>
            </div>
          )}
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
