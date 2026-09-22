// THE JOB THIS FILE WAS KEPT FOR IS DONE, and only the placeholders below are
// still read. It was written as seed phrasing for the internal job-description →
// trade matching that did not exist yet; that matching exists now, and this copy
// went into R__trade_search_terms.sql on its way there. The service catalogue
// has since taken over the part a customer actually sees — JobSuggestBox asks
// the server what matches instead of shipping a list to the browser.
//
// So JOB_SUGGESTIONS below has no reader left. It stays because it is the only
// written record of how these phrasings were grouped by trade, and deleting it
// while the catalogue is still growing would throw that away for the sake of a
// tidy file. DEFAULT_JOB_SUGGESTIONS is a different matter and is live: the
// hero's placeholder and its example chips come from it.
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
