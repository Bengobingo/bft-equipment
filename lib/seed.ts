import type { KitPart } from "./types";
// Optional training data, inserted only into an empty inventory.
export const sampleEquipment = [
  [
    "BOX001",
    "Server Validation Box A",
    "其他工程設備箱",
    "PED",
    "Server / Dual Socket",
    "DEMO-K001",
    "PED / Rack 01",
    "ready",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation box"
  ],
  [
    "BOX002",
    "CPU / DIMM Box A",
    "其他工程設備箱",
    "PED",
    "DDR5 RDIMM",
    "DEMO-K002",
    "PED / Rack 02",
    "ready",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation box"
  ],
  [
    "BOX003",
    "U.2 Storage Box",
    "其他工程設備箱",
    "PED",
    "NVMe / U.2",
    "DEMO-K003",
    "PED / Rack 03",
    "ready",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation box"
  ],
  [
    "BOX004",
    "Thermal Validation Box",
    "其他工程設備箱",
    "PED",
    "Server / Thermal",
    "DEMO-K004",
    "PED / Rack 04",
    "ready",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation box"
  ],
  [
    "BOX005",
    "Cable Verification Box",
    "其他工程設備箱",
    "PED",
    "Server / Cable",
    "DEMO-K005",
    "PED / Rack 05",
    "ready",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation box"
  ],
  [
    "BOX006",
    "Mainboard Bring-up Box",
    "主機板測試設備箱",
    "PED",
    "Server / Mainboard",
    "DEMO-K006",
    "PED / Rack 06",
    "ready",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation box"
  ],
  [
    "BOX007",
    "Fixture Maintenance Box",
    "其他工程設備箱",
    "PED",
    "Server / Fixture",
    "DEMO-K007",
    "PED / Rack 07",
    "maintenance",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation box"
  ],
  [
    "BOX008",
    "Mainboard Test Box B",
    "主機板測試設備箱",
    "PED",
    "Server / Dual Socket",
    "DEMO-K008",
    "PED / Rack 08",
    "ready",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation box"
  ],
  [
    "BOX009",
    "Pilot Build Box",
    "其他工程設備箱",
    "PED",
    "Server / Pilot Build",
    "DEMO-K009",
    "PED / Rack 09",
    "ready",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation box"
  ],
  [
    "BOX010",
    "DIMM Screening Box",
    "其他工程設備箱",
    "PED",
    "DDR5 / Memory",
    "DEMO-K010",
    "PED / Rack 10",
    "ready",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation box"
  ],
  [
    "BOX011",
    "Engineering Fixture Box",
    "其他工程設備箱",
    "PED",
    "Server / Engineering",
    "DEMO-K011",
    "PED / Rack 11",
    "ready",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation box"
  ],
  [
    "BOX012",
    "Production Rework Box",
    "其他工程設備箱",
    "PED",
    "Server / Rework",
    "DEMO-K012",
    "PED / Rack 12",
    "ready",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation box"
  ]
] as const;
export function sampleParts(index: number): KitPart[] {
  return [
    { type: "CPU", name: "Server validation CPU", quantity: 2 },
    { type: "Memory", name: "DDR5 RDIMM 32 GB", quantity: 8 },
    { type: "Cable", name: "Server signal / power cable", quantity: 4 },
    { type: "Storage", name: "NVMe U.2 test drive", quantity: 2 },
    { type: "Heatsink", name: "CPU heatsink assembly", quantity: 2 },
  ].map((part, row) => ({ id: `demo-${index}-${row}`, type: part.type as KitPart["type"], name: part.name, partNumber: `DEMO-PN-${index + 1}-${row + 1}`, serial: "", quantity: part.quantity }));
}
