# Stock QR Direct Printer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add preview-first Stock QR label printing with selectable Sticker printers, direct printer IP support, and per-printer test print.

**Architecture:** Keep the existing `PrinterConfig` model and `cupsPrinterUrl` field for compatibility, but treat the field as a generic `Printer IP / URL`. Server routing normalizes bare IP/host values to IPP targets and preserves existing CUPS/IPP URLs. Stock receive collects generated label HTML, opens a focused preview dialog, and prints all pending labels to the selected configured printer.

**Tech Stack:** React 18, TypeScript, TanStack Query, shadcn/ui, Express, Mongoose, `ipp`, `puppeteer-core`, Jest, Vitest.

## Global Constraints

- Do not run production build commands on this machine.
- Do not run `npm run build`, `npm run build:dev`, `npm run build:watch`, `vite build`, or equivalent build commands.
- Existing CUPS URLs like `http://cups-host:631/printers/Zebra` must continue to work.
- Bare printer hosts/IPs normalize to direct IPP target `ipp://<host>:631/ipp/print`.
- Raw socket printing on port `9100` is out of scope.
- Receive success remains independent from print success.
- Keep Mongo field name `cupsPrinterUrl`; only UI/API meaning changes to `Printer IP / URL`.

---

## File Structure

- `server/lib/printerRouting.js` owns kind mapping, validation, address normalization, and IPP target resolution.
- `server/lib/printerRouting.test.js` verifies direct IP/host input, CUPS compatibility, invalid input, and target resolution.
- `server/routes/print.js` owns explicit printer selection, test print endpoint, and render-to-print pipeline reuse.
- `src/lib/printConfig.ts` mirrors client-side printer input validation and print metadata.
- `src/lib/printConfig.test.ts` verifies client-side validation examples.
- `src/lib/api.ts` exposes `printerConfigId` printing and per-printer test print calls.
- `src/lib/print.ts` passes optional `printerConfigId` to server printing.
- `src/components/lis/PrintPreviewDialog.tsx` adds printer selection to existing preview flows.
- `src/components/lis/StockRawLabelPreviewDialog.tsx` previews and prints raw Stock label HTML batches.
- `src/components/lis/PrinterRegistryCard.tsx` updates copy and adds `พิมพ์ทดสอบ`.
- `src/pages/SettingsPage.tsx` wires test-print mutation.
- `src/components/lis/stock/ReceiveCart.tsx` opens preview instead of immediately printing labels.

---

### Task 1: Normalize Printer Addresses

**Files:**
- Modify: `server/lib/printerRouting.js`
- Modify: `server/lib/printerRouting.test.js`
- Modify: `src/lib/printConfig.ts`
- Create: `src/lib/printConfig.test.ts`

**Interfaces:**
- Produces: `normalizePrinterAddress(value: string): string`
- Produces: `printerTargetFromAddress(value: string): { printerUri: string; display: string; isDirect: boolean }`
- Produces: `validatePrinterInput(input, opts): string | null` accepts bare host/IP and full URLs.
- Produces: `validatePrinterUrl(url: string): string | null` mirrors server validation.

- [ ] **Step 1: Add failing server tests**

Update `server/lib/printerRouting.test.js` import to include:

```js
normalizePrinterAddress,
printerTargetFromAddress,
```

Add tests:

```js
describe('printer address normalization', () => {
  test('accepts direct printer IP and host', () => {
    expect(validatePrinterInput({ kind: 'sticker', cupsPrinterUrl: '192.168.1.50' })).toBeNull();
    expect(validatePrinterInput({ kind: 'a4', cupsPrinterUrl: 'printer.local' })).toBeNull();
  });

  test('normalizes bare values to IPP endpoint', () => {
    expect(normalizePrinterAddress('192.168.1.50')).toBe('ipp://192.168.1.50:631/ipp/print');
    expect(normalizePrinterAddress('printer.local')).toBe('ipp://printer.local:631/ipp/print');
    expect(normalizePrinterAddress('192.168.1.50:632')).toBe('ipp://192.168.1.50:632/ipp/print');
  });

  test('keeps full CUPS and IPP URLs intact', () => {
    expect(normalizePrinterAddress('http://cups:631/printers/Zebra')).toBe('http://cups:631/printers/Zebra');
    expect(normalizePrinterAddress('ipps://printer.local:631/ipp/print')).toBe('ipps://printer.local:631/ipp/print');
  });

  test('resolves target uri for CUPS and direct IPP', () => {
    expect(printerTargetFromAddress('http://cups:631/printers/Zebra')).toEqual({ printerUri: 'ipp://cups:631/printers/Zebra', display: 'http://cups:631/printers/Zebra', isDirect: false });
    expect(printerTargetFromAddress('192.168.1.50')).toEqual({ printerUri: 'ipp://192.168.1.50:631/ipp/print', display: '192.168.1.50', isDirect: true });
  });
});
```

Update existing validation copy expectations from `CUPS printer URL` to `Printer IP / URL` and replace `rejects non-url` with:

```js
test('rejects non-url and non-host input', () => {
  expect(validatePrinterInput({ kind: 'a4', cupsPrinterUrl: 'not a url' })).toMatch(/ไม่ถูกต้อง/);
});
```

- [ ] **Step 2: Verify server test fails**

Run: `npm --prefix server test -- --runTestsByPath lib/printerRouting.test.js`

Expected: FAIL because new helpers are missing.

- [ ] **Step 3: Implement server helpers**

In `server/lib/printerRouting.js`, add:

```js
const URL_PROTOCOLS = ['http:', 'https:', 'ipp:', 'ipps:'];
const HOST_WITH_OPTIONAL_PORT = /^[A-Za-z0-9.-]+(?::\d{1,5})?$/;

function hasUrlProtocol(raw) {
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(raw);
}

function normalizePrinterAddress(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (hasUrlProtocol(raw)) return raw;
  if (!HOST_WITH_OPTIONAL_PORT.test(raw)) throw new Error('Printer IP / URL ไม่ถูกต้อง');
  const parsed = new URL(`ipp://${raw}`);
  if (!parsed.port) parsed.port = '631';
  parsed.pathname = '/ipp/print';
  return parsed.toString();
}

function printerTargetFromAddress(value) {
  const raw = String(value || '').trim();
  const normalized = normalizePrinterAddress(raw);
  const url = new URL(normalized);
  const parts = url.pathname.split('/').filter(Boolean);
  const qi = parts.findIndex((p) => p === 'printers' || p === 'classes');
  const hasQueue = qi >= 0 && parts[qi + 1];
  const protocol = url.protocol === 'https:' ? 'ipps:' : url.protocol === 'http:' ? 'ipp:' : url.protocol;
  return { printerUri: `${protocol}//${url.host}${url.pathname}`, display: raw || normalized, isDirect: !hasQueue };
}
```

Replace `validatePrinterInput` body so it calls `normalizePrinterAddress(raw)`, accepts `URL_PROTOCOLS`, and returns these messages:

```js
if (!raw) return requireUrl ? 'ต้องระบุ Printer IP / URL' : null;
return 'Printer IP / URL ไม่ถูกต้อง';
return 'Printer IP / URL ต้องเป็น IP เครื่องปริ้น, http, https, ipp หรือ ipps';
```

Export the two new helpers.

- [ ] **Step 4: Add client validation test**

Create `src/lib/printConfig.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validatePrinterUrl } from "./printConfig";

describe("validatePrinterUrl", () => {
  it("accepts direct printer IP and host", () => {
    expect(validatePrinterUrl("192.168.1.50")).toBeNull();
    expect(validatePrinterUrl("printer.local")).toBeNull();
  });

  it("accepts CUPS and IPP URLs", () => {
    expect(validatePrinterUrl("http://cups:631/printers/Zebra")).toBeNull();
    expect(validatePrinterUrl("ipps://printer.local:631/ipp/print")).toBeNull();
  });

  it("rejects invalid addresses", () => {
    expect(validatePrinterUrl("")).toMatch(/Printer IP \/ URL/);
    expect(validatePrinterUrl("not a url")).toMatch(/ไม่ถูกต้อง/);
    expect(validatePrinterUrl("ftp://printer.local/printers/x")).toMatch(/Printer IP \/ URL/);
  });
});
```

- [ ] **Step 5: Implement client validation mirror**

In `src/lib/printConfig.ts`, replace `validatePrinterUrl` with a mirror that accepts `HOST_WITH_OPTIONAL_PORT`, parses full URLs, and returns the same three Thai messages as server validation.

- [ ] **Step 6: Run focused tests**

Run: `npm --prefix server test -- --runTestsByPath lib/printerRouting.test.js`

Run: `npx vitest run src/lib/printConfig.test.ts`

Expected: PASS.

---
### Task 2: Add Explicit Printer Selection and Test Print API

**Files:**
- Modify: `server/routes/print.js`
- Modify: `src/lib/api.ts`
- Modify: `src/lib/print.ts`

**Interfaces:**
- Consumes: `printerTargetFromAddress(value: string)` from Task 1.
- Produces: `POST /api/print` body `{ docType: PrintDocType; html: string; copies?: number; printerConfigId?: string }`.
- Produces: `POST /api/print/printers-config/:id/test`.
- Produces: `api.testPrinterConfig(id: string): Promise<PrintResult>`.
- Produces: `printDocument` and `printRawHtmlDocument` accept `printerConfigId` in server mode.

- [ ] **Step 1: Import target helper**

In `server/routes/print.js`, add `printerTargetFromAddress` to the existing destructured import from `../lib/printerRouting`.

- [ ] **Step 2: Replace local CUPS-only target parsing**

Remove `cupsTargetFromUrl` from `server/routes/print.js`. Add:

```js
function printTargetFromConfig(cfg) {
  try {
    return printerTargetFromAddress(cfg.cupsPrinterUrl);
  } catch (err) {
    throw new Error(`Printer IP / URL ไม่ถูกต้อง: ${err.message}`);
  }
}
```

Update both `printViaCups` and `printBuffersViaCups`:

```js
const target = printTargetFromConfig(cfg);
const printer = ipp.Printer(cupsRequestOptions(cfg.cupsPrinterUrl), { uri: target.printerUri, version: '2.0' });
```

- [ ] **Step 3: Normalize request options**

Update `cupsRequestOptions` so it parses `printerTargetFromAddress(cupsPrinterUrl).printerUri` instead of `new URL(cupsPrinterUrl)`. Preserve `rejectUnauthorized` behavior for private `https:`/`ipps:` hosts.

- [ ] **Step 4: Add selected-printer lookup**

Add before the main print endpoint:

```js
async function choosePrinterForDocType(docType, printerConfigId) {
  const kind = kindForDocType(docType);
  if (printerConfigId) {
    const selected = await PrinterConfig.findById(printerConfigId).lean();
    if (!selected) {
      const err = new Error('ไม่พบเครื่องพิมพ์ที่เลือก');
      err.statusCode = 404;
      throw err;
    }
    if (selected.kind !== kind) {
      const err = new Error('เครื่องพิมพ์ที่เลือกไม่ตรงกับชนิดเอกสาร');
      err.statusCode = 400;
      throw err;
    }
    return selected;
  }
  const printers = await PrinterConfig.find({ kind }).lean();
  return pickDefault(printers, kind);
}
```

- [ ] **Step 5: Extract print pipeline**

Create `async function printHtmlJob({ docType, html, copiesOverride, printerConfig })` above `router.post('/')`. Move the existing Puppeteer/render/print code from the current `router.post('/')` try block into it. Keep these behaviors unchanged:

```js
const copies = (Number.isInteger(copiesOverride) && copiesOverride >= 1 && copiesOverride <= 99) ? copiesOverride : 1;
const cfg = { slug: docType, cupsPrinterUrl: printerConfig.cupsPrinterUrl };
if (docType === 'sample-label') {
  const pngBuffers = await renderSampleLabelPngBuffers(page);
  const result = await printBuffersViaCups(pngBuffers, cfg, copies, 'image/png');
  printerTarget = result.target;
} else {
  await page.pdf(pdfOpts);
  const result = await printViaCups(tmpPdf, cfg, copies);
  printerTarget = result.target;
}
return { printer: printerTarget, copies };
```

The helper must close `browser` and delete `tmpPdf` in `finally`, matching the existing route cleanup.

- [ ] **Step 6: Update main print endpoint**

Replace the existing `router.post('/')` body with:

```js
router.post('/', async (req, res) => {
  const { docType, html, copies: copiesOverride, printerConfigId } = req.body || {};
  if (!ALLOWED_SLUGS.includes(docType)) return res.status(400).json({ error: 'docType ไม่ถูกต้อง' });
  if (typeof html !== 'string' || !html.trim()) return res.status(400).json({ error: 'ไม่มีเนื้อหาเอกสาร' });

  try {
    const printerConfig = await choosePrinterForDocType(docType, printerConfigId);
    const result = await printHtmlJob({ docType, html, copiesOverride, printerConfig });
    res.json({ ok: true, printer: result.printer, copies: result.copies });
  } catch (err) {
    const status = err.statusCode || 500;
    const fallback = printerConfigId ? ' หากเครื่องพิมพ์ IP ตรงไม่รองรับ IPP ให้ตั้งผ่าน CUPS URL แทน' : '';
    res.status(status).json({ error: `พิมพ์ไม่สำเร็จ: ${err.message}${fallback}` });
  }
});
```

- [ ] **Step 7: Add test print endpoint**

Add helpers and endpoint before `/pdf`:

```js
function escapeHtmlText(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function testPrintHtml(config) {
  const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  const label = escapeHtmlText(config.label || 'Printer');
  const target = escapeHtmlText(config.cupsPrinterUrl || '-');
  if (config.kind === 'sticker') {
    return `<div style="font-family:'Kanit',sans-serif;width:152mm;height:101mm;box-sizing:border-box;padding:8mm;color:#000;border:1px solid #000;"><div style="font-size:18pt;font-weight:700;margin-bottom:4mm;">LIS Test Print</div><div style="font-size:14pt;line-height:1.5;">Printer: <b>${label}</b></div><div>Kind: sticker</div><div style="word-break:break-all;">Target: ${target}</div><div>${escapeHtmlText(now)}</div></div>`;
  }
  return `<main style="font-family:'Kanit',sans-serif;padding:18mm;color:#000;"><h1>LIS Test Print</h1><p>Printer: <b>${label}</b></p><p>Kind: a4</p><p style="word-break:break-all;">Target: ${target}</p><p>${escapeHtmlText(now)}</p></main>`;
}

router.post('/printers-config/:id/test', async (req, res) => {
  try {
    const printerConfig = await PrinterConfig.findById(req.params.id).lean();
    if (!printerConfig) return res.status(404).json({ error: 'ไม่พบเครื่องพิมพ์' });
    const docType = printerConfig.kind === 'sticker' ? 'stock-label' : 'service-request';
    const result = await printHtmlJob({ docType, html: testPrintHtml(printerConfig), copiesOverride: 1, printerConfig });
    res.json({ ok: true, printer: result.printer, copies: result.copies });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: `พิมพ์ทดสอบไม่สำเร็จ: ${err.message} หากเครื่องพิมพ์ IP ตรงไม่รองรับ IPP ให้ตั้งผ่าน CUPS URL แทน` });
  }
});
```

- [ ] **Step 8: Update client API and print helpers**

In `src/lib/api.ts`:

```ts
printDocument: (payload: { docType: PrintDocType; html: string; copies?: number; printerConfigId?: string }) =>
  client.post("/print", payload).then((r) => r.data as PrintResult),

testPrinterConfig: (id: string) =>
  client.post(`/print/printers-config/${id}/test`).then((r) => r.data as PrintResult),
```

In `src/lib/print.ts`, add `printerConfigId?: string` to server print option types and pass it to `api.printDocument` in both `printDocument` and `printRawHtmlDocument`.

- [ ] **Step 9: Run focused tests**

Run: `npm --prefix server test -- --runTestsByPath lib/printerRouting.test.js`

Run: `npx vitest run src/lib/print.test.ts src/lib/printConfig.test.ts`

Expected: PASS.

---
### Task 3: Add Printer Selection to Existing Preview

**Files:**
- Modify: `src/components/lis/PrintPreviewDialog.tsx`

**Interfaces:**
- Consumes: `api.getPrinterConfigs`, `defaultPrinterFor`, `docTypeToKind`, and Task 2 `printDocument(..., { printerConfigId })`.
- Produces: Existing preview dialog can choose a configured server printer for the document kind.

- [ ] **Step 1: Add imports/state**

Ensure hooks and Select imports include:

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
```

Add state:

```tsx
const [selectedPrinterId, setSelectedPrinterId] = useState("");
```

- [ ] **Step 2: Compute selectable printers**

Replace the current default-only `cfg` calculation with:

```tsx
const printerKind = docTypeToKind(docType);
const serverPrinters = useMemo(
  () => (configs ?? []).filter((printer) => printer.kind === printerKind && printer.cupsPrinterUrl?.trim()),
  [configs, printerKind],
);
const cfg = selectedPrinterId
  ? serverPrinters.find((printer) => printer.id === selectedPrinterId)
  : defaultPrinterFor(configs, printerKind);
```

Add initialization:

```tsx
useEffect(() => {
  if (!open || outputMode !== "server") return;
  if (selectedPrinterId && serverPrinters.some((printer) => printer.id === selectedPrinterId)) return;
  const fallback = defaultPrinterFor(configs, printerKind) ?? serverPrinters[0];
  setSelectedPrinterId(fallback?.id ?? "");
}, [configs, open, outputMode, printerKind, selectedPrinterId, serverPrinters]);
```

- [ ] **Step 3: Print selected printer**

Update the server print call:

```tsx
const res = await printDocument(docType, printRef.current, {
  css,
  copies,
  outputMode: mode,
  printerConfigId: mode === "server" ? cfg?.id : undefined,
});
```

- [ ] **Step 4: Render dropdown**

In the footer next to copy controls, render only in server mode:

```tsx
{outputMode === "server" && serverPrinters.length > 0 && (
  <Select value={cfg?.id ?? ""} onValueChange={setSelectedPrinterId}>
    <SelectTrigger className="h-9 w-[220px]"><SelectValue placeholder="เลือกเครื่องพิมพ์" /></SelectTrigger>
    <SelectContent>
      {serverPrinters.map((printer) => (
        <SelectItem key={printer.id} value={printer.id}>{printer.label?.trim() || printer.cupsPrinterUrl}</SelectItem>
      ))}
    </SelectContent>
  </Select>
)}
```

- [ ] **Step 5: Verify focused tests**

Run: `npx vitest run src/lib/print.test.ts src/lib/printConfig.test.ts`

Expected: PASS.

---

### Task 4: Add Stock Raw Label Batch Preview

**Files:**
- Create: `src/components/lis/StockRawLabelPreviewDialog.tsx`
- Modify: `src/components/lis/stock/ReceiveCart.tsx`

**Interfaces:**
- Consumes: `printRawHtmlDocument("stock-label", html, { copies, outputMode: "server", printerConfigId })`.
- Produces: `StockRawLabelPreviewDialog` props `{ open; labels; onOpenChange; onPrinted? }`.
- Produces: Receive Cart opens preview after successful receive when labels exist.

- [ ] **Step 1: Create preview component**

Create `src/components/lis/StockRawLabelPreviewDialog.tsx` with this structure:

```tsx
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { defaultPrinterFor } from "@/lib/printConfig";
import { printRawHtmlDocument } from "@/lib/print";

type Props = { open: boolean; labels: string[]; onOpenChange: (open: boolean) => void; onPrinted?: () => void };
```

The component must:

```tsx
const [copies, setCopies] = useState(1);
const [selectedPrinterId, setSelectedPrinterId] = useState("");
const [printing, setPrinting] = useState(false);
const { data: configs } = useQuery({ queryKey: ["printer-configs"], queryFn: api.getPrinterConfigs, enabled: open });
const stickerPrinters = useMemo(() => (configs ?? []).filter((printer) => printer.kind === "sticker" && printer.cupsPrinterUrl?.trim()), [configs]);
const selectedPrinter = selectedPrinterId ? stickerPrinters.find((printer) => printer.id === selectedPrinterId) : defaultPrinterFor(configs, "sticker");
const effectivePrinterId = selectedPrinter?.id ?? stickerPrinters[0]?.id ?? "";
```

`handlePrint` must loop through labels and keep receive state independent:

```tsx
for (const html of labels) {
  await printRawHtmlDocument("stock-label", html, { copies, outputMode: "server", printerConfigId: effectivePrinterId });
}
```

Render a dialog that previews `labels[0]` using `dangerouslySetInnerHTML`, shows count text when there are multiple labels, has copy +/- controls, a Sticker printer dropdown, a close button, and a `พิมพ์ฉลาก` button disabled when there are no labels or no printer.

- [ ] **Step 2: Wire ReceiveCart state**

In `src/components/lis/stock/ReceiveCart.tsx`, import:

```tsx
import StockRawLabelPreviewDialog from "@/components/lis/StockRawLabelPreviewDialog";
```

Remove `printRawHtmlDocument` import from this file. Add state:

```tsx
const [pendingLabels, setPendingLabels] = useState<string[]>([]);
const [labelPreviewOpen, setLabelPreviewOpen] = useState(false);
```

- [ ] **Step 3: Replace immediate print loop**

Replace the existing `for (const html of labels)` print loop with:

```tsx
if (labels.length > 0) {
  setPendingLabels(labels);
  setLabelPreviewOpen(true);
}
```

- [ ] **Step 4: Render preview dialog**

Render near the bottom of `ReceiveCart`:

```tsx
<StockRawLabelPreviewDialog
  open={labelPreviewOpen}
  labels={pendingLabels}
  onOpenChange={(open) => {
    setLabelPreviewOpen(open);
    if (!open) setPendingLabels([]);
  }}
  onPrinted={() => setPendingLabels([])}
/>
```

Wrap the current return in a fragment if needed.

- [ ] **Step 5: Run focused checks**

Run: `npx vitest run src/lib/print.test.ts src/lib/printConfig.test.ts src/lib/stockLabel.test.ts`

Expected: PASS.

---
### Task 5: Add Settings Test Print and Printer IP Copy

**Files:**
- Modify: `src/components/lis/PrinterRegistryCard.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/pages/__tests__/SettingsPage.test.tsx`

**Interfaces:**
- Consumes: `api.testPrinterConfig(id: string)` from Task 2.
- Produces: `PrinterRegistryCard` prop `onTestPrint: (id: string) => Promise<unknown>`.
- Produces: visible copy `Printer IP / URL` and per-printer `พิมพ์ทดสอบ` button.

- [ ] **Step 1: Update card props**

In `PrinterRegistryCard.tsx`, add `onTestPrint`:

```tsx
type Props = {
  configs: PrinterConfig[];
  saving?: boolean;
  onCreate: (input: PrinterConfigInput) => Promise<unknown>;
  onUpdate: (id: string, input: Partial<PrinterConfigInput>) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onSetDefault: (id: string) => Promise<unknown>;
  onTestPrint: (id: string) => Promise<unknown>;
};
```

Update the component signature to destructure `onTestPrint`.

- [ ] **Step 2: Add test-print handler**

Import toast if needed:

```tsx
import { toast } from "sonner";
```

Add:

```tsx
async function handleTestPrint(config: PrinterConfig) {
  try {
    await onTestPrint(config.id);
    toast.success(`ส่งพิมพ์ทดสอบไปยัง ${config.label?.trim() || config.cupsPrinterUrl}`);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "พิมพ์ทดสอบไม่สำเร็จ");
  }
}
```

- [ ] **Step 3: Add row button**

In each existing printer row action area, add:

```tsx
<Button type="button" variant="outline" size="sm" onClick={() => void handleTestPrint(config)} disabled={saving}>
  พิมพ์ทดสอบ
</Button>
```

- [ ] **Step 4: Rename copy**

Replace every `CUPS printer URL` visible label with `Printer IP / URL`.

Replace placeholder strings with:

```tsx
placeholder="192.168.1.50 หรือ http://192.168.1.10:631/printers/Zebra"
```

Add under add/edit inputs:

```tsx
<p className="text-xs text-muted-foreground">
  ใส่ IP เครื่องปริ้นโดยตรงได้ถ้าเครื่องรองรับ IPP หรือใส่ CUPS URL เต็มได้เหมือนเดิม
</p>
```

- [ ] **Step 5: Wire SettingsPage mutation**

In `SettingsPage.tsx`, add:

```tsx
const testPrinterMutation = useMutation({ mutationFn: api.testPrinterConfig });
```

Include it in `printerSaving` and pass:

```tsx
onTestPrint={testPrinterMutation.mutateAsync}
```

- [ ] **Step 6: Update test mock**

In `src/pages/__tests__/SettingsPage.test.tsx`, add:

```ts
testPrinterConfig: vi.fn(),
```

- [ ] **Step 7: Run focused Settings test**

Run: `npx vitest run src/pages/__tests__/SettingsPage.test.tsx`

Expected: PASS.

---

### Task 6: Final Integration Verification

**Files:**
- Modify only if tests expose task-related issues.

**Interfaces:**
- Consumes all prior tasks.
- Produces verified, non-build implementation.

- [ ] **Step 1: Run server focused tests**

Run: `npm --prefix server test -- --runTestsByPath lib/printerRouting.test.js`

Expected: PASS.

- [ ] **Step 2: Run client focused tests**

Run: `npx vitest run src/lib/print.test.ts src/lib/printConfig.test.ts src/lib/stockLabel.test.ts src/pages/__tests__/SettingsPage.test.tsx`

Expected: PASS.

- [ ] **Step 3: Run TypeScript no-emit**

Run: `npx tsc --noEmit`

Expected: PASS or only unrelated pre-existing failures. Do not run `tsc -b` as a build step.

- [ ] **Step 4: Manual smoke checklist**

Verify in app:

```text
1. Settings > Printers can save Sticker printer with 192.168.1.50.
2. Saved row keeps the value and can be made default.
3. พิมพ์ทดสอบ sends to that selected printer.
4. Stock Management > Receive with ปริ้นลาเบลหลังรับเข้า opens preview before printing.
5. Preview dropdown lists configured Sticker printers.
6. พิมพ์ฉลาก prints all pending labels to the selected printer.
7. Existing sample-delivery preview still works.
```

- [ ] **Step 5: Confirm no build was run**

Do not run:

```bash
npm run build
npm run build:dev
npm run build:watch
vite build
```

- [ ] **Step 6: Final summary**

Report:

```text
- Direct printer IP support added for Printer IP / URL.
- Stock QR labels now open preview before printing.
- Sticker printer can be selected in preview.
- Settings has per-printer test print.
- Focused tests run and result.
```
