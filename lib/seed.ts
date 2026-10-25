import type { KitPart } from "./types";
// Optional training data, inserted only into an empty inventory.
export const sampleEquipment = [
  [
    "PED-KIT-001",
    "Server Validation Kit A",
    "伺服器整機設備箱",
    "PED",
    "Server / Dual Socket",
    "DEMO-K001",
    "PED / Rack 01",
    "ready",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation kit"
  ],
  [
    "PED-KIT-002",
    "CPU / DIMM Kit A",
    "CPU / DIMM 設備箱",
    "PED",
    "DDR5 RDIMM",
    "DEMO-K002",
    "PED / Rack 02",
    "ready",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation kit"
  ],
  [
    "PED-KIT-003",
    "U.2 Storage Kit",
    "儲存 / 線材設備箱",
    "PED",
    "NVMe / U.2",
    "DEMO-K003",
    "PED / Rack 03",
    "ready",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation kit"
  ],
  [
    "PED-KIT-004",
    "Thermal Validation Kit",
    "散熱 / 治具設備箱",
    "PED",
    "Server / Thermal",
    "DEMO-K004",
    "PED / Rack 04",
    "ready",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation kit"
  ],
  [
    "PED-KIT-005",
    "Cable Verification Kit",
    "儲存 / 線材設備箱",
    "PED",
    "Server / Cable",
    "DEMO-K005",
    "PED / Rack 05",
    "ready",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation kit"
  ],
  [
    "PED-KIT-006",
    "Mainboard Bring-up Kit",
    "主機板測試設備箱",
    "PED",
    "Server / Mainboard",
    "DEMO-K006",
    "PED / Rack 06",
    "ready",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation kit"
  ],
  [
    "PED-KIT-007",
    "Fixture Maintenance Kit",
    "散熱 / 治具設備箱",
    "PED",
    "Server / Fixture",
    "DEMO-K007",
    "PED / Rack 07",
    "maintenance",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation kit"
  ],
  [
    "PED-KIT-008",
    "Mainboard Test Kit B",
    "主機板測試設備箱",
    "PED",
    "Server / Dual Socket",
    "DEMO-K008",
    "PED / Rack 08",
    "ready",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation kit"
  ],
  [
    "PED-KIT-009",
    "Pilot Build Kit",
    "伺服器整機設備箱",
    "PED",
    "Server / Pilot Build",
    "DEMO-K009",
    "PED / Rack 09",
    "ready",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation kit"
  ],
  [
    "PED-KIT-010",
    "DIMM Screening Kit",
    "CPU / DIMM 設備箱",
    "PED",
    "DDR5 / Memory",
    "DEMO-K010",
    "PED / Rack 10",
    "ready",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation kit"
  ],
  [
    "PED-KIT-011",
    "Engineering Fixture Kit",
    "散熱 / 治具設備箱",
    "PED",
    "Server / Engineering",
    "DEMO-K011",
    "PED / Rack 11",
    "ready",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation kit"
  ],
  [
    "PED-KIT-012",
    "Production Rework Kit",
    "其他工程設備箱",
    "PED",
    "Server / Rework",
    "DEMO-K012",
    "PED / Rack 12",
    "ready",
    "DEMO · CPU, DIMM, Cable, U.2 and heatsink validation kit"
  ]
] as const;
export function sampleParts(index: number): KitPart[] {
  return [
    { type: "CPU", name: "Server validation CPU", quantity: 2 },
    { type: "DIMM", name: "DDR5 RDIMM 32 GB", quantity: 8 },
    { type: "Cable", name: "Server signal / power cable", quantity: 4 },
    { type: "U.2", name: "NVMe U.2 test drive", quantity: 2 },
    { type: "Heatsink", name: "CPU heatsink assembly", quantity: 2 },
  ].map((part, row) => ({ id: `demo-${index}-${row}`, type: part.type as KitPart["type"], name: part.name, partNumber: `DEMO-PN-${index + 1}-${row + 1}`, serial: "", quantity: part.quantity }));
}
