'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, Polyline, Circle, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { colorByAlt, getAltitudeLegendGradient } from '../lib/colorByAlt';
import { typeDisplayName } from '../lib/aircraftTypes';

export interface Aircraft {
  hex: string;
  callsign?: string;
  lat: number;
  lon: number;
  alt?: number;
  altGeom?: number;
  track?: number;
  gs?: number;
  ts?: number;
  onGround: boolean;
  squawk?: string;
  reg?: string;
  typeCode?: string;
  src?: string;
  seen?: number;
  dstNm?: number;
}

interface TrailPoint {
  lat: number;
  lon: number;
  ts: number;
  alt: number | null;
}

interface MapComponentProps {
  aircraft: Aircraft[];
  selectedAircraft: Aircraft | null;
  onSelectAircraft: (aircraft: Aircraft) => void;
  selectedTrail: TrailPoint[];
  trailHistory: Map<string, TrailPoint[]>;
}

interface LabelControlProps {
  isMobile: boolean;
  labelsEnabled: boolean;
  onToggle: () => void;
}

// Compute heading from two lat/lon points (returns degrees, 0° = north)
function computeHeading(lat1: number, lon1: number, lat2: number, lon2: number): number | null {
  // Skip if points are identical (zero distance)
  if (lat1 === lat2 && lon1 === lon2) {
    return null;
  }
  
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  
  return (θ * 180 / Math.PI + 360) % 360;
}

// Calculate heading for aircraft from trail points
// Uses last segment if 2 points, or average of last 2 segments if ≥3 points
function calculateAircraftHeading(points: TrailPoint[]): number | null {
  if (points.length < 2) {
    return null;
  }
  
  if (points.length === 2) {
    // Just use the last segment
    return computeHeading(points[0].lat, points[0].lon, points[1].lat, points[1].lon);
  }
  
  // ≥3 points: average of last TWO segments
  const len = points.length;
  const heading1 = computeHeading(
    points[len - 3].lat, points[len - 3].lon,
    points[len - 2].lat, points[len - 2].lon
  );
  const heading2 = computeHeading(
    points[len - 2].lat, points[len - 2].lon,
    points[len - 1].lat, points[len - 1].lon
  );
  
  if (heading1 === null && heading2 === null) {
    return null;
  }
  if (heading1 === null) return heading2;
  if (heading2 === null) return heading1;
  
  // Average two headings (handling wrap-around)
  let diff = heading2 - heading1;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  
  return (heading1 + diff / 2 + 360) % 360;
}

// Guard Leaflet usage for SSR/first load
function aircraftIconSize(isMobile: boolean, isSelected: boolean, zoom: number): number {
  // Shrink markers when zoomed out so they don't cover whole regions
  let base: number;
  if (zoom <= 6) {
    base = isMobile ? 12 : 14;
  } else if (zoom <= 7) {
    base = isMobile ? 16 : 18;
  } else if (zoom <= 8) {
    base = isMobile ? 20 : 24;
  } else {
    // Mobile <768: 24px default; desktop: 32px
    base = isMobile ? 24 : 32;
  }
  if (isSelected) {
    base += 8;
  }
  return base;
}

const createAircraftIcon = (
  rotation: number = 0, 
  isSelected: boolean = false, 
  isMobile: boolean = false,
  label: string | null = null,
  zoom: number = 9
) => {
  try {
    // Dynamic import L only on client
    const L = require('leaflet');
    
    const size = aircraftIconSize(isMobile, isSelected, zoom);
    const anchor = size / 2; // Center anchor
    
    // Label styling
    const labelFontSize = isMobile ? '10px' : '11px';
    const labelStyle = label 
      ? `position: absolute; left: ${size + 4}px; top: 50%; transform: translateY(-50%); 
         font-size: ${labelFontSize}; font-family: system-ui, -apple-system, sans-serif; 
         color: #18181b; font-weight: 500; white-space: nowrap; pointer-events: none;
         text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff,
                      -2px 0 0 #fff, 2px 0 0 #fff, 0 -2px 0 #fff, 0 2px 0 #fff;`
      : '';
    
    // Twemoji airplane glyph (U+2708) - faces upper-right / NE at 0°
    // Wrap in a container div with position:relative so label can be absolutely positioned
    const html = `
      <div style="position: relative; width: ${size}px; height: ${size}px;">
        <img src="/twemoji-2708.svg" width="${size}" height="${size}" 
             style="transform: rotate(${rotation}deg); transform-origin: center center; display: block;" alt="✈" />
        ${label ? `<span style="${labelStyle}">${label}</span>` : ''}
      </div>
    `;
    
    return L.divIcon({
      html: html,
      className: 'aircraft-marker',
      iconSize: [size, size],
      iconAnchor: [anchor, anchor],
    });
  } catch (error) {
    console.error('Error creating aircraft icon:', error);
    // Return null will use default marker
    return undefined;
  }
};

// Desktop altitude legend component
function AltitudeLegend() {
  const map = useMap();
  const legendRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!map || typeof window === 'undefined') return;

    try {
      // Dynamic Leaflet Control import
      const L = require('leaflet');
      
      const LegendControl = L.Control.extend({
        onAdd: function() {
          const div = L.DomUtil.create('div', 'altitude-legend');
          legendRef.current = div;
          
          div.style.background = 'white';
          div.style.padding = '6px 8px';
          div.style.borderRadius = '4px';
          div.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
          div.style.fontSize = '11px';
          div.style.fontFamily = 'system-ui, -apple-system, sans-serif';
          
          const gradient = getAltitudeLegendGradient();
          div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="color: #666; font-weight: 500;">0</span>
              <div style="width: 100px; height: 8px; background: ${gradient}; border-radius: 2px;"></div>
              <span style="color: #666; font-weight: 500;">40k</span>
            </div>
          `;
          
          return div;
        }
      });

      const legendControl = new LegendControl({ position: 'bottomleft' });
      legendControl.addTo(map);

      return () => {
        legendControl.remove();
      };
    } catch (error) {
      console.error('Error creating altitude legend:', error);
    }
  }, [map]);

  return null;
}

// Label toggle control component
function LabelControl({ isMobile, labelsEnabled, onToggle }: LabelControlProps) {
  const map = useMap();
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!map || typeof window === 'undefined') return;

    try {
      const L = require('leaflet');
      
      const LabelToggleControl = L.Control.extend({
        onAdd: function() {
          const button = L.DomUtil.create('button', 'label-toggle-control');
          buttonRef.current = button;
          
          // Styling for 44px hit area
          button.style.background = 'white';
          button.style.border = '2px solid rgba(0,0,0,0.2)';
          button.style.borderRadius = '4px';
          button.style.width = '44px';
          button.style.height = '44px';
          button.style.display = 'flex';
          button.style.alignItems = 'center';
          button.style.justifyContent = 'center';
          button.style.cursor = 'pointer';
          button.style.fontSize = '18px';
          button.style.fontWeight = '600';
          button.style.transition = 'background-color 0.15s';
          button.title = 'Etykiety';
          button.innerHTML = '🏷️';
          
          // Prevent map interactions when clicking the button
          L.DomEvent.disableClickPropagation(button);
          L.DomEvent.disableScrollPropagation(button);
          
          button.onclick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
          };
          
          return button;
        }
      });

      const labelControl = new LabelToggleControl({ position: 'topright' });
      labelControl.addTo(map);

      return () => {
        labelControl.remove();
      };
    } catch (error) {
      console.error('Error creating label control:', error);
    }
  }, [map, onToggle, isMobile]);

  // Update button appearance when labelsEnabled changes
  useEffect(() => {
    if (buttonRef.current) {
      if (labelsEnabled) {
        buttonRef.current.style.backgroundColor = '#2563eb';
        buttonRef.current.style.color = 'white';
        buttonRef.current.style.borderColor = '#2563eb';
      } else {
        buttonRef.current.style.backgroundColor = 'white';
        buttonRef.current.style.color = '#3f3f46';
        buttonRef.current.style.borderColor = 'rgba(0,0,0,0.2)';
      }
    }
  }, [labelsEnabled]);

  return null;
}

// Component to track zoom level
function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const handleZoom = () => {
      onZoomChange(map.getZoom());
    };

    // Set initial zoom
    handleZoom();

    map.on('zoomend', handleZoom);
    return () => {
      map.off('zoomend', handleZoom);
    };
  }, [map, onZoomChange]);

  return null;
}

// Component to follow selected aircraft
function FollowSelectedAircraft({
  selectedAircraft,
  suppressFollow,
}: {
  selectedAircraft: Aircraft | null;
  suppressFollow: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (suppressFollow) return;
    if (!map || !selectedAircraft || selectedAircraft.lat == null || selectedAircraft.lon == null) {
      return;
    }

    // Recenter map on selected aircraft, preserving current zoom
    const currentZoom = map.getZoom();
    map.setView([selectedAircraft.lat, selectedAircraft.lon], currentZoom, {
      animate: true,
      duration: 0.25,
    });
  }, [map, selectedAircraft, suppressFollow]);

  return null;
}

// User location types
type LocationStatus = 'idle' | 'pending' | 'granted' | 'error';

interface UserLocation {
  lat: number;
  lon: number;
  accuracy: number;
}

interface LocateControlProps {
  onLocationUpdate: (location: UserLocation | null) => void;
  onStatusChange: (status: LocationStatus) => void;
  isMobile: boolean;
}

function LocateControl({ onLocationUpdate, onStatusChange, isMobile }: LocateControlProps) {
  const map = useMap();
  const [status, setStatus] = useState<LocationStatus>('idle');
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const statusRef = useRef<LocationStatus>('idle');
  const handleLocateRef = useRef<() => void>(() => {});
  const [controlMounted, setControlMounted] = useState(false);

  const updateStatus = useCallback((newStatus: LocationStatus) => {
    statusRef.current = newStatus;
    setStatus(newStatus);
    onStatusChange(newStatus);
  }, [onStatusChange]);

  const handleLocate = useCallback(() => {
    if (statusRef.current === 'pending') return;

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      onLocationUpdate(null);
      updateStatus('error');
      return;
    }

    updateStatus('pending');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: UserLocation = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : 50,
        };
        onLocationUpdate(location);
        updateStatus('granted');

        // One-shot center on the user at a 5 km range (center → nearer map edge).
        const LOCATE_RANGE_M = 5000;
        const size = map.getSize();
        const minPx = Math.max(Math.min(size.x, size.y), 1);
        const metersPerPixelAtZoom0 = 156543.03392 * Math.cos((location.lat * Math.PI) / 180);
        const targetMpp = (LOCATE_RANGE_M * 2) / minPx;
        const zoom = Math.log2(metersPerPixelAtZoom0 / targetMpp);
        map.setView([location.lat, location.lon], zoom, { animate: true });
      },
      (error) => {
        console.error('Geolocation error:', error);
        onLocationUpdate(null);
        updateStatus('error');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [updateStatus, onLocationUpdate, map]);

  handleLocateRef.current = handleLocate;

  useEffect(() => {
    if (!map || typeof window === 'undefined') return;

    try {
      const L = require('leaflet');

      const LocateControlClass = L.Control.extend({
        onAdd: function() {
          const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
          const button = L.DomUtil.create('button', 'locate-control-button', container);
          buttonRef.current = button as HTMLButtonElement;
          button.type = 'button';
          button.setAttribute('aria-label', 'Pokaż moją lokalizację');

          // 44px on mobile (390px viewport), 34px on desktop
          const size = isMobile ? 44 : 34;
          button.style.width = `${size}px`;
          button.style.height = `${size}px`;
          button.style.background = 'white';
          button.style.border = 'none';
          button.style.borderRadius = '4px';
          button.style.cursor = 'pointer';
          button.style.display = 'flex';
          button.style.alignItems = 'center';
          button.style.justifyContent = 'center';
          button.style.padding = '0';
          button.style.transition = 'background-color 0.2s';

          L.DomEvent.disableClickPropagation(button);
          L.DomEvent.disableScrollPropagation(button);
          L.DomEvent.on(button, 'click', (e: Event) => {
            L.DomEvent.preventDefault(e);
            handleLocateRef.current();
          });

          return container;
        },
        onRemove: function() {
          if (buttonRef.current) {
            L.DomEvent.off(buttonRef.current, 'click');
          }
        }
      });

      const control = new LocateControlClass({ position: 'topright' });
      control.addTo(map);
      setControlMounted(true);

      return () => {
        setControlMounted(false);
        control.remove();
      };
    } catch (error) {
      console.error('Error creating locate control:', error);
    }
  }, [map, isMobile]);

  // Update button appearance based on status without remounting the control
  useEffect(() => {
    if (!buttonRef.current) return;

    const button = buttonRef.current;
    const iconSize = isMobile ? 22 : 18;

    button.innerHTML = '';

    if (status === 'error') {
      button.style.backgroundColor = '#fee2e2';
      button.disabled = false;
      button.title = 'Brak zgody na lokalizację';
      button.setAttribute('aria-label', 'Brak zgody na lokalizację');
      button.innerHTML = `<img src="/locate-icon.svg" width="${iconSize}" height="${iconSize}" style="filter: invert(15%) sepia(89%) saturate(5074%) hue-rotate(356deg) brightness(87%) contrast(93%);" alt="" />`;
    } else if (status === 'pending') {
      button.style.backgroundColor = '#e5e7eb';
      button.disabled = true;
      button.title = 'Pobieranie lokalizacji...';
      button.setAttribute('aria-label', 'Pobieranie lokalizacji...');
      button.innerHTML = `<img src="/locate-icon.svg" width="${iconSize}" height="${iconSize}" style="filter: grayscale(100%);" alt="" />`;
    } else if (status === 'granted') {
      button.style.backgroundColor = 'white';
      button.disabled = false;
      button.title = 'Odśwież lokalizację';
      button.setAttribute('aria-label', 'Odśwież lokalizację');
      button.innerHTML = `<img src="/locate-icon.svg" width="${iconSize}" height="${iconSize}" style="filter: invert(45%) sepia(88%) saturate(1945%) hue-rotate(202deg) brightness(101%) contrast(93%);" alt="" />`;
    } else {
      button.style.backgroundColor = 'white';
      button.disabled = false;
      button.title = 'Pokaż moją lokalizację';
      button.setAttribute('aria-label', 'Pokaż moją lokalizację');
      button.innerHTML = `<img src="/locate-icon.svg" width="${iconSize}" height="${iconSize}" alt="" />`;
    }
  }, [status, isMobile, controlMounted]);

  return null;
}

function UserLocationLayer({ location }: { location: UserLocation }) {
  const accuracy = Math.max(location.accuracy, 15);

  return (
    <>
      <Circle
        className="user-location-accuracy"
        center={[location.lat, location.lon]}
        radius={accuracy}
        pathOptions={{
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.15,
          weight: 2,
          opacity: 0.55,
        }}
      />
      <CircleMarker
        className="user-location-dot"
        center={[location.lat, location.lon]}
        radius={10}
        pathOptions={{
          color: '#ffffff',
          fillColor: '#3b82f6',
          fillOpacity: 1,
          weight: 3,
          opacity: 1,
        }}
      />
    </>
  );
}

export default function MapComponent({ aircraft, selectedAircraft, onSelectAircraft, selectedTrail, trailHistory }: MapComponentProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [labelsEnabled, setLabelsEnabled] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(6);
  const lastKnownHeadingRef = useRef<Map<string, number>>(new Map());
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [followSuppressed, setFollowSuppressed] = useState(false);

  const handleLocationUpdate = useCallback((location: UserLocation | null) => {
    setUserLocation(location);
    if (location) {
      // Keep follow-selected from yanking the map away from the one-shot GPS pan
      setFollowSuppressed(true);
    }
  }, []);

  const handleStatusChange = useCallback((_status: LocationStatus) => {
    // Status is owned by LocateControl for the button; parent only needs coords.
  }, []);

  const handleSelectAircraft = useCallback((ac: Aircraft) => {
    setFollowSuppressed(false);
    onSelectAircraft(ac);
  }, [onSelectAircraft]);

  useEffect(() => {
    setMounted(true);
    
    // Guard window usage
    if (typeof window === 'undefined') return;
    
    try {
      const checkMobile = () => setIsMobile(window.innerWidth < 768);
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    } catch (error) {
      console.error('Error setting up resize listener:', error);
    }
  }, []);

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-100">
        <div className="text-zinc-500">Ładowanie mapy...</div>
      </div>
    );
  }

  // Show error state if map fails, but don't crash the page
  if (mapError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-100">
        <div className="text-center text-zinc-600 p-4">
          <div className="text-sm font-medium mb-1">Mapa niedostępna</div>
          <div className="text-xs text-zinc-500">Lista lotów działa normalnie</div>
        </div>
      </div>
    );
  }

  try {
    return (
      <MapContainer
        center={[52.1657, 20.9671]}
        zoom={6}
        minZoom={5}
        maxZoom={18}
        style={{ 
          height: isMobile ? '55vh' : '100%',
          minHeight: isMobile ? '320px' : '100%',
          width: '100%' 
        }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Data: <a href="https://adsb.fi/">adsb.fi</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocateControl
          onLocationUpdate={handleLocationUpdate}
          onStatusChange={handleStatusChange}
          isMobile={isMobile}
        />
        {aircraft.map((ac) => {
          try {
            // For selected aircraft: use selectedTrail (API data) when available, otherwise session buffer
            // For all other aircraft: use session buffer
            const isSelected = selectedAircraft?.hex === ac.hex;
            const points = (isSelected && selectedTrail.length >= 2) 
              ? selectedTrail 
              : (trailHistory.get(ac.hex) || []);
            
            let heading: number | null = calculateAircraftHeading(points);
            
            // Store successful heading for fallback
            if (heading !== null) {
              lastKnownHeadingRef.current.set(ac.hex, heading);
            } else {
              // Fallback to last known heading for this hex
              heading = lastKnownHeadingRef.current.get(ac.hex) ?? 0;
            }
            
            // Apply rotation: Twemoji glyph faces upper-right / NE at 0°, so subtract 45°
            const rotation = heading - 45;
            
            // Label logic:
            // - Always show for selected aircraft
            // - For others: only if labelsEnabled AND zoom >= 9
            const shouldShowLabel = isSelected || (labelsEnabled && currentZoom >= 9);
            const labelText = shouldShowLabel ? (ac.callsign || ac.hex) : null;
            
            const icon = createAircraftIcon(rotation, isSelected, isMobile, labelText, currentZoom);
            return (
              <Marker
                key={ac.hex}
                position={[ac.lat, ac.lon]}
                icon={icon}
                eventHandlers={{
                  click: () => {
                    try {
                      handleSelectAircraft(ac);
                    } catch (error) {
                      console.error('Error selecting aircraft:', error);
                    }
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -12]} opacity={0.9}>
                  <div className="text-xs">
                    <div className="font-bold">{ac.callsign || ac.hex}</div>
                    {typeDisplayName(ac.typeCode) && <div>{typeDisplayName(ac.typeCode)}</div>}
                    {ac.alt !== undefined && !ac.onGround && <div>{ac.alt} ft</div>}
                  </div>
                </Tooltip>
              </Marker>
            );
          } catch (error) {
            console.error(`Error rendering marker for ${ac.hex}:`, error);
            return null;
          }
        })}
        {userLocation && <UserLocationLayer location={userLocation} />}
        {selectedAircraft && selectedTrail.length >= 2 && !isMobile && <AltitudeLegend />}
        <ZoomTracker onZoomChange={setCurrentZoom} />
        <LabelControl 
          isMobile={isMobile} 
          labelsEnabled={labelsEnabled} 
          onToggle={() => setLabelsEnabled(!labelsEnabled)} 
        />
        <FollowSelectedAircraft
          selectedAircraft={selectedAircraft}
          suppressFollow={followSuppressed}
        />
        {selectedTrail.length >= 2 && (() => {
          try {
            const positions: [number, number][] = selectedTrail.map(p => [p.lat, p.lon]);
            const lineWeight = isMobile ? 1.5 : 2;
            
            const segments = [];
            for (let i = 0; i < positions.length - 1; i++) {
              const point = selectedTrail[i];
              // Color by altitude of the segment's starting point
              const color = colorByAlt(point.alt);
              
              segments.push(
                <Polyline
                  key={`trail-${i}`}
                  positions={[positions[i], positions[i + 1]]}
                  pathOptions={{
                    color: color,
                    weight: lineWeight,
                    opacity: 1,
                  }}
                />
              );
            }
            return <>{segments}</>;
          } catch (error) {
            console.error('Error rendering trail:', error);
            return null;
          }
        })()}
      </MapContainer>
    );
  } catch (error) {
    console.error('Error rendering map:', error);
    setMapError(error instanceof Error ? error.message : 'Unknown error');
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-100">
        <div className="text-center text-zinc-600 p-4">
          <div className="text-sm font-medium mb-1">Mapa niedostępna</div>
          <div className="text-xs text-zinc-500">Lista lotów działa normalnie</div>
        </div>
      </div>
    );
  }
}
