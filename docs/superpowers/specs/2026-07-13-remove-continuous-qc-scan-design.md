# Remove Continuous QC Scan Design

## Goal

Simplify the QC sample-receiving flow so users cannot choose between
continuing to scan and opening the assigned QC work. After a successful
receipt, the application must always open that petition's QC testing page.

## Scope

Update only `QrReceiveModal`, which is opened from the QC testing queue. Keep
QR-camera scanning, manual petition-number entry, validation, and the receive
API request unchanged.

Remove the continuous-scan switch and all state or UI used solely to support
it: the received-items session list, transient success notice, and timer. The
modal will no longer offer controls to remain on the receiving screen after a
successful receipt.

## Behavior

When a user confirms receipt, the modal continues to call the existing QC
receive endpoint and refresh the queue. On a successful response it immediately
navigates to `/qc-testing/:id`, using the received petition ID. It does not
render a success screen or restart the scanner.

If lookup, validation, or receiving fails, the existing error and retry flow
remains available. Closing the modal before a successful receipt remains
unchanged.

## Testing

Update the focused `QrReceiveModal` tests to assert that the continuous-scan
label and switch are absent. Add a receipt-success test that confirms the
receive request, queue-refresh callback, and automatic route change to the
received petition's QC testing page. Retain coverage for manual entry and the
camera-failure fallback.
