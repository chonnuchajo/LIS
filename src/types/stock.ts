export type StockTier = "primary" | "supplier" | "working";

export interface StandardTier {
  qty: number;
  sizeMg: number | string | null;
  exp: string;
}

export interface StandardPrimary extends StandardTier {
  ordered: number;
  usesPerBottle: number | string | null;
  pricePerUnit: number;
  totalPrice: number | string;
}

export interface StockStandardItem {
  _id: string;
  code: string;
  name: string;
  primary: StandardPrimary;
  supplier: StandardTier;
  working: StandardTier;
  usagePerUseMg: number | string | null;
  frequency: string;
  openShelfLife?: OpenShelfLife;
  storageTemp: string;
  status: string;
  expiryStatus: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StockSolventItem {
  _id: string;
  name: string;
  sizeLiter: number;
  qty: number;
  price: number;
  note: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StockGlasswareItem {
  _id: string;
  name: string;
  qty: number;
  pricePerPiece: number;
  note: string;
  createdAt?: string;
  updatedAt?: string;
}

export type StockItemType = "standard" | "solvent" | "glassware";
export type StockAction = "create" | "update" | "delete" | "deduct" | "receive" | "withdraw" | "discard";

export interface StockTransactionItem {
  _id: string;
  itemType: StockItemType;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  action: StockAction;
  tier?: StockTier | null;
  beforeQty?: number | null;
  afterQty?: number | null;
  delta?: number | null;
  unit?: string;
  sampleId?: string;
  note?: string;
  userEmail?: string;
  userName?: string;
  createdAt: string;
}

export type ShelfUnit = "day" | "week" | "month";
export interface OpenShelfLife {
  value: number;
  unit: ShelfUnit;
}

export type StockUnitKind = "sealed" | "working";
export type StockUnitSource = "primary" | "supply" | "";
export type StockUnitStatus = "active" | "empty" | "discarded";

export interface StockUnitVolume {
  initial: number;
  remaining: number;
  unit: "ml" | "mg" | "g";
}

export interface StockUnitItem {
  _id: string;
  qrId: string;
  itemCode: string;
  itemName: string;
  kind: StockUnitKind;
  source?: StockUnitSource;
  parentId?: string | null;
  lotNo?: string;
  exp?: string | null;
  volume: StockUnitVolume;
  status: StockUnitStatus;
  receivedDate?: string | null;
  withdrawnDate?: string | null;
  discardedAt?: string | null;
  discardedBy?: { email?: string; name?: string };
  discardReason?: string;
  createdBy?: { email?: string; name?: string };
  createdAt?: string;
  updatedAt?: string;
}
