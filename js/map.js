// Site map inset (Leaflet + Esri World Imagery). Click a feature to fly the 3D view there.
export function initMap(geo, { onPick }) {
  const box = document.getElementById('minimap');
  const toggle = document.getElementById('mini-toggle');
  if (matchMedia('(max-width: 820px)').matches) { box.classList.add('collapsed'); toggle.textContent = '+'; toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Show map'); }
  toggle.addEventListener('click', () => {
    const c = box.classList.toggle('collapsed');
    toggle.textContent = c ? '+' : '–'; toggle.setAttribute('aria-expanded', String(!c)); toggle.setAttribute('aria-label', c ? 'Show map' : 'Hide map');
    if (!c) setTimeout(() => map.invalidateSize(), 50);
  });
  if (!window.L) { document.getElementById('map').textContent = 'Map unavailable'; return { setFocus() {} }; }

  const ll = (p) => [p[1], p[0]];
  const map = L.map('map', { zoomControl: false, attributionControl: true, scrollWheelZoom: true }).setView([34.684, 33.275], 13);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18, attribution: '© Esri, Maxar',
  }).addTo(map);
  map.attributionControl.setPrefix(false);

  L.polygon(geo.corridor_ll.map(ll), { color: '#eef5f7', weight: 1, dashArray: '4 4', fillOpacity: .06 }).addTo(map);
  const route = L.polyline(geo.route_ll.map(ll), { color: '#1a8fd1', weight: 3 }).addTo(map);
  route.on('click', () => onPick('pipeline'));
  const icon = (cls) => L.divIcon({ className: '', html: `<div class="map-pin ${cls}"></div>`, iconSize: [14, 14], iconAnchor: [7, 7] });
  L.marker(ll(geo.station.ll), { icon: icon(''), title: 'Shore station' }).addTo(map).on('click', () => onPick('station'));
  L.marker(ll(geo.route_ll[0]), { icon: icon(''), title: 'Landfall' }).addTo(map).on('click', () => onPick('landfall'));
  L.marker(ll(geo.tanks.Manifold.ll), { icon: icon('tank'), title: 'Storage tanks' }).addTo(map).on('click', () => onPick('tanks'));
  map.fitBounds(route.getBounds(), { padding: [12, 12] });

  const focus = L.marker([0, 0], { icon: L.divIcon({ className: '', html: '<div class="map-pin focus"></div>', iconSize: [10, 10], iconAnchor: [5, 5] }), interactive: false, keyboard: false }).addTo(map);
  return {
    setFocus(lat, lon) { focus.setLatLng([lat, lon]); },
    invalidate() { map.invalidateSize(); },
  };
}
