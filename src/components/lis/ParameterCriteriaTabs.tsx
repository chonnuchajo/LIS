import { useMemo, useState, type ReactNode } from "react";
import { Pencil, Search } from "lucide-react";

import type { ParameterItem, ParameterScope } from "@/lib/api";
import {
  type AdvancedCriteriaMode,
  buildConditionalCriteriaRows,
  buildLabelToleranceCriteriaRows,
  buildSubstanceCriteriaRows,
} from "@/lib/parameterCriteriaRows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ParameterCriteriaTab = "list" | AdvancedCriteriaMode;

const ALL_PARAMETERS_VALUE = "__all__";

type CriteriaSortKey = "parameterOrder" | "parameterName" | "drugPercentAsc" | "drugPercentDesc";

type ParameterOption = ParameterItem & { _id: string };

type SortableCriteriaRow = {
  parameterId: string;
  parameterName: string;
  fieldIndex: number;
  fieldLabel: string;
  ruleIndex: number | null;
  searchText: string;
  drugPercent?: string;
};

const criteriaCollator = new Intl.Collator(["th", "en"], { numeric: true, sensitivity: "base" });

export type ParameterCriteriaTabsProps = {
  value: ParameterCriteriaTab;
  onValueChange: (value: ParameterCriteriaTab) => void;
  parameters: ParameterItem[];
  scope: ParameterScope;
  children: ReactNode;
  canViewHeadCriteriaColumns?: boolean;
  onEditField: (mode: AdvancedCriteriaMode, parameterId: string, fieldIndex: number) => void;
};

export function ParameterCriteriaTabs({
  value,
  onValueChange,
  parameters,
  scope,
  children,
  canViewHeadCriteriaColumns = false,
  onEditField,
}: ParameterCriteriaTabsProps) {
  const [parameterFilter, setParameterFilter] = useState(ALL_PARAMETERS_VALUE);
  const [sortKey, setSortKey] = useState<CriteriaSortKey>("parameterOrder");
  const [criteriaSearch, setCriteriaSearch] = useState("");
  const showHeadCriteriaColumns = canViewHeadCriteriaColumns === true;

  const scopedParameters = useMemo(
    () =>
      parameters.filter(
        (parameter): parameter is ParameterOption => (parameter.scope ?? "qc") === scope && Boolean(parameter._id),
      ),
    [parameters, scope],
  );
  const parameterOrder = useMemo(() => {
    const order = new Map<string, number>();
    scopedParameters.forEach((parameter, index) => order.set(parameter._id, index));
    return order;
  }, [scopedParameters]);
  const activeParameterFilter = parameterOrder.has(parameterFilter) ? parameterFilter : ALL_PARAMETERS_VALUE;

  const substanceRows = useMemo(() => buildSubstanceCriteriaRows(parameters, scope), [parameters, scope]);
  const conditionalRows = useMemo(() => buildConditionalCriteriaRows(parameters, scope), [parameters, scope]);
  const labelRows = useMemo(() => buildLabelToleranceCriteriaRows(parameters, scope), [parameters, scope]);
  const normalizedCriteriaSearch = criteriaSearch.trim().toLowerCase();
  const visibleSubstanceRows = useMemo(
    () => filterAndSortRows(substanceRows, activeParameterFilter, normalizedCriteriaSearch, sortKey, parameterOrder),
    [activeParameterFilter, normalizedCriteriaSearch, parameterOrder, sortKey, substanceRows],
  );
  const visibleConditionalRows = useMemo(
    () => filterAndSortRows(conditionalRows, activeParameterFilter, normalizedCriteriaSearch, sortKey, parameterOrder),
    [activeParameterFilter, conditionalRows, normalizedCriteriaSearch, parameterOrder, sortKey],
  );
  const visibleLabelRows = useMemo(
    () => filterAndSortRows(labelRows, activeParameterFilter, normalizedCriteriaSearch, sortKey, parameterOrder),
    [activeParameterFilter, labelRows, normalizedCriteriaSearch, parameterOrder, sortKey],
  );

  return (
    <Tabs value={value} onValueChange={(next) => onValueChange(next as ParameterCriteriaTab)}>
      <TabsList className="mb-4 grid w-full grid-cols-2 lg:inline-grid lg:w-auto lg:grid-cols-4">
        <TabsTrigger value="list">ทั้งหมด</TabsTrigger>
        <TabsTrigger value="substance">แยกตามสาร</TabsTrigger>
        <TabsTrigger value="conditional">เงื่อนไขพิเศษ</TabsTrigger>
        <TabsTrigger value="labelTolerance">ตาม %สาร</TabsTrigger>
      </TabsList>

      {value !== "list" ? (
        <div className="mb-4 flex flex-col gap-3 rounded-md border bg-muted/20 p-3 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground sm:min-w-[260px] sm:flex-1">
            ค้นหาเกณฑ์
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="ค้นหาเกณฑ์"
                value={criteriaSearch}
                onChange={(event) => setCriteriaSearch(event.target.value)}
                placeholder="ค้นหาสาร / Parameter / ค่าเกณฑ์..."
                className="h-9 bg-background pl-8"
              />
            </div>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground sm:min-w-[220px]">
            Parameter
            <NativeSelect
              aria-label="เลือก Parameter"
              className="h-9 bg-background"
              value={activeParameterFilter}
              onChange={(event) => setParameterFilter(event.target.value)}
            >
              <option value={ALL_PARAMETERS_VALUE}>ทุก Parameter</option>
              {scopedParameters.map((parameter) => (
                <option key={parameter._id} value={parameter._id}>
                  {parameter.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground sm:min-w-[220px]">
            เรียงลำดับ
            <NativeSelect
              aria-label="เรียงลำดับ"
              className="h-9 bg-background"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as CriteriaSortKey)}
            >
              <option value="parameterOrder">ตามลำดับ Parameter</option>
              <option value="parameterName">ชื่อ Parameter</option>
              <option value="drugPercentAsc">%สาร น้อยไปมาก</option>
              <option value="drugPercentDesc">%สาร มากไปน้อย</option>
            </NativeSelect>
          </label>
        </div>
      ) : null}

      <TabsContent value="list" className="mt-0">
        {children}
      </TabsContent>

      <TabsContent value="substance" className="mt-0">
        <TableShell empty={visibleSubstanceRows.length === 0}>
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Parameter</TableHead>
                <TableHead>สาร</TableHead>
                <TableHead>ค่าต่ำสุด</TableHead>
                <TableHead>ค่าต่ำสุด 2</TableHead>
                <TableHead className="text-right">แก้ไข</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleSubstanceRows.map((row) => (
                <TableRow key={row.rowId}>
                  <TableCell className="font-medium">{row.parameterName}</TableCell>
                  <TableCell>{row.substance}</TableCell>
                  <TableCell>{row.value ?? "-"}</TableCell>
                  <TableCell>{row.value2 ?? "-"}</TableCell>
                  <TableCell className="text-right">
                    <EditButton
                      label={`แก้ไขเกณฑ์สาร ${row.fieldLabel}`}
                      onClick={() => onEditField("substance", row.parameterId, row.fieldIndex)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableShell>
      </TabsContent>

      <TabsContent value="conditional" className="mt-0">
        <TableShell empty={visibleConditionalRows.length === 0}>
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow>
                <TableHead>Parameter</TableHead>
                <TableHead>กฎที่</TableHead>
                <TableHead>ชื่อกฎ</TableHead>
                <TableHead>เงื่อนไข</TableHead>
                <TableHead>ผลลัพธ์</TableHead>
                <TableHead className="text-right">แก้ไข</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleConditionalRows.map((row) => (
                <TableRow key={row.rowId}>
                  <TableCell className="font-medium">{row.parameterName}</TableCell>
                  <TableCell>{row.ruleIndex == null ? "-" : row.ruleIndex + 1}</TableCell>
                  <TableCell>{row.ruleLabel}</TableCell>
                  <TableCell>{row.conditionsText}</TableCell>
                  <TableCell>{row.resultText}</TableCell>
                  <TableCell className="text-right">
                    <EditButton
                      label={`แก้ไขกฎ ${row.fieldLabel}`}
                      onClick={() => onEditField("conditional", row.parameterId, row.fieldIndex)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableShell>
      </TabsContent>

      <TabsContent value="labelTolerance" className="mt-0">
        <TableShell empty={visibleLabelRows.length === 0}>
          <Table className={showHeadCriteriaColumns ? "min-w-[1100px]" : "min-w-[780px]"}>
            <TableHeader>
              <TableRow>
                <TableHead>Parameter</TableHead>
                <TableHead>%สาร</TableHead>
                {showHeadCriteriaColumns ? <TableHead>เกณฑ์คลาดเคลื่อน (%,+-)</TableHead> : null}
                <TableHead>เกณฑ์กลาง</TableHead>
                <TableHead>ค่าต่ำสุด</TableHead>
                {showHeadCriteriaColumns ? (
                  <>
                    <TableHead>25% ล่าง</TableHead>
                    <TableHead>25% บน</TableHead>
                  </>
                ) : null}
                <TableHead>ค่าสูงสุด</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleLabelRows.map((row) => (
                <TableRow key={row.rowId}>
                  <TableCell>
                    <div className="min-w-0 space-y-1">
                      <div className="font-medium">{row.parameterName}</div>
                      <div className="truncate text-xs text-muted-foreground">{row.selectorText}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium tabular-nums">{row.drugPercent}</span>
                      <EditButton
                        label={`แก้ไขเกณฑ์ %สาร ${row.fieldLabel}`}
                        onClick={() => onEditField("labelTolerance", row.parameterId, row.fieldIndex)}
                      />
                    </div>
                  </TableCell>
                  {showHeadCriteriaColumns ? <TableCell>{row.tolerancePercent}</TableCell> : null}
                  <TableCell>{row.headTolerance}</TableCell>
                  <TableCell>{row.failLow}</TableCell>
                  {showHeadCriteriaColumns ? (
                    <>
                      <TableCell>{row.passLow}</TableCell>
                      <TableCell>{row.passHigh}</TableCell>
                    </>
                  ) : null}
                  <TableCell>{row.failHigh}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableShell>
      </TabsContent>
    </Tabs>
  );
}

function filterAndSortRows<T extends SortableCriteriaRow>(
  rows: T[],
  parameterFilter: string,
  searchQuery: string,
  sortKey: CriteriaSortKey,
  parameterOrder: Map<string, number>,
) {
  return rows
    .filter(
      (row) =>
        (parameterFilter === ALL_PARAMETERS_VALUE || row.parameterId === parameterFilter) &&
        matchesCriteriaSearch(row, searchQuery),
    )
    .slice()
    .sort(compareCriteriaRows(sortKey, parameterOrder));
}

function matchesCriteriaSearch(row: SortableCriteriaRow, searchQuery: string) {
  if (!searchQuery) return true;
  return row.searchText.toLowerCase().includes(searchQuery);
}

function compareCriteriaRows<T extends SortableCriteriaRow>(
  sortKey: CriteriaSortKey,
  parameterOrder: Map<string, number>,
) {
  const defaultCompare = (a: T, b: T) => compareByParameterOrder(a, b, parameterOrder);
  return (a: T, b: T) => {
    if (sortKey === "parameterName") {
      return (
        criteriaCollator.compare(a.parameterName, b.parameterName) ||
        criteriaCollator.compare(a.fieldLabel, b.fieldLabel) ||
        defaultCompare(a, b)
      );
    }
    if (sortKey === "drugPercentAsc" || sortKey === "drugPercentDesc") {
      return compareDrugPercent(a, b, sortKey === "drugPercentAsc" ? "asc" : "desc") || defaultCompare(a, b);
    }
    return defaultCompare(a, b);
  };
}

function compareByParameterOrder<T extends SortableCriteriaRow>(
  a: T,
  b: T,
  parameterOrder: Map<string, number>,
) {
  return (
    (parameterOrder.get(a.parameterId) ?? Number.MAX_SAFE_INTEGER) -
      (parameterOrder.get(b.parameterId) ?? Number.MAX_SAFE_INTEGER) ||
    a.fieldIndex - b.fieldIndex ||
    (a.ruleIndex ?? -1) - (b.ruleIndex ?? -1) ||
    criteriaCollator.compare(a.fieldLabel, b.fieldLabel)
  );
}

function compareDrugPercent<T extends SortableCriteriaRow>(a: T, b: T, direction: "asc" | "desc") {
  const aValue = parseDrugPercent(a);
  const bValue = parseDrugPercent(b);
  if (aValue == null && bValue == null) return 0;
  if (aValue == null) return 1;
  if (bValue == null) return -1;
  return direction === "asc" ? aValue - bValue : bValue - aValue;
}

function parseDrugPercent(row: SortableCriteriaRow) {
  const value = Number(row.drugPercent);
  return Number.isFinite(value) ? value : null;
}

function TableShell({ empty, children }: { empty: boolean; children: ReactNode }) {
  if (empty) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        ไม่มีรายการเกณฑ์ในแท็บนี้
      </div>
    );
  }
  return <div className="overflow-x-auto rounded-md border">{children}</div>;
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={label} title={label} onClick={onClick}>
      <Pencil className="h-4 w-4" />
    </Button>
  );
}
