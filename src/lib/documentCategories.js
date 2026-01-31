/**
 * Document Categories and Schema Mappings for Stewart Title
 * Comprehensive coverage for US Title Insurance documents
 */

import { schemas } from "../schemas";

/**
 * Subdocument types for splitting PDF packets
 * High-level categories for identifying document boundaries in multi-doc PDFs
 */
export const SUBDOCUMENT_TYPES = [
  // Admin / Cover Sheet
  {
    name: "cover_sheet",
    description: "Title order cover sheet, order form, transaction summary, file summary, closing instructions, escrow instructions, title search cover"
  },
  
  // Deeds & Transfers
  { 
    name: "deed", 
    description: "Transfer deeds: warranty deed, quitclaim deed, grant deed, special warranty deed, bargain and sale deed, trustee's deed, executor's deed, administrator's deed, sheriff's deed, tax deed, deed in lieu of foreclosure" 
  },
  
  // Mortgages & Security Instruments
  { 
    name: "mortgage", 
    description: "Deed of trust, mortgage, promissory note, security deed, construction loan, home equity loan, reverse mortgage, bond for deed" 
  },
  { 
    name: "mortgage_modification", 
    description: "Assignments of mortgage/deed of trust, loan modifications, subordination agreements, releases, satisfactions, reconveyances, partial releases" 
  },
  
  // Liens & Encumbrances  
  { 
    name: "tax_lien", 
    description: "Federal tax liens (IRS), state tax liens, income tax liens, estate tax liens, inheritance tax liens" 
  },
  { 
    name: "mechanics_lien", 
    description: "Mechanic's liens, construction liens, materialman's liens, contractor liens, notice of completion, lien releases" 
  },
  { 
    name: "hoa_lien", 
    description: "HOA liens, condominium association liens, assessment liens, special assessment liens, municipal liens, code violation liens" 
  },
  { 
    name: "judgment_lien", 
    description: "Judgment liens, abstract of judgment, child support liens, alimony liens, federal judgment liens" 
  },
  { 
    name: "ucc_filing", 
    description: "UCC-1 financing statements, UCC-3 amendments, UCC terminations, fixture filings, security agreements" 
  },
  
  // Easements & Rights
  { 
    name: "easement", 
    description: "Easement agreements, utility easements, access easements, drainage easements, conservation easements, right-of-way, license agreements" 
  },
  
  // Covenants & Restrictions
  { 
    name: "ccr", 
    description: "Covenants, conditions & restrictions (CC&Rs), deed restrictions, declarations, restrictive covenants, HOA governing documents" 
  },
  
  // Court Documents
  { 
    name: "court_document", 
    description: "Court orders, decrees, lis pendens, notice of pending litigation, divorce decrees, quiet title actions, partition actions" 
  },
  { 
    name: "probate", 
    description: "Probate documents, letters testamentary, letters of administration, affidavit of heirship, death certificates, small estate affidavits" 
  },
  { 
    name: "bankruptcy", 
    description: "Bankruptcy filings, discharge orders, relief from stay, trustee deeds, chapter 7/11/13 documents" 
  },
  
  // Foreclosure Documents
  { 
    name: "foreclosure", 
    description: "Notice of default, notice of trustee's sale, foreclosure complaint, sheriff's sale notice, redemption documents, deficiency judgment" 
  },
  
  // Tax Documents
  { 
    name: "tax_document", 
    description: "Property tax bills, tax statements, tax receipts, tax certificates, assessment notices, tax sale certificates" 
  },
  
  // Title Insurance Documents
  { 
    name: "title_document", 
    description: "Title commitment, preliminary report, title policy (owner's/lender's), title search, chain of title, title binder" 
  },
  
  // Surveys & Plats
  { 
    name: "survey", 
    description: "ALTA surveys, boundary surveys, topographic surveys, as-built surveys, mortgage inspection" 
  },
  { 
    name: "plat", 
    description: "Plat maps, subdivision plats, condominium plats, lot splits, replats, minor plats" 
  },
  
  // Authority & Entity Documents
  { 
    name: "power_of_attorney", 
    description: "Power of attorney (general, limited, durable), revocation of POA, affidavit of attorney-in-fact" 
  },
  { 
    name: "entity_document", 
    description: "Corporate resolutions, articles of incorporation, articles of organization, operating agreements, partnership agreements, certificate of good standing, incumbency certificates" 
  },
  { 
    name: "trust_document", 
    description: "Trust agreements, certificate of trust, trust amendments, trustee certifications, trust deeds" 
  },
  
  // Affidavits & Declarations
  { 
    name: "affidavit", 
    description: "Affidavit of title, identity affidavit, non-foreign affidavit (FIRPTA), gap affidavit, affidavit of continuous marriage, name affidavit, affidavit of survivorship" 
  },
  
  // Closing Documents
  { 
    name: "closing_document", 
    description: "Settlement statement (HUD-1), closing disclosure, ALTA settlement statement, escrow instructions, closing instructions" 
  },
  
  // Leases
  { 
    name: "lease", 
    description: "Lease agreements, memorandum of lease, ground lease, commercial lease, assignment of lease, SNDA (subordination, non-disturbance, attornment)" 
  },
  
  // Catch-all
  { 
    name: "other", 
    description: "Other recorded documents, miscellaneous instruments, unclassified documents" 
  }
];

/**
 * Detailed document categories for classification and extraction
 * Maps to specific extraction schemas
 */
export const DOCUMENT_CATEGORIES = [
  // Admin / Cover Sheet
  {
    name: "cover_sheet",
    description: "Title order cover sheets, order forms, transaction summaries, file information sheets with buyer/seller/lender info, property details, and transaction type"
  },
  {
    name: "transaction_summary",
    description: "Comprehensive transaction summary documents with all parties, property, loan, and closing information"
  },
  
  // Deeds
  { 
    name: "recorded_transfer_deed", 
    description: "Recorded transfer deeds with grantor/grantee names, recording information, legal description, consideration, and notary acknowledgment" 
  },
  
  // Mortgages
  { 
    name: "deed_of_trust_mortgage", 
    description: "Deed of trust, mortgage, or promissory note with lender/borrower, loan amount, terms, maturity date, and recording details" 
  },
  { 
    name: "mortgage_child_docs", 
    description: "Assignments, modifications, subordinations, releases, satisfactions of mortgages/deeds of trust" 
  },
  
  // Liens
  { 
    name: "tax_lien", 
    description: "Federal/state tax liens with taxpayer name, amount owed, tax period, lien number, and recording information" 
  },
  { 
    name: "mechanics_lien", 
    description: "Mechanic's/construction liens with claimant, property owner, amount claimed, labor/materials description, and notice dates" 
  },
  { 
    name: "hoa_lien", 
    description: "HOA/condo association liens with association name, unit owner, assessment amount, delinquent period, and recording details" 
  },
  { 
    name: "judgment_lien", 
    description: "Judgment liens and abstracts with creditor/debtor names, judgment amount, court information, and case number" 
  },
  { 
    name: "ucc_filing", 
    description: "UCC financing statements with secured party, debtor, collateral description, and filing information" 
  },
  
  // Easements & Restrictions
  { 
    name: "easement", 
    description: "Recorded easements with grantor/grantee, easement type, purpose, location, and recording details" 
  },
  { 
    name: "ccr_restrictions", 
    description: "CC&Rs and deed restrictions with declarant, restricted property, covenant terms, and enforcement provisions" 
  },
  
  // Court Documents
  { 
    name: "lis_pendens", 
    description: "Lis pendens (notice of pending litigation) with parties, case number, court, nature of action, and property affected" 
  },
  { 
    name: "court_order", 
    description: "Court orders and decrees with case information, parties, order type, and effective dates" 
  },
  { 
    name: "probate_document", 
    description: "Probate documents including letters testamentary, letters of administration, heirship affidavits, and estate documents" 
  },
  { 
    name: "bankruptcy_document", 
    description: "Bankruptcy filings with debtor, case number, chapter, trustee, and discharge/stay information" 
  },
  
  // Foreclosure
  { 
    name: "foreclosure_notice", 
    description: "Foreclosure documents including notice of default, trustee's sale notice, and foreclosure filings" 
  },
  
  // Tax Documents
  { 
    name: "tax_reports", 
    description: "Property tax bills and statements with parcel number, assessed values, tax amounts, due dates, and payment status" 
  },
  
  // Title Documents
  { 
    name: "prior_policy", 
    description: "Prior title policies, commitments, and preliminary reports with policy number, exceptions, and requirements" 
  },
  
  // Survey & Plat
  { 
    name: "survey_plat", 
    description: "Surveys and plat maps with surveyor information, legal description, boundaries, and monuments" 
  },
  { 
    name: "property_details", 
    description: "Legal descriptions, vesting information, and property details not in other categories" 
  },
  
  // Authority Documents
  { 
    name: "power_of_attorney", 
    description: "Power of attorney documents with principal, agent, powers granted, and effective dates" 
  },
  { 
    name: "entity_authority", 
    description: "Corporate/entity documents including resolutions, articles, operating agreements, and good standing certificates" 
  },
  { 
    name: "trust_certification", 
    description: "Trust documents including certificates of trust, trust agreements, and trustee certifications" 
  },
  
  // Affidavits
  { 
    name: "affidavit", 
    description: "Various affidavits including title affidavits, identity affidavits, FIRPTA certificates, and gap affidavits" 
  },
  
  // Closing Documents
  { 
    name: "settlement_statement", 
    description: "Settlement statements (HUD-1, Closing Disclosure) with transaction details, prorations, and disbursements" 
  },
  
  // Leases
  { 
    name: "lease_document", 
    description: "Lease agreements and memoranda of lease with landlord/tenant, term, rent, and lease provisions" 
  },
  
  // Catch-all
  { 
    name: "other_recorded", 
    description: "Other recorded documents not fitting specific categories" 
  }
];

/**
 * Map document categories to their extraction schemas
 */
export const SCHEMA_MAP = {
  // Admin
  cover_sheet: schemas.cover_sheet?.schema,
  transaction_summary: schemas.transaction_summary?.schema,
  // Deeds
  recorded_transfer_deed: schemas.recorded_transfer_deed?.schema,
  deed_of_trust_mortgage: schemas.deed_of_trust_mortgage?.schema,
  mortgage_child_docs: schemas.mortgage_child_docs?.schema,
  tax_lien: schemas.tax_lien?.schema,
  mechanics_lien: schemas.mechanics_lien?.schema,
  hoa_lien: schemas.hoa_lien?.schema,
  judgment_lien: schemas.judgments?.schema, // alias
  ucc_filing: schemas.ucc_filing?.schema,
  easement: schemas.easement?.schema,
  ccr_restrictions: schemas.ccr_restrictions?.schema,
  lis_pendens: schemas.lis_pendens?.schema,
  court_order: schemas.court_order?.schema,
  probate_document: schemas.probate_document?.schema,
  bankruptcy_document: schemas.bankruptcy_document?.schema,
  foreclosure_notice: schemas.foreclosure_notice?.schema,
  tax_reports: schemas.tax_reports?.schema,
  prior_policy: schemas.prior_policy?.schema,
  survey_plat: schemas.survey_plat?.schema,
  property_details: schemas.property_details?.schema,
  power_of_attorney: schemas.power_of_attorney?.schema,
  entity_authority: schemas.entity_authority?.schema,
  trust_certification: schemas.trust_certification?.schema,
  affidavit: schemas.affidavit?.schema,
  settlement_statement: schemas.settlement_statement?.schema,
  lease_document: schemas.lease_document?.schema,
  other_recorded: schemas.other_recorded?.schema,
  // Legacy aliases
  judgments: schemas.judgments?.schema,
  notices_agreements: schemas.notices_agreements?.schema,
};

/**
 * Map split types to extraction categories
 */
export const SPLIT_TO_CATEGORY_MAP = {
  // Admin
  cover_sheet: "cover_sheet",
  transaction_summary: "transaction_summary",
  order_form: "cover_sheet",
  // Deeds
  deed: "recorded_transfer_deed",
  mortgage: "deed_of_trust_mortgage",
  mortgage_modification: "mortgage_child_docs",
  tax_lien: "tax_lien",
  mechanics_lien: "mechanics_lien",
  hoa_lien: "hoa_lien",
  judgment_lien: "judgment_lien",
  ucc_filing: "ucc_filing",
  easement: "easement",
  ccr: "ccr_restrictions",
  court_document: "court_order",
  probate: "probate_document",
  bankruptcy: "bankruptcy_document",
  foreclosure: "foreclosure_notice",
  tax_document: "tax_reports",
  title_document: "prior_policy",
  survey: "survey_plat",
  plat: "survey_plat",
  power_of_attorney: "power_of_attorney",
  entity_document: "entity_authority",
  trust_document: "trust_certification",
  affidavit: "affidavit",
  closing_document: "settlement_statement",
  lease: "lease_document",
  other: "other_recorded",
  // Legacy mappings
  lien: "tax_lien",
  judgment: "judgment_lien",
  notice: "foreclosure_notice",
  plat_survey: "survey_plat",
};

/**
 * Convert snake_case field name to friendly Title Case
 * e.g., "tenant_name" -> "Tenant Name", "lease_term" -> "Lease Term"
 */
export function toFriendlyFieldName(fieldName) {
  if (!fieldName) return fieldName;
  
  // Special case mappings for better readability
  const specialMappings = {
    'grantor_name': 'Grantor (Seller)',
    'grantee_name': 'Grantee (Buyer)',
    'trustor_or_borrower_name': 'Borrower Name',
    'grantor_signature_present': 'Grantor Signature',
    'notary_signature_present': 'Notary Signature',
    'surveyor_signature_present': 'Surveyor Signature',
    'surveyor_seal_present': 'Surveyor Seal',
    'principal_signature_present': 'Principal Signature',
    'affiant_signature_present': 'Affiant Signature',
    'requires_visual_verification': 'Visual Verification Required',
    'parcel_identification_number': 'Parcel ID (PIN)',
    'ccr_restrictions': 'CC&R Restrictions',
    'hoa_lien': 'HOA Lien',
    'ucc_filing': 'UCC Filing',
  };
  
  if (specialMappings[fieldName]) {
    return specialMappings[fieldName];
  }
  
  // Convert snake_case to Title Case
  return fieldName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Critical fields by document type that trigger review if missing
 */
export const CRITICAL_FIELDS = {
  // Admin
  cover_sheet: ["order_number", "property_address"],
  transaction_summary: ["buyer_name", "seller_name", "property_address"],
  // Deeds - include signature verification
  recorded_transfer_deed: ["recording_date", "grantor_name", "grantee_name", "grantor_signature_present", "notary_signature_present"],
  deed_of_trust_mortgage: ["recording_date", "loan_amount", "trustor_or_borrower_name"],
  mortgage_child_docs: ["recording_date", "document_type"],
  tax_lien: ["recording_date", "taxpayer_name", "total_amount_owed"],
  mechanics_lien: ["recording_date", "claimant_name", "claim_amount"],
  hoa_lien: ["recording_date", "association_name", "amount_owed"],
  judgment_lien: ["recording_date", "creditor_name", "debtor_name", "judgment_amount"],
  ucc_filing: ["filing_date", "secured_party", "debtor_name"],
  easement: ["recording_date", "easement_type"],
  ccr_restrictions: ["recording_date", "declarant_name"],
  lis_pendens: ["recording_date", "plaintiff_name", "defendant_name", "case_number"],
  court_order: ["order_date", "case_number"],
  probate_document: ["decedent_name", "case_number"],
  bankruptcy_document: ["debtor_name", "case_number", "chapter"],
  foreclosure_notice: ["recording_date", "borrower_name"],
  tax_reports: ["parcel_identification_number", "tax_year"],
  prior_policy: ["policy_number"],
  survey_plat: ["surveyor_name", "survey_date", "surveyor_signature_present", "surveyor_seal_present", "requires_visual_verification"],
  property_details: ["legal_description"],
  power_of_attorney: ["principal_name", "agent_name", "principal_signature_present", "notary_signature_present"],
  affidavit: ["affiant_name", "affiant_signature_present", "notary_signature_present"],
  entity_authority: ["entity_name", "entity_type"],
  trust_certification: ["trust_name", "trustee_name"],
  affidavit: ["affiant_name", "affidavit_type"],
  settlement_statement: ["closing_date", "buyer_name", "seller_name"],
  lease_document: ["landlord_name", "tenant_name", "lease_term"],
  // Catch-all types - flexible critical fields
  other_recorded: ["document_title", "document_summary"],
  notices_agreements: ["notice_date", "issuing_party_name"],
};

/**
 * Confidence threshold for human review
 */
export const REVIEW_CONFIDENCE_THRESHOLD = 0.75;

/**
 * Check if an extraction needs human review
 */
export function checkNeedsReview(extraction, documentType) {
  const reasons = [];
  
  if (!extraction) {
    reasons.push("Document could not be processed — try re-uploading");
    return { needsReview: true, reasons };
  }
  
  // Handle wrapped response: { content: { ... }, error: null }
  const content = extraction.content || extraction;
  
  // Flag unclassified/other documents for human review
  if (documentType === "other_recorded" || documentType === "other") {
    reasons.push("Unrecognized document type — please identify and categorize manually");
  }
  
  if (content.requires_human_review) {
    reasons.push("Possible OCR issues detected — check handwritten or faded text");
  }
  
  const likelihoods = content.likelihoods || {};
  const likelihoodValues = Object.values(likelihoods).filter(v => typeof v === 'number');
  
  if (likelihoodValues.length > 0) {
    const avgLikelihood = likelihoodValues.reduce((sum, v) => sum + v, 0) / likelihoodValues.length;
    if (avgLikelihood < REVIEW_CONFIDENCE_THRESHOLD) {
      reasons.push(`Overall extraction confidence is low (${(avgLikelihood * 100).toFixed(0)}%) — review all fields`);
    }
    
    const lowConfFields = Object.entries(likelihoods)
      .filter(([_, v]) => typeof v === 'number' && v < 0.5)
      .map(([k, v]) => `${toFriendlyFieldName(k)} (${(v * 100).toFixed(0)}%)`);
    if (lowConfFields.length > 0 && lowConfFields.length <= 3) {
      reasons.push(`Verify these uncertain fields: ${lowConfFields.join(", ")}`);
    } else if (lowConfFields.length > 3) {
      reasons.push(`${lowConfFields.length} fields need verification due to low confidence`);
    }
  }
  
  const criticalFields = CRITICAL_FIELDS[documentType] || [];
  let parsedData = content.data || 
                   content.choices?.[0]?.message?.parsed ||
                   content.choices?.[0]?.message?.content ||
                   content.result ||
                   {};
  
  if (typeof parsedData === "string") {
    try {
      parsedData = JSON.parse(parsedData);
    } catch {
      parsedData = {};
    }
  }
  
  const missingCritical = criticalFields.filter(f => {
    const value = parsedData[f];
    return value === undefined || value === null || value === "";
  });
  
  if (missingCritical.length > 0) {
    const friendlyNames = missingCritical.map(f => toFriendlyFieldName(f));
    reasons.push(`Missing required fields: ${friendlyNames.join(", ")}`);
  }
  
  return {
    needsReview: reasons.length > 0,
    reasons,
  };
}

/**
 * Get schema for a document category
 */
export function getSchemaForCategory(category) {
  return SCHEMA_MAP[category] || SCHEMA_MAP.other_recorded;
}

/**
 * Get display name for a document category
 */
export function getCategoryDisplayName(category) {
  const displayNames = {
    // Admin
    cover_sheet: "Cover Sheet / Order Form",
    transaction_summary: "Transaction Summary",
    // Deeds
    recorded_transfer_deed: "Transfer Deed",
    deed_of_trust_mortgage: "Deed of Trust / Mortgage",
    mortgage_child_docs: "Mortgage Modification",
    tax_lien: "Tax Lien",
    mechanics_lien: "Mechanic's Lien",
    hoa_lien: "HOA / Assessment Lien",
    judgment_lien: "Judgment Lien",
    ucc_filing: "UCC Filing",
    easement: "Easement",
    ccr_restrictions: "CC&Rs / Restrictions",
    lis_pendens: "Lis Pendens",
    court_order: "Court Order",
    probate_document: "Probate Document",
    bankruptcy_document: "Bankruptcy Document",
    foreclosure_notice: "Foreclosure Notice",
    tax_reports: "Tax Report / Statement",
    prior_policy: "Title Policy / Commitment",
    survey_plat: "Survey / Plat",
    property_details: "Property Details",
    power_of_attorney: "Power of Attorney",
    entity_authority: "Entity / Corporate Document",
    trust_certification: "Trust Document",
    affidavit: "Affidavit",
    settlement_statement: "Settlement Statement",
    lease_document: "Lease",
    other_recorded: "Other Document",
    // Legacy
    judgments: "Judgment",
    notices_agreements: "Notice / Agreement",
  };
  return displayNames[category] || category;
}

export default {
  SUBDOCUMENT_TYPES,
  DOCUMENT_CATEGORIES,
  SCHEMA_MAP,
  SPLIT_TO_CATEGORY_MAP,
  CRITICAL_FIELDS,
  REVIEW_CONFIDENCE_THRESHOLD,
  toFriendlyFieldName,
  checkNeedsReview,
  getSchemaForCategory,
  getCategoryDisplayName,
};
