/**
 * Export Presets for Title Production Systems
 * Defines field mappings, format builders, and system-specific transformations
 * for SoftPro, RamQuest, Qualia, AIM+, ResWare, TitleExpress, and industry standards.
 */

import { getMergedExtractionData, valueForExport } from "./utils";
import { schemas } from "../schemas/index";

// ============================================================================
// HELPERS
// ============================================================================

function esc(str) {
  if (str == null) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function xmlTag(name, value, attrs = "") {
  if (value == null || value === "") return `<${name}${attrs}/>`;
  return `<${name}${attrs}>${esc(value)}</${name}>`;
}

function indent(str, level = 1) {
  const pad = "  ".repeat(level);
  return str.split("\n").map(l => pad + l).join("\n");
}

function flattenObject(obj, prefix = "") {
  const result = {};
  for (const [key, value] of Object.entries(obj || {})) {
    const newKey = prefix ? `${prefix}_${key}` : key;
    if (value === null || value === undefined) {
      result[newKey] = "";
    } else if (typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else if (Array.isArray(value)) {
      result[newKey] = value.map(v => valueForExport(v)).join("; ");
    } else {
      result[newKey] = valueForExport(value);
    }
  }
  return result;
}

/**
 * Escape a single CSV cell value.
 * - Handles null/undefined
 * - Escapes double-quote characters by doubling them
 * - Wraps in quotes if the value contains comma, quote, newline, tab, or semicolon
 * - Prevents CSV formula injection by prefixing dangerous leading characters
 */
function escapeCSVCell(value) {
  if (value == null) return "";
  let s = String(value);
  // CSV injection prevention: prefix =, +, -, @ with a single quote so
  // spreadsheet applications don't interpret the cell as a formula.
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  // Always double internal quotes
  s = s.replace(/"/g, '""');
  // Wrap in quotes if the value contains any delimiter-like characters
  if (/[,"\n\r\t;]/.test(s)) {
    return `"${s}"`;
  }
  return s;
}

function convertToCSV(rows, columns) {
  const header = columns.map(escapeCSVCell).join(",");
  const lines = rows.map(row =>
    columns.map(col => escapeCSVCell(row[col])).join(",")
  );
  return [header, ...lines].join("\n");
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Normalize data for export: replace not-in-document sentinel with "N/A" at every level. */
function normalizeDataForExport(data) {
  if (data == null || typeof data !== "object") return valueForExport(data);
  if (Array.isArray(data)) return data.map(normalizeDataForExport);
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = normalizeDataForExport(v);
  }
  return out;
}

/** Extract all documents with merged data from packets.
 *  Uses category override (from reviewer reclassification) when available.
 *  Data is normalized so "not in document" sentinel exports as "N/A". */
function extractAllDocs(packets) {
  const docs = [];
  for (const pkt of packets) {
    for (const doc of pkt.documents || []) {
      const { data } = getMergedExtractionData(doc, schemas);
      // Category override takes priority — set during human review for "other" docs
      const catOverride = doc.categoryOverride || null;
      const docType = catOverride?.name || doc.classification?.category || "unknown";
      docs.push({
        packetId: pkt.id,
        packetFilename: pkt.filename || pkt.name,
        docId: doc.id,
        docType,
        docTypeOriginal: doc.classification?.category || "unknown",
        isReclassified: !!catOverride,
        pages: doc.pages,
        confidence: doc.extractionConfidence,
        needsReview: doc.needsReview,
        data: normalizeDataForExport(data || {}),
      });
    }
  }
  return docs;
}

function mapFields(data, fieldMap) {
  const mapped = {};
  for (const [target, source] of Object.entries(fieldMap)) {
    if (typeof source === "function") {
      mapped[target] = valueForExport(source(data));
    } else {
      mapped[target] = valueForExport(data[source] ?? "");
    }
  }
  return mapped;
}

function formatAIMDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr.replace(/[-/]/g, "");
  return `${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}${d.getFullYear()}`;
}

function centsFromDollars(val) {
  if (val == null || val === "") return "0";
  const n = parseFloat(val);
  return isNaN(n) ? "0" : String(Math.round(n * 100));
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

// ============================================================================
// COMMON FIELD MAPS
// ============================================================================

const MISMO_FIELD_MAP = {
  // Property
  "StreetAddress": "property_street_address",
  "City": "property_city",
  "State": "property_state",
  "PostalCode": "property_zip",
  "County": "property_county",
  "ParcelIdentifier": "parcel_identification_number",
  "LegalDescription": "legal_description",
  "LotIdentifier": "lot_number",
  "BlockIdentifier": "block_number",
  "SubdivisionName": "subdivision_name",
  // Parties
  "BorrowerName": "borrower_name",
  "SellerName": "grantor_name",
  "BuyerName": "grantee_name",
  "LenderName": "lender_name",
  "TrusteeName": "trustee_name",
  // Financial
  "LoanAmount": "loan_amount",
  "PurchasePrice": "consideration_amount",
  "InterestRate": "interest_rate",
  // Recording
  "RecordingDate": "recording_date",
  "RecordingDocumentNumber": "recording_instrument_number",
  "BookNumber": "recording_book_number",
  "PageNumber": "recording_page_number",
  // Dates
  "ClosingDate": "closing_date",
  "EffectiveDate": "effective_date",
};

// ============================================================================
// MISMO XML BUILDER
// ============================================================================

function buildMISMOXML(packets) {
  const docs = extractAllDocs(packets);
  const deeds = docs.filter(d => d.docType.includes("deed") || d.docType.includes("transfer"));
  const mortgages = docs.filter(d => d.docType.includes("mortgage") || d.docType.includes("deed_of_trust"));
  const firstDeed = deeds[0]?.data || docs[0]?.data || {};
  const firstMortgage = mortgages[0]?.data || {};

  const propertyXML = [
    xmlTag("StreetAddress", firstDeed.property_street_address),
    xmlTag("City", firstDeed.property_city),
    xmlTag("State", firstDeed.property_state),
    xmlTag("PostalCode", firstDeed.property_zip),
    xmlTag("County", firstDeed.property_county),
    xmlTag("UnparsedLegalDescription", firstDeed.legal_description),
    xmlTag("ParcelIdentificationNumber", firstDeed.parcel_identification_number),
    xmlTag("LotIdentifier", firstDeed.lot_number),
    xmlTag("BlockIdentifier", firstDeed.block_number),
    xmlTag("SubdivisionName", firstDeed.subdivision_name),
  ].join("\n");

  const partiesXML = [
    firstDeed.grantee_name ? `<PARTY _Type="Buyer">\n  ${xmlTag("FullName", firstDeed.grantee_name)}\n  ${xmlTag("VestingType", firstDeed.vesting_type)}\n</PARTY>` : "",
    firstDeed.grantor_name ? `<PARTY _Type="Seller">\n  ${xmlTag("FullName", firstDeed.grantor_name)}\n</PARTY>` : "",
    firstMortgage.lender_name ? `<PARTY _Type="Lender">\n  ${xmlTag("FullName", firstMortgage.lender_name)}\n</PARTY>` : "",
    firstMortgage.borrower_name ? `<PARTY _Type="Borrower">\n  ${xmlTag("FullName", firstMortgage.borrower_name)}\n</PARTY>` : "",
  ].filter(Boolean).join("\n");

  const loanXML = firstMortgage.loan_amount ? [
    xmlTag("LoanAmount", firstMortgage.loan_amount),
    xmlTag("InterestRate", firstMortgage.interest_rate),
    xmlTag("MaturityDate", firstMortgage.maturity_date),
  ].join("\n") : "";

  const recordingDocsXML = docs.map(d => {
    const r = d.data;
    return `<RECORDED_DOCUMENT>
  ${xmlTag("RecordingDate", r.recording_date)}
  ${xmlTag("BookNumber", r.recording_book_number)}
  ${xmlTag("PageNumber", r.recording_page_number)}
  ${xmlTag("InstrumentNumber", r.recording_instrument_number)}
  ${xmlTag("DocumentType", d.docType)}
  ${xmlTag("County", r.recording_county || r.property_county)}
</RECORDED_DOCUMENT>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<MESSAGE xmlns="http://www.mismo.org/residential/2009/schemas" MISMOVersionIdentifier="3.6">
  <DEAL_SETS>
    <DEAL_SET>
      <DEALS>
        <DEAL>
          <COLLATERALS>
            <COLLATERAL>
              <SUBJECT_PROPERTY>
${indent(propertyXML, 8)}
              </SUBJECT_PROPERTY>
            </COLLATERAL>
          </COLLATERALS>
          <PARTIES>
${indent(partiesXML, 6)}
          </PARTIES>
${loanXML ? `          <LOANS>\n            <LOAN>\n${indent(loanXML, 7)}\n            </LOAN>\n          </LOANS>` : ""}
          <SERVICES>
            <SERVICE>
              <TITLE>
                <TITLE_SEARCH_RESULTS>
${indent(recordingDocsXML, 10)}
                </TITLE_SEARCH_RESULTS>
              </TITLE>
            </SERVICE>
          </SERVICES>
        </DEAL>
      </DEALS>
    </DEAL_SET>
  </DEAL_SETS>
</MESSAGE>`;
}

// ============================================================================
// UCD XML BUILDER (Uniform Closing Dataset - MISMO v3.3)
// ============================================================================

function buildUCDXML(packets) {
  const docs = extractAllDocs(packets);
  const settlement = docs.find(d => d.docType.includes("settlement")) || docs[0];
  const d = settlement?.data || {};

  return `<?xml version="1.0" encoding="UTF-8"?>
<MESSAGE xmlns="http://www.mismo.org/residential/2009/schemas" MISMOVersionIdentifier="3.3.0299">
  <ABOUT_VERSIONS>
    <ABOUT_VERSION>
      <DataVersionIdentifier>UCD</DataVersionIdentifier>
      <DataVersionName>Uniform Closing Dataset</DataVersionName>
    </ABOUT_VERSION>
  </ABOUT_VERSIONS>
  <DEAL_SETS>
    <DEAL_SET>
      <DEALS>
        <DEAL>
          <PARTIES>
            <PARTY _Type="Borrower">
              ${xmlTag("FullName", d.buyer_name || d.borrower_name)}
            </PARTY>
            <PARTY _Type="Seller">
              ${xmlTag("FullName", d.seller_name || d.grantor_name)}
            </PARTY>
            <PARTY _Type="Lender">
              ${xmlTag("FullName", d.lender_name)}
            </PARTY>
          </PARTIES>
          <LOANS>
            <LOAN>
              <CLOSING_INFORMATION>
                ${xmlTag("ClosingDate", d.closing_date)}
                ${xmlTag("DisbursementDate", d.funding_date || d.disbursement_date)}
              </CLOSING_INFORMATION>
              <LOAN_IDENTIFIERS>
                ${xmlTag("LoanIdentifier", d.loan_number || d.order_number)}
              </LOAN_IDENTIFIERS>
              ${xmlTag("LoanAmount", d.loan_amount)}
              ${xmlTag("InterestRate", d.interest_rate)}
            </LOAN>
          </LOANS>
          <COLLATERALS>
            <COLLATERAL>
              <SUBJECT_PROPERTY>
                ${xmlTag("StreetAddress", d.property_street_address)}
                ${xmlTag("City", d.property_city)}
                ${xmlTag("State", d.property_state)}
                ${xmlTag("PostalCode", d.property_zip)}
              </SUBJECT_PROPERTY>
            </COLLATERAL>
          </COLLATERALS>
        </DEAL>
      </DEALS>
    </DEAL_SET>
  </DEAL_SETS>
</MESSAGE>`;
}

// ============================================================================
// ALTA SETTLEMENT BUILDER
// ============================================================================

function buildALTASettlement(packets) {
  const docs = extractAllDocs(packets);
  const settlement = docs.find(d => d.docType.includes("settlement")) || docs[0];
  const d = settlement?.data || {};

  const rows = [
    { section: "Header", field: "File Number", value: d.order_number || d.escrow_number },
    { section: "Header", field: "Closing Date", value: d.closing_date },
    { section: "Header", field: "Property Address", value: d.property_street_address },
    { section: "Header", field: "Settlement Agent", value: d.closer_name || d.settlement_agent },
    { section: "100 - Gross Amount Due", field: "Contract Sales Price", value: d.contract_price || d.consideration_amount },
    { section: "200 - Amounts Paid By/For Borrower", field: "Principal Amount of New Loan", value: d.loan_amount },
    { section: "200 - Amounts Paid By/For Borrower", field: "Earnest Money", value: d.earnest_money },
    { section: "500 - Reductions in Amount Due Seller", field: "Payoff Amount", value: d.payoff_amount },
    { section: "800 - Items Payable", field: "Origination Fee", value: d.origination_fee },
    { section: "1100 - Title Charges", field: "Title Insurance Premium", value: d.title_insurance_premium },
    { section: "1100 - Title Charges", field: "Settlement/Closing Fee", value: d.settlement_fee || d.closing_fee },
    { section: "1200 - Recording Fees", field: "Recording Fees", value: d.recording_fees },
    { section: "1300 - Transfer Taxes", field: "Transfer Tax", value: d.transfer_tax },
  ];

  const columns = ["section", "field", "value"];
  return convertToCSV(rows, columns);
}

// ============================================================================
// DELIMITED EXPORT (AIM+ compatible)
// ============================================================================

function buildDelimitedExport(packets, delimiter = "|") {
  const docs = extractAllDocs(packets);
  const rows = docs.map(d => {
    const data = d.data;
    return [
      d.packetFilename || "",
      d.docType || "",
      data.property_street_address || "",
      data.property_city || "",
      data.property_state || "",
      data.property_zip || "",
      data.property_county || "",
      data.parcel_identification_number || "",
      data.grantor_name || "",
      data.grantee_name || "",
      data.borrower_name || "",
      data.lender_name || "",
      centsFromDollars(data.consideration_amount),
      centsFromDollars(data.loan_amount),
      formatAIMDate(data.recording_date),
      data.recording_book_number || "",
      data.recording_page_number || "",
      data.recording_instrument_number || "",
      formatAIMDate(data.closing_date),
    ].join(delimiter);
  });

  const header = [
    "FileName", "DocType", "Address", "City", "State", "Zip", "County",
    "ParcelID", "Grantor", "Grantee", "Borrower", "Lender",
    "ConsiderationCents", "LoanAmountCents", "RecordingDate", "Book",
    "Page", "Instrument", "ClosingDate",
  ].join(delimiter);

  return [header, ...rows].join("\n");
}

// ============================================================================
// GENERIC BUILDERS
// ============================================================================

function buildGenericJSON(packets) {
  const docs = extractAllDocs(packets);
  return JSON.stringify({
    exported_at: new Date().toISOString(),
    source: "CORTEX by SAIL",
    total_documents: docs.length,
    documents: docs.map(d => ({
      packet_filename: d.packetFilename,
      document_type: d.docType,
      pages: d.pages,
      confidence: d.confidence,
      needs_review: d.needsReview,
      extracted_data: d.data,
    })),
  }, null, 2);
}

function buildGenericCSV(packets) {
  const docs = extractAllDocs(packets);
  const allRows = docs.map(d => ({
    packet_filename: d.packetFilename,
    document_type: d.docType,
    confidence: d.confidence,
    needs_review: d.needsReview,
    ...flattenObject(d.data),
  }));
  if (allRows.length === 0) return "";
  const allCols = [...new Set(allRows.flatMap(r => Object.keys(r)))];
  return convertToCSV(allRows, allCols);
}

function buildTPS(packets) {
  const docs = extractAllDocs(packets);
  const deeds = docs.filter(d => d.docType.includes("deed") || d.docType.includes("transfer"));
  const firstDeed = deeds[0]?.data || docs[0]?.data || {};

  return JSON.stringify({
    tps_version: "1.0",
    export_timestamp: new Date().toISOString(),
    source: "CORTEX by SAIL",
    run_summary: {
      total_packets: packets.length,
      total_documents: docs.length,
    },
    transactions: packets.map(pkt => {
      const pktDocs = docs.filter(d => d.packetId === pkt.id);
      const deed = pktDocs.find(d => d.docType.includes("deed") || d.docType.includes("transfer"));
      const dData = deed?.data || pktDocs[0]?.data || {};
      return {
        transaction_id: pkt.id,
        source_file: pkt.filename || pkt.name,
        property_info: {
          address: dData.property_street_address,
          county: dData.property_county,
          state: dData.property_state,
          parcel_number: dData.parcel_identification_number,
          legal_description: dData.legal_description,
        },
        vesting: {
          current_owner: dData.grantee_name,
          prior_owner: dData.grantor_name,
        },
        documents: pktDocs.map(d => ({
          doc_type: d.docType,
          confidence: d.confidence,
          requires_review: d.needsReview,
          recording_info: {
            date: d.data.recording_date,
            book: d.data.recording_book_number,
            page: d.data.recording_page_number,
            instrument: d.data.recording_instrument_number,
          },
          extracted_fields: d.data,
        })),
      };
    }),
  }, null, 2);
}

function buildSummaryReport(packets) {
  const docs = extractAllDocs(packets);
  const lines = [
    "═══════════════════════════════════════════",
    "  CORTEX EXTRACTION SUMMARY REPORT",
    `  Generated: ${new Date().toLocaleString()}`,
    "═══════════════════════════════════════════",
    "",
    `Total Packets: ${packets.length}`,
    `Total Documents: ${docs.length}`,
    `Needs Review: ${docs.filter(d => d.needsReview).length}`,
    "",
  ];

  for (const pkt of packets) {
    lines.push(`── ${pkt.filename || pkt.name} ──`);
    const pktDocs = docs.filter(d => d.packetId === pkt.id);
    for (const d of pktDocs) {
      lines.push(`  [${d.docType}] confidence: ${d.confidence != null ? (d.confidence * 100).toFixed(0) + "%" : "N/A"}`);
      const important = ["property_street_address", "grantor_name", "grantee_name", "recording_date", "consideration_amount", "loan_amount"];
      for (const f of important) {
        if (d.data[f]) lines.push(`    ${f.replace(/_/g, " ")}: ${d.data[f]}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ============================================================================
// XLSX BUILDER (uses SheetJS)
// ============================================================================

async function buildXLSX(packets) {
  const XLSX = await import("xlsx");
  const docs = extractAllDocs(packets);
  const wb = XLSX.utils.book_new();

  // Group by doc type
  const byType = {};
  for (const d of docs) {
    const t = d.docType || "other";
    if (!byType[t]) byType[t] = [];
    byType[t].push({ packet: d.packetFilename, confidence: d.confidence, ...flattenObject(d.data) });
  }

  // Summary sheet
  const summaryRows = Object.entries(byType).map(([type, rows]) => ({
    Document_Type: type,
    Count: rows.length,
  }));
  const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

  // One sheet per doc type
  for (const [type, rows] of Object.entries(byType)) {
    const sheetName = type.slice(0, 31); // Excel max sheet name length
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}

// ============================================================================
// PRESET DEFINITIONS
// ============================================================================

export const EXPORT_PRESETS = [
  // --- Title Production Systems (Stewart first) ---
  {
    id: "tps_stewart",
    name: "Stewart STEPS",
    category: "tps",
    description: "Stewart Title production JSON format",
    format: "json",
    fileExtension: ".json",
    icon: "zap",
    transform: (packets) => buildTPS(packets),
    mimeType: "application/json",
  },
  {
    id: "softpro",
    name: "SoftPro",
    category: "tps",
    description: "SoftPro Standard/Select compatible XML export",
    format: "xml",
    fileExtension: ".xml",
    icon: "building",
    transform: (packets) => buildMISMOXML(packets),
    mimeType: "application/xml",
  },
  {
    id: "ramquest",
    name: "RamQuest",
    category: "tps",
    description: "RamQuest / ClosingMarket XML export",
    format: "xml",
    fileExtension: ".xml",
    icon: "building",
    transform: (packets) => buildMISMOXML(packets),
    mimeType: "application/xml",
  },
  {
    id: "qualia",
    name: "Qualia",
    category: "tps",
    description: "Qualia-compatible JSON payload",
    format: "json",
    fileExtension: ".json",
    icon: "building",
    transform: (packets) => buildGenericJSON(packets),
    mimeType: "application/json",
  },
  {
    id: "aim_plus",
    name: "AIM+",
    category: "tps",
    description: "AIM+ pipe-delimited ASCII export",
    format: "txt",
    fileExtension: ".txt",
    icon: "building",
    transform: (packets) => buildDelimitedExport(packets, "|"),
    mimeType: "text/plain",
  },
  {
    id: "resware",
    name: "ResWare",
    category: "tps",
    description: "ResWare SOAP-compatible XML export",
    format: "xml",
    fileExtension: ".xml",
    icon: "building",
    transform: (packets) => buildMISMOXML(packets),
    mimeType: "application/xml",
  },
  {
    id: "titleexpress",
    name: "TitleExpress",
    category: "tps",
    description: "TitleExpress / AgentNet XML export",
    format: "xml",
    fileExtension: ".xml",
    icon: "building",
    transform: (packets) => buildMISMOXML(packets),
    mimeType: "application/xml",
  },
  // --- Industry Standards ---
  {
    id: "mismo",
    name: "MISMO XML",
    category: "standard",
    description: "MISMO v3.6 industry standard XML",
    format: "xml",
    fileExtension: ".xml",
    icon: "landmark",
    transform: (packets) => buildMISMOXML(packets),
    mimeType: "application/xml",
  },
  {
    id: "ucd",
    name: "UCD",
    category: "standard",
    description: "Uniform Closing Dataset (MISMO v3.3)",
    format: "xml",
    fileExtension: ".xml",
    icon: "landmark",
    transform: (packets) => buildUCDXML(packets),
    mimeType: "application/xml",
  },
  {
    id: "alta_settlement",
    name: "ALTA Settlement",
    category: "standard",
    description: "ALTA settlement statement line items",
    format: "csv",
    fileExtension: ".csv",
    icon: "landmark",
    transform: (packets) => buildALTASettlement(packets),
    mimeType: "text/csv",
  },
  // --- Generic Formats ---
  {
    id: "generic_json",
    name: "JSON",
    category: "generic",
    description: "Full hierarchical JSON export",
    format: "json",
    fileExtension: ".json",
    icon: "braces",
    transform: (packets) => buildGenericJSON(packets),
    mimeType: "application/json",
  },
  {
    id: "generic_csv",
    name: "CSV",
    category: "generic",
    description: "Flat CSV with all fields",
    format: "csv",
    fileExtension: ".csv",
    icon: "table",
    transform: (packets) => buildGenericCSV(packets),
    mimeType: "text/csv",
  },
  {
    id: "generic_xlsx",
    name: "XLSX",
    category: "generic",
    description: "Multi-sheet Excel workbook by doc type",
    format: "xlsx",
    fileExtension: ".xlsx",
    icon: "sheet",
    async: true,
    transform: async (packets) => buildXLSX(packets),
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  {
    id: "summary_report",
    name: "Summary Report",
    category: "generic",
    description: "Human-readable text summary",
    format: "txt",
    fileExtension: ".txt",
    icon: "fileText",
    transform: (packets) => buildSummaryReport(packets),
    mimeType: "text/plain",
  },
];

/**
 * Return a short outcome description for the given preset + packets (file count, row/doc count, optional column list).
 * Used for "You'll get: …" preview near the Download button.
 */
export function getExportOutcomeDescription(presetId, packets) {
  const preset = EXPORT_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;
  const docs = extractAllDocs(packets);
  const fileCount = 1;
  const rowOrDocCount = docs.length;
  let columns = null;
  if (preset.id === "generic_csv" && docs.length > 0) {
    const sample = docs.map((d) => ({
      packet_filename: d.packetFilename,
      document_type: d.docType,
      confidence: d.confidence,
      needs_review: d.needsReview,
      ...flattenObject(d.data),
    }));
    columns = [...new Set(sample.flatMap((r) => Object.keys(r)))];
  }
  return { fileCount, rowOrDocCount, format: preset.format, name: preset.name, columns };
}

/**
 * Execute a preset export and trigger download
 */
export async function executePresetExport(presetId, packets) {
  const preset = EXPORT_PRESETS.find(p => p.id === presetId);
  if (!preset) throw new Error(`Unknown preset: ${presetId}`);

  const ts = timestamp();
  const filename = `cortex-${preset.id}-${ts}${preset.fileExtension}`;

  if (preset.async || preset.format === "xlsx") {
    const arrayBuffer = await preset.transform(packets);
    const blob = new Blob([arrayBuffer], { type: preset.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    const content = preset.transform(packets);
    downloadFile(content, filename, preset.mimeType);
  }

  return filename;
}

export default EXPORT_PRESETS;
