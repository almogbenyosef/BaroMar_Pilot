// All visible text and key figures live here, so they can be edited without touching the 3D code.
// Figures come from "BaroMar Intro Snapshot, Nov 2026" (investor material, confidential) and the
// Leonardo Stadler Rev.05 tank drawings. Edit here if the approved numbers change.

export const SITE = {
  title: 'Cyprus Pilot',
  subtitle: 'Underwater compressed-air energy storage at Proteas, Cyprus',
  confidential: 'Confidential & proprietary. Prepared for investors under NDA.',
  // Engineering model of the shore station (GLB, metres, Y up, origin at the pad centre).
  // Leave empty to show the simplified model. Example: 'assets/models/shore_station.glb'
  stationModel: '',
};

export const KEY_FIGURES = [
  { value: '400', unit: 'kWh', label: 'Energy capacity' },
  { value: '300', unit: 'kW', label: 'Max power output' },
  { value: '700', unit: 'm³', label: 'Underwater air volume' },
  { value: '100', unit: 'm', label: 'Deployment depth' },
  { value: '6', unit: 'km', label: 'Subsea pipeline' },
  { value: '10', unit: 'm³', label: 'Thermal energy storage' },
  { value: '500', unit: 'm²', label: 'Onshore facility' },
  { value: 'Q1', unit: '2027', label: 'Pilot readiness target' },
];

// The order follows the path the air takes: from the grid, through the shore station,
// across the shoreline, along the seabed, into the tanks.
export const PARTS = [
  {
    id: 'overview',
    rail: 'Pilot overview',
    title: 'BaroMar Cyprus pilot',
    lead: 'A first-of-a-kind, grid-to-grid demonstration of underwater compressed-air energy storage (UW-CAES), built next to the Cyprus Institute’s PROTEAS research facility near Pentakomo.',
    body: [
      'Surplus electricity runs a compressor on shore. The compressed air travels through a pipeline along the seabed and is stored in rigid tanks 100 m down, where the weight of the sea keeps it at a steady pressure. When power is needed, the air flows back, is reheated, and drives a turboexpander-generator.',
      'The pilot is the minimum viable product that validates the full cycle — thermodynamics, subsea deployment and end-to-end operation — before commercial scale-up.',
    ],
    figures: true,
    images: [
      { src: 'assets/img/station_render.jpg', caption: 'Shore station, design render' },
      { src: 'assets/img/site_location.jpg', caption: 'Pilot location at PROTEAS' },
    ],
    view: 'overview',
  },
  {
    id: 'station',
    rail: 'Shore station',
    title: 'Shore station',
    lead: 'All moving machinery sits on land, on a ~500 m² pad where it can be serviced. Nothing underwater has moving parts.',
    body: [
      'The station holds the compressor, the thermal energy storage that keeps the heat of compression, the two-stage turboexpander-generator, cooling, and the control room that connects the system to the grid.',
      'The 3D model shown here is a simplified layout based on the design render. It will be replaced with the current engineering model.',
    ],
    stats: [['Footprint', '~500 m²'], ['Max output', '300 kW'], ['Heat store', '10 m³']],
    images: [{ src: 'assets/img/station_render.jpg', caption: 'Design render of the shore station' }],
    children: ['compressor', 'tes', 'teg', 'cooling', 'control'],
    view: 'station',
  },
  {
    id: 'landfall',
    rail: 'Landfall',
    title: 'Landfall at White Rocks',
    lead: 'The pipeline leaves the station, crosses the coastal road in a protected crossing and enters the sea at a rocky point south of PROTEAS.',
    body: [
      'On land the pipe is buried in a shallow trench. At the shoreline it is protected against waves and scour before it continues down the slope.',
    ],
    stats: [['Shore to station', '~230 m'], ['Entry point', '34.7059° N, 33.2590° E']],
    images: [
      { src: 'assets/img/site_landfall.jpg', caption: 'Planned pipe entry point (red arrow)' },
      { src: 'assets/img/pipe_entry.jpg', caption: 'Shoreline at the entry point' },
    ],
    view: 'landfall',
  },
  {
    id: 'pipeline',
    rail: 'Subsea pipeline',
    title: 'Subsea pipeline',
    lead: 'A single air line runs about 6 km along the seabed, from the shoreline down to the storage site at 100 m depth.',
    body: [
      'The route follows the licensed marine corridor approved in the 2025 compatibility permit, avoiding steep features found in the multibeam survey. Scour protection holds the pipe in place in the shallow zone.',
      'The pipe is drawn much thicker than it is so it can be seen at this scale.',
    ],
    stats: [['Route length', '~5.7 km (survey route)'], ['Start depth', '0 m'], ['End depth', '~100 m']],
    view: 'pipeline',
  },
  {
    id: 'tanks',
    rail: 'Storage tanks',
    title: 'Underwater storage tanks',
    lead: 'Fourteen steel tubes stand on a ballasted concrete slab on the seabed, about 100 m down. Together they hold roughly 700 m³ of air.',
    body: [
      'The tubes are open to the sea at the bottom. Air pumped in from the top pushes the water out; when air is drawn back, the sea flows in again. Because the sea pressure at 100 m is constant, the air stays at almost the same pressure throughout — which keeps the machinery on shore running at its best point.',
      'Ballast cages filled with rock and the concrete slab hold the structure down against the buoyancy of the stored air.',
    ],
    stats: [['Tubes', '14 × Ø2.5 m × 10.4 m'], ['Air volume', '~700 m³'], ['Slab', '14.3 × 13.4 m octagon'], ['Water pressure', '~11 bar']],
    images: [
      { src: 'assets/img/tank_drawing.jpg', caption: 'Structure, Leonardo Stadler Rev.05 drawings' },
      { src: 'assets/img/tank_concept.jpg', caption: 'Earlier concept render' },
    ],
    tankToggle: true,
    view: 'tanks',
  },
  {
    id: 'seabed',
    rail: 'Seabed survey',
    title: 'Seabed and survey',
    lead: 'The seabed shape comes from the multibeam (MBES) survey of the corridor, extended to the coast with a smooth model.',
    body: [
      'The seabed slopes gently from the shore to about 60 m, then more steeply to about 100 m at the tank site. Turn on the survey layer to see the original colour-coded depth map.',
      'Depth is exaggerated three times so the slope is easy to read.',
    ],
    stats: [['Survey', 'MBES, Survey area B–C'], ['Depth range', '0 – 105 m'], ['Vertical scale', '×3']],
    surveyToggle: true,
    view: 'seabed',
  },
];

// Sub-parts of the shore station (shown as labels when you zoom in).
export const STATION_PARTS = {
  compressor: {
    title: 'Compressor',
    text: 'Electric compressors take surplus electricity from the grid and squeeze air to about 11 bar — the pressure of the sea at the tank depth.',
  },
  tes: {
    title: 'Thermal energy storage',
    text: 'Compressing air makes it hot. Heat exchangers move that heat into insulated water tanks (10 m³) so it can be given back to the air before expansion. This is what lets the cycle approach adiabatic efficiency.',
  },
  teg: {
    title: 'Turboexpander-generator',
    text: 'On discharge, the stored air is reheated and expanded through a two-stage turboexpander that turns a generator, feeding up to 300 kW back to the grid.',
  },
  cooling: {
    title: 'Cooling',
    text: 'A cooling tower and cold-water tank remove the heat that is not stored, keeping air and equipment at working temperature.',
  },
  control: {
    title: 'Control room and grid connection',
    text: 'The control room runs the charge and discharge sequences and connects the station to the grid through the local substation.',
  },
};

// Process explainer (the "How it works" view and the 3D charge / generate simulation).
export const PROCESS = {
  charge: {
    title: 'Charge',
    when: 'When electricity is cheap or renewable output is curtailed',
    steps: [
      'Surplus electricity drives the compressor on shore.',
      'Heat of compression is captured and stored in the thermal storage.',
      'Cooled, compressed air flows 6 km through the subsea pipeline.',
      'Air fills the tubes from the top and pushes seawater out at the bottom.',
    ],
  },
  hold: {
    title: 'Store',
    when: 'Between charge and discharge, for hours',
    steps: [
      'Air sits in the tubes at ~11 bar, held by the weight of 100 m of sea.',
      'Heat waits in the insulated thermal storage on shore.',
      'Nothing moves underwater; the ballast holds the structure on the seabed.',
    ],
  },
  generate: {
    title: 'Generate',
    when: 'When the grid needs power',
    steps: [
      'Valves open and the sea pushes the air back up the pipeline.',
      'Stored heat warms the air again.',
      'The air expands through the turboexpander, which turns the generator.',
      'Electricity flows back to the grid as seawater refills the tubes.',
    ],
  },
};

export const ABOUT = {
  title: 'About BaroMar',
  text: [
    'BaroMar has developed a patented underwater compressed-air energy storage solution for large-scale, long-duration storage. Air is stored in rigid tanks ballasted on the seabed, using the hydrostatic pressure of the sea and mature power, energy and marine technology.',
    'Commercial systems are designed to scale to more than 100 MW and 8 hours of storage, with a target round-trip efficiency of about 70%, no geological constraints, no moving parts underwater and no critical raw materials.',
  ],
  credits: 'Bathymetry: Proteas MBES survey (2023). Tank structure: Leonardo Stadler Coastal & Harbour Engineering, Rev.05. Coastline © OpenStreetMap contributors. Satellite imagery © Esri, Maxar, Earthstar Geographics.',
};
