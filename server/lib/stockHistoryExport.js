const fs = require('fs');
const path = require('path');

const STANDARD_TITLE = 'บันทึกการรับ -  การใช้  Standard';
const CHEMICAL_TITLE = 'ใบรับ/เบิกสิ่งของ';
const UNKNOWN_LOT = 'ไม่ระบุ Lot';

function sanitizeFilenameSegment(value) {
  const text = String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^-+|-+$/g, '');
  return text || 'stock';
}

function sanitizeSheetName(value, usedNames = new Set()) {
  const base = String(value || 'Lot')
    .trim()
    .replace(/[\\/*?:[\]]+/g, '-')
    .replace(/'+/g, '')
    .slice(0, 31)
    || 'Lot';
  let name = base;
  let suffix = 2;
  while (usedNames.has(name)) {
    const marker = ` (${suffix})`;
    name = `${base.slice(0, 31 - marker.length)}${marker}`;
    suffix += 1;
  }
  usedNames.add(name);
  return name;
}

function dateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function normalizeExportDateValue(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function buildStandardExportDateRange(startDateValue, endDateValue) {
  const startDate = normalizeExportDateValue(startDateValue);
  const endDate = normalizeExportDateValue(endDateValue);
  if (!startDate) return { error: 'ต้องเลือกวันที่เริ่มต้น' };
  if (!endDate) return { error: 'ต้องเลือกวันที่สิ้นสุด' };
  if (startDate > endDate) return { error: 'วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด' };

  return {
    value: {
      startDate,
      endDate,
      createdAt: {
        $gte: new Date(`${startDate}T00:00:00.000+07:00`),
        $lte: new Date(`${endDate}T23:59:59.999+07:00`),
      },
    },
  };
}

function formatDateForDocument(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function asNumberOrBlank(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : '';
}

function transactionAmount(tx) {
  const value = tx.volumeDelta != null ? tx.volumeDelta : tx.delta;
  const n = Number(value);
  return Number.isFinite(n) ? Math.abs(n) : '';
}

function transactionActor(tx) {
  return tx.userName || tx.userEmail || '';
}

function transactionNote(tx, unit) {
  const parts = [];
  if (unit?.lotBottleNo) parts.push(`ขวดที่ ${unit.lotBottleNo}`);
  if (Array.isArray(tx.weights) && tx.weights.length) parts.push(`weights ${tx.weights.join(', ')} mg`);
  if (tx.instrumentName) parts.push(tx.instrumentName);
  if (tx.note) parts.push(tx.note);
  return parts.join(' · ');
}

function uniqueJoined(values) {
  const unique = [...new Set(values.filter(Boolean))];
  return unique.join(', ');
}

function standardTxSort(a, b) {
  const aTime = new Date(a.createdAt || 0).getTime();
  const bTime = new Date(b.createdAt || 0).getTime();
  if (aTime !== bTime) return aTime - bTime;
  return String(a._id || '').localeCompare(String(b._id || ''), 'en', { numeric: true });
}

function lotSort(a, b) {
  if (a === UNKNOWN_LOT && b !== UNKNOWN_LOT) return 1;
  if (b === UNKNOWN_LOT && a !== UNKNOWN_LOT) return -1;
  return String(a).localeCompare(String(b), 'th', { numeric: true });
}

const STANDARD_LOGO_PATH = path.join(__dirname, '..', 'assets', 'standard-export-logo.png');
const EXCEL_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CONTENT_TYPES_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const DRAWING_NS = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const DRAWING_MAIN_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const DRAWING_REL_NS = REL_NS;

function xmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  }[ch]));
}

function columnName(index) {
  let n = index;
  let out = '';
  while (n > 0) {
    const mod = (n - 1) % 26;
    out = String.fromCharCode(65 + mod) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function cellReference(row, col) {
  return `${columnName(col)}${row}`;
}

function xlsxCell(row, col, value, style = 0) {
  const ref = cellReference(row, col);
  const styleAttr = style ? ` s="${style}"` : '';
  if (value === '' || value === null || value === undefined) return `<c r="${ref}"${styleAttr}/>`;
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${styleAttr}><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function xlsxRow(rowNumber, cells, height) {
  const ht = height ? ` ht="${height}" customHeight="1"` : '';
  return `<row r="${rowNumber}"${ht}>${cells.join('')}</row>`;
}

function emptyStyledCells(row, fromCol, toCol, style) {
  const cells = [];
  for (let col = fromCol; col <= toCol; col += 1) cells.push(xlsxCell(row, col, '', style));
  return cells;
}

function standardWorkbookStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${EXCEL_NS}">
  <fonts count="4">
    <font><sz val="10"/><name val="Tahoma"/></font>
    <font><b/><sz val="11"/><name val="Tahoma"/></font>
    <font><b/><sz val="8"/><name val="Tahoma"/></font>
    <font><sz val="7"/><name val="Tahoma"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left/><right/><top/><bottom style="dotted"><color rgb="FF000000"/></bottom><diagonal/></border>
    <border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="9">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="2" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="2" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="bottom" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;
}

function workbookXml(sheets) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${EXCEL_NS}" xmlns:r="${REL_NS}">
  <sheets>${sheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets>
</workbook>`;
}

function workbookRelsXml(sheets) {
  const sheetRelationships = sheets.map((_, index) => (
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  )).join('\n  ');
  const stylesRelationshipId = sheets.length + 1;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PACKAGE_REL_NS}">
  ${sheetRelationships}
  <Relationship Id="rId${stylesRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PACKAGE_REL_NS}">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function contentTypesXml(sheetCount, includeLogo) {
  const pngDefault = includeLogo ? '<Default Extension="png" ContentType="image/png"/>' : '';
  const worksheetOverrides = Array.from({ length: sheetCount }, (_, index) => (
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  )).join('\n  ');
  const drawingOverrides = includeLogo
    ? Array.from({ length: sheetCount }, (_, index) => (
      `<Override PartName="/xl/drawings/drawing${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`
    )).join('\n  ')
    : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${CONTENT_TYPES_NS}">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${pngDefault}
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${worksheetOverrides}
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${drawingOverrides}
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

function docPropsCoreXml() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>LIS</dc:creator><cp:lastModifiedBy>LIS</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function docPropsAppXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>LIS</Application></Properties>`;
}

function sheetRelsXml(drawingIndex) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PACKAGE_REL_NS}">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingIndex}.xml"/>
</Relationships>`;
}

function drawingRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PACKAGE_REL_NS}">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/standard-export-logo.png"/>
</Relationships>`;
}

function drawingXml() {
  const emu = (px) => Math.round(px * 9525);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="${DRAWING_NS}" xmlns:a="${DRAWING_MAIN_NS}" xmlns:r="${DRAWING_REL_NS}">
  <xdr:oneCellAnchor>
    <xdr:from><xdr:col>0</xdr:col><xdr:colOff>${emu(4)}</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>${emu(1)}</xdr:rowOff></xdr:from>
    <xdr:ext cx="${emu(91)}" cy="${emu(52)}"/>
    <xdr:pic>
      <xdr:nvPicPr><xdr:cNvPr id="2" name="standard-export-logo.png"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>
      <xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>
      <xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:oneCellAnchor>
</xdr:wsDr>`;
}

function readStandardLogo() {
  try {
    return fs.readFileSync(STANDARD_LOGO_PATH);
  } catch (_) {
    return null;
  }
}

function standardWorksheetXml({ rows, merges, lastRow, includeLogo }) {
  const drawing = includeLogo ? '<drawing r:id="rId1"/>' : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${EXCEL_NS}" xmlns:r="${REL_NS}">
  <dimension ref="A1:F${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="13.5" customWidth="1"/>
    <col min="2" max="2" width="17" customWidth="1"/>
    <col min="3" max="3" width="18" customWidth="1"/>
    <col min="4" max="4" width="18" customWidth="1"/>
    <col min="5" max="5" width="22" customWidth="1"/>
    <col min="6" max="6" width="24" customWidth="1"/>
  </cols>
  <sheetData>${rows.join('')}</sheetData>
  <mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>
  <pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.1" footer="0.1"/>
  ${drawing}
</worksheet>`;
}

function buildStandardWorksheetParts({ standard, lotNo, units, transactions }) {
  const unitByQrId = new Map(units.map((unit) => [String(unit.qrId || ''), unit]));
  const sortedTransactions = transactions.slice().sort(standardTxSort);
  const dataRowCount = Math.max(18, sortedTransactions.length);
  const lastRow = 8 + dataRowCount;
  const sheetRows = [];

  sheetRows.push(xlsxRow(1, [
    xlsxCell(1, 1, '', 8),
    xlsxCell(1, 2, STANDARD_TITLE, 1),
    xlsxCell(1, 3, '', 1),
    xlsxCell(1, 4, '', 1),
    xlsxCell(1, 5, '', 1),
    xlsxCell(1, 6, '', 1),
  ], 24));
  sheetRows.push(xlsxRow(2, [
    xlsxCell(2, 1, '', 8),
    xlsxCell(2, 2, 'Product Name', 2),
    xlsxCell(2, 3, ':', 2),
    xlsxCell(2, 4, standard?.name || '', 3),
    xlsxCell(2, 5, '', 3),
    xlsxCell(2, 6, '', 3),
  ], 28));
  sheetRows.push(xlsxRow(3, [
    xlsxCell(3, 1, 'Code Number :', 2),
    xlsxCell(3, 2, standard?.code || '', 3),
    xlsxCell(3, 3, '', 3),
    xlsxCell(3, 4, 'Expiry Date:', 2),
    xlsxCell(3, 5, uniqueJoined(units.map((unit) => formatDateForDocument(unit.exp))), 3),
    xlsxCell(3, 6, '', 3),
  ], 22));
  sheetRows.push(xlsxRow(4, [
    xlsxCell(4, 1, 'Batch/Lot no.:', 2),
    xlsxCell(4, 2, lotNo || UNKNOWN_LOT, 3),
    xlsxCell(4, 3, '', 3),
    xlsxCell(4, 4, 'Uncertainty:', 2),
    xlsxCell(4, 5, '', 3),
    xlsxCell(4, 6, '', 3),
  ], 22));
  sheetRows.push(xlsxRow(5, [
    xlsxCell(5, 1, '% Purity:', 2),
    xlsxCell(5, 2, '', 3),
    xlsxCell(5, 3, '', 3),
    xlsxCell(5, 4, 'อุณหภูมิที่เก็บ :', 2),
    xlsxCell(5, 5, standard?.storageTemp || '', 3),
    xlsxCell(5, 6, '', 3),
  ], 22));
  sheetRows.push(xlsxRow(6, emptyStyledCells(6, 1, 6, 0), 14));
  sheetRows.push(xlsxRow(7, [
    xlsxCell(7, 1, 'วัน/เดือน/ปี', 4),
    xlsxCell(7, 2, 'Total  weight', 4),
    xlsxCell(7, 3, 'น้ำหนักที่ใช้', 4),
    xlsxCell(7, 4, 'น้ำหนักที่เหลือ', 4),
    xlsxCell(7, 5, 'ผู้รับ / ผู้ใช้', 4),
    xlsxCell(7, 6, 'หมายเหตุ', 4),
  ], 18));
  sheetRows.push(xlsxRow(8, [
    xlsxCell(8, 1, 'ที่รับ/ใช้', 5),
    xlsxCell(8, 2, '(mg)', 5),
    xlsxCell(8, 3, '(mg)', 5),
    xlsxCell(8, 4, '(mg)', 5),
    xlsxCell(8, 5, '', 5),
    xlsxCell(8, 6, '', 5),
  ], 18));

  for (let index = 0; index < dataRowCount; index += 1) {
    const tx = sortedTransactions[index];
    const rowNumber = index + 9;
    if (!tx) {
      sheetRows.push(xlsxRow(rowNumber, emptyStyledCells(rowNumber, 1, 6, 6), 18));
      continue;
    }
    const unit = unitByQrId.get(String(tx.qrId || ''));
    const amount = transactionAmount(tx);
    sheetRows.push(xlsxRow(rowNumber, [
      xlsxCell(rowNumber, 1, formatDateForDocument(tx.createdAt), 6),
      xlsxCell(rowNumber, 2, tx.action === 'receive' ? amount : '', 6),
      xlsxCell(rowNumber, 3, tx.action === 'deduct' ? amount : '', 6),
      xlsxCell(rowNumber, 4, asNumberOrBlank(tx.afterQty), 6),
      xlsxCell(rowNumber, 5, transactionActor(tx), 6),
      xlsxCell(rowNumber, 6, transactionNote(tx, unit), 7),
    ], 18));
  }

  const merges = ['B1:F1', 'D2:F2', 'B3:C3', 'E3:F3', 'B4:C4', 'E4:F4', 'B5:C5', 'E5:F5'];
  return { rows: sheetRows, merges, lastRow };
}

function createStandardWorkbook(sheets) {
  const logo = readStandardLogo();
  const includeLogo = Boolean(logo);
  const files = [
    { filename: '[Content_Types].xml', buffer: Buffer.from(contentTypesXml(sheets.length, includeLogo), 'utf8') },
    { filename: '_rels/.rels', buffer: Buffer.from(rootRelsXml(), 'utf8') },
    { filename: 'docProps/core.xml', buffer: Buffer.from(docPropsCoreXml(), 'utf8') },
    { filename: 'docProps/app.xml', buffer: Buffer.from(docPropsAppXml(), 'utf8') },
    { filename: 'xl/workbook.xml', buffer: Buffer.from(workbookXml(sheets), 'utf8') },
    { filename: 'xl/_rels/workbook.xml.rels', buffer: Buffer.from(workbookRelsXml(sheets), 'utf8') },
    { filename: 'xl/styles.xml', buffer: Buffer.from(standardWorkbookStylesXml(), 'utf8') },
  ];
  sheets.forEach((sheet, index) => {
    const sheetNumber = index + 1;
    files.push({
      filename: `xl/worksheets/sheet${sheetNumber}.xml`,
      buffer: Buffer.from(standardWorksheetXml({ ...sheet, includeLogo }), 'utf8'),
    });
  });
  if (includeLogo) {
    sheets.forEach((_, index) => {
      const sheetNumber = index + 1;
      files.push(
        { filename: `xl/worksheets/_rels/sheet${sheetNumber}.xml.rels`, buffer: Buffer.from(sheetRelsXml(sheetNumber), 'utf8') },
        { filename: `xl/drawings/drawing${sheetNumber}.xml`, buffer: Buffer.from(drawingXml(), 'utf8') },
        { filename: `xl/drawings/_rels/drawing${sheetNumber}.xml.rels`, buffer: Buffer.from(drawingRelsXml(), 'utf8') },
      );
    });
    files.push(
      { filename: 'xl/media/standard-export-logo.png', buffer: logo },
    );
  }
  return createZipBuffer(files);
}

function createStandardUsageWorkbook({ standard, lotNo, units, transactions }) {
  return createStandardWorkbook([
    {
      name: 'Standard Usage',
      ...buildStandardWorksheetParts({ standard, lotNo, units, transactions }),
    },
  ]);
}

function buildStandardLotGroups({ units = [], transactions = [] }) {
  const unitByQrId = new Map(units.map((unit) => [String(unit.qrId || ''), unit]));
  const grouped = new Map();

  for (const tx of transactions.filter((item) => item?.itemType === 'standard' && ['receive', 'deduct'].includes(item.action))) {
    const unit = unitByQrId.get(String(tx.qrId || ''));
    const lotNo = unit?.lotNo || UNKNOWN_LOT;
    if (!grouped.has(lotNo)) grouped.set(lotNo, []);
    grouped.get(lotNo).push(tx);
  }

  return [...grouped.keys()].sort(lotSort).map((lotNo) => ({
    lotNo,
    units: units.filter((unit) => (unit.lotNo || UNKNOWN_LOT) === lotNo),
    transactions: grouped.get(lotNo),
  }));
}

function buildStandardLotExportWorkbook({ standard, units = [], transactions = [] }) {
  const safeCode = sanitizeFilenameSegment(standard?.code || standard?.name || 'standard');
  const usedSheetNames = new Set();
  const sheets = buildStandardLotGroups({ units, transactions }).map((group) => ({
    name: sanitizeSheetName(group.lotNo, usedSheetNames),
    ...buildStandardWorksheetParts({
      standard,
      lotNo: group.lotNo,
      units: group.units,
      transactions: group.transactions,
    }),
  }));
  if (sheets.length === 0) return null;
  return {
    filename: `${safeCode}_standard-history.xlsx`,
    buffer: createStandardWorkbook(sheets),
    sheetCount: sheets.length,
  };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function buildSolventRequisitionDoc({ solvent, date, requisitions = [] }) {
  const sizeLabel = solvent?.sizeLiter ? `${solvent.sizeLiter} L` : '';
  const rows = requisitions.map((req, index) => `
    <tr>
      <td>${escapeHtml(formatDateForDocument(req.date || date))}</td>
      <td></td>
      <td>${escapeHtml(req.qty)}</td>
      <td>${escapeHtml(sizeLabel)}</td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td>${index + 1}</td>
      <td>${escapeHtml(req.requestedBy?.name || req.requestedBy?.email || '')}</td>
      <td>${escapeHtml([req.instrumentName, req.note].filter(Boolean).join(' · '))}</td>
    </tr>`).join('');

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${CHEMICAL_TITLE}</title>
  <style>
    body { font-family: "TH Sarabun New", Tahoma, Arial, sans-serif; font-size: 16pt; }
    h1 { text-align: center; font-size: 22pt; margin: 0 0 12px; }
    .meta { margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #000; padding: 4px 5px; text-align: center; vertical-align: middle; }
    th { font-weight: bold; }
    td:last-child { text-align: left; }
    .footer { margin-top: 22px; text-align: right; }
  </style>
</head>
<body>
  <h1>${CHEMICAL_TITLE}</h1>
  <div class="meta">ชนิดสารเคมี ${escapeHtml(solvent?.name || '')}</div>
  <div class="meta">วันที่ ${escapeHtml(formatDateForDocument(date))}</div>
  <table>
    <thead>
      <tr>
        <th>วันที่</th>
        <th>จำนวนที่รับ</th>
        <th>จำนวนที่เบิก</th>
        <th>ขนาดบรรจุ</th>
        <th>Expried date</th>
        <th>Lot NO./<br />Batch NO.</th>
        <th>ยอดคงเหลือ</th>
        <th>ยี่ห้อ</th>
        <th>COA</th>
        <th>ขวดที่</th>
        <th>ผู้รับ/<br />ผู้เบิก</th>
        <th>หมายเหตุ</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="12">ไม่มีข้อมูล</td></tr>'}
    </tbody>
  </table>
  <div class="footer">ผู้ตรวจสอบ........................ วันที่.........../............/.........</div>
  <div>FM-QP-06-06-003-R00 (01/06/65) P1/1</div>
</body>
</html>`;
  return Buffer.from(html, 'utf8');
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function createZipBuffer(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime();

  for (const file of files) {
    const filename = String(file.filename || 'file.bin');
    const nameBuffer = Buffer.from(filename, 'utf8');
    const dataBuffer = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer || '');
    const checksum = crc32(dataBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    localParts.push(localHeader, nameBuffer, dataBuffer);
    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + dataBuffer.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

module.exports = {
  STANDARD_TITLE,
  CHEMICAL_TITLE,
  UNKNOWN_LOT,
  buildStandardExportDateRange,
  buildStandardLotExportWorkbook,
  buildSolventRequisitionDoc,
  createStandardUsageWorkbook,
  createZipBuffer,
  dateStamp,
  formatDateForDocument,
  sanitizeFilenameSegment,
};
