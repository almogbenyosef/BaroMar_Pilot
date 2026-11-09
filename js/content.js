// All visible text and key figures live here, so they can be edited without touching the 3D code.
// Copy: "BaroMar Cyprus Pilot 3D — Revised Website Copy", 9 Nov 2026. The keys in the comments
// (overview.lead, ui.takeApart …) match the "Cyprus Pilot 3D – site texts" doc.
// Copy rules: no manufacturers, model numbers or detailed specs; the process is "isobaric";
// featured figures stay 400 kWh / 300 kW / 700 m³ (one reference storage unit).

export const SITE = {
  title: 'Altum Mare-UWCAES Pilot Cyprus',
  subtitle: 'Isobaric, adiabatic underwater compressed-air energy storage · PROTEAS, Cyprus',
  confidential: 'Confidential & proprietary. Prepared for investors under NDA.',
  // Engineering model of the shore station (GLB, metres, Y up, origin at the pad centre).
  stationModel: '',   // empty = assets/models/shore_station.glb
};

export const KEY_FIGURES = [
  { value: '400', unit: 'kWh', label: 'Energy capacity' },
  { value: '300', unit: 'kW', label: 'Maximum power output' },
  { value: '700', unit: 'm³', label: 'Underwater air-storage volume' },
  { value: '100', unit: 'm', label: 'Storage depth' },
  { value: '6', unit: 'km', label: 'Subsea Air Pipeline' },
  { value: '10', unit: 'm³', label: 'Hot-water thermal storage' },
  { value: '500', unit: 'm²', label: 'Shore Station footprint' },
  { value: 'Q1', unit: '2027', label: 'Pilot readiness target' },
];

// Photos: each chapter (and each station component) takes an optional list of real photos,
//   images: [{ src: 'assets/img/<file>.jpg', caption: '…' }]
// shown under its text. Left empty for now; the 3D model carries the story until site photos are ready.
// The order follows the path the air takes: from the grid, through the shore station,
// across the shoreline, along the seabed, into the tanks.
export const PARTS = [
  {
    id: 'overview',
    rail: 'Pilot overview',
    title: 'Altum Mare-UWCAES Pilot Cyprus',
    lead: 'A first-of-its-kind demonstration of underwater compressed-air energy storage, being developed at The Cyprus Institute’s PROTEAS research facility near Pentakomo, Cyprus.',
    body: [
      'When electricity is available, the Shore Station compresses air and captures the heat produced in the process. The air travels through a pipeline along the seabed to underwater storage. When electricity is needed, the sea pushes the stored air back toward shore. The captured heat warms the returning air before it drives a generator and sends electricity back to the grid.',
      'The cycle is isobaric and adiabatic: the sea holds the stored air at a constant pressure, and the heat of compression is kept and returned to the air rather than wasted.',
      'The pilot is designed to demonstrate the complete energy-storage cycle in a real marine environment, bringing together established power and marine technologies as a foundation for larger commercial systems.',
    ],
    figures: true,
    images: [],
    view: 'overview',
  },
  {
    id: 'station',
    rail: 'Shore Station',
    title: 'Shore Station',
    lead: 'The Shore Station brings together the equipment that converts electricity into compressed air and back into electricity. Keeping the main machinery on land makes the system accessible for operation and maintenance.',
    body: [
      'During charging, the compressor uses electricity to compress air, while heat from the process is captured and stored in hot water. During generation, the returning air is reheated using this stored heat and drives the Turboexpander-Generator, producing electricity for the grid. Keeping and reusing the heat is what makes the cycle adiabatic.',
      'Select Charge or Generate to follow the flow of air (white), hot water (red), cooling water (blue) and electricity (yellow) through the station. The 3D model is a simplified illustration of the planned system.',
    ],
    stats: [['Footprint', 'approximately 500 m²'], ['Maximum power output', '300 kW'], ['Hot-water storage', '10 m³'], ['Grid connection', 'electricity in and out']],
    images: [],
    children: ['compressor', 'dryer', 'hx', 'teg', 'tes', 'coldTank', 'cooling', 'electrical', 'control', 'substation', 'cable'],
    view: 'station',
  },
  {
    id: 'landfall',
    rail: 'Pipeline Landfall',
    title: 'Pipeline Landfall',
    lead: 'A buried air pipeline connects the Shore Station to the coastline, where the onshore system meets the Subsea Air Pipeline.',
    body: [
      'The pipeline runs underground from the station toward the sea. At the Landfall Manhole, the onshore and offshore sections connect, creating a continuous air route between the Shore Station and the underwater storage site.',
    ],
    stats: [['Onshore connection', 'buried air pipeline'], ['Transition point', 'Landfall Manhole']],
    images: [],
    view: 'landfall',
  },
  {
    id: 'pipeline',
    rail: 'Subsea Air Pipeline',
    title: 'Subsea Air Pipeline',
    lead: 'The Subsea Air Pipeline connects the Shore Station to the underwater storage site, approximately 6 km offshore at a depth of around 100 m.',
    body: [
      'The same pipeline carries compressed air in both directions: toward the storage units during charging and back to shore during generation. Its route has been designed around the surveyed seabed and local marine conditions.',
      'Concrete ballast blocks help keep the pipeline securely positioned along the seabed, including areas closer to shore where additional protection is needed.',
      'The pipeline is drawn thicker than its actual size so it remains visible in the 3D view. The underwater terrain is also vertically exaggerated to help illustrate the route.',
    ],
    stats: [['Function', 'air transfer in both directions'], ['Route length', 'approximately 6 km'], ['Route', 'along the seabed'], ['Storage depth', 'approximately 100 m'], ['Seabed support', 'concrete ballast']],
    view: 'pipeline',
  },
  {
    id: 'tanks',
    rail: 'Underwater Storage',
    title: 'Underwater Storage Units',
    lead: 'Each Underwater Storage Unit consists of 14 vertical Steel Air-Storage Tanks mounted on a Concrete Base Slab and secured by Rock Ballast. One unit provides approximately 700 m³ of underwater air-storage volume.',
    body: [
      'During charging, compressed air enters the tanks from above and displaces seawater through their open bottoms. During generation, the surrounding sea pushes the air back toward shore as water flows into the tanks. The natural pressure of the sea enables BaroMar’s isobaric storage process, without moving machinery underwater.',
      'Rock Ballast keeps the Storage Unit stable on the seabed. The structure may also provide surfaces for marine life over time, depending on local conditions. The interactive model starts with one Storage Unit and lets you add two more to explore a three-unit configuration.',
    ],
    stats: [['Configuration', '14 Steel Air-Storage Tanks per unit'], ['Air-storage volume', 'approximately 700 m³ per unit'], ['Foundation', 'Concrete Base Slab'], ['Storage principle', 'Isobaric']],
    images: [],
    tankToggle: true,
    view: 'tanks',
  },
];

// Sub-parts of the shore station (labels on the model; clicking one opens its panel).
export const STATION_PARTS = {
  compressor: { title: 'Air Compressor', tag: 'Electricity to compressed air', text: 'The compressor uses electricity from the grid to pressurize air before it travels to the underwater storage site. The heat created during compression is captured for later use.' },
  dryer: { title: 'Air Separator and Dryer', tag: 'Air preparation', text: 'Before the compressed air enters the pipeline, the separator and dryer reduce moisture in the air stream, helping protect the equipment and piping.' },
  hx: { title: 'Heat Exchangers', tag: 'Heat recovery and reuse', text: 'Heat exchangers move heat between the compressed air and the water circuit. They capture heat during charging and use stored heat to warm the returning air during generation.' },
  teg: { title: 'Turboexpander-Generator', tag: 'Compressed air to electricity', text: 'When electricity is needed, warm compressed air expands through the turbine and drives the generator. The system is designed for approximately 250 kW of nominal power generation, with peak output of up to 300 kW.' },
  tes: { title: 'Thermal Storage', tag: 'Recovered heat storage', text: 'Heat recovered during air compression is stored in an insulated hot-water tank. When power is generated, this heat is transferred back to the air before it expands through the turbine.' },
  coldTank: { title: 'Cold-Water Tank', tag: 'Water circulation', text: 'The cold-water tank supports the station’s water circuit, allowing water to circulate as heat is captured, stored and reused during the energy-storage cycle.' },
  cooling: { title: 'Cooling System', tag: 'Temperature management', text: 'The cooling system helps regulate operating temperatures and removes heat that is not transferred into thermal storage.' },
  substation: { title: 'Grid Connection', tag: 'Electricity in and out', text: 'The grid connection supplies electricity to the Shore Station during charging and receives electricity from the generator during discharge.' },
  cable: { title: 'Grid Power Cable', tag: 'Buried connection', text: 'A buried cable links the grid connection to the Shore Station’s electrical room, bringing electricity in during charging and sending it back to the grid during generation.' },
  electrical: { title: 'Electrical Room', tag: 'Power and control', text: 'The electrical room contains the systems that distribute electricity, manage equipment power and support operation of the pilot.' },
  control: { title: 'Control Room', tag: 'System operation', text: 'From the control room, operators monitor and manage charging, storage and generation across the shore and underwater systems.' },
};

// Process explainer (the "How it works" view and the 3D charge / generate simulation).
export const PROCESS = {
  charge: {
    title: 'Charge',
    when: 'When electricity is available for storage',
    steps: [
      'Electricity from the grid powers the compressor at the Shore Station.',
      'Heat created during compression is captured and stored in hot water for later use, rather than wasted.',
      'Compressed air travels through the Subsea Air Pipeline toward the underwater storage site.',
      'Air enters the Steel Air-Storage Tanks, pushing seawater out through their open bottoms.',
    ],
  },
  hold: {
    title: 'Store',
    when: 'Until electricity is needed',
    steps: [
      'Compressed air remains underwater, stored using the natural pressure of the sea.',
      'Recovered heat is kept in the Thermal Storage system at the Shore Station.',
      'The Underwater Storage Units stay securely in place on the seabed, with no moving mechanical parts.',
    ],
  },
  generate: {
    title: 'Generate',
    when: 'When electricity is needed',
    steps: [
      'The surrounding sea pushes the stored air back through the pipeline toward shore.',
      'Heat previously stored in hot water is transferred back to the returning air.',
      'The warmed air expands through the turbine, driving the generator.',
      'Electricity flows back to the grid as seawater returns into the underwater tanks.',
    ],
  },
};

// Labels inside the animated "How it works" drawing (svg.*)
export const DIAGRAM = {
  grid: 'Electricity grid', compressor: 'Compressor', teg: 'Turboexpander-Generator', hx: 'Heat exchanger', store: 'Thermal Storage',
  sea: 'Sea level', pipe: 'Subsea Air Pipeline — approximately 6 km', tubes: 'Air-Storage Tanks', depth: 'Approximately 100 m underwater',
};

export const ABOUT = {
  title: 'About BaroMar',
  text: [
    'BaroMar has developed a patented isobaric and adiabatic underwater compressed-air energy storage solution designed for large-scale, long-duration electricity storage. By using the natural pressure of the sea, the technology stores compressed air in underwater structures at constant pressure, while the heat of compression is stored on land and returned to the air on discharge.',
    'The solution is designed to scale with energy-storage needs, without relying on underground geological caverns or conventional battery materials. With no moving machinery underwater, it combines established marine infrastructure with power-generation and thermal-storage technologies.',
  ],
  credits: 'Bathymetry: PROTEAS MBES survey (2023). Underwater Storage Unit design: Leonardo Stadler Coastal & Harbour Engineering. Shore Station: BaroMar engineering 3D model, including Boris Sola’s design work. Land elevation: EU-DEM v1.1 (Copernicus). Coastline © OpenStreetMap contributors. Satellite imagery © Esri, Maxar, Earthstar Geographics.',
  note: 'The 3D visualization is illustrative. Underwater depth is vertically exaggerated, and the pipeline is shown thicker than its actual dimensions to make the system easier to understand.',
};

// Interface labels (ui.*, pin.*, explode.*, load.*)
export const UI = {
  menuHeading: 'Explore the system',
  howButton: 'How it works',
  howTitle: 'How BaroMar stores energy',
  howRun: 'Explore in 3D',
  siteMap: 'Pilot location',
  playCycle: 'Play full cycle',
  stopCycle: 'Stop',
  tanksFull: (n) => `Air storage ${n}% full`,
  builtHeading: 'How it is built',
  takeApart: 'Take it apart',
  putBack: 'Put it back together',
  stationExplodeNote: 'Explore how the main equipment, piping and supporting structure fit together inside the Shore Station.',
  tankExplodeNote: 'Explore the main layers of one Storage Unit, including the Concrete Base Slab, Rock Ballast, Steel Air-Storage Tanks and air distribution system.',
  componentNote: 'A simplified 3D illustration of the planned Shore Station equipment and layout.',
  tankShow: 'Show',
  oneStructure: 'Show 1 Storage Unit',
  threeStructures: 'Add 2 Storage Units',
  tankLayoutNote: 'The reference view shows one Underwater Storage Unit containing 14 Steel Air-Storage Tanks, with approximately 700 m³ of air-storage volume. Select “Add 2 Storage Units” to visualize a three-unit configuration. This does not change the featured pilot performance figures.',
  pin: { manhole: 'Landfall Manhole', station: 'Shore Station', landfall: 'Pipeline Landfall', pipeline: 'Subsea Air Pipeline', tanks: 'Underwater Storage' },
  explodeStation: { air: 'Compressed-air piping', hot: 'Hot-water piping', cool: 'Cooling-water piping', steel: 'Station structure' },
  explodeTank: { manifold: 'Air distribution manifold', tubes: '14 Steel Air-Storage Tanks', cages: 'Rock-filled cages', core: 'Rock Ballast', slab: 'Concrete Base Slab' },
  load: ['Loading the seabed…', 'Building the terrain…', 'Loading the Shore Station…', 'Placing the pipeline and Storage Units…'],
  nojs: 'This interactive 3D experience requires JavaScript and WebGL.',
};
