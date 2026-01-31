/**
 * Stewart Title Document Schemas
 * Comprehensive schemas for US Title Insurance document extraction
 */

// Helper function to convert field definitions to JSON Schema
function buildSchema(title, description, fields) {
  const properties = {};
  const required = [];

  fields.forEach(field => {
    let type = "string";
    if (field.data_type === "integer") type = "integer";
    else if (field.data_type === "number") type = "number";
    else if (field.data_type === "boolean") type = "boolean";
    else if (field.data_type === "date") type = "string";
    else if (field.data_type === "array") type = "array";

    const prop = {
      type,
      description: field.description || `${field.label.replace(/_/g, ' ')}.`
    };

    if (type === "array" && field.items) {
      prop.items = field.items;
    }

    properties[field.label] = prop;

    if (field.required) {
      required.push(field.label);
    }
  });

  return {
    type: "object",
    title,
    description,
    properties,
    required: required.length > 0 ? required : undefined
  };
}

// ============================================================================
// ADMIN / TRANSACTION FIELDS
// ============================================================================
const orderTrackingFields = [
  { label: "order_number", data_type: "string", description: "Stewart order/file number." },
  { label: "escrow_number", data_type: "string", description: "Escrow number." },
  { label: "gf_number", data_type: "string", description: "GF/Guaranty file number." },
  { label: "branch_name", data_type: "string", description: "Stewart branch/office name." },
  { label: "branch_code", data_type: "string", description: "Branch code." },
  { label: "closer_name", data_type: "string", description: "Closer/escrow officer name." },
  { label: "processor_name", data_type: "string", description: "Processor name." },
  { label: "examiner_name", data_type: "string", description: "Title examiner name." },
  { label: "underwriter", data_type: "string", description: "Title underwriter." },
];

const transactionFields = [
  { label: "transaction_type", data_type: "string", description: "Type: purchase, refinance, equity_loan, construction, cash_sale, foreclosure, short_sale, reo." },
  { label: "property_type", data_type: "string", description: "Type: sfr, condo, townhouse, pud, multi_family, commercial, industrial, land, farm, mobile_home." },
  { label: "occupancy_type", data_type: "string", description: "Type: primary_residence, second_home, investment, vacant." },
  { label: "closing_date", data_type: "date", description: "Scheduled closing date." },
  { label: "funding_date", data_type: "date", description: "Funding date." },
  { label: "effective_date", data_type: "date", description: "Policy effective date." },
  { label: "contract_date", data_type: "date", description: "Purchase contract date." },
  { label: "contract_price", data_type: "number", description: "Contract/purchase price." },
];

const buyerFields = [
  { label: "buyer_name", data_type: "string", description: "Buyer/borrower name." },
  { label: "buyer_entity_type", data_type: "string", description: "Buyer type: individual, married_couple, corporation, llc, trust." },
  { label: "buyer_address", data_type: "string", description: "Buyer mailing address." },
  { label: "buyer_city", data_type: "string", description: "Buyer city." },
  { label: "buyer_state", data_type: "string", description: "Buyer state." },
  { label: "buyer_zip", data_type: "string", description: "Buyer ZIP." },
  { label: "buyer_email", data_type: "string", description: "Buyer email." },
  { label: "buyer_phone", data_type: "string", description: "Buyer phone." },
  { label: "buyer_ssn_last4", data_type: "string", description: "Buyer SSN last 4 digits." },
  { label: "co_buyer_name", data_type: "string", description: "Co-buyer name." },
];

const sellerFields = [
  { label: "seller_name", data_type: "string", description: "Seller name." },
  { label: "seller_entity_type", data_type: "string", description: "Seller type: individual, married_couple, corporation, llc, trust, estate." },
  { label: "seller_address", data_type: "string", description: "Seller mailing address." },
  { label: "seller_city", data_type: "string", description: "Seller city." },
  { label: "seller_state", data_type: "string", description: "Seller state." },
  { label: "seller_zip", data_type: "string", description: "Seller ZIP." },
  { label: "seller_email", data_type: "string", description: "Seller email." },
  { label: "seller_phone", data_type: "string", description: "Seller phone." },
  { label: "co_seller_name", data_type: "string", description: "Co-seller name." },
];

const lenderFields = [
  { label: "lender_name", data_type: "string", description: "Lender/mortgage company name." },
  { label: "lender_address", data_type: "string", description: "Lender address." },
  { label: "lender_city", data_type: "string", description: "Lender city." },
  { label: "lender_state", data_type: "string", description: "Lender state." },
  { label: "lender_zip", data_type: "string", description: "Lender ZIP." },
  { label: "lender_contact_name", data_type: "string", description: "Lender contact name." },
  { label: "lender_contact_email", data_type: "string", description: "Lender contact email." },
  { label: "lender_contact_phone", data_type: "string", description: "Lender contact phone." },
  { label: "loan_officer_name", data_type: "string", description: "Loan officer name." },
  { label: "loan_number", data_type: "string", description: "Lender loan number." },
  { label: "loan_type", data_type: "string", description: "Type: conventional, fha, va, usda, jumbo, portfolio, hard_money." },
  { label: "loan_purpose", data_type: "string", description: "Purpose: purchase, rate_term_refi, cash_out_refi, construction, heloc." },
  { label: "loan_amount", data_type: "number", description: "Loan amount." },
  { label: "interest_rate", data_type: "string", description: "Interest rate." },
  { label: "loan_term_months", data_type: "integer", description: "Loan term in months." },
];

const realtorFields = [
  { label: "listing_agent_name", data_type: "string", description: "Listing/seller's agent name." },
  { label: "listing_agent_company", data_type: "string", description: "Listing agent brokerage." },
  { label: "listing_agent_phone", data_type: "string", description: "Listing agent phone." },
  { label: "listing_agent_email", data_type: "string", description: "Listing agent email." },
  { label: "listing_agent_license", data_type: "string", description: "Listing agent license number." },
  { label: "selling_agent_name", data_type: "string", description: "Selling/buyer's agent name." },
  { label: "selling_agent_company", data_type: "string", description: "Selling agent brokerage." },
  { label: "selling_agent_phone", data_type: "string", description: "Selling agent phone." },
  { label: "selling_agent_email", data_type: "string", description: "Selling agent email." },
  { label: "selling_agent_license", data_type: "string", description: "Selling agent license number." },
];

const attorneyFields = [
  { label: "buyer_attorney_name", data_type: "string", description: "Buyer's attorney name." },
  { label: "buyer_attorney_firm", data_type: "string", description: "Buyer's attorney firm." },
  { label: "buyer_attorney_phone", data_type: "string", description: "Buyer's attorney phone." },
  { label: "buyer_attorney_email", data_type: "string", description: "Buyer's attorney email." },
  { label: "seller_attorney_name", data_type: "string", description: "Seller's attorney name." },
  { label: "seller_attorney_firm", data_type: "string", description: "Seller's attorney firm." },
  { label: "seller_attorney_phone", data_type: "string", description: "Seller's attorney phone." },
  { label: "seller_attorney_email", data_type: "string", description: "Seller's attorney email." },
];

const titleSearchFields = [
  { label: "search_from_date", data_type: "date", description: "Title search from date." },
  { label: "search_to_date", data_type: "date", description: "Title search to date." },
  { label: "search_type", data_type: "string", description: "Type: full, update, current_owner, two_owner, foreclosure." },
  { label: "plant_name", data_type: "string", description: "Title plant name." },
  { label: "plant_date", data_type: "date", description: "Plant effective date." },
  { label: "exam_date", data_type: "date", description: "Title exam completion date." },
  { label: "chain_of_title_years", data_type: "integer", description: "Years of chain of title searched." },
  { label: "prior_policy_number", data_type: "string", description: "Prior policy number (if short search)." },
];

const workflowFields = [
  { label: "status", data_type: "string", description: "Status: open, pending, cleared, closed, cancelled." },
  { label: "opened_date", data_type: "date", description: "Date order opened." },
  { label: "commitment_date", data_type: "date", description: "Commitment issued date." },
  { label: "cleared_date", data_type: "date", description: "Date cleared to close." },
  { label: "closed_date", data_type: "date", description: "Actual closing date." },
  { label: "policy_issued_date", data_type: "date", description: "Date policy issued." },
  { label: "examiner_notes", data_type: "string", description: "Examiner notes/comments." },
  { label: "special_instructions", data_type: "string", description: "Special instructions." },
];

// Common field sets
const recordingFields = [
  { label: "recording_date", data_type: "date", description: "Date recorded (YYYY-MM-DD).", required: true },
  { label: "recording_book_number", data_type: "string", description: "Recording book number." },
  { label: "recording_page_number", data_type: "string", description: "Recording page number." },
  { label: "recording_instrument_number", data_type: "string", description: "Instrument/document number." },
  { label: "recording_county", data_type: "string", description: "County where recorded." },
  { label: "recording_state", data_type: "string", description: "State where recorded (2-letter code)." },
];

const propertyFields = [
  { label: "property_address", data_type: "string", description: "Property street address." },
  { label: "property_city", data_type: "string", description: "Property city." },
  { label: "property_state", data_type: "string", description: "Property state (2-letter code)." },
  { label: "property_zip", data_type: "string", description: "Property ZIP code." },
  { label: "property_county", data_type: "string", description: "Property county." },
  { label: "legal_description", data_type: "string", description: "Legal description of property." },
  { label: "parcel_number", data_type: "string", description: "Parcel/APN number." },
];

const notaryFields = [
  { label: "notary_name", data_type: "string", description: "Notary public name as printed." },
  { label: "notary_state", data_type: "string", description: "Notary state." },
  { label: "notary_county", data_type: "string", description: "Notary county." },
  { label: "notary_commission_number", data_type: "string", description: "Notary commission number." },
  { label: "notary_commission_expiration", data_type: "date", description: "Commission expiration date." },
  { label: "acknowledgment_date", data_type: "date", description: "Date of acknowledgment." },
  { label: "notary_seal_present", data_type: "boolean", description: "True if notary seal/stamp is visible on document." },
  { label: "notary_signature_present", data_type: "boolean", description: "True if notary signature is visible." },
];

// Signature tracking fields
const signatureFields = [
  { label: "grantor_signature_present", data_type: "boolean", description: "True if grantor/seller signature is visible." },
  { label: "grantor_signature_date", data_type: "date", description: "Date next to grantor signature." },
  { label: "grantee_signature_present", data_type: "boolean", description: "True if grantee/buyer signature is visible." },
  { label: "grantee_signature_date", data_type: "date", description: "Date next to grantee signature." },
  { label: "witness_1_name", data_type: "string", description: "First witness name (printed)." },
  { label: "witness_1_signature_present", data_type: "boolean", description: "True if first witness signature visible." },
  { label: "witness_2_name", data_type: "string", description: "Second witness name (printed)." },
  { label: "witness_2_signature_present", data_type: "boolean", description: "True if second witness signature visible." },
  { label: "all_required_signatures_present", data_type: "boolean", description: "True if all required signatures appear present." },
  { label: "signature_issues_noted", data_type: "string", description: "Note any signature issues: missing, illegible, undated, etc." },
];

// ============================================================================
// DEEDS
// ============================================================================
const recordedTransferDeedFields = [
  { label: "document_title", data_type: "string", description: "Document title (e.g., Warranty Deed, Quitclaim Deed)." },
  { label: "deed_type", data_type: "string", description: "Type: warranty, special_warranty, quitclaim, grant, bargain_sale, trustees, executors, sheriffs, tax." },
  { label: "grantor_name", data_type: "string", description: "Grantor (seller) name.", required: true },
  { label: "grantor_entity_type", data_type: "string", description: "Grantor type: individual, married_couple, corporation, llc, trust, estate." },
  { label: "grantee_name", data_type: "string", description: "Grantee (buyer) name.", required: true },
  { label: "grantee_entity_type", data_type: "string", description: "Grantee type: individual, married_couple, corporation, llc, trust." },
  { label: "vesting_type", data_type: "string", description: "How title is held: sole_and_separate, joint_tenants, tenants_in_common, community_property, trust." },
  { label: "consideration_amount", data_type: "number", description: "Purchase price or consideration amount." },
  { label: "transfer_tax", data_type: "number", description: "Transfer tax amount paid." },
  { label: "execution_date", data_type: "date", description: "Date deed was signed." },
  ...propertyFields,
  ...recordingFields,
  ...signatureFields,
  ...notaryFields,
];

// ============================================================================
// MORTGAGES & LOANS
// ============================================================================
const deedOfTrustMortgageFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "loan_type", data_type: "string", description: "Type: conventional, fha, va, usda, construction, heloc, reverse_mortgage." },
  { label: "trustor_or_borrower_name", data_type: "string", description: "Borrower/trustor name.", required: true },
  { label: "trustor_entity_type", data_type: "string", description: "Borrower entity type." },
  { label: "lender_name", data_type: "string", description: "Lender name." },
  { label: "beneficiary_name", data_type: "string", description: "Beneficiary name (if different from lender)." },
  { label: "trustee_name", data_type: "string", description: "Trustee name (for deed of trust)." },
  { label: "loan_amount", data_type: "number", description: "Original loan amount.", required: true },
  { label: "loan_number", data_type: "string", description: "Loan number." },
  { label: "interest_rate", data_type: "string", description: "Interest rate (if stated)." },
  { label: "loan_date", data_type: "date", description: "Date of loan/note." },
  { label: "maturity_date", data_type: "date", description: "Loan maturity date." },
  { label: "is_mers", data_type: "boolean", description: "Is MERS involved?" },
  { label: "mers_min", data_type: "string", description: "MERS MIN number." },
  ...propertyFields,
  ...recordingFields,
  ...notaryFields,
];

const mortgageChildDocsFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "document_type", data_type: "string", description: "Type: assignment, modification, subordination, release, satisfaction, reconveyance, partial_release." },
  { label: "original_loan_amount", data_type: "number", description: "Original loan amount." },
  { label: "new_loan_amount", data_type: "number", description: "New/modified loan amount (if modification)." },
  { label: "assignor_name", data_type: "string", description: "Assignor name (for assignments)." },
  { label: "assignee_name", data_type: "string", description: "Assignee name (for assignments)." },
  { label: "original_recording_date", data_type: "date", description: "Recording date of original instrument." },
  { label: "original_recording_book", data_type: "string", description: "Book of original recording." },
  { label: "original_recording_page", data_type: "string", description: "Page of original recording." },
  { label: "original_instrument_number", data_type: "string", description: "Instrument number of original." },
  ...propertyFields,
  ...recordingFields,
  ...notaryFields,
];

// ============================================================================
// LIENS
// ============================================================================
const taxLienFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "lien_type", data_type: "string", description: "Type: federal_irs, state_income, state_sales, estate_tax, inheritance_tax." },
  { label: "taxpayer_name", data_type: "string", description: "Taxpayer name.", required: true },
  { label: "taxpayer_address", data_type: "string", description: "Taxpayer address." },
  { label: "issuing_authority", data_type: "string", description: "Authority issuing lien (IRS, State Dept of Revenue, etc.)." },
  { label: "total_amount_owed", data_type: "number", description: "Total amount owed.", required: true },
  { label: "tax_period", data_type: "string", description: "Tax period covered." },
  { label: "assessment_date", data_type: "date", description: "Date of assessment." },
  { label: "lien_number", data_type: "string", description: "Lien/serial number." },
  { label: "certificate_number", data_type: "string", description: "Certificate number." },
  ...propertyFields,
  ...recordingFields,
];

const mechanicsLienFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "lien_type", data_type: "string", description: "Type: mechanics, materialman, contractor, subcontractor." },
  { label: "claimant_name", data_type: "string", description: "Lien claimant name.", required: true },
  { label: "claimant_address", data_type: "string", description: "Claimant address." },
  { label: "property_owner_name", data_type: "string", description: "Property owner name." },
  { label: "general_contractor_name", data_type: "string", description: "General contractor name." },
  { label: "claim_amount", data_type: "number", description: "Amount of lien claim.", required: true },
  { label: "labor_description", data_type: "string", description: "Description of labor/services provided." },
  { label: "materials_description", data_type: "string", description: "Description of materials provided." },
  { label: "first_work_date", data_type: "date", description: "Date work first commenced." },
  { label: "last_work_date", data_type: "date", description: "Date work last performed." },
  { label: "notice_to_owner_date", data_type: "date", description: "Date notice to owner was sent." },
  ...propertyFields,
  ...recordingFields,
];

const hoaLienFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "lien_type", data_type: "string", description: "Type: hoa, condo, special_assessment, municipal, code_violation." },
  { label: "association_name", data_type: "string", description: "HOA/Association name.", required: true },
  { label: "unit_owner_name", data_type: "string", description: "Unit/property owner name." },
  { label: "unit_number", data_type: "string", description: "Unit number (if condo)." },
  { label: "amount_owed", data_type: "number", description: "Total amount owed.", required: true },
  { label: "assessment_amount", data_type: "number", description: "Regular assessment amount." },
  { label: "special_assessment_amount", data_type: "number", description: "Special assessment amount." },
  { label: "delinquent_period", data_type: "string", description: "Period of delinquency." },
  { label: "interest_rate", data_type: "string", description: "Interest rate on delinquent amounts." },
  ...propertyFields,
  ...recordingFields,
];

const judgmentsFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "judgment_type", data_type: "string", description: "Type: money_judgment, child_support, alimony, federal." },
  { label: "court_name", data_type: "string", description: "Court name." },
  { label: "court_type", data_type: "string", description: "Court type: superior, district, federal, municipal." },
  { label: "court_county", data_type: "string", description: "Court county." },
  { label: "court_state", data_type: "string", description: "Court state." },
  { label: "case_number", data_type: "string", description: "Case number.", required: true },
  { label: "creditor_name", data_type: "string", description: "Judgment creditor name.", required: true },
  { label: "debtor_name", data_type: "string", description: "Judgment debtor name.", required: true },
  { label: "judgment_amount", data_type: "number", description: "Judgment amount.", required: true },
  { label: "judgment_date", data_type: "date", description: "Date judgment entered." },
  { label: "interest_rate", data_type: "string", description: "Post-judgment interest rate." },
  ...recordingFields,
];

const uccFilingFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "filing_type", data_type: "string", description: "Type: ucc1_initial, ucc3_amendment, ucc3_continuation, ucc3_termination." },
  { label: "secured_party_name", data_type: "string", description: "Secured party name.", required: true },
  { label: "secured_party_address", data_type: "string", description: "Secured party address." },
  { label: "debtor_name", data_type: "string", description: "Debtor name.", required: true },
  { label: "debtor_address", data_type: "string", description: "Debtor address." },
  { label: "collateral_description", data_type: "string", description: "Description of collateral." },
  { label: "filing_number", data_type: "string", description: "UCC filing number." },
  { label: "filing_date", data_type: "date", description: "Filing date.", required: true },
  { label: "lapse_date", data_type: "date", description: "Lapse/expiration date." },
  { label: "is_fixture_filing", data_type: "boolean", description: "Is this a fixture filing?" },
  ...propertyFields,
];

// ============================================================================
// EASEMENTS & RESTRICTIONS
// ============================================================================
const easementFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "easement_type", data_type: "string", description: "Type: utility, access, drainage, conservation, view, solar, parking." },
  { label: "easement_purpose", data_type: "string", description: "Purpose of easement." },
  { label: "grantor_name", data_type: "string", description: "Grantor name." },
  { label: "grantee_name", data_type: "string", description: "Grantee name." },
  { label: "dominant_estate", data_type: "string", description: "Dominant estate (benefited property)." },
  { label: "servient_estate", data_type: "string", description: "Servient estate (burdened property)." },
  { label: "easement_width", data_type: "string", description: "Width of easement." },
  { label: "easement_location", data_type: "string", description: "Location description." },
  { label: "is_exclusive", data_type: "boolean", description: "Is easement exclusive?" },
  { label: "is_perpetual", data_type: "boolean", description: "Is easement perpetual?" },
  { label: "consideration", data_type: "number", description: "Consideration paid." },
  ...propertyFields,
  ...recordingFields,
];

const ccrRestrictionsFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "document_type", data_type: "string", description: "Type: ccr, deed_restriction, declaration, amendment." },
  { label: "declarant_name", data_type: "string", description: "Declarant name." },
  { label: "subdivision_name", data_type: "string", description: "Subdivision/development name." },
  { label: "association_name", data_type: "string", description: "HOA name (if applicable)." },
  { label: "effective_date", data_type: "date", description: "Effective date." },
  { label: "expiration_date", data_type: "date", description: "Expiration date (if any)." },
  { label: "restrictions_summary", data_type: "string", description: "Summary of key restrictions." },
  { label: "use_restrictions", data_type: "string", description: "Use restrictions." },
  { label: "architectural_control", data_type: "boolean", description: "Are there architectural controls?" },
  { label: "assessment_authority", data_type: "boolean", description: "Does HOA have assessment authority?" },
  ...propertyFields,
  ...recordingFields,
];

// ============================================================================
// COURT DOCUMENTS
// ============================================================================
const lisPendensFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "court_name", data_type: "string", description: "Court name." },
  { label: "court_county", data_type: "string", description: "Court county." },
  { label: "court_state", data_type: "string", description: "Court state." },
  { label: "case_number", data_type: "string", description: "Case number.", required: true },
  { label: "plaintiff_name", data_type: "string", description: "Plaintiff name.", required: true },
  { label: "defendant_name", data_type: "string", description: "Defendant name.", required: true },
  { label: "nature_of_action", data_type: "string", description: "Nature of action/claim." },
  { label: "filing_date", data_type: "date", description: "Court filing date." },
  { label: "amount_claimed", data_type: "number", description: "Amount claimed (if stated)." },
  ...propertyFields,
  ...recordingFields,
];

const courtOrderFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "order_type", data_type: "string", description: "Type: judgment, decree, order, stipulation." },
  { label: "court_name", data_type: "string", description: "Court name." },
  { label: "court_county", data_type: "string", description: "Court county." },
  { label: "court_state", data_type: "string", description: "Court state." },
  { label: "case_number", data_type: "string", description: "Case number." },
  { label: "case_name", data_type: "string", description: "Case name/caption." },
  { label: "order_date", data_type: "date", description: "Date of order.", required: true },
  { label: "judge_name", data_type: "string", description: "Judge name." },
  { label: "order_summary", data_type: "string", description: "Summary of order provisions." },
  ...propertyFields,
  ...recordingFields,
];

const probateDocumentFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "document_type", data_type: "string", description: "Type: letters_testamentary, letters_administration, heirship_affidavit, small_estate, death_certificate." },
  { label: "decedent_name", data_type: "string", description: "Decedent name.", required: true },
  { label: "date_of_death", data_type: "date", description: "Date of death." },
  { label: "executor_name", data_type: "string", description: "Executor/personal representative name." },
  { label: "administrator_name", data_type: "string", description: "Administrator name (if intestate)." },
  { label: "court_name", data_type: "string", description: "Probate court name." },
  { label: "case_number", data_type: "string", description: "Probate case number.", required: true },
  { label: "heirs_names", data_type: "string", description: "Names of heirs." },
  { label: "issue_date", data_type: "date", description: "Date letters/document issued." },
  ...propertyFields,
  ...recordingFields,
];

const bankruptcyDocumentFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "document_type", data_type: "string", description: "Type: petition, discharge, relief_from_stay, trustee_deed." },
  { label: "debtor_name", data_type: "string", description: "Debtor name.", required: true },
  { label: "case_number", data_type: "string", description: "Bankruptcy case number.", required: true },
  { label: "chapter", data_type: "string", description: "Chapter: 7, 11, 13.", required: true },
  { label: "court_name", data_type: "string", description: "Bankruptcy court name." },
  { label: "court_district", data_type: "string", description: "Court district." },
  { label: "filing_date", data_type: "date", description: "Filing date." },
  { label: "discharge_date", data_type: "date", description: "Discharge date (if applicable)." },
  { label: "trustee_name", data_type: "string", description: "Trustee name." },
  ...propertyFields,
  ...recordingFields,
];

// ============================================================================
// FORECLOSURE
// ============================================================================
const foreclosureNoticeFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "notice_type", data_type: "string", description: "Type: notice_of_default, trustee_sale, foreclosure_complaint, sheriffs_sale." },
  { label: "borrower_name", data_type: "string", description: "Borrower name.", required: true },
  { label: "lender_name", data_type: "string", description: "Lender/beneficiary name." },
  { label: "trustee_name", data_type: "string", description: "Trustee name." },
  { label: "loan_amount", data_type: "number", description: "Original loan amount." },
  { label: "amount_in_default", data_type: "number", description: "Amount in default." },
  { label: "default_date", data_type: "date", description: "Date of default." },
  { label: "sale_date", data_type: "date", description: "Scheduled sale date." },
  { label: "sale_time", data_type: "string", description: "Scheduled sale time." },
  { label: "sale_location", data_type: "string", description: "Sale location." },
  { label: "original_recording_date", data_type: "date", description: "Recording date of original loan." },
  { label: "original_instrument_number", data_type: "string", description: "Original instrument number." },
  ...propertyFields,
  ...recordingFields,
];

// ============================================================================
// TAX DOCUMENTS
// ============================================================================
const taxReportsFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "tax_type", data_type: "string", description: "Type: annual, supplemental, corrected." },
  { label: "tax_year", data_type: "string", description: "Tax year.", required: true },
  { label: "parcel_identification_number", data_type: "string", description: "Parcel/APN number.", required: true },
  { label: "property_owner_name", data_type: "string", description: "Property owner name." },
  { label: "assessed_land_value", data_type: "number", description: "Assessed land value." },
  { label: "assessed_improvement_value", data_type: "number", description: "Assessed improvement value." },
  { label: "total_assessed_value", data_type: "number", description: "Total assessed value." },
  { label: "tax_amount", data_type: "number", description: "Total tax amount." },
  { label: "first_installment_amount", data_type: "number", description: "First installment amount." },
  { label: "first_installment_due_date", data_type: "date", description: "First installment due date." },
  { label: "first_installment_status", data_type: "string", description: "Status: paid, unpaid, delinquent." },
  { label: "second_installment_amount", data_type: "number", description: "Second installment amount." },
  { label: "second_installment_due_date", data_type: "date", description: "Second installment due date." },
  { label: "second_installment_status", data_type: "string", description: "Status: paid, unpaid, delinquent." },
  { label: "exemptions", data_type: "string", description: "Tax exemptions (homestead, etc.)." },
  ...propertyFields,
];

// ============================================================================
// TITLE DOCUMENTS
// ============================================================================
const priorPolicyFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "document_type", data_type: "string", description: "Type: owners_policy, lenders_policy, commitment, preliminary_report." },
  { label: "policy_number", data_type: "string", description: "Policy number.", required: true },
  { label: "effective_date", data_type: "date", description: "Effective date." },
  { label: "policy_amount", data_type: "number", description: "Policy amount." },
  { label: "insured_name", data_type: "string", description: "Insured name." },
  { label: "underwriter", data_type: "string", description: "Title insurance underwriter." },
  { label: "exceptions_summary", data_type: "string", description: "Summary of exceptions." },
  { label: "requirements_summary", data_type: "string", description: "Summary of requirements." },
  { label: "vesting", data_type: "string", description: "Vesting shown on policy." },
  ...propertyFields,
];

// ============================================================================
// SURVEYS & PLATS
// ============================================================================
const surveyPlatFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "document_type", data_type: "string", description: "Type: alta_survey, boundary_survey, plat_map, subdivision_plat, condo_plat, ics_survey, mortgage_inspection." },
  
  // Surveyor information
  { label: "surveyor_name", data_type: "string", description: "Surveyor name as printed." },
  { label: "surveyor_license_number", data_type: "string", description: "Surveyor license/registration number." },
  { label: "surveyor_license_state", data_type: "string", description: "State of surveyor license." },
  { label: "survey_company", data_type: "string", description: "Survey company name." },
  { label: "survey_company_address", data_type: "string", description: "Survey company address." },
  { label: "surveyor_signature_present", data_type: "boolean", description: "True if surveyor signature is visible." },
  { label: "surveyor_seal_present", data_type: "boolean", description: "True if surveyor seal/stamp is visible." },
  
  // Dates
  { label: "survey_date", data_type: "date", description: "Date survey was performed." },
  { label: "certification_date", data_type: "date", description: "Date of surveyor certification." },
  { label: "last_revision_date", data_type: "date", description: "Date of last revision (if any)." },
  
  // Property identification (from text on diagram)
  { label: "subdivision_name", data_type: "string", description: "Subdivision name as shown on plat." },
  { label: "lot_number", data_type: "string", description: "Lot number(s)." },
  { label: "block_number", data_type: "string", description: "Block number." },
  { label: "phase_unit", data_type: "string", description: "Phase or unit number." },
  { label: "section_township_range", data_type: "string", description: "Section, township, range if shown." },
  { label: "acreage", data_type: "string", description: "Total acreage or square footage as stated." },
  
  // Visual elements detected (flags for review)
  { label: "contains_diagram", data_type: "boolean", description: "True if document contains survey diagram/map." },
  { label: "contains_legal_description", data_type: "boolean", description: "True if legal description text is present." },
  { label: "shows_improvements", data_type: "boolean", description: "True if buildings/improvements are shown." },
  { label: "shows_easements", data_type: "boolean", description: "True if easements are depicted." },
  { label: "shows_encroachments", data_type: "boolean", description: "True if encroachments are noted." },
  { label: "shows_flood_zone", data_type: "boolean", description: "True if flood zone information is shown." },
  
  // Text extracted from diagram
  { label: "easements_noted", data_type: "string", description: "List of easements noted on survey (text descriptions)." },
  { label: "encroachments_noted", data_type: "string", description: "List of encroachments noted (text descriptions)." },
  { label: "exceptions_noted", data_type: "string", description: "Exceptions or notes on survey." },
  { label: "flood_zone_designation", data_type: "string", description: "Flood zone designation if shown (e.g., Zone X, Zone AE)." },
  { label: "certification_text", data_type: "string", description: "Text of surveyor's certification statement." },
  
  // Flags for human review
  { label: "requires_visual_verification", data_type: "boolean", description: "True if diagram details require human visual review." },
  { label: "visual_review_notes", data_type: "string", description: "Notes on what requires visual verification." },
  
  ...propertyFields,
  ...recordingFields,
];

const propertyDetailsFields = [
  { label: "vesting_value", data_type: "string", description: "Current vesting." },
  { label: "complete_legal_description", data_type: "string", description: "Complete legal description." },
  { label: "lot_number", data_type: "string", description: "Lot number." },
  { label: "block_number", data_type: "string", description: "Block number." },
  { label: "subdivision_name", data_type: "string", description: "Subdivision name." },
  { label: "section", data_type: "string", description: "Section number." },
  { label: "township", data_type: "string", description: "Township." },
  { label: "range", data_type: "string", description: "Range." },
  { label: "plat_book", data_type: "string", description: "Plat book reference." },
  { label: "plat_page", data_type: "string", description: "Plat page reference." },
  { label: "plant_effective_date", data_type: "date", description: "Plant effective date." },
  ...propertyFields,
];

// ============================================================================
// AUTHORITY DOCUMENTS
// ============================================================================
const powerOfAttorneyFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "poa_type", data_type: "string", description: "Type: general, limited, durable, springing, healthcare, financial." },
  { label: "principal_name", data_type: "string", description: "Principal name.", required: true },
  { label: "principal_address", data_type: "string", description: "Principal address." },
  { label: "agent_name", data_type: "string", description: "Agent/attorney-in-fact name.", required: true },
  { label: "agent_address", data_type: "string", description: "Agent address." },
  { label: "successor_agent_name", data_type: "string", description: "Successor agent name." },
  { label: "powers_granted", data_type: "string", description: "Summary of powers granted." },
  { label: "real_property_powers", data_type: "boolean", description: "True if POA grants real property powers." },
  { label: "effective_date", data_type: "date", description: "Effective date." },
  { label: "expiration_date", data_type: "date", description: "Expiration date (if limited)." },
  { label: "is_durable", data_type: "boolean", description: "Is POA durable (survives incapacity)?" },
  // Signature tracking
  { label: "principal_signature_present", data_type: "boolean", description: "True if principal signature is visible." },
  { label: "principal_signature_date", data_type: "date", description: "Date next to principal signature." },
  { label: "witness_1_name", data_type: "string", description: "First witness name." },
  { label: "witness_1_signature_present", data_type: "boolean", description: "True if first witness signature visible." },
  { label: "witness_2_name", data_type: "string", description: "Second witness name." },
  { label: "witness_2_signature_present", data_type: "boolean", description: "True if second witness signature visible." },
  ...recordingFields,
  ...notaryFields,
];

const entityAuthorityFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "document_type", data_type: "string", description: "Type: resolution, articles_incorporation, articles_organization, operating_agreement, partnership_agreement, good_standing, incumbency." },
  { label: "entity_name", data_type: "string", description: "Entity name.", required: true },
  { label: "entity_type", data_type: "string", description: "Type: corporation, llc, partnership, lp, llp.", required: true },
  { label: "state_of_formation", data_type: "string", description: "State of formation." },
  { label: "formation_date", data_type: "date", description: "Formation date." },
  { label: "authorized_signer_name", data_type: "string", description: "Authorized signer name." },
  { label: "authorized_signer_title", data_type: "string", description: "Authorized signer title." },
  { label: "registered_agent", data_type: "string", description: "Registered agent name." },
  { label: "document_date", data_type: "date", description: "Document date." },
  ...recordingFields,
];

const trustCertificationFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "document_type", data_type: "string", description: "Type: certificate_of_trust, trust_agreement, trust_amendment, trustee_certification." },
  { label: "trust_name", data_type: "string", description: "Trust name.", required: true },
  { label: "trustor_name", data_type: "string", description: "Trustor/settlor name." },
  { label: "trustee_name", data_type: "string", description: "Trustee name.", required: true },
  { label: "successor_trustee_name", data_type: "string", description: "Successor trustee name." },
  { label: "trust_date", data_type: "date", description: "Date trust established." },
  { label: "is_revocable", data_type: "boolean", description: "Is trust revocable?" },
  { label: "trustee_powers", data_type: "string", description: "Summary of trustee powers." },
  ...recordingFields,
  ...notaryFields,
];

// ============================================================================
// AFFIDAVITS
// ============================================================================
const affidavitFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "affidavit_type", data_type: "string", description: "Type: title, identity, non_foreign_firpta, gap, continuous_marriage, name, survivorship, heirship, scriveners, possession, death, domicile." },
  { label: "affiant_name", data_type: "string", description: "Affiant (person swearing) name.", required: true },
  { label: "affiant_address", data_type: "string", description: "Affiant address." },
  { label: "co_affiant_name", data_type: "string", description: "Co-affiant name (if any)." },
  { label: "statement_summary", data_type: "string", description: "Summary of sworn statements." },
  { label: "execution_date", data_type: "date", description: "Date signed." },
  { label: "related_party_name", data_type: "string", description: "Related party name (if applicable)." },
  { label: "related_transaction", data_type: "string", description: "Related transaction description." },
  // Signature tracking
  { label: "affiant_signature_present", data_type: "boolean", description: "True if affiant signature is visible." },
  { label: "affiant_signature_date", data_type: "date", description: "Date next to affiant signature." },
  { label: "co_affiant_signature_present", data_type: "boolean", description: "True if co-affiant signature visible (if applicable)." },
  ...propertyFields,
  ...recordingFields,
  ...notaryFields,
];

// ============================================================================
// CLOSING DOCUMENTS
// ============================================================================
const settlementStatementFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "document_type", data_type: "string", description: "Type: hud1, closing_disclosure, alta_settlement." },
  { label: "file_number", data_type: "string", description: "File/escrow number." },
  { label: "closing_date", data_type: "date", description: "Closing date.", required: true },
  { label: "disbursement_date", data_type: "date", description: "Disbursement date." },
  { label: "settlement_agent", data_type: "string", description: "Settlement agent/company." },
  { label: "settlement_location", data_type: "string", description: "Settlement location." },
  // Buyer info
  { label: "buyer_name", data_type: "string", description: "Buyer name.", required: true },
  { label: "buyer_address", data_type: "string", description: "Buyer address." },
  { label: "co_buyer_name", data_type: "string", description: "Co-buyer name." },
  // Seller info
  { label: "seller_name", data_type: "string", description: "Seller name.", required: true },
  { label: "seller_address", data_type: "string", description: "Seller address." },
  { label: "co_seller_name", data_type: "string", description: "Co-seller name." },
  // Lender info
  { label: "lender_name", data_type: "string", description: "Lender name." },
  { label: "loan_number", data_type: "string", description: "Loan number." },
  // Financial
  { label: "purchase_price", data_type: "number", description: "Contract/purchase price." },
  { label: "loan_amount", data_type: "number", description: "Loan amount." },
  { label: "earnest_money", data_type: "number", description: "Earnest money deposit." },
  { label: "seller_credit", data_type: "number", description: "Seller credit to buyer." },
  { label: "lender_credit", data_type: "number", description: "Lender credit." },
  // Prorations
  { label: "proration_date", data_type: "date", description: "Proration date." },
  { label: "tax_proration", data_type: "number", description: "Property tax proration." },
  { label: "hoa_proration", data_type: "number", description: "HOA dues proration." },
  { label: "rent_proration", data_type: "number", description: "Rent proration (if applicable)." },
  // Fees
  { label: "title_insurance_premium", data_type: "number", description: "Title insurance premium." },
  { label: "owners_policy_amount", data_type: "number", description: "Owner's policy amount." },
  { label: "lenders_policy_amount", data_type: "number", description: "Lender's policy amount." },
  { label: "escrow_fee", data_type: "number", description: "Escrow/settlement fee." },
  { label: "recording_fees", data_type: "number", description: "Recording fees." },
  { label: "transfer_tax", data_type: "number", description: "Transfer tax." },
  { label: "survey_fee", data_type: "number", description: "Survey fee." },
  // Totals
  { label: "total_buyer_charges", data_type: "number", description: "Total buyer charges." },
  { label: "total_buyer_credits", data_type: "number", description: "Total buyer credits." },
  { label: "buyer_cash_to_close", data_type: "number", description: "Buyer cash to/from close." },
  { label: "total_seller_charges", data_type: "number", description: "Total seller charges." },
  { label: "total_seller_credits", data_type: "number", description: "Total seller credits." },
  { label: "seller_proceeds", data_type: "number", description: "Seller net proceeds." },
  // Commission
  { label: "total_commission", data_type: "number", description: "Total real estate commission." },
  { label: "listing_agent_commission", data_type: "number", description: "Listing agent commission." },
  { label: "selling_agent_commission", data_type: "number", description: "Selling agent commission." },
  // Payoffs
  { label: "existing_loan_payoff", data_type: "number", description: "Existing loan payoff amount." },
  { label: "existing_loan_lender", data_type: "string", description: "Existing loan lender name." },
  ...propertyFields,
];

// ============================================================================
// LEASES
// ============================================================================
const leaseDocumentFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "document_type", data_type: "string", description: "Type: residential_lease, commercial_lease, ground_lease, memorandum_of_lease, snda." },
  { label: "landlord_name", data_type: "string", description: "Landlord name.", required: true },
  { label: "tenant_name", data_type: "string", description: "Tenant name.", required: true },
  { label: "lease_commencement_date", data_type: "date", description: "Lease start date." },
  { label: "lease_expiration_date", data_type: "date", description: "Lease end date." },
  { label: "lease_term", data_type: "string", description: "Lease term.", required: true },
  { label: "monthly_rent", data_type: "number", description: "Monthly rent amount." },
  { label: "security_deposit", data_type: "number", description: "Security deposit." },
  { label: "renewal_options", data_type: "string", description: "Renewal option terms." },
  { label: "purchase_option", data_type: "boolean", description: "Does lease include purchase option?" },
  ...propertyFields,
  ...recordingFields,
];

// ============================================================================
// TRANSACTION SUMMARY (Admin/Cover Sheet)
// ============================================================================
const transactionSummaryFields = [
  // Order tracking
  ...orderTrackingFields,
  // Transaction details
  ...transactionFields,
  // Property
  ...propertyFields,
  // Parties
  ...buyerFields,
  ...sellerFields,
  // Lender
  ...lenderFields,
  // Agents
  ...realtorFields,
  // Attorneys
  ...attorneyFields,
  // Title search
  ...titleSearchFields,
  // Workflow
  ...workflowFields,
];

// ============================================================================
// COVER SHEET / ORDER FORM
// ============================================================================
const coverSheetFields = [
  { label: "document_title", data_type: "string", description: "Document title." },
  // Order info
  ...orderTrackingFields,
  // Transaction
  ...transactionFields,
  // Property
  ...propertyFields,
  // Buyer
  ...buyerFields,
  // Seller
  ...sellerFields,
  // Lender
  ...lenderFields,
  // Agents
  ...realtorFields,
  // Attorneys
  ...attorneyFields,
];

// ============================================================================
// OTHER
// ============================================================================
const otherRecordedDocsFields = [
  // Document identification
  { label: "document_title", data_type: "string", description: "Document title as it appears on document." },
  { label: "document_type", data_type: "string", description: "Best guess document type/category." },
  { label: "document_purpose", data_type: "string", description: "Primary purpose or intent of this document." },
  { label: "document_summary", data_type: "string", description: "2-3 sentence summary of document contents and significance." },
  
  // Parties (up to 4)
  { label: "party_1_name", data_type: "string", description: "First party name." },
  { label: "party_1_role", data_type: "string", description: "First party role (grantor, grantee, buyer, seller, borrower, lender, etc)." },
  { label: "party_2_name", data_type: "string", description: "Second party name." },
  { label: "party_2_role", data_type: "string", description: "Second party role." },
  { label: "party_3_name", data_type: "string", description: "Third party name (if any)." },
  { label: "party_3_role", data_type: "string", description: "Third party role." },
  { label: "party_4_name", data_type: "string", description: "Fourth party name (if any)." },
  { label: "party_4_role", data_type: "string", description: "Fourth party role." },
  
  // Key dates
  { label: "document_date", data_type: "date", description: "Date document was executed/signed." },
  { label: "effective_date", data_type: "date", description: "Effective date (if different from document date)." },
  { label: "expiration_date", data_type: "date", description: "Expiration date (if applicable)." },
  
  // Financial
  { label: "amount_1", data_type: "number", description: "Primary dollar amount mentioned." },
  { label: "amount_1_description", data_type: "string", description: "What amount_1 represents (loan amount, purchase price, lien amount, etc)." },
  { label: "amount_2", data_type: "number", description: "Secondary dollar amount (if any)." },
  { label: "amount_2_description", data_type: "string", description: "What amount_2 represents." },
  
  // References
  { label: "reference_document_number", data_type: "string", description: "Referenced document/instrument number." },
  { label: "reference_book_page", data_type: "string", description: "Referenced book/page." },
  { label: "case_number", data_type: "string", description: "Court case number (if any)." },
  { label: "loan_number", data_type: "string", description: "Loan number (if any)." },
  { label: "order_number", data_type: "string", description: "Order/file number (if any)." },
  
  // Key terms
  { label: "key_terms", data_type: "string", description: "Important terms, conditions, or provisions (comma-separated)." },
  { label: "restrictions", data_type: "string", description: "Any restrictions, covenants, or limitations mentioned." },
  { label: "exceptions", data_type: "string", description: "Any exceptions or carve-outs mentioned." },
  
  // Property
  ...propertyFields,
  
  // Recording
  ...recordingFields,
  
  // Notary (if applicable)
  ...notaryFields,
  
  // Flags
  { label: "requires_follow_up", data_type: "boolean", description: "True if document appears to require action or follow-up." },
  { label: "follow_up_reason", data_type: "string", description: "Reason for follow-up if flagged." },
  { label: "confidence_notes", data_type: "string", description: "Notes on extraction confidence or ambiguities." },
];

const noticesAgreementsFields = [
  // Document identification
  { label: "document_title", data_type: "string", description: "Document title." },
  { label: "notice_type", data_type: "string", description: "Notice type: default, intent_to_foreclose, completion, commencement, termination, demand, cure, acceleration, etc." },
  { label: "agreement_type", data_type: "string", description: "Agreement type: subordination, extension, modification, assumption, assignment, release, etc." },
  
  // Parties
  { label: "issuing_party_name", data_type: "string", description: "Party issuing the notice/agreement." },
  { label: "issuing_party_type", data_type: "string", description: "Issuing party type: lender, contractor, hoa, taxing_authority, attorney, etc." },
  { label: "receiving_party_name", data_type: "string", description: "Party receiving the notice." },
  { label: "property_owner_name", data_type: "string", description: "Current property owner name." },
  
  // Dates
  { label: "notice_date", data_type: "date", description: "Date notice was issued." },
  { label: "effective_date", data_type: "date", description: "Effective date of agreement." },
  { label: "deadline_date", data_type: "date", description: "Deadline or cure date." },
  { label: "expiration_date", data_type: "date", description: "Expiration date." },
  
  // Financial
  { label: "amount_due", data_type: "number", description: "Amount due or claimed." },
  { label: "per_diem_interest", data_type: "number", description: "Per diem interest amount." },
  { label: "late_fees", data_type: "number", description: "Late fees." },
  { label: "attorney_fees", data_type: "number", description: "Attorney fees." },
  { label: "total_amount", data_type: "number", description: "Total amount including fees." },
  
  // References
  { label: "reference_document", data_type: "string", description: "Referenced document (loan, lien, etc)." },
  { label: "reference_recording_info", data_type: "string", description: "Referenced document recording info." },
  { label: "loan_number", data_type: "string", description: "Loan number." },
  { label: "case_number", data_type: "string", description: "Court case number." },
  { label: "account_number", data_type: "string", description: "Account number." },
  
  // Content
  { label: "notice_summary", data_type: "string", description: "Summary of notice content and requirements." },
  { label: "action_required", data_type: "string", description: "Action required by recipient." },
  { label: "consequences", data_type: "string", description: "Consequences of non-compliance." },
  
  ...propertyFields,
  ...recordingFields,
];

// ============================================================================
// BUILD ALL SCHEMAS
// ============================================================================
export const schemas = {
  // Deeds
  recorded_transfer_deed: {
    id: "recorded_transfer_deed",
    name: "Recorded Transfer Deed",
    schema: buildSchema("RecordedTransferDeed", "Extract data from recorded transfer deeds", recordedTransferDeedFields),
  },
  
  // Mortgages
  deed_of_trust_mortgage: {
    id: "deed_of_trust_mortgage",
    name: "Deed of Trust / Mortgage",
    schema: buildSchema("DeedOfTrustMortgage", "Extract data from deeds of trust, mortgages, and promissory notes", deedOfTrustMortgageFields),
  },
  mortgage_child_docs: {
    id: "mortgage_child_docs",
    name: "Mortgage Modifications",
    schema: buildSchema("MortgageChildDocs", "Extract data from mortgage assignments, modifications, releases", mortgageChildDocsFields),
  },
  
  // Liens
  tax_lien: {
    id: "tax_lien",
    name: "Tax Lien",
    schema: buildSchema("TaxLien", "Extract data from federal and state tax liens", taxLienFields),
  },
  mechanics_lien: {
    id: "mechanics_lien",
    name: "Mechanic's Lien",
    schema: buildSchema("MechanicsLien", "Extract data from mechanic's and construction liens", mechanicsLienFields),
  },
  hoa_lien: {
    id: "hoa_lien",
    name: "HOA / Assessment Lien",
    schema: buildSchema("HOALien", "Extract data from HOA and assessment liens", hoaLienFields),
  },
  judgments: {
    id: "judgments",
    name: "Judgment Lien",
    schema: buildSchema("JudgmentLien", "Extract data from judgment liens", judgmentsFields),
  },
  ucc_filing: {
    id: "ucc_filing",
    name: "UCC Filing",
    schema: buildSchema("UCCFiling", "Extract data from UCC financing statements", uccFilingFields),
  },
  
  // Easements & Restrictions
  easement: {
    id: "easement",
    name: "Easement",
    schema: buildSchema("Easement", "Extract data from recorded easements", easementFields),
  },
  ccr_restrictions: {
    id: "ccr_restrictions",
    name: "CC&Rs / Restrictions",
    schema: buildSchema("CCRRestrictions", "Extract data from CC&Rs and deed restrictions", ccrRestrictionsFields),
  },
  
  // Court Documents
  lis_pendens: {
    id: "lis_pendens",
    name: "Lis Pendens",
    schema: buildSchema("LisPendens", "Extract data from lis pendens notices", lisPendensFields),
  },
  court_order: {
    id: "court_order",
    name: "Court Order",
    schema: buildSchema("CourtOrder", "Extract data from court orders and decrees", courtOrderFields),
  },
  probate_document: {
    id: "probate_document",
    name: "Probate Document",
    schema: buildSchema("ProbateDocument", "Extract data from probate documents", probateDocumentFields),
  },
  bankruptcy_document: {
    id: "bankruptcy_document",
    name: "Bankruptcy Document",
    schema: buildSchema("BankruptcyDocument", "Extract data from bankruptcy documents", bankruptcyDocumentFields),
  },
  
  // Foreclosure
  foreclosure_notice: {
    id: "foreclosure_notice",
    name: "Foreclosure Notice",
    schema: buildSchema("ForeclosureNotice", "Extract data from foreclosure notices", foreclosureNoticeFields),
  },
  
  // Tax
  tax_reports: {
    id: "tax_reports",
    name: "Tax Report / Statement",
    schema: buildSchema("TaxReport", "Extract data from property tax reports", taxReportsFields),
  },
  
  // Title
  prior_policy: {
    id: "prior_policy",
    name: "Title Policy / Commitment",
    schema: buildSchema("PriorPolicy", "Extract data from title policies and commitments", priorPolicyFields),
  },
  
  // Survey & Property
  survey_plat: {
    id: "survey_plat",
    name: "Survey / Plat",
    schema: buildSchema("SurveyPlat", "Extract data from surveys and plat maps", surveyPlatFields),
  },
  property_details: {
    id: "property_details",
    name: "Property Details",
    schema: buildSchema("PropertyDetails", "Extract property detail information", propertyDetailsFields),
  },
  
  // Authority Documents
  power_of_attorney: {
    id: "power_of_attorney",
    name: "Power of Attorney",
    schema: buildSchema("PowerOfAttorney", "Extract data from powers of attorney", powerOfAttorneyFields),
  },
  entity_authority: {
    id: "entity_authority",
    name: "Entity / Corporate Document",
    schema: buildSchema("EntityAuthority", "Extract data from corporate and entity documents", entityAuthorityFields),
  },
  trust_certification: {
    id: "trust_certification",
    name: "Trust Document",
    schema: buildSchema("TrustCertification", "Extract data from trust documents", trustCertificationFields),
  },
  
  // Affidavits
  affidavit: {
    id: "affidavit",
    name: "Affidavit",
    schema: buildSchema("Affidavit", "Extract data from affidavits", affidavitFields),
  },
  
  // Closing
  settlement_statement: {
    id: "settlement_statement",
    name: "Settlement Statement",
    schema: buildSchema("SettlementStatement", "Extract data from settlement statements", settlementStatementFields),
  },
  
  // Lease
  lease_document: {
    id: "lease_document",
    name: "Lease Document",
    schema: buildSchema("LeaseDocument", "Extract data from lease agreements", leaseDocumentFields),
  },
  
  // Other
  other_recorded: {
    id: "other_recorded",
    name: "Other Document",
    schema: buildSchema("OtherRecorded", "Extract data from other recorded documents", otherRecordedDocsFields),
  },
  notices_agreements: {
    id: "notices_agreements",
    name: "Notices & Agreements",
    schema: buildSchema("NoticesAgreements", "Extract data from notices and agreements", noticesAgreementsFields),
  },
  
  // Admin / Transaction
  transaction_summary: {
    id: "transaction_summary",
    name: "Transaction Summary",
    schema: buildSchema("TransactionSummary", "Extract comprehensive transaction and admin information", transactionSummaryFields),
  },
  cover_sheet: {
    id: "cover_sheet",
    name: "Cover Sheet / Order Form",
    schema: buildSchema("CoverSheet", "Extract data from title order cover sheets and order forms", coverSheetFields),
  },
};

export const schemaList = Object.values(schemas);

export const documentCategories = [
  { category: "Admin & Transaction", schemas: ["transaction_summary", "cover_sheet"] },
  { category: "Deeds & Transfers", schemas: ["recorded_transfer_deed"] },
  { category: "Mortgages & Loans", schemas: ["deed_of_trust_mortgage", "mortgage_child_docs"] },
  { category: "Liens", schemas: ["tax_lien", "mechanics_lien", "hoa_lien", "judgments", "ucc_filing"] },
  { category: "Easements & Restrictions", schemas: ["easement", "ccr_restrictions"] },
  { category: "Court Documents", schemas: ["lis_pendens", "court_order", "probate_document", "bankruptcy_document"] },
  { category: "Foreclosure", schemas: ["foreclosure_notice"] },
  { category: "Tax Documents", schemas: ["tax_reports"] },
  { category: "Title Documents", schemas: ["prior_policy"] },
  { category: "Surveys & Property", schemas: ["survey_plat", "property_details"] },
  { category: "Authority Documents", schemas: ["power_of_attorney", "entity_authority", "trust_certification"] },
  { category: "Affidavits", schemas: ["affidavit"] },
  { category: "Closing Documents", schemas: ["settlement_statement"] },
  { category: "Leases", schemas: ["lease_document"] },
  { category: "Other", schemas: ["other_recorded", "notices_agreements"] },
];

export default schemas;
