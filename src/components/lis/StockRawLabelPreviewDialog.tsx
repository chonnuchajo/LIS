import PrintPreviewDialog from "@/components/lis/PrintPreviewDialog";

type Props = {
  open: boolean;
  labels: string[];
  onOpenChange: (open: boolean) => void;
  onPrinted?: () => void;
  autoPrint?: boolean;
  autoPrintKey?: string | number;
};

const STOCK_LABEL_PREVIEW_CSS = `
  @page { size: 65mm 25mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .stock-label-root { width: 65mm; margin: 0; padding: 0; }
  .stock-label-page {
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    width: 65mm;
    height: 25mm;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    overflow: hidden;
  }
  .stock-label-page > * { flex: 0 0 65mm; }
  .stock-label-page, .stock-label-page * {
    color: #000 !important;
    border-color: #000 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @media print {
    html, body { margin: 0; padding: 0; width: 65mm; height: 25mm; }
    .stock-label-page { break-after: page; page-break-after: always; }
    .stock-label-page:last-child { break-after: auto; page-break-after: auto; }
  }
`;

export default function StockRawLabelPreviewDialog({ open, labels, onOpenChange, onPrinted, autoPrint, autoPrintKey }: Props) {
  return (
    <PrintPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      docType="stock-label"
      css={STOCK_LABEL_PREVIEW_CSS}
      onPrinted={() => onPrinted?.()}
      autoPrint={autoPrint}
      autoPrintKey={autoPrintKey}
    >
      <div className="stock-label-root">
        {labels.map((html, index) => (
          <div
            key={`${index}-${html.length}`}
            className="stock-label-page"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ))}
      </div>
    </PrintPreviewDialog>
  );
}
