import type { ReactNode } from "react";
import { Pencil } from "lucide-react";

import type { ParameterItem, ParameterScope } from "@/lib/api";
import {
  type AdvancedCriteriaMode,
  buildConditionalCriteriaRows,
  buildLabelToleranceCriteriaRows,
  buildSubstanceCriteriaRows,
} from "@/lib/parameterCriteriaRows";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export type ParameterCriteriaTabsProps = {
  value: ParameterCriteriaTab;
  onValueChange: (value: ParameterCriteriaTab) => void;
  parameters: ParameterItem[];
  scope: ParameterScope;
  children: ReactNode;
  onEditField: (mode: AdvancedCriteriaMode, parameterId: string, fieldIndex: number) => void;
};

export function ParameterCriteriaTabs({
  value,
  onValueChange,
  parameters,
  scope,
  children,
  onEditField,
}: ParameterCriteriaTabsProps) {
  const substanceRows = buildSubstanceCriteriaRows(parameters, scope);
  const conditionalRows = buildConditionalCriteriaRows(parameters, scope);
  const labelRows = buildLabelToleranceCriteriaRows(parameters, scope);

  return (
    <Tabs value={value} onValueChange={(next) => onValueChange(next as ParameterCriteriaTab)}>
      <TabsList className="mb-4 grid w-full grid-cols-2 lg:inline-grid lg:w-auto lg:grid-cols-4">
        <TabsTrigger value="list">ทั้งหมด</TabsTrigger>
        <TabsTrigger value="substance">แยกตามสาร</TabsTrigger>
        <TabsTrigger value="conditional">เงื่อนไขพิเศษ</TabsTrigger>
        <TabsTrigger value="labelTolerance">ตาม %สาร</TabsTrigger>
      </TabsList>

      <TabsContent value="list" className="mt-0">
        {children}
      </TabsContent>

      <TabsContent value="substance" className="mt-0">
        <TableShell empty={substanceRows.length === 0}>
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Parameter</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>เธชเธฒเธฃ</TableHead>
                <TableHead>เน€เธเธทเนเธญเธเนเธ</TableHead>
                <TableHead>เธเนเธฒเธ•เนเธณเธชเธธเธ”</TableHead>
                <TableHead>เธเนเธฒเธ•เนเธณเธชเธธเธ” 2</TableHead>
                <TableHead>เน€เธเธเธฒเธฐเธซเธฑเธงเธซเธเนเธฒเธ•เธฃเธงเธ</TableHead>
                <TableHead className="text-right">เนเธเนเนเธ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {substanceRows.map((row) => (
                <TableRow key={row.rowId}>
                  <TableCell className="font-medium">{row.parameterName}</TableCell>
                  <TableCell>{row.fieldLabel}</TableCell>
                  <TableCell>{row.substance}</TableCell>
                  <TableCell>{row.operator}</TableCell>
                  <TableCell>{row.value ?? "-"}</TableCell>
                  <TableCell>{row.value2 ?? "-"}</TableCell>
                  <TableCell>{row.headOnly ? <Badge variant="secondary">เน€เธเธเธฒเธฐเธซเธฑเธงเธซเธเนเธฒ</Badge> : "-"}</TableCell>
                  <TableCell className="text-right">
                    <EditButton
                      label={`เนเธเนเนเธเน€เธเธ“เธ‘เนเธชเธฒเธฃ ${row.fieldLabel}`}
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
        <TableShell empty={conditionalRows.length === 0}>
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Parameter</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>เธเธเธ—เธตเน</TableHead>
                <TableHead>เธเธทเนเธญเธเธ</TableHead>
                <TableHead>เน€เธเธทเนเธญเธเนเธ</TableHead>
                <TableHead>เธเธฅเธฅเธฑเธเธเน</TableHead>
                <TableHead className="text-right">เนเธเนเนเธ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conditionalRows.map((row) => (
                <TableRow key={row.rowId}>
                  <TableCell className="font-medium">{row.parameterName}</TableCell>
                  <TableCell>{row.fieldLabel}</TableCell>
                  <TableCell>{row.ruleIndex == null ? "-" : row.ruleIndex + 1}</TableCell>
                  <TableCell>{row.ruleLabel}</TableCell>
                  <TableCell>{row.conditionsText}</TableCell>
                  <TableCell>{row.resultText}</TableCell>
                  <TableCell className="text-right">
                    <EditButton
                      label={`เนเธเนเนเธเธเธ ${row.fieldLabel}`}
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
        <TableShell empty={labelRows.length === 0}>
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>{"\u0025 \u0E22\u0E32"}</TableHead>
                <TableHead>เธงเธฅเธชเธฒเธ”เธขเธฒเน€เธเธ“เธ‘เนเธเธฅเธฒเธ”เน€เธเธฅเธทเนเธ¥เธ%</TableHead>
                <TableHead>เธเนเธฒเธ•เนเธณเธชเธธเธ”</TableHead>
                <TableHead>25% เธฅเนเธฒเธ</TableHead>
                <TableHead>25% เธเธ</TableHead>
                <TableHead>เธเนเธฒเธชเธนเธเธชเธธเธ”</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {labelRows.map((row) => (
                <TableRow key={row.rowId}>
                  <TableCell>
                    <div className="flex items-center justify-between gap-2">
                      <span>{row.drugPercent}</span>
                      <EditButton
                        label={`เนเธเนเนเธเน€เธเธ“เธ‘เน %เธขเธฒ ${row.fieldLabel}`}
                        onClick={() => onEditField("labelTolerance", row.parameterId, row.fieldIndex)}
                      />
                    </div>
                  </TableCell>
                  <TableCell>{row.tolerancePercent}</TableCell>
                  <TableCell>{row.failLow}</TableCell>
                  <TableCell>{row.passLow}</TableCell>
                  <TableCell>{row.passHigh}</TableCell>
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

function TableShell({ empty, children }: { empty: boolean; children: ReactNode }) {
  if (empty) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        เนเธกเนเธกเธตเธฃเธฒเธขเธเธฒเธฃเน€เธเธ“เธ‘เนเนเธเนเธ—เนเธเธเธตเน
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
