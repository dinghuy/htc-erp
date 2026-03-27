import { PDFDocument, rgb, PDFFont, PDFPage, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';

export interface QuotationPdfData {
  quoteNumber: string;
  subject: string;
  date: string;
  customer: {
    name: string;
    address: string;
    taxCode: string;
    contact: string;
    phone: string;
  };
  salesPerson: string;
  salesPersonPhone: string;
  currency: string;
  items: Array<{
    no: number | string;
    code: string;
    commodity: string;
    unit: string;
    qty: number;
    unitPrice: number;
    amount: number;
    remarks: string;
  }>;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  terms: {
    validity: string;
    validityEn?: string;
    payment: string;
    paymentEn?: string;
    delivery: string;
    deliveryEn?: string;
    warranty: string;
    warrantyEn?: string;
    remarks?: string;
    remarksEn?: string;
    termItems?: Array<{
      labelViPrint: string;
      labelEn: string;
      textVi: string;
      textEn: string;
    }>;
  };
}

// Brand Colors (LDA Blue - Stitch Premium)
const LDA_BLUE = rgb(0 / 255, 63 / 255, 133 / 255); // #003F85
const TEXT_MAIN = rgb(26 / 255, 32 / 255, 44 / 255);
const TEXT_LIGHT = rgb(100 / 255, 116 / 255, 139 / 255);
const BORDER_COLOR = rgb(26 / 255, 32 / 255, 44 / 255);
const TABLE_HEADER_FILL = rgb(91 / 255, 155 / 255, 213 / 255);
const GRID_LINE_THICKNESS = 0.9;

const PAGE_SIZE: [number, number] = [595.28, 841.89]; // A4
const PAGE_WIDTH = PAGE_SIZE[0];
const PAGE_HEIGHT = PAGE_SIZE[1];
const TOP_MARGIN = 28.35; // 1 cm
const NEW_PAGE_TOP_MARGIN = 28.35;
const LEFT_MARGIN = 14.17; // 0.5 cm
const RIGHT_MARGIN = 14.17;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
const BASE_CONTENT_WIDTH = 495.28;
const CONTENT_SCALE = CONTENT_WIDTH / BASE_CONTENT_WIDTH;
const HEADER_RULE_OFFSET = 65;
const HEADER_RULE_THICKNESS = 1.5;
const TITLE_TOP_SPACING = 30;
const TITLE_SUB_SPACING = 25;
const TITLE_AFTER_SPACING = 35;
const HEADER_COMPANY_FONT_SIZE = 11;
const HEADER_INFO_FONT_SIZE = 9;
const HEADER_TEXT_LEADING = 11;
const INFO_GRID_LEFT_COL_X = LEFT_MARGIN;
const INFO_GRID_LEFT_COL_W = 255 * CONTENT_SCALE;
const INFO_GRID_GAP = 25 * CONTENT_SCALE;
const INFO_GRID_LABEL_LEFT_W = 95 * CONTENT_SCALE;
const INFO_GRID_LABEL_RIGHT_W = 80 * CONTENT_SCALE;
const INFO_GRID_LEFT_VAL_X = INFO_GRID_LEFT_COL_X + INFO_GRID_LABEL_LEFT_W;
const INFO_GRID_RIGHT_COL_X = INFO_GRID_LEFT_COL_X + INFO_GRID_LEFT_COL_W + INFO_GRID_GAP;
const INFO_GRID_RIGHT_VAL_X = INFO_GRID_RIGHT_COL_X + INFO_GRID_LABEL_RIGHT_W;
const INFO_GRID_COL_VAL_W = 160 * CONTENT_SCALE;
const INFO_GRID_RIGHT_VAL_W = 150 * CONTENT_SCALE;
const TABLE_COL_WIDTHS = Object.freeze([
  22 * CONTENT_SCALE,
  68 * CONTENT_SCALE,
  140 * CONTENT_SCALE,
  28 * CONTENT_SCALE,
  25 * CONTENT_SCALE,
  85 * CONTENT_SCALE,
  75 * CONTENT_SCALE,
  CONTENT_WIDTH - (22 + 68 + 140 + 28 + 25 + 85 + 75) * CONTENT_SCALE,
]) as ReadonlyArray<number>;
const TABLE_HEADER_HEIGHT = 24;
const FONT_DIR = path.join(__dirname, '..', 'frontend', 'public');
const WORKSPACE_DIR = path.join(__dirname, '..', '..');
const TIMES_NEW_ROMAN_PATHS = [
  path.join(FONT_DIR, 'Times New Roman.ttf'),
  path.join(WORKSPACE_DIR, 'Times New Roman.ttf'),
];
const TIMES_NEW_ROMAN_BOLD_PATHS = [
  path.join(FONT_DIR, 'Times New Roman Bold.ttf'),
  path.join(WORKSPACE_DIR, 'Times New Roman Bold.ttf'),
];
const TIMES_NEW_ROMAN_ITALIC_PATHS = [
  path.join(FONT_DIR, 'Times New Roman Italic.ttf'),
  path.join(WORKSPACE_DIR, 'Times New Roman Italic.ttf'),
];
const TIMES_NEW_ROMAN_BOLD_ITALIC_PATHS = [
  path.join(FONT_DIR, 'Times New Roman Bold Italic.ttf'),
  path.join(WORKSPACE_DIR, 'Times New Roman Bold Italic.ttf'),
];
const LDA_LOGO_PATH = path.join(FONT_DIR, 'lda-logo.png');
const LOGO_TARGET_WIDTH = 90;
const LOGO_OFFSET_X = 28.35; // 1 cm
const LOGO_OFFSET_Y = 8.5; // 0.3 cm
const SIMULATED_BOLD_OFFSET = 0.35;
const ITALIC_SKEW = degrees(12);

// Layout constants (reference measurements)
const SPEC_TABLE_COLS = Object.freeze(TABLE_COL_WIDTHS) as ReadonlyArray<number>;
const SPEC_EXPECTED = Object.freeze({
  leftMargin: LEFT_MARGIN,
  rightMargin: RIGHT_MARGIN,
  tableCols: SPEC_TABLE_COLS,
  headerRuleY: Number((PAGE_HEIGHT - TOP_MARGIN - HEADER_RULE_OFFSET).toFixed(2)),
  titleY: Number((PAGE_HEIGHT - TOP_MARGIN - HEADER_RULE_OFFSET - TITLE_TOP_SPACING).toFixed(2)),
  infoGrid: {
    leftColX: INFO_GRID_LEFT_COL_X,
    leftValX: INFO_GRID_LEFT_VAL_X,
    rightColX: INFO_GRID_RIGHT_COL_X,
    rightValX: INFO_GRID_RIGHT_VAL_X,
    colValW: INFO_GRID_COL_VAL_W,
    rightValW: INFO_GRID_RIGHT_VAL_W,
  },
  tableHeaderFill: {
    r: 91,
    g: 155,
    b: 213,
  },
  gridLineThickness: 0.9,
} as const);

const validateLayoutSpec = () => {
  const expected = SPEC_EXPECTED;
  const currentTableWidth = TABLE_COL_WIDTHS.reduce((sum, width) => sum + width, 0);
  const expectedTableWidth = expected.tableCols.reduce((sum, width) => sum + width, 0);
  const headerRuleY = PAGE_HEIGHT - TOP_MARGIN - HEADER_RULE_OFFSET;
  const titleY = headerRuleY - TITLE_TOP_SPACING;

  if (LEFT_MARGIN !== expected.leftMargin || RIGHT_MARGIN !== expected.rightMargin) {
    throw new Error(
      `Margin mismatch: left ${LEFT_MARGIN} (expected ${expected.leftMargin}), right ${RIGHT_MARGIN} (expected ${expected.rightMargin})`,
    );
  }
  if (currentTableWidth !== expectedTableWidth || currentTableWidth !== CONTENT_WIDTH) {
    throw new Error(
      `Table width mismatch: ${currentTableWidth} (expected ${expectedTableWidth}, content ${CONTENT_WIDTH})`,
    );
  }
  if (TABLE_COL_WIDTHS.length !== expected.tableCols.length || !TABLE_COL_WIDTHS.every((w, i) => w === expected.tableCols[i])) {
    throw new Error(`Table columns mismatch: ${TABLE_COL_WIDTHS.join(',')} (expected ${expected.tableCols.join(',')})`);
  }
  if (Number(headerRuleY.toFixed(2)) !== expected.headerRuleY) {
    throw new Error(`Header rule Y mismatch: ${headerRuleY.toFixed(2)} (expected ${expected.headerRuleY})`);
  }
  if (Number(titleY.toFixed(2)) !== expected.titleY) {
    throw new Error(`Title Y mismatch: ${titleY.toFixed(2)} (expected ${expected.titleY})`);
  }
  if (INFO_GRID_LEFT_COL_X !== expected.infoGrid.leftColX || INFO_GRID_LEFT_VAL_X !== expected.infoGrid.leftValX) {
    throw new Error(
      `Info grid left anchors mismatch: col ${INFO_GRID_LEFT_COL_X}, val ${INFO_GRID_LEFT_VAL_X} (expected ${expected.infoGrid.leftColX}, ${expected.infoGrid.leftValX})`,
    );
  }
  if (INFO_GRID_RIGHT_COL_X !== expected.infoGrid.rightColX || INFO_GRID_RIGHT_VAL_X !== expected.infoGrid.rightValX) {
    throw new Error(
      `Info grid right anchors mismatch: col ${INFO_GRID_RIGHT_COL_X}, val ${INFO_GRID_RIGHT_VAL_X} (expected ${expected.infoGrid.rightColX}, ${expected.infoGrid.rightValX})`,
    );
  }
  if (INFO_GRID_COL_VAL_W !== expected.infoGrid.colValW || INFO_GRID_RIGHT_VAL_W !== expected.infoGrid.rightValW) {
    throw new Error(
      `Info grid widths mismatch: left ${INFO_GRID_COL_VAL_W}, right ${INFO_GRID_RIGHT_VAL_W} (expected ${expected.infoGrid.colValW}, ${expected.infoGrid.rightValW})`,
    );
  }
  const headerFill = TABLE_HEADER_FILL as unknown as { red: number; green: number; blue: number };
  const to255 = (value: number) => Math.round(value * 255);
  if (
    to255(headerFill.red) !== expected.tableHeaderFill.r
    || to255(headerFill.green) !== expected.tableHeaderFill.g
    || to255(headerFill.blue) !== expected.tableHeaderFill.b
  ) {
    throw new Error(
      `Table header fill mismatch: ${to255(headerFill.red)},${to255(headerFill.green)},${to255(headerFill.blue)} (expected ${expected.tableHeaderFill.r},${expected.tableHeaderFill.g},${expected.tableHeaderFill.b})`,
    );
  }
  if (GRID_LINE_THICKNESS !== expected.gridLineThickness) {
    throw new Error(`Grid line thickness mismatch: ${GRID_LINE_THICKNESS} (expected ${expected.gridLineThickness})`);
  }
};

const resolveFontPath = (paths: string[]): string | null => {
  for (const candidate of paths) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

export async function generateQuotationPdf(data: QuotationPdfData): Promise<Uint8Array> {
  if (process.env.NODE_ENV !== 'production') {
    validateLayoutSpec();
  }

  const regularPath = resolveFontPath(TIMES_NEW_ROMAN_PATHS);
  const boldPath = resolveFontPath(TIMES_NEW_ROMAN_BOLD_PATHS);
  const italicPath = resolveFontPath(TIMES_NEW_ROMAN_ITALIC_PATHS);
  const boldItalicPath = resolveFontPath(TIMES_NEW_ROMAN_BOLD_ITALIC_PATHS);

  if (!regularPath) {
    throw new Error(`Missing Times New Roman font. Checked: ${TIMES_NEW_ROMAN_PATHS.join(', ')}`);
  }
  if (!fs.existsSync(LDA_LOGO_PATH)) {
    throw new Error(`Missing L&D logo at ${LDA_LOGO_PATH}`);
  }

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Load Times New Roman (use bold/italic if available, fallback to regular)
  const timesNewRoman = await pdfDoc.embedFont(fs.readFileSync(regularPath));
  const timesNewRomanBold = boldPath ? await pdfDoc.embedFont(fs.readFileSync(boldPath)) : timesNewRoman;
  const timesNewRomanItalic = italicPath ? await pdfDoc.embedFont(fs.readFileSync(italicPath)) : timesNewRoman;
  const timesNewRomanBoldItalic = boldItalicPath
    ? await pdfDoc.embedFont(fs.readFileSync(boldItalicPath))
    : (boldPath ? timesNewRomanBold : timesNewRoman);
  const simulateBold = !boldPath;
  const simulateItalic = !italicPath && !boldItalicPath;

  let page = pdfDoc.addPage(PAGE_SIZE);
  const { width, height } = page.getSize();
  let y = height - TOP_MARGIN;

  const drawTextWithFont = (
    pg: PDFPage,
    text: string,
    options: {
      x: number;
      y: number;
      size: number;
      font: PDFFont;
      color?: ReturnType<typeof rgb>;
      lineHeight?: number;
      rotate?: ReturnType<typeof degrees>;
      xSkew?: ReturnType<typeof degrees>;
      ySkew?: ReturnType<typeof degrees>;
    },
    simulate = false,
  ) => {
    if (!simulate) {
      pg.drawText(text, options);
      return;
    }
    pg.drawText(text, options);
    pg.drawText(text, { ...options, x: options.x + SIMULATED_BOLD_OFFSET });
  };

  const splitLongToken = (token: string, maxWidth: number, fontSize: number, font: PDFFont): string[] => {
    const parts: string[] = [];
    let start = 0;
    while (start < token.length) {
      let low = start + 1;
      let high = token.length;
      let best = low;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const candidate = token.slice(start, mid);
        const candidateWidth = font.widthOfTextAtSize(candidate, fontSize);
        if (candidateWidth <= maxWidth) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      parts.push(token.slice(start, best));
      start = best;
    }
    return parts;
  };

  const wrapTextLines = (text: string, maxWidth: number, fontSize: number, font: PDFFont): string[] => {
    if (!text) return [''];

    const paragraphs = text.split('\n');
    const lines: string[] = [];

    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) {
        lines.push('');
        continue;
      }
      const words = paragraph.split(/\s+/);
      let line = '';

      for (const word of words) {
        const wordWidth = font.widthOfTextAtSize(word, fontSize);
        if (wordWidth > maxWidth) {
          if (line) {
            lines.push(line);
            line = '';
          }
          const segments = splitLongToken(word, maxWidth, fontSize, font);
          if (segments.length > 0) {
            for (let i = 0; i < segments.length - 1; i += 1) {
              lines.push(segments[i]);
            }
            line = segments[segments.length - 1];
          }
          continue;
        }
        const testLine = line ? line + ' ' + word : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        if (testWidth > maxWidth && line !== '') {
          lines.push(line);
          line = word;
        } else {
          line = testLine;
        }
      }
      lines.push(line);
    }

    return lines.length ? lines : [''];
  };

  const drawWrappedText = (
    pg: PDFPage, text: string, x: number, startY: number,
    maxWidth: number, fontSize: number, font: PDFFont, color = TEXT_MAIN, simulate = false
  ): number => {
    if (!text) return startY;

    // Split text by newlines first to honor explicit line breaks
    const paragraphs = text.split('\n');
    let curY = startY;
    const lineHeight = fontSize * 1.5;

    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) {
        curY -= lineHeight;
        continue;
      }
      const words = paragraph.split(/\s+/);
      let line = '';

      for (const word of words) {
        const wordWidth = font.widthOfTextAtSize(word, fontSize);
        if (wordWidth > maxWidth) {
          if (line) {
            drawTextWithFont(pg, line, { x, y: curY, size: fontSize, font, color }, simulate);
            line = '';
            curY -= lineHeight;
          }
          const segments = splitLongToken(word, maxWidth, fontSize, font);
          if (segments.length > 0) {
            for (let i = 0; i < segments.length - 1; i += 1) {
              drawTextWithFont(pg, segments[i], { x, y: curY, size: fontSize, font, color }, simulate);
              curY -= lineHeight;
            }
            line = segments[segments.length - 1];
          }
          continue;
        }
        const testLine = line ? line + ' ' + word : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        if (testWidth > maxWidth && line !== '') {
          drawTextWithFont(pg, line, { x, y: curY, size: fontSize, font, color }, simulate);
          line = word;
          curY -= lineHeight;
        } else {
          line = testLine;
        }
      }
      drawTextWithFont(pg, line, { x, y: curY, size: fontSize, font, color }, simulate);
      curY -= lineHeight;
    }
    return curY + fontSize * 0.5; // adjust back slighty for the next element
  };

  // 1. HEADER (Logo & Company Info)
  try {
    const logoBytes = fs.readFileSync(LDA_LOGO_PATH);
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoScale = LOGO_TARGET_WIDTH / logoImage.width;
    const logoHeight = logoImage.height * logoScale;
    page.drawImage(logoImage, {
      x: LEFT_MARGIN + LOGO_OFFSET_X,
      y: y - logoHeight + LOGO_OFFSET_Y,
      width: LOGO_TARGET_WIDTH,
      height: logoHeight,
    });
  } catch (err) {
    console.warn('Logo integration failed:', err);
  }

  const headerRightX = width - RIGHT_MARGIN;
  const headerLines: Array<{
    text: string;
    size: number;
    font: PDFFont;
    color: ReturnType<typeof rgb>;
    simulate?: boolean;
  }> = [
    { text: 'L&D AUTO COMPANY LIMITED', size: HEADER_COMPANY_FONT_SIZE, font: timesNewRomanBold, color: LDA_BLUE, simulate: true },
    { text: 'HW 51, My Tan Quarter,', size: HEADER_INFO_FONT_SIZE, font: timesNewRoman, color: TEXT_LIGHT },
    { text: 'Phu My Ward, Ho Chi Minh City, Vietnam', size: HEADER_INFO_FONT_SIZE, font: timesNewRoman, color: TEXT_LIGHT },
    { text: 'Tel: +84 254 6263 118    Fax: +84 254 6263 119', size: HEADER_INFO_FONT_SIZE, font: timesNewRoman, color: TEXT_LIGHT },
    { text: 'Web: www.ldauto.vn    Hotline: 1900 9696 64', size: HEADER_INFO_FONT_SIZE, font: timesNewRoman, color: TEXT_LIGHT },
  ];
  let headerTextY = y - 8;
  for (const line of headerLines) {
    const textWidth = line.font.widthOfTextAtSize(line.text, line.size);
    const x = headerRightX - textWidth;
    drawTextWithFont(page, line.text, {
      x,
      y: headerTextY,
      size: line.size,
      font: line.font,
      color: line.color,
    }, Boolean(line.simulate));
    headerTextY -= HEADER_TEXT_LEADING;
  }

  y -= HEADER_RULE_OFFSET;
  page.drawLine({ start: { x: LEFT_MARGIN, y }, end: { x: width - RIGHT_MARGIN, y }, color: LDA_BLUE, thickness: HEADER_RULE_THICKNESS });

  // 2. TITLE SECTION (Centered)
  y -= TITLE_TOP_SPACING;
  const titleText = 'QUOTATION/BÁO GIÁ';
  drawTextWithFont(page, titleText, {
    x: width / 2 - timesNewRomanBold.widthOfTextAtSize(titleText, 20) / 2,
    y,
    size: 20,
    font: timesNewRomanBold,
    color: LDA_BLUE,
  }, simulateBold);

  y -= TITLE_SUB_SPACING;
  const noText = `No/Số: ${data.quoteNumber}`;
  drawTextWithFont(page, noText, {
    x: width / 2 - timesNewRomanBold.widthOfTextAtSize(noText, 12) / 2, y: y, size: 12, font: timesNewRomanBold
  }, simulateBold);

  y -= TITLE_AFTER_SPACING;

  // 3. CUSTOMER INFO GRID (Dynamic Wrapping)
  const leftColX = INFO_GRID_LEFT_COL_X;
  const leftValX = INFO_GRID_LEFT_VAL_X;
  const rightColX = INFO_GRID_RIGHT_COL_X;
  const rightValX = INFO_GRID_RIGHT_VAL_X;
  const colValW = INFO_GRID_COL_VAL_W;

  const drawWrappedField = (pg: PDFPage, label: string, value: string, lx: number, vx: number, curY: number, maxWidth: number) => {
    drawTextWithFont(pg, label, { x: lx + 5, y: curY, size: 11, font: timesNewRomanBold, color: TEXT_LIGHT }, simulateBold);
    return drawWrappedText(pg, value || '—', vx, curY, maxWidth, 11, timesNewRoman, TEXT_MAIN);
  };

  let ly = y - 13;
  ly = drawWrappedField(page, 'Customer / KH:', data.customer.name, leftColX, leftValX, ly, colValW) - 10;
  ly = drawWrappedField(page, 'Address / ĐC:', data.customer.address, leftColX, leftValX, ly, colValW) - 10;
  ly = drawWrappedField(page, 'Tax code / MST:', data.customer.taxCode, leftColX, leftValX, ly, colValW) - 10;
  ly = drawWrappedField(page, 'Contact / LH:', data.customer.contact, leftColX, leftValX, ly, colValW) - 10;
  ly = drawWrappedField(page, 'Phone / ĐT:', data.customer.phone, leftColX, leftValX, ly, colValW) - 10;

  let ry = y - 13;
  ry = drawWrappedField(page, 'Date / Ngày:', data.date, rightColX, rightValX, ry, INFO_GRID_RIGHT_VAL_W) - 10;
  ry = drawWrappedField(page, 'Sales / NV:', data.salesPerson, rightColX, rightValX, ry, INFO_GRID_RIGHT_VAL_W) - 10;
  ry = drawWrappedField(page, 'Sale Phone:', data.salesPersonPhone, rightColX, rightValX, ry, INFO_GRID_RIGHT_VAL_W) - 10;
  ry = drawWrappedField(page, 'Crcy / Tiền:', data.currency, rightColX, rightValX, ry, INFO_GRID_RIGHT_VAL_W) - 10;

  const gridEndH = Math.min(ly, ry);
  y = gridEndH - 5;

  // ─── Subject line ───
  if (data.subject) {
    const subjClean = data.subject.trim();
    drawTextWithFont(page, `Subject / V/v: ${subjClean}`, {
      x: LEFT_MARGIN, y: y - 14, size: 13, font: timesNewRomanBold, color: LDA_BLUE,
    }, simulateBold);
    y -= 35;
  } else {
    y -= 15;
  }

  drawTextWithFont(page, 'Dear Sir/Madam, / Thưa Ông/Bà,', {
    x: LEFT_MARGIN, y, size: 12, font: timesNewRomanBold
  }, simulateBold);
  y -= 17;
  drawTextWithFont(page, 'We are glad to offer you the quotation as following / Chúng tôi xin gửi đến quý công ty bảng chào giá như sau:', {
    x: LEFT_MARGIN, y, size: 11, font: timesNewRoman, color: TEXT_LIGHT
  });
  y -= 15;

  // 4. ITEMS TABLE
  // Total usable width = 495pt (width 595 - margins 50*2)
  // Font size for items = 9 to prevent overflow
  const ITEM_ROW_FONT_SIZE = 9;
  const ITEM_CODE_FONT_SIZE = ITEM_ROW_FONT_SIZE + 1.5;
  const ITEM_NUM_FONT_SIZE = ITEM_ROW_FONT_SIZE + 1.5;

  // Helper: truncate text to fit within maxWidth at given font/size
  const truncateText = (text: string, maxWidth: number, font: PDFFont, size: number): string => {
    if (!text) return '';
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 0 && font.widthOfTextAtSize(truncated + '…', size) > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '…';
  };

  const cols = [
    { labelEn: 'No.', labelVi: 'Stt', w: TABLE_COL_WIDTHS[0] },
    { labelEn: 'Part name', labelVi: 'Mã hàng', w: TABLE_COL_WIDTHS[1] },
    { labelEn: 'Commodity', labelVi: 'Tên hàng hóa', w: TABLE_COL_WIDTHS[2] },
    { labelEn: 'Unit', labelVi: 'ĐV', w: TABLE_COL_WIDTHS[3] },
    { labelEn: 'Q.ty', labelVi: 'S.lg', w: TABLE_COL_WIDTHS[4] },
    { labelEn: 'Unit price', labelVi: 'Đơn giá', w: TABLE_COL_WIDTHS[5], align: 'right' },
    { labelEn: 'Total', labelVi: 'Thành tiền', w: TABLE_COL_WIDTHS[6], align: 'right' },
    { labelEn: 'Remarks', labelVi: 'Ghi chú', w: TABLE_COL_WIDTHS[7] }
  ];

  const HEADER_FONT_SIZE = 9;

  // Draw Items
  const tableStartX = LEFT_MARGIN;
  const tableEndX = width - RIGHT_MARGIN;
  const tableColX = [tableStartX];
  for (const c of cols) {
    tableColX.push(tableColX[tableColX.length - 1] + c.w);
  }
  const tableBottomMargin = TOP_MARGIN;
  const rowTextTopOffset = 13;
  const rowBottomPadding = 6;
  const maxRowFontSize = Math.max(ITEM_ROW_FONT_SIZE, ITEM_CODE_FONT_SIZE, ITEM_NUM_FONT_SIZE);
  const rowLineHeight = maxRowFontSize * 1.5;
  const MIN_ROW_HEIGHT = Math.max(16, rowTextTopOffset + rowLineHeight - maxRowFontSize * 0.5 + rowBottomPadding);

  const drawHeaderGrid = (topY: number, bottomY: number) => {
    // Vertical lines
    for (const x of tableColX) {
      page.drawLine({ start: { x, y: topY }, end: { x, y: bottomY }, color: BORDER_COLOR, thickness: GRID_LINE_THICKNESS });
    }
    // Top & bottom
    page.drawLine({ start: { x: tableStartX, y: topY }, end: { x: tableEndX, y: topY }, color: BORDER_COLOR, thickness: GRID_LINE_THICKNESS });
    page.drawLine({ start: { x: tableStartX, y: bottomY }, end: { x: tableEndX, y: bottomY }, color: BORDER_COLOR, thickness: GRID_LINE_THICKNESS });
  };

  const drawRowGrid = (topY: number, bottomY: number) => {
    for (const x of tableColX) {
      page.drawLine({ start: { x, y: topY }, end: { x, y: bottomY }, color: BORDER_COLOR, thickness: GRID_LINE_THICKNESS });
    }
    page.drawLine({ start: { x: tableStartX, y: bottomY }, end: { x: tableEndX, y: bottomY }, color: BORDER_COLOR, thickness: GRID_LINE_THICKNESS });
  };

  const drawTableHeader = () => {
    if (y - (TABLE_HEADER_HEIGHT + MIN_ROW_HEIGHT) < tableBottomMargin) {
      page = pdfDoc.addPage(PAGE_SIZE);
      y = height - NEW_PAGE_TOP_MARGIN;
    }
    page.drawRectangle({ x: tableStartX, y: y - TABLE_HEADER_HEIGHT, width: CONTENT_WIDTH, height: TABLE_HEADER_HEIGHT, color: TABLE_HEADER_FILL });
    let curX = tableStartX;
    const headerLineHeight = HEADER_FONT_SIZE + 2;
    for (const c of cols) {
      const labelEn = truncateText(c.labelEn, c.w - 6, timesNewRomanBold, HEADER_FONT_SIZE);
      const labelVi = truncateText(c.labelVi, c.w - 6, timesNewRomanBold, HEADER_FONT_SIZE);
      const alignRight = (c as any).align === 'right';
      const enX = alignRight
        ? curX + c.w - 4 - timesNewRomanBold.widthOfTextAtSize(labelEn, HEADER_FONT_SIZE)
        : curX + 4;
      const viX = alignRight
        ? curX + c.w - 4 - timesNewRomanBold.widthOfTextAtSize(labelVi, HEADER_FONT_SIZE)
        : curX + 4;
      drawTextWithFont(page, labelEn, {
        x: enX,
        y: y - 8, size: HEADER_FONT_SIZE, font: timesNewRomanBold, color: rgb(1, 1, 1)
      }, simulateBold);
      drawTextWithFont(page, labelVi, {
        x: viX,
        y: y - 8 - headerLineHeight, size: HEADER_FONT_SIZE, font: timesNewRomanBold, color: rgb(1, 1, 1)
      }, simulateBold);
      curX += c.w;
    }
    const headerTopY = y;
    const headerBottomY = y - TABLE_HEADER_HEIGHT;
    drawHeaderGrid(headerTopY, headerBottomY);
    y = headerBottomY;
  };

  const getRowHeightForLines = (lineCount: number) => {
    const clampedLines = Math.max(1, lineCount);
    return Math.max(16, rowTextTopOffset + clampedLines * rowLineHeight - maxRowFontSize * 0.5 + rowBottomPadding);
  };

  const maxLinesForAvailableHeight = (availableHeight: number) => {
    const usable = availableHeight - rowTextTopOffset - rowBottomPadding + maxRowFontSize * 0.5;
    return Math.max(0, Math.floor(usable / rowLineHeight));
  };

  const drawCommodityLines = (lines: string[], x: number, startY: number, color = TEXT_MAIN) => {
    let curY = startY;
    for (const line of lines) {
      drawTextWithFont(page, line, { x, y: curY, size: ITEM_ROW_FONT_SIZE, font: timesNewRoman, color });
      curY -= rowLineHeight;
    }
  };

  drawTableHeader();

  data.items.forEach((item) => {
    const commMaxW = cols[2].w - 7;
    const commLines = wrapTextLines(item.commodity, commMaxW, ITEM_ROW_FONT_SIZE, timesNewRoman);
    let remainingLines = commLines.slice();
    let isFirstChunk = true;

    while (remainingLines.length > 0) {
      const availableHeight = y - tableBottomMargin;
      let linesFit = maxLinesForAvailableHeight(availableHeight);

      if (linesFit < 1) {
        page = pdfDoc.addPage(PAGE_SIZE);
        y = height - NEW_PAGE_TOP_MARGIN;
        drawTableHeader();
        continue;
      }

      const chunkLines = remainingLines.slice(0, linesFit);
      const rowH = getRowHeightForLines(chunkLines.length);
      if (y - rowH < tableBottomMargin) {
        page = pdfDoc.addPage(PAGE_SIZE);
        y = height - NEW_PAGE_TOP_MARGIN;
        drawTableHeader();
        continue;
      }

      const ty = y;
      let curIdxX = LEFT_MARGIN;

      if (isFirstChunk) {
        // No.
        drawTextWithFont(page, String(item.no), { x: curIdxX + 4, y: ty - rowTextTopOffset, size: ITEM_ROW_FONT_SIZE, font: timesNewRoman });
        curIdxX += cols[0].w;

        // Part code — truncate to fit column
        const codeStr = truncateText(item.code || '-', cols[1].w - 6, timesNewRomanBold, ITEM_CODE_FONT_SIZE);
        drawTextWithFont(page, codeStr, {
          x: curIdxX + 4, y: ty - rowTextTopOffset, size: ITEM_CODE_FONT_SIZE, font: timesNewRomanBold, color: LDA_BLUE
        }, simulateBold);
        curIdxX += cols[1].w;
      } else {
        curIdxX += cols[0].w + cols[1].w;
      }

      // Commodity — render chunk
      drawCommodityLines(chunkLines, curIdxX + 4, ty - rowTextTopOffset);
      curIdxX += cols[2].w;

      if (isFirstChunk) {
        // Unit
        const unitStr = truncateText(item.unit, cols[3].w - 5, timesNewRoman, ITEM_ROW_FONT_SIZE);
        drawTextWithFont(page, unitStr, { x: curIdxX + 3, y: ty - rowTextTopOffset, size: ITEM_ROW_FONT_SIZE, font: timesNewRoman });
        curIdxX += cols[3].w;

        // Qty
        const qtyStr = truncateText(item.qty.toString(), cols[4].w - 5, timesNewRoman, ITEM_ROW_FONT_SIZE);
        drawTextWithFont(page, qtyStr, { x: curIdxX + 3, y: ty - rowTextTopOffset, size: ITEM_ROW_FONT_SIZE, font: timesNewRoman });
        curIdxX += cols[4].w;

        // Unit price — right-aligned, truncated
        const priceStr = truncateText((item.unitPrice || 0).toLocaleString(), cols[5].w - 6, timesNewRoman, ITEM_NUM_FONT_SIZE);
        drawTextWithFont(page, priceStr, {
          x: curIdxX + cols[5].w - 4 - timesNewRoman.widthOfTextAtSize(priceStr, ITEM_NUM_FONT_SIZE),
          y: ty - rowTextTopOffset, size: ITEM_NUM_FONT_SIZE, font: timesNewRoman
        });
        curIdxX += cols[5].w;

        // Amount — right-aligned, truncated
        const amtStr = truncateText((item.amount || 0).toLocaleString(), cols[6].w - 6, timesNewRomanBold, ITEM_NUM_FONT_SIZE);
        drawTextWithFont(page, amtStr, {
          x: curIdxX + cols[6].w - 4 - timesNewRomanBold.widthOfTextAtSize(amtStr, ITEM_NUM_FONT_SIZE),
          y: ty - rowTextTopOffset, size: ITEM_NUM_FONT_SIZE, font: timesNewRomanBold
        }, simulateBold);
        curIdxX += cols[6].w;

        // Remarks — truncate to fit narrow column
        const remStr = truncateText(item.remarks || '', cols[7].w - 5, timesNewRoman, ITEM_ROW_FONT_SIZE);
        drawTextWithFont(page, remStr, {
          x: curIdxX + 3, y: ty - rowTextTopOffset, size: ITEM_ROW_FONT_SIZE, font: timesNewRoman, color: TEXT_MAIN
        });
      }

      const rowTopY = y;
      const rowBottomY = y - rowH;
      drawRowGrid(rowTopY, rowBottomY);
      y -= rowH;
      remainingLines = remainingLines.slice(chunkLines.length);
      isFirstChunk = false;
    }
  });

  // 5. TOTALS
  y -= 25;
  const totalX = width - 270;
  const drawTotalLine = (label: string, value: string, bold = false) => {
    if (bold) {
      drawTextWithFont(page, label, { x: totalX, y, size: 11, font: timesNewRomanBold }, simulateBold);
    } else {
      drawTextWithFont(page, label, { x: totalX, y, size: 11, font: timesNewRoman });
    }
    drawTextWithFont(page, value, {
      x: width - RIGHT_MARGIN - timesNewRomanBold.widthOfTextAtSize(value, 11), y, size: 11, font: timesNewRomanBold
    }, simulateBold);
    y -= 18;
  };

  drawTotalLine('Subtotal / Tạm tính:', `${(data.subtotal || 0).toLocaleString()} ${data.currency}`);
  drawTotalLine('VAT (8%):', `${(data.taxTotal || 0).toLocaleString()} ${data.currency}`);

  y -= 10;
  const grandTotalStr = `${(data.grandTotal || 0).toLocaleString()} ${data.currency}`;
  page.drawRectangle({ x: totalX - 5, y: y - 6, width: width - totalX - 30, height: 26, color: LDA_BLUE });
  drawTextWithFont(page, 'GRAND TOTAL:', {
    x: totalX + 5, y: y + 5, size: 11, font: timesNewRomanBold, color: rgb(1, 1, 1)
  }, simulateBold);
  drawTextWithFont(page, grandTotalStr, {
    x: width - 40 - timesNewRomanBold.widthOfTextAtSize(grandTotalStr, 11),
    y: y + 5, size: 11, font: timesNewRomanBold, color: rgb(1, 1, 1)
  }, simulateBold);
  y -= 45;

  // 6. REMARKS & TERMS
  const DEBUG_PAGINATION = process.env.DEBUG_PDF_PAGINATION === '1';
  const logPos = (label: string) => {
    if (!DEBUG_PAGINATION) return;
    console.log(`[pdf-pagination] ${label} | page=${pdfDoc.getPageCount()} y=${y.toFixed(2)}`);
  };
  const BOTTOM_MARGIN = TOP_MARGIN;
  const ensureSpace = (needed: number): PDFPage => {
    if (y < needed) {
      if (DEBUG_PAGINATION) {
        console.log(`[pdf-pagination] new page (needed=${needed.toFixed(2)} y=${y.toFixed(2)})`);
      }
      page = pdfDoc.addPage(PAGE_SIZE);
      y = height - NEW_PAGE_TOP_MARGIN;
    }
    return page;
  };
  const estimateWrappedHeight = (text: string, maxWidth: number, fontSize: number, font: PDFFont) => {
    if (!text) return 0;
    const lines = wrapTextLines(text, maxWidth, fontSize, font);
    const lineHeight = fontSize * 1.5;
    return lines.length * lineHeight;
  };

  logPos('before remarks');
  if (data.terms.remarks || data.terms.remarksEn) {
    const remarkTitleH = 18;
    const remarkEnH = estimateWrappedHeight(data.terms.remarksEn || '', CONTENT_WIDTH, 12, timesNewRomanBold) + 2;
    const remarkViH = estimateWrappedHeight(data.terms.remarks || '', CONTENT_WIDTH, 11, timesNewRoman) + 4;
    const remarkBlockH = remarkTitleH + remarkEnH + remarkViH + 12;
    ensureSpace(remarkBlockH + BOTTOM_MARGIN);
    drawTextWithFont(
      page,
      'Remark:',
      { x: LEFT_MARGIN, y, size: 13, font: timesNewRomanBoldItalic, color: TEXT_MAIN, xSkew: simulateItalic ? ITALIC_SKEW : undefined },
      simulateBold,
    );
    y -= 18;
    if (data.terms.remarksEn) {
      y = drawWrappedText(page, data.terms.remarksEn, LEFT_MARGIN, y, CONTENT_WIDTH, 12, timesNewRomanBold, TEXT_MAIN, simulateBold) - 2;
    }
    if (data.terms.remarks) {
      y = drawWrappedText(page, data.terms.remarks, LEFT_MARGIN, y, CONTENT_WIDTH, 11, timesNewRoman, TEXT_LIGHT) - 4;
    }
    y -= 12;
  }

  logPos('before terms header');
  let termItems = data.terms.termItems;
  if (!termItems) {
    termItems = [
      { labelViPrint: 'Hiệu lực', labelEn: 'Validity', textVi: data.terms.validity, textEn: data.terms.validityEn || '30 days' },
      { labelViPrint: 'Thanh toán', labelEn: 'Payment', textVi: data.terms.payment, textEn: data.terms.paymentEn || '30%/70%' },
      { labelViPrint: 'Giao hàng', labelEn: 'Delivery', textVi: data.terms.delivery, textEn: data.terms.deliveryEn || '4-6 months' },
      { labelViPrint: 'Bảo hành', labelEn: 'Warranty', textVi: data.terms.warranty, textEn: data.terms.warrantyEn || 'As standard' }
    ].filter((t: any) => t.textVi);
  }
  const headerBlockH = 22;
  const firstTerm = termItems[0];
  if (firstTerm) {
    const leftText = `1. ${firstTerm.labelEn || 'Term'}: ${firstTerm.textEn || ''}`;
    const rightText = `1. ${firstTerm.labelViPrint || 'Điều khoản'}: ${firstTerm.textVi || ''}`;
    const termLineHeight = 11 * 1.5;
    const leftLines = wrapTextLines(leftText, width / 2 - 60, 11, timesNewRoman).length;
    const rightLines = wrapTextLines(rightText, width / 2 - 60, 11, timesNewRoman).length;
    const firstTermH = Math.max(leftLines, rightLines) * termLineHeight + 10;
    ensureSpace(headerBlockH + firstTermH + BOTTOM_MARGIN);
  } else {
    ensureSpace(headerBlockH + BOTTOM_MARGIN);
  }
  drawTextWithFont(page, 'Terms & Conditions', {
    x: LEFT_MARGIN, y, size: 12, font: timesNewRomanBold, color: LDA_BLUE
  }, simulateBold);
  drawTextWithFont(page, 'Điều khoản', {
    x: width / 2 + 10, y, size: 12, font: timesNewRomanBold, color: LDA_BLUE
  }, simulateBold);
  y -= 4;
  page.drawLine({ start: { x: LEFT_MARGIN, y }, end: { x: width - RIGHT_MARGIN, y }, color: LDA_BLUE, thickness: 1 });
  y -= 18;

  const drawTerm = (labelEn: string, valEn: string, labelVi: string, valVi: string, idx: number) => {
    ensureSpace(45);
    const curY = y;
    const nextYLeft = drawWrappedText(page, `${idx}. ${labelEn}: ${valEn}`, LEFT_MARGIN, curY, width / 2 - 60, 11, timesNewRoman);
    const nextYRight = drawWrappedText(page, `${idx}. ${labelVi}: ${valVi}`, width / 2 + 10, curY, width / 2 - 60, 11, timesNewRoman, TEXT_MAIN);
    y = Math.min(nextYLeft, nextYRight) - 10;
  };

  termItems.forEach((t: any, idx: number) => {
    drawTerm(t.labelEn || 'Term', t.textEn || '', t.labelViPrint || 'Điều khoản', t.textVi || '', idx + 1);
  });

  y -= 20;
  ensureSpace(90);
  drawTextWithFont(page, 'Best regard/Trân trọng./.', {
    x: LEFT_MARGIN, y, size: 11, font: timesNewRoman, color: TEXT_LIGHT
  });

  y -= 50;
  const columnWidth = CONTENT_WIDTH / 2;
  const leftCenter = LEFT_MARGIN + columnWidth / 2;
  const rightCenter = LEFT_MARGIN + columnWidth + columnWidth / 2;
  const leftTitle = 'L&D AUTO COMPANY LIMITED';
  const leftSub = 'CÔNG TY TNHH L&D AUTO';
  const rightTitle = 'CUSTOMER';
  const rightSub = 'Khách hàng';
  drawTextWithFont(page, leftTitle, {
    x: leftCenter - timesNewRomanBold.widthOfTextAtSize(leftTitle, 12) / 2,
    y,
    size: 12,
    font: timesNewRomanBold,
  }, simulateBold);
  drawTextWithFont(page, rightTitle, {
    x: rightCenter - timesNewRomanBold.widthOfTextAtSize(rightTitle, 12) / 2,
    y,
    size: 12,
    font: timesNewRomanBold,
  }, simulateBold);
  y -= 16;
  drawTextWithFont(page, leftSub, {
    x: leftCenter - timesNewRoman.widthOfTextAtSize(leftSub, 11) / 2,
    y,
    size: 11,
    font: timesNewRoman,
  });
  drawTextWithFont(page, rightSub, {
    x: rightCenter - timesNewRoman.widthOfTextAtSize(rightSub, 11) / 2,
    y,
    size: 11,
    font: timesNewRoman,
  });

  return await pdfDoc.save();
}
