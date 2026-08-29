// Not used by the customer-facing search bar — the "Trade" field was removed so
// customers only ever describe the problem, and TradeTies resolves the trade
// internally. Kept here, keyed by the exact strings in TRADE_CATEGORIES
// (components/profile/constants.ts), as seed phrasing for that internal
// job-description → trade matching once it exists.
export const JOB_SUGGESTIONS: Record<string, { placeholder: string; jobs: string[] }> = {
  Electrician: {
    placeholder: "Outlet in the kitchen stopped working",
    jobs: ["Outlet not working", "Breaker keeps tripping", "Flickering lights", "Ceiling fan install", "No power in a room", "Panel upgrade"],
  },
  Plumber: {
    placeholder: "Kitchen sink is leaking under the cabinet",
    jobs: ["Leaking faucet", "No hot water", "Clogged drain", "Running toilet", "Low water pressure", "Burst pipe"],
  },
  Carpenter: {
    placeholder: "Cabinet door came off its hinge",
    jobs: ["Broken cabinet hinge", "Squeaky floor", "Deck repair", "Door won't close", "Shelving install", "Trim work"],
  },
  Painter: {
    placeholder: "Living room walls need a fresh coat",
    jobs: ["Interior room repaint", "Peeling paint", "Water-stained ceiling", "Exterior touch-up", "Cabinet refinishing", "Fence staining"],
  },
  "HVAC Technician": {
    placeholder: "Furnace won't start",
    jobs: ["Furnace won't start", "AC not cooling", "Thermostat not responding", "Strange noise from unit", "No airflow", "Annual tune-up"],
  },
  Landscaper: {
    placeholder: "Backyard needs a seasonal cleanup",
    jobs: ["Lawn mowing", "Seasonal cleanup", "Tree trimming", "Sprinkler repair", "Hedge trimming", "Mulching"],
  },
  "General Contractor": {
    placeholder: "Small bathroom remodel",
    jobs: ["Bathroom remodel", "Kitchen remodel", "Room addition", "Basement finishing", "Permit-ready renovation", "General repairs"],
  },
  Roofer: {
    placeholder: "Roof is leaking near the chimney",
    jobs: ["Roof leak", "Missing shingles", "Gutter repair", "Storm damage", "Roof inspection", "Replacement quote"],
  },
  Mason: {
    placeholder: "Cracked concrete steps out front",
    jobs: ["Cracked concrete", "Brick repair", "Retaining wall", "Chimney repair", "Patio install", "Foundation crack"],
  },
  "Flooring Specialist": {
    placeholder: "Hardwood floor has a few damaged boards",
    jobs: ["Damaged hardwood boards", "Tile installation", "Carpet replacement", "Squeaky subfloor", "Laminate install", "Floor refinishing"],
  },
  Locksmith: {
    placeholder: "Door won't lock properly",
    jobs: ["Door won't lock", "Locked out", "Broken key in lock", "Rekey the house", "Smart lock install", "Lost keys"],
  },
  Other: {
    placeholder: "Describe the job you need done",
    jobs: ["Not sure — describe it", "Multiple small jobs", "General repair", "Inspection needed"],
  },
};

// Shown when no trade is picked yet ("Any trade") — a mix across the most common calls.
export const DEFAULT_JOB_SUGGESTIONS = {
  placeholder: "Kitchen sink is leaking under the cabinet",
  jobs: ["Leaking faucet", "No hot water", "Outlet not working", "Clogged drain", "Furnace won't start", "Door won't lock"],
};
