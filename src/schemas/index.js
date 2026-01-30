/**
 * Stewart Title Document Schemas
 * Generated from RecDocSchema_v3.xlsx
 */

// Helper function to convert field definitions to JSON Schema
function buildSchema(title, description, fields) {
  const properties = {};
  const required = [];

  fields.forEach(field => {
    let type = "string";
    if (field.data_type === "integer") type = "integer";
    else if (field.data_type === "boolean") type = "boolean";
    else if (field.data_type === "date") type = "string"; // dates as ISO strings
    else if (field.data_type === "array") type = "string"; // enum values

    properties[field.label] = {
      type,
      description: field.description || `${field.label.replace(/_/g, ' ')}.`
    };

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

// Document Type Definitions from RecDocSchema_v3.xlsx

const recordedTransferDeedFields = [
  { label: "property_street_address", data_type: "string", description: "Property street address.", required: false },
  { label: "property_state", data_type: "string", description: "State for property (2-letter code).", required: false },
  { label: "legal_description", data_type: "string", description: "Legal description.", required: false },
  { label: "parcel_identification_number", data_type: "string", description: "Number for parcel identification.", required: false },
  { label: "property_county", data_type: "string", description: "County for property.", required: false },
  { label: "grantor_name", data_type: "string", description: "Name of grantor.", required: false },
  { label: "grantor_entity_type", data_type: "string", description: "Grantor entity type.", required: false },
  { label: "grantee_name", data_type: "string", description: "Name of grantee.", required: false },
  { label: "grantee_entity_type", data_type: "string", description: "Grantee entity type.", required: false },
  { label: "deed_type", data_type: "string", description: "Deed type.", required: false },
  { label: "consideration_amount", data_type: "integer", description: "Amount for consideration.", required: false },
  { label: "recording_date", data_type: "date", description: "Date of recording (YYYY-MM-DD).", required: true },
  { label: "recording_book_number", data_type: "string", description: "Number for recording book.", required: false },
  { label: "recording_page_number", data_type: "string", description: "Number for recording page.", required: false },
  { label: "recording_instrument_number", data_type: "string", description: "Number for recording instrument.", required: false },
  { label: "transfer_tax_amount", data_type: "integer", description: "Amount for transfer tax.", required: false },
  { label: "grantor_signature_present", data_type: "boolean", description: "Grantor signature present.", required: false },
  { label: "notary_public_name", data_type: "string", description: "Name of notary public.", required: false },
  { label: "notary_commission_number", data_type: "integer", description: "Number for notary commission.", required: false },
  { label: "notary_commission_expiration_date", data_type: "date", description: "Date of notary commission expiration.", required: false },
  { label: "notary_acknowledgment_date", data_type: "date", description: "Date of notary acknowledgment.", required: false },
  { label: "notary_county", data_type: "string", description: "County for notary.", required: false },
  { label: "notary_state", data_type: "string", description: "State for notary.", required: false },
  { label: "document_title", data_type: "string", description: "Document title.", required: false },
  { label: "dated_date", data_type: "date", description: "Date of dated.", required: false },
  { label: "is_rerecorded", data_type: "boolean", description: "Whether is rerecorded.", required: false },
  { label: "title_company_name", data_type: "string", description: "Name of title company.", required: false }
];

const deedOfTrustMortgageFields = [
  { label: "property_street_address", data_type: "string", description: "Property street address.", required: false },
  { label: "property_city", data_type: "string", description: "City for property.", required: false },
  { label: "property_state", data_type: "string", description: "State for property (2-letter code).", required: false },
  { label: "legal_description", data_type: "string", description: "Legal description.", required: false },
  { label: "parcel_identification_number", data_type: "string", description: "Number for parcel identification.", required: false },
  { label: "property_county", data_type: "string", description: "County for property.", required: false },
  { label: "trustor_or_borrower_name", data_type: "string", description: "Name of trustor or borrower.", required: false },
  { label: "trustor_or_borrower_entity_type", data_type: "string", description: "Trustor or borrower entity type.", required: false },
  { label: "lender_name", data_type: "string", description: "Name of lender.", required: false },
  { label: "lender_entity_type", data_type: "string", description: "Lender entity type.", required: false },
  { label: "beneficiary_name", data_type: "string", description: "Name of beneficiary.", required: false },
  { label: "trustee_name", data_type: "string", description: "Name of trustee.", required: false },
  { label: "trustee_entity_type", data_type: "string", description: "Trustee entity type.", required: false },
  { label: "loan_amount", data_type: "integer", description: "Amount for loan.", required: false },
  { label: "loan_date", data_type: "date", description: "Date of loan.", required: false },
  { label: "maturity_date", data_type: "date", description: "Date of maturity.", required: false },
  { label: "execution_date", data_type: "date", description: "Date of execution.", required: false },
  { label: "recording_date", data_type: "date", description: "Date of recording (YYYY-MM-DD).", required: true },
  { label: "recording_book_number", data_type: "string", description: "Number for recording book.", required: false },
  { label: "recording_page_number", data_type: "string", description: "Number for recording page.", required: false },
  { label: "recording_instrument_number", data_type: "string", description: "Number for recording instrument.", required: false },
  { label: "promissory_note_date", data_type: "date", description: "Date of promissory note.", required: false },
  { label: "promissory_note_amount", data_type: "integer", description: "Amount for promissory note.", required: false },
  { label: "loan_purpose", data_type: "string", description: "Loan purpose.", required: false },
  { label: "has_assignment_of_rents", data_type: "boolean", description: "Whether has assignment of rents.", required: false },
  { label: "trustor_signature_present", data_type: "boolean", description: "Trustor signature present.", required: false },
  { label: "notary_public_name", data_type: "string", description: "Name of notary public.", required: false },
  { label: "notary_commission_number", data_type: "integer", description: "Number for notary commission.", required: false },
  { label: "notary_commission_expiration_date", data_type: "date", description: "Date of notary commission expiration.", required: false },
  { label: "notary_acknowledgment_date", data_type: "date", description: "Date of notary acknowledgment.", required: false },
  { label: "notary_county", data_type: "string", description: "County for notary.", required: false },
  { label: "notary_state", data_type: "string", description: "State for notary.", required: false },
  { label: "title_company_name", data_type: "string", description: "Name of title company.", required: false },
  { label: "loan_number", data_type: "integer", description: "Number for loan.", required: false },
  { label: "dated_date", data_type: "date", description: "Date of dated.", required: false },
  { label: "is_mortgage_electronic_registration_systems", data_type: "boolean", description: "Whether is MERS.", required: false },
  { label: "is_rerecorded", data_type: "boolean", description: "Whether is rerecorded.", required: false },
  { label: "loan_type", data_type: "string", description: "Loan type (construction, home_equity, revolving_line_of_credit, promissory_note, reverse_mortgage, bond).", required: false },
  { label: "document_title", data_type: "string", description: "Document title.", required: false }
];

const mortgageChildDocsFields = [
  { label: "legal_description", data_type: "string", description: "Legal description.", required: false },
  { label: "parcel_identification_number", data_type: "string", description: "Number for parcel identification.", required: false },
  { label: "property_county", data_type: "string", description: "County for property.", required: false },
  { label: "assignor", data_type: "string", description: "Assignor.", required: false },
  { label: "assignee", data_type: "string", description: "Assignee.", required: false },
  { label: "subordinated_to", data_type: "string", description: "Subordinated to.", required: false },
  { label: "is_rerecorded", data_type: "boolean", description: "Whether is rerecorded.", required: false },
  { label: "substituted_trustee", data_type: "string", description: "Substituted trustee.", required: false },
  { label: "loan_amount", data_type: "integer", description: "Amount for loan.", required: false },
  { label: "recording_date", data_type: "date", description: "Date of recording (YYYY-MM-DD).", required: true },
  { label: "recording_book_number", data_type: "string", description: "Number for recording book.", required: false },
  { label: "recording_page_number", data_type: "string", description: "Number for recording page.", required: false },
  { label: "recording_instrument_number", data_type: "string", description: "Number for recording instrument.", required: false },
  { label: "notary_public_name", data_type: "string", description: "Name of notary public.", required: false },
  { label: "notary_commission_number", data_type: "integer", description: "Number for notary commission.", required: false },
  { label: "notary_commission_expiration_date", data_type: "date", description: "Date of notary commission expiration.", required: false },
  { label: "notary_acknowledgment_date", data_type: "date", description: "Date of notary acknowledgment.", required: false },
  { label: "notary_county", data_type: "string", description: "County for notary.", required: false },
  { label: "notary_state", data_type: "string", description: "State for notary.", required: false },
  { label: "title_company_name", data_type: "string", description: "Name of title company.", required: false },
  { label: "dated_date", data_type: "date", description: "Date of dated.", required: false },
  { label: "document_title", data_type: "string", description: "Document title.", required: false }
];

const taxLienFields = [
  { label: "issuing_authority", data_type: "string", description: "Issuing authority.", required: false },
  { label: "lien_filing_date", data_type: "date", description: "Date of lien filing.", required: false },
  { label: "lien_number", data_type: "string", description: "Number for lien.", required: false },
  { label: "notice_number", data_type: "string", description: "Number for notice.", required: false },
  { label: "serial_number", data_type: "string", description: "Number for serial.", required: false },
  { label: "certificate_number", data_type: "string", description: "Number for certificate.", required: false },
  { label: "assessment_number", data_type: "string", description: "Number for assessment.", required: false },
  { label: "taxpayer_name", data_type: "string", description: "Name of taxpayer.", required: false },
  { label: "tax_period_start_date", data_type: "date", description: "Date of tax period start.", required: false },
  { label: "tax_period_end_date", data_type: "date", description: "Date of tax period end.", required: false },
  { label: "tax_year", data_type: "string", description: "Tax year.", required: false },
  { label: "assessment_date", data_type: "date", description: "Date of assessment.", required: false },
  { label: "total_amount_owed", data_type: "integer", description: "Total amount owed.", required: false },
  { label: "principal_tax_amount", data_type: "integer", description: "Amount for principal tax.", required: false },
  { label: "unpaid_balance", data_type: "integer", description: "Unpaid balance.", required: false },
  { label: "property_address", data_type: "string", description: "Property address.", required: false },
  { label: "property_city", data_type: "string", description: "City for property.", required: false },
  { label: "property_state", data_type: "string", description: "State for property.", required: false },
  { label: "property_zip_code", data_type: "string", description: "ZIP code for property.", required: false },
  { label: "property_legal_description", data_type: "string", description: "Property legal description.", required: false },
  { label: "property_parcel_number", data_type: "string", description: "Number for property parcel.", required: false },
  { label: "property_county", data_type: "string", description: "County for property.", required: false },
  { label: "notice_of_assessment_date", data_type: "date", description: "Date of notice of assessment.", required: false },
  { label: "tax_type", data_type: "string", description: "Tax type (state_tax_lien, county_tax_lien, municipal_tax_lien, income_tax_lien, etc.).", required: false },
  { label: "recording_date", data_type: "date", description: "Date of recording (YYYY-MM-DD).", required: true },
  { label: "recording_book_number", data_type: "string", description: "Number for recording book.", required: false },
  { label: "recording_page_number", data_type: "string", description: "Number for recording page.", required: false },
  { label: "recording_instrument_number", data_type: "string", description: "Number for recording instrument.", required: false },
  { label: "document_title", data_type: "string", description: "Document title.", required: false }
];

const easementFields = [
  { label: "easement_type", data_type: "string", description: "Easement type.", required: false },
  { label: "easement_purpose", data_type: "string", description: "Easement purpose.", required: false },
  { label: "property_county", data_type: "string", description: "County for property.", required: false },
  { label: "grantor_name", data_type: "string", description: "Name of grantor.", required: false },
  { label: "grantee_name", data_type: "string", description: "Name of grantee.", required: false },
  { label: "has_right_of_entry", data_type: "boolean", description: "Whether has right of entry.", required: false },
  { label: "recording_date", data_type: "date", description: "Date of recording (YYYY-MM-DD).", required: true },
  { label: "recording_county", data_type: "string", description: "County for recording.", required: true },
  { label: "recording_book_number", data_type: "string", description: "Number for recording book.", required: false },
  { label: "recording_page_number", data_type: "string", description: "Number for recording page.", required: false },
  { label: "recording_instrument_number", data_type: "string", description: "Number for recording instrument.", required: false },
  { label: "document_title", data_type: "string", description: "Document title.", required: false }
];

const judgmentsFields = [
  { label: "judgment_type", data_type: "string", description: "Judgment type.", required: false },
  { label: "court_name", data_type: "string", description: "Name of court.", required: false },
  { label: "court_type", data_type: "string", description: "Court type.", required: false },
  { label: "court_county", data_type: "string", description: "County for court.", required: false },
  { label: "court_state", data_type: "string", description: "State for court.", required: false },
  { label: "court_district", data_type: "string", description: "Court district.", required: false },
  { label: "court_division", data_type: "string", description: "Court division.", required: false },
  { label: "federal_district", data_type: "string", description: "Federal district.", required: false },
  { label: "case_number", data_type: "string", description: "Number for case.", required: false },
  { label: "docket_number", data_type: "string", description: "Number for docket.", required: false },
  { label: "filing_date", data_type: "date", description: "Date of filing.", required: false },
  { label: "plaintiff_name", data_type: "string", description: "Name of plaintiff.", required: false },
  { label: "defendant_name", data_type: "string", description: "Name of defendant.", required: false },
  { label: "petitioner_name", data_type: "string", description: "Name of petitioner.", required: false },
  { label: "respondent_name", data_type: "string", description: "Name of respondent.", required: false },
  { label: "judgment_amount", data_type: "string", description: "Amount for judgment.", required: false },
  { label: "principal_amount", data_type: "string", description: "Amount for principal.", required: false },
  { label: "judgment_creditor_name", data_type: "string", description: "Name of judgment creditor.", required: false },
  { label: "judgment_debtor_name", data_type: "string", description: "Name of judgment debtor.", required: false },
  { label: "document_title", data_type: "string", description: "Document title.", required: false },
  { label: "recording_date", data_type: "date", description: "Date of recording (YYYY-MM-DD).", required: true },
  { label: "recording_county", data_type: "string", description: "County for recording.", required: true },
  { label: "recording_book_number", data_type: "string", description: "Number for recording book.", required: false },
  { label: "recording_page_number", data_type: "string", description: "Number for recording page.", required: false },
  { label: "recording_instrument_number", data_type: "string", description: "Number for recording instrument.", required: false }
];

const noticesAgreementsFields = [
  { label: "notice_type", data_type: "string", description: "Notice type (is_default_notice, is_foreclosure_notice, is_notice_of_sale, etc.).", required: false },
  { label: "document_title", data_type: "string", description: "Document title.", required: false },
  { label: "issuing_party_name", data_type: "string", description: "Name of issuing party.", required: false },
  { label: "receiving_party_name", data_type: "string", description: "Name of receiving party.", required: false },
  { label: "notice_date", data_type: "date", description: "Date of notice.", required: false },
  { label: "property_address", data_type: "string", description: "Property address.", required: false },
  { label: "property_city", data_type: "string", description: "City for property.", required: false },
  { label: "property_state", data_type: "string", description: "State for property.", required: false },
  { label: "property_zip_code", data_type: "string", description: "ZIP code for property.", required: false },
  { label: "property_legal_description", data_type: "string", description: "Property legal description.", required: false },
  { label: "property_parcel_number", data_type: "string", description: "Number for property parcel.", required: false },
  { label: "property_county", data_type: "string", description: "County for property.", required: false },
  { label: "amount_due", data_type: "string", description: "Amount due.", required: false },
  { label: "principal_amount", data_type: "string", description: "Amount for principal.", required: false },
  { label: "account_number", data_type: "string", description: "Number for account.", required: false },
  { label: "loan_number", data_type: "string", description: "Number for loan.", required: false },
  { label: "case_number", data_type: "string", description: "Number for case.", required: false },
  { label: "citation_number", data_type: "string", description: "Number for citation.", required: false },
  { label: "assessment_amount", data_type: "string", description: "Amount for assessment.", required: false },
  { label: "tax_year", data_type: "string", description: "Tax year.", required: false },
  { label: "recording_date", data_type: "date", description: "Date of recording (YYYY-MM-DD).", required: true },
  { label: "recording_county", data_type: "string", description: "County for recording.", required: true },
  { label: "recording_book_number", data_type: "string", description: "Number for recording book.", required: false },
  { label: "recording_page_number", data_type: "string", description: "Number for recording page.", required: false },
  { label: "recording_instrument_number", data_type: "string", description: "Number for recording instrument.", required: false }
];

const otherRecordedDocsFields = [
  { label: "recording_date", data_type: "date", description: "Date of recording (YYYY-MM-DD).", required: true },
  { label: "recording_county", data_type: "string", description: "County for recording.", required: true },
  { label: "recording_book_number", data_type: "string", description: "Number for recording book.", required: false },
  { label: "recording_page_number", data_type: "string", description: "Number for recording page.", required: false },
  { label: "recording_instrument_number", data_type: "string", description: "Number for recording instrument.", required: false },
  { label: "document_title", data_type: "string", description: "Document title.", required: false },
  { label: "property_legal_description", data_type: "string", description: "Property legal description.", required: false },
  { label: "property_parcel_number", data_type: "string", description: "Number for property parcel.", required: false },
  { label: "property_county", data_type: "string", description: "County for property.", required: false },
  { label: "party_1_name", data_type: "string", description: "Name of party 1.", required: false },
  { label: "party_2_name", data_type: "string", description: "Name of party 2.", required: false }
];

const taxReportsFields = [
  { label: "tax_type", data_type: "string", description: "Tax type (annual_general, supplemental, corrected, default).", required: false },
  { label: "tax_year", data_type: "string", description: "Tax year.", required: false },
  { label: "parcel_identification_number", data_type: "string", description: "Number for parcel identification.", required: false },
  { label: "supplemental_parcel_identification_number", data_type: "string", description: "Number for supplemental parcel.", required: false },
  { label: "due_date", data_type: "date", description: "Date of due.", required: false },
  { label: "first_installment_due_date", data_type: "date", description: "Date of first installment due.", required: false },
  { label: "first_installment_amount_due", data_type: "integer", description: "First installment amount due.", required: false },
  { label: "first_installment_penalty_amount", data_type: "integer", description: "Amount for first installment penalty.", required: false },
  { label: "first_installment_status", data_type: "string", description: "First installment status.", required: false },
  { label: "second_installment_due_date", data_type: "date", description: "Date of second installment due.", required: false },
  { label: "second_installment_amount_due", data_type: "integer", description: "Second installment amount due.", required: false },
  { label: "second_installment_penalty_amount", data_type: "integer", description: "Amount for second installment penalty.", required: false },
  { label: "second_installment_status", data_type: "string", description: "Second installment status.", required: false },
  { label: "property_owner_name", data_type: "string", description: "Name of property owner.", required: false },
  { label: "mailing_address", data_type: "string", description: "Mailing address.", required: false },
  { label: "mailing_city", data_type: "string", description: "City for mailing.", required: false },
  { label: "mailing_state", data_type: "string", description: "State for mailing.", required: false },
  { label: "mailing_zip_code", data_type: "string", description: "ZIP code for mailing.", required: false },
  { label: "property_address", data_type: "string", description: "Property address.", required: false },
  { label: "property_city", data_type: "string", description: "City for property.", required: false },
  { label: "property_state", data_type: "string", description: "State for property.", required: false },
  { label: "property_zip_code", data_type: "string", description: "ZIP code for property.", required: false },
  { label: "property_legal_description", data_type: "string", description: "Property legal description.", required: false },
  { label: "property_county", data_type: "string", description: "County for property.", required: false },
  { label: "land_use_description", data_type: "string", description: "Land use description.", required: false },
  { label: "total_assessed_value", data_type: "integer", description: "Total assessed value.", required: false },
  { label: "land_assessed_value", data_type: "integer", description: "Land assessed value.", required: false },
  { label: "improvement_assessed_value", data_type: "integer", description: "Improvement assessed value.", required: false },
  { label: "special_assessment_district_name", data_type: "string", description: "Name of special assessment district.", required: false },
  { label: "special_assessment_district_amount", data_type: "integer", description: "Amount for special assessment district.", required: false },
  { label: "defaulted_redemption_amount", data_type: "integer", description: "Amount for defaulted redemption.", required: false },
  { label: "defaulted_redemption_date", data_type: "date", description: "Date of defaulted redemption.", required: false }
];

const propertyDetailsFields = [
  { label: "vesting_value", data_type: "string", description: "Vesting value.", required: false },
  { label: "complete_legal_description", data_type: "string", description: "Complete legal description.", required: false },
  { label: "plant_effective_date", data_type: "date", description: "Date of plant effective.", required: false }
];

const priorPolicyFields = [
  { label: "policy_number", data_type: "string", description: "Number for policy.", required: false },
  { label: "exception_number", data_type: "string", description: "Number for exception.", required: false },
  { label: "exception_text", data_type: "string", description: "Exception text.", required: false },
  { label: "requirement_number", data_type: "string", description: "Number for requirement.", required: false },
  { label: "requirement_text", data_type: "string", description: "Requirement text.", required: false }
];

// Build schemas
export const schemas = {
  recorded_transfer_deed: {
    id: "recorded_transfer_deed",
    name: "Recorded Transfer Deed Documents",
    description: "Extract data from recorded transfer deed documents (warranty deeds, quitclaim deeds, grant deeds)",
    schema: buildSchema("RecordedTransferDeed", "Extract data from recorded transfer deed documents", recordedTransferDeedFields),
  },
  deed_of_trust_mortgage: {
    id: "deed_of_trust_mortgage",
    name: "Deed of Trust / Mortgage / Promissory Note",
    description: "Extract data from deed of trust, mortgage, promissory note, and bond documents",
    schema: buildSchema("DeedOfTrustMortgage", "Extract data from deed of trust, mortgage, promissory note documents", deedOfTrustMortgageFields),
  },
  mortgage_child_docs: {
    id: "mortgage_child_docs",
    name: "Mortgage Child Documents (Assignment, Modification, Subordination)",
    description: "Extract data from assignments, modifications, subordinations of deeds of trust/mortgages",
    schema: buildSchema("MortgageChildDocs", "Extract data from mortgage child documents", mortgageChildDocsFields),
  },
  tax_lien: {
    id: "tax_lien",
    name: "State, Federal & General Tax Liens",
    description: "Extract data from state, federal, and general tax lien documents",
    schema: buildSchema("TaxLien", "Extract data from tax lien documents", taxLienFields),
  },
  easement: {
    id: "easement",
    name: "Recorded Easement Documents",
    description: "Extract data from recorded easement documents",
    schema: buildSchema("Easement", "Extract data from easement documents", easementFields),
  },
  judgments: {
    id: "judgments",
    name: "Judgments, Federal Judgments & Orders",
    description: "Extract data from recorded judgments, federal judgments, and court orders",
    schema: buildSchema("Judgments", "Extract data from judgment and order documents", judgmentsFields),
  },
  notices_agreements: {
    id: "notices_agreements",
    name: "Notices & Agreements",
    description: "Extract data from recorded notices and agreements (default notices, foreclosure notices, etc.)",
    schema: buildSchema("NoticesAgreements", "Extract data from notice and agreement documents", noticesAgreementsFields),
  },
  other_recorded: {
    id: "other_recorded",
    name: "All Other Recorded Documents",
    description: "Extract data from other recorded documents not in specific categories",
    schema: buildSchema("OtherRecorded", "Extract data from other recorded documents", otherRecordedDocsFields),
  },
  tax_reports: {
    id: "tax_reports",
    name: "Tax Reports",
    description: "Extract data from property tax reports and tax statements",
    schema: buildSchema("TaxReports", "Extract data from tax report documents", taxReportsFields),
  },
  property_details: {
    id: "property_details",
    name: "Property Details",
    description: "Extract property details including vesting and legal description",
    schema: buildSchema("PropertyDetails", "Extract property detail information", propertyDetailsFields),
  },
  prior_policy: {
    id: "prior_policy",
    name: "Prior Policy / Preliminary Report / Commitment",
    description: "Extract data from prior policies, starters, preliminary reports, or commitments",
    schema: buildSchema("PriorPolicy", "Extract data from prior policy and commitment documents", priorPolicyFields),
  },
};

export const schemaList = Object.values(schemas);

// Document type categories for the dropdown
export const documentCategories = [
  { category: "Deeds & Transfers", schemas: ["recorded_transfer_deed"] },
  { category: "Mortgages & Loans", schemas: ["deed_of_trust_mortgage", "mortgage_child_docs"] },
  { category: "Liens & Encumbrances", schemas: ["tax_lien", "easement", "judgments"] },
  { category: "Notices & Other", schemas: ["notices_agreements", "other_recorded"] },
  { category: "Tax & Property", schemas: ["tax_reports", "property_details"] },
  { category: "Title Documents", schemas: ["prior_policy"] },
];

export default schemas;
