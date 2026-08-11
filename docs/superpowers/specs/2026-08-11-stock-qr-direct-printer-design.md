# Stock QR Direct Printer Preview Design

## Goal

Stock Management should print QR labels through a preview flow before sending to a printer, matching the sample-delivery label experience. Users must be able to choose a configured Sticker printer at print time. System Settings must accept a direct printer IP for network printers, keep supporting existing CUPS/IPP URLs, and provide a test-print action.

## Current State

- Printer destinations are stored in `PrinterConfig` with `kind`, `label`, `cupsPrinterUrl`, and `isDefault`.
- Print routing maps `stock-label` and `sample-label` to the `sticker` kind.
- `PrintPreviewDialog` already previews printable React content and prints through the default printer for a document kind.
- Stock receiving currently builds raw label HTML and calls `printRawHtmlDocument("stock-label", html)` immediately, so there is no preview or printer choice.
- Server validation currently requires a full CUPS queue URL such as `http://host:631/printers/name`.

## Scope

- Add preview-first printing for Stock QR labels generated during Stock receive.
- Allow users to select one configured Sticker printer in the Stock label preview.
- Add backend support for choosing a specific printer by `printerConfigId` per print request.
- Rename printer setup language from CUPS-only to `Printer IP / URL`.
- Accept direct printer IPs, IPP/IPPS URLs, HTTP(S) CUPS URLs, and keep existing records valid.
- Add a test-print button for each configured printer.

## Direct Printer IP Behavior

When the input is a bare host/IP, the system treats it as a direct IPP printer and normalizes it for printing:

- `192.168.1.50` becomes `ipp://192.168.1.50:631/ipp/print`.
- `printer.local` becomes `ipp://printer.local:631/ipp/print`.
- Full URLs remain explicit. Existing CUPS URLs like `http://cups-host:631/printers/Zebra` continue to print through their queue path.

The server should report a clear failure if the direct printer does not support IPP/PDF/PNG printing. Raw socket printing on port `9100` is intentionally out of scope because current labels are rendered from HTML, not model-specific ZPL/ESC-POS commands.

## Stock QR Preview Flow

The Receive Cart should collect generated stock-label HTML after successful receive. If printing is enabled and labels exist, it opens a Stock label preview dialog instead of immediately sending jobs.

The dialog should:

- Show a preview using the same visual content that will be printed.
- Show a Sticker printer dropdown populated from System Settings.
- Default to the configured default Sticker printer, then fall back to the first Sticker printer.
- Allow changing copies.
- Print all pending labels to the selected printer.
- Keep receive success independent from print success. If printing fails, received stock remains saved.

## Printer Selection API

`POST /api/print` should accept optional `printerConfigId` in addition to `docType`, `html`, and `copies`.

- If `printerConfigId` is provided, the server validates that it exists and matches the document kind.
- If omitted, the current default-printer behavior remains unchanged.
- The response should include the chosen display target and number of copies.

## Test Print

System Settings should add a `พิมพ์ทดสอบ` action per printer row.

The test job should:

- Print to the selected printer, not the default printer.
- Use `stock-label` format for Sticker printers and an A4 test page for A4 printers.
- Include printer label, kind, host/URL, and current timestamp.
- Reuse the same backend print pipeline as normal printing so it validates real connectivity.

## UI Copy

- Replace `CUPS printer URL` with `Printer IP / URL`.
- Placeholder examples: `192.168.1.50` and `http://192.168.1.10:631/printers/Zebra`.
- Helper text should explain that direct IP requires a printer that supports IPP network printing.

## Error Handling

- Invalid input shows a validation message before saving.
- Printer kind mismatch returns a 400 response.
- Missing selected printer returns a 404 response.
- Direct printer IP that rejects IPP shows a practical message telling the user to use the CUPS URL fallback.
- Test print success/failure is shown with toast feedback.

## Validation

- Add/update unit tests for printer URL normalization and validation.
- Add API coverage for explicit `printerConfigId` routing where feasible.
- Add client tests only where existing test structure makes the behavior straightforward.
- Do not run production build commands on this machine.
