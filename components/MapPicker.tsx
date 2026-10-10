"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { MUMBAI_ZONES, AIRPORT_TERMINALS, Coordinates } from "@/lib/geo";

interface MapPickerProps {
  terminal: "T1" | "T2";
  selectedZone: string;
  onSelectZone: (zone: string) => void;
  destinationCoords?: Coordinates;
  otherStops?: { name: string; coords: Coordinates; order: number }[];
  height?: string;
}

export default function MapPicker({
  terminal,
  selectedZone,
  onSelectZone,
  destinationCoords,
  otherStops,
  height = "260px",
}: MapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [19.12, 72.88], // Mumbai central
        zoom: 11,
        zoomControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      mapInstanceRef.current = map;
      markersLayerRef.current = L.layerGroup().addTo(map);
    }

    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    const airportCoords = AIRPORT_TERMINALS[terminal].coords;

    // Airport icon
    const airportIcon = L.divIcon({
      className: "custom-airport-pin",
      html: `
        <div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">
          <div class="beacon-pulse" style="position:absolute; width:36px; height:36px; border-radius:50%; background:rgba(255,176,32,0.4); pointer-events:none;"></div>
          <div style="background:#070A12; color:#FFB020; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 0 12px rgba(255,176,32,0.5); border:2px solid #FFB020; font-size:14px; position:relative; z-index:2;">
            ✈
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    L.marker([airportCoords.lat, airportCoords.lng], { icon: airportIcon })
      .bindPopup(`<b>Mumbai Airport (${terminal})</b><br/>Pickup Terminal Hub`)
      .addTo(markersLayer);

    // Zone markers
    const routePoints: [number, number][] = [[airportCoords.lat, airportCoords.lng]];

    Object.values(MUMBAI_ZONES).forEach((zone) => {
      const isSelected = zone.id === selectedZone;
      const pinColor = isSelected ? "#2DE2C4" : "#8A94B2";
      const pinSize = isSelected ? 32 : 22;

      const zoneIcon = L.divIcon({
        className: "custom-zone-pin",
        html: `
          <div style="background:${pinColor}; color:#070A12; width:${pinSize}px; height:${pinSize}px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; box-shadow:0 0 ${isSelected ? "14px #2DE2C4" : "4px rgba(0,0,0,0.5)"}; border:2px solid ${isSelected ? "#FFFFFF" : "#141C30"}; cursor:pointer; transition:transform 0.2s;">
            ${isSelected ? "✓" : "●"}
          </div>
        `,
        iconSize: [pinSize, pinSize],
        iconAnchor: [pinSize / 2, pinSize / 2],
      });

      const marker = L.marker([zone.center.lat, zone.center.lng], { icon: zoneIcon })
        .addTo(markersLayer)
        .on("click", () => {
          onSelectZone(zone.id);
        });

      marker.bindTooltip(`<b>${zone.name}</b>`, {
        permanent: isSelected,
        direction: "top",
      });

      if (isSelected) {
        routePoints.push([zone.center.lat, zone.center.lng]);
      }
    });

    // Render multi-stop route if provided
    if (otherStops && otherStops.length > 0) {
      const sorted = [...otherStops].sort((a, b) => a.order - b.order);
      const fullRoute: [number, number][] = [[airportCoords.lat, airportCoords.lng]];

      sorted.forEach((stop) => {
        fullRoute.push([stop.coords.lat, stop.coords.lng]);

        const stopIcon = L.divIcon({
          className: "custom-stop-pin",
          html: `
            <div style="background:#FFB020; color:#070A12; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:900; box-shadow:0 0 10px rgba(255,176,32,0.6); border:2px solid #070A12;">
              #${stop.order}
            </div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        L.marker([stop.coords.lat, stop.coords.lng], { icon: stopIcon })
          .bindPopup(`<b>Stop #${stop.order}:</b> ${stop.name}`)
          .addTo(markersLayer);
      });

      routeLayerRef.current = L.polyline(fullRoute, {
        color: "#2DE2C4",
        weight: 4,
        opacity: 0.9,
        dashArray: "6, 8",
      }).addTo(map);

      map.fitBounds(L.latLngBounds(fullRoute), { padding: [30, 30] });
    } else if (routePoints.length > 1) {
      // Single glowing route corridor
      routeLayerRef.current = L.polyline(routePoints, {
        color: "#2DE2C4",
        weight: 4,
        opacity: 0.85,
      }).addTo(map);

      map.fitBounds(L.latLngBounds(routePoints), { padding: [40, 40] });
    }

    return () => {
      // Map cleanup on unmount
    };
  }, [terminal, selectedZone, destinationCoords, otherStops, onSelectZone]);

  return (
    <div className="relative rounded-3xl overflow-hidden border border-[var(--surface-border)] shadow-md bg-[var(--surface)]">
      <div ref={mapContainerRef} style={{ width: "100%", height }} />
      <div className="absolute top-3 left-3 z-20 glass-surface px-3 py-1 rounded-xl text-[11px] font-bold text-[var(--text)] shadow-sm border border-[var(--surface-border)] flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
        <span className="font-display">BOM Corridor Radar</span>
      </div>
    </div>
  );
}
