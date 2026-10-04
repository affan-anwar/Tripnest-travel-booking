import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

const CAR_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>';

const marker = (kind, inner = "") =>
  L.divIcon({ html: `<div class="pin ${kind}">${inner}</div>`, className: "", iconSize: [34, 34], iconAnchor: [17, 17] });

// CARTO map tiles (built on OpenStreetMap) and OSRM road routes: both free and need no API key.
export default function LiveMap({ pickup, drop, driver, height = 360 }) {
  const box = useRef(null);
  const mapRef = useRef(null);
  const carRef = useRef(null);

  useEffect(() => {
    const dark = document.documentElement.dataset.theme === "dark";
    const map = L.map(box.current, { scrollWheelZoom: false });
    mapRef.current = map;
    L.tileLayer(`https://{s}.basemaps.cartocdn.com/${dark ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png`, {
      maxZoom: 19,
      subdomains: "abcd",
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    }).addTo(map);
    L.marker([pickup.lat, pickup.lng], { icon: marker("pickup") }).addTo(map).bindPopup(pickup.name || "Pickup");
    L.marker([drop.lat, drop.lng], { icon: marker("drop") }).addTo(map).bindPopup(drop.name || "Drop");
    map.fitBounds([[pickup.lat, pickup.lng], [drop.lat, drop.lng]], { padding: [48, 48] });
    const straight = L.polyline([[pickup.lat, pickup.lng], [drop.lat, drop.lng]], {
      color: "#b58e4e", weight: 3, dashArray: "6 8",
    }).addTo(map);

    let cancelled = false;
    fetch(`https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${drop.lng},${drop.lat}?overview=full&geometries=geojson`)
      .then((r) => r.json())
      .then((d) => {
        const coords = d.routes?.[0]?.geometry?.coordinates;
        if (!cancelled && coords) {
          map.removeLayer(straight);
          L.polyline(coords.map(([lng, lat]) => [lat, lng]), { color: "#b58e4e", weight: 5, opacity: 0.95 }).addTo(map);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      carRef.current = null;
      map.remove();
    };
  }, [pickup.lat, pickup.lng, drop.lat, drop.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || driver?.lat == null) return;
    if (!carRef.current) {
      carRef.current = L.marker([driver.lat, driver.lng], { icon: marker("car", CAR_SVG), zIndexOffset: 500 })
        .addTo(map).bindPopup("Your driver");
    } else {
      carRef.current.setLatLng([driver.lat, driver.lng]);
    }
  }, [driver?.lat, driver?.lng, pickup.lat, pickup.lng, drop.lat, drop.lng]);

  return <div ref={box} className="map" style={{ height }} />;
}
