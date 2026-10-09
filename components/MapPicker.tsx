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
      const airportCoords = AIRPORT_TERMINALS[terminal].coords;
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
        <div style="background:#0f172a; color:#fff; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 10px rgba(0,0,0,0.3); border:2px solid #38bdf8;">
          ✈️
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    L.marker([airportCoords.lat, airportCoords.lng], { icon: airportIcon })
      .bindPopup(`<b>Mumbai Airport (${terminal})</b><br/>Pickup Terminal Hub`)
      .addTo(markersLayer);

    // Zone markers
    const routePoints: [number, number][] = [[airportCoords.lat, airportCoords.lng]];

    Object.values(MUMBAI_ZONES).forEach((zone) => {
      const isSelected = zone.id === selectedZone;
      const pinColor = isSelected ? "#0d9488" : "#64748b";
      const pinSize = isSelected ? 30 : 22;

      const zoneIcon = L.divIcon({
        className: "custom-zone-pin",
        html: `
          <div style="background:${pinColor}; color:#fff; width:${pinSize}px; height:${pinSize}px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; box-shadow:0 2px 8px rgba(0,0,0,0.25); border:2px solid white; cursor:pointer;">
            ${isSelected ? "✓" : "📍"}
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
            <div style="background:#f59e0b; color:#fff; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold; box-shadow:0 2px 6px rgba(0,0,0,0.3); border:2px solid white;">
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
        color: "#0d9488",
        weight: 4,
        opacity: 0.85,
        dashArray: "6, 6",
      }).addTo(map);

      map.fitBounds(L.latLngBounds(fullRoute), { padding: [30, 30] });
    } else if (routePoints.length > 1) {
      // Single route line
      routeLayerRef.current = L.polyline(routePoints, {
        color: "#0d9488",
        weight: 4,
        opacity: 0.8,
      }).addTo(map);

      map.fitBounds(L.latLngBounds(routePoints), { padding: [40, 40] });
    }

    return () => {
      // Map cleanup on unmount
    };
  }, [terminal, selectedZone, destinationCoords, otherStops, onSelectZone]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100">
      <div ref={mapContainerRef} style={{ width: "100%", height }} />
      <div className="absolute top-2 left-2 z-20 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-700 shadow-xs border border-slate-200/80 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
        <span>BOM Route Corridor Map</span>
      </div>
    </div>
  );
}
