export interface StockStandardItem {
  id: string;
  name: string;
  lotNo: string;
  manufacturer: string;
  purity: number;
  receivedDate: string;
  expiryDate: string;
  remainingQty: number;
  unit: string;
  location: string;
}

export interface StockSolventItem {
  id: string;
  name: string;
  lotNo: string;
  manufacturer: string;
  grade: string;
  receivedDate: string;
  expiryDate: string;
  remainingQty: number;
  unit: string;
  location: string;
}

export const stockStandards: StockStandardItem[] = [
  { id: "STD-001", name: "Glyphosate Standard", lotNo: "GL-2025-A01", manufacturer: "Sigma-Aldrich", purity: 99.5, receivedDate: "2025-12-01", expiryDate: "2027-12-01", remainingQty: 85, unit: "mg", location: "ตู้เย็น A-1" },
  { id: "STD-002", name: "Paraquat Standard", lotNo: "PQ-2025-B02", manufacturer: "Dr. Ehrenstorfer", purity: 99.0, receivedDate: "2025-11-15", expiryDate: "2027-11-15", remainingQty: 120, unit: "mg", location: "ตู้เย็น A-1" },
  { id: "STD-003", name: "Chlorpyrifos Standard", lotNo: "CP-2026-A01", manufacturer: "Sigma-Aldrich", purity: 98.5, receivedDate: "2026-01-10", expiryDate: "2028-01-10", remainingQty: 200, unit: "mg", location: "ตู้เย็น A-2" },
  { id: "STD-004", name: "Cypermethrin Standard", lotNo: "CY-2025-C03", manufacturer: "AccuStandard", purity: 99.2, receivedDate: "2025-10-20", expiryDate: "2027-10-20", remainingQty: 50, unit: "mg", location: "ตู้เย็น A-2" },
  { id: "STD-005", name: "Atrazine Standard", lotNo: "AT-2026-A02", manufacturer: "Sigma-Aldrich", purity: 99.8, receivedDate: "2026-02-05", expiryDate: "2028-02-05", remainingQty: 150, unit: "mg", location: "ตู้เย็น B-1" },
  { id: "STD-006", name: "Abamectin Standard", lotNo: "AB-2025-D01", manufacturer: "Dr. Ehrenstorfer", purity: 97.5, receivedDate: "2025-09-01", expiryDate: "2027-09-01", remainingQty: 30, unit: "mg", location: "ตู้เย็น B-1" },
  { id: "STD-007", name: "Imidacloprid Standard", lotNo: "IM-2026-B01", manufacturer: "AccuStandard", purity: 99.1, receivedDate: "2026-03-01", expiryDate: "2028-03-01", remainingQty: 180, unit: "mg", location: "ตู้เย็น B-2" },
  { id: "STD-008", name: "Profenofos Standard", lotNo: "PF-2025-E02", manufacturer: "Sigma-Aldrich", purity: 98.0, receivedDate: "2025-08-15", expiryDate: "2027-08-15", remainingQty: 65, unit: "mg", location: "ตู้เย็น B-2" },
];

export const stockSolvents: StockSolventItem[] = [
  { id: "SOL-001", name: "Methanol", lotNo: "MeOH-2026-01", manufacturer: "Merck", grade: "HPLC Grade", receivedDate: "2026-01-15", expiryDate: "2028-01-15", remainingQty: 2500, unit: "mL", location: "ชั้น C-1" },
  { id: "SOL-002", name: "Acetonitrile", lotNo: "ACN-2026-02", manufacturer: "J.T.Baker", grade: "HPLC Grade", receivedDate: "2026-02-01", expiryDate: "2028-02-01", remainingQty: 1800, unit: "mL", location: "ชั้น C-1" },
  { id: "SOL-003", name: "Hexane", lotNo: "HEX-2025-12", manufacturer: "Merck", grade: "GC Grade", receivedDate: "2025-12-20", expiryDate: "2027-12-20", remainingQty: 3000, unit: "mL", location: "ชั้น C-2" },
  { id: "SOL-004", name: "Acetone", lotNo: "ACE-2026-01", manufacturer: "RCI Labscan", grade: "AR Grade", receivedDate: "2026-01-05", expiryDate: "2028-01-05", remainingQty: 4000, unit: "mL", location: "ชั้น C-2" },
  { id: "SOL-005", name: "Dichloromethane", lotNo: "DCM-2025-11", manufacturer: "Merck", grade: "HPLC Grade", receivedDate: "2025-11-10", expiryDate: "2027-11-10", remainingQty: 350, unit: "mL", location: "ชั้น D-1" },
  { id: "SOL-006", name: "Toluene", lotNo: "TOL-2026-03", manufacturer: "J.T.Baker", grade: "GC Grade", receivedDate: "2026-03-10", expiryDate: "2026-05-15", remainingQty: 200, unit: "mL", location: "ชั้น D-1" },
];

// Helper: get standard for a sample name using FIFO (oldest receivedDate first)
export function getStandardForSample(sampleName: string): StockStandardItem | null {
  const keyword = sampleName.split(" ")[0].toLowerCase();
  const matches = stockStandards
    .filter(s => s.name.toLowerCase().includes(keyword) && s.remainingQty > 0)
    .sort((a, b) => new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime());
  return matches[0] || null;
}
