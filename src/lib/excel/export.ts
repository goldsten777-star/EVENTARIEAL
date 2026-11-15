"use client";

/**
 * Shared browser-side Excel export. exceljs (~1 MB) is loaded only when the
 * user actually exports. Sheets are right-to-left with a frozen, styled
 * header row and an auto-filter.
 */
export async function loadExcel() {
  const mod = await import("exceljs");
  return (mod.default ?? mod) as typeof import("exceljs");
}

export function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, " ").trim() || "אירוע";
}

export function styleHeader(row: import("exceljs").Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A93" } };
  row.alignment = { vertical: "middle", horizontal: "right" };
  row.height = 22;
}

export type SheetColumn = { header: string; width?: number; format?: "currency" | "number" | "text" };
export type Sheet = {
  name: string;
  columns: SheetColumn[];
  rows: Array<Array<string | number | null>>;
  /** optional bold last row, e.g. totals */
  footer?: Array<string | number | null>;
};

const CURRENCY = '#,##0 "₪";-#,##0 "₪"';

/** Builds one workbook from several sheets and downloads it. */
export async function exportWorkbook(filename: string, sheets: Sheet[]) {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Event Manager";
  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31), { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
    ws.columns = sheet.columns.map((c) => ({ header: c.header, width: c.width ?? Math.max(12, c.header.length + 4) }));
    styleHeader(ws.getRow(1));
    for (const r of sheet.rows) ws.addRow(r);
    if (sheet.footer) {
      const row = ws.addRow(sheet.footer);
      row.font = { bold: true };
    }
    sheet.columns.forEach((c, i) => {
      if (c.format === "currency") ws.getColumn(i + 1).numFmt = CURRENCY;
    });
    if (sheet.rows.length) {
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
    }
  }
  const date = new Date().toISOString().slice(0, 10);
  downloadBuffer(await wb.xlsx.writeBuffer(), `${safeFileName(filename)} ${date}.xlsx`);
}
