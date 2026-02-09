# Title Production System Import/Export Formats & Industry Standards

## Comprehensive Research Report

> **Date:** February 7, 2026
> **Purpose:** Catalog data formats, import specifications, schemas, and API references for major title production systems and industry data standards.

---

## Table of Contents

1. [Industry Standards Overview](#1-industry-standards-overview)
2. [SoftPro (Standard/Select)](#2-softpro-standardselect)
3. [RamQuest (Old Republic)](#3-ramquest-old-republic)
4. [Qualia](#4-qualia)
5. [AIM+ (Old Republic Title)](#5-aim-old-republic-title)
6. [ResWare (Adeptive/Fidelity → now Qualia)](#6-resware-adeptivefidelity)
7. [TitleExpress (SMS/First American)](#7-titleexpress-smsfirst-american)
8. [ClosingCorp / Closing Market](#8-closingcorp--closing-market)
9. [MISMO XML Standard](#9-mismo-xml-standard)
10. [ALTA Settlement Statement Format](#10-alta-settlement-statement-format)
11. [HUD-1 Data Format](#11-hud-1-data-format)
12. [Closing Disclosure (CD) / TRID Format](#12-closing-disclosure-cd--trid-format)
13. [Common Data Fields Across Systems](#13-common-data-fields-across-systems)
14. [Format Comparison Matrix](#14-format-comparison-matrix)

---

## 1. Industry Standards Overview

The title insurance and settlement industry relies on several key standards for data exchange:

| Standard | Organization | Format | Primary Use |
|----------|-------------|--------|-------------|
| **MISMO** | MBA (Mortgage Bankers Association) | XML (v3.x) | Universal mortgage/title data exchange |
| **UCD** | Fannie Mae / Freddie Mac | MISMO v3.3.0299 XML | Closing Disclosure data to GSEs |
| **ULDD** | Fannie Mae / Freddie Mac | MISMO v3.0 XML | Loan delivery data |
| **ALTA Forms** | ALTA | XLS, DOC, PDF | Settlement statements |
| **TRID/CD** | CFPB | PDF (regulatory), XML (UCD) | Closing Disclosure compliance |
| **HUD-1** | HUD/CFPB | PDF (legacy), flat file | Settlement statement (pre-TRID) |

---

## 2. SoftPro (Standard/Select)

### Overview
SoftPro is the most widely used title production software in the US, offering Standard (basic) and Select (full-featured) tiers.

### Import/Export Formats

| Format | Direction | Details |
|--------|-----------|---------|
| **Proprietary XML** | Import/Export | SoftPro uses its own XML schema for order data exchange |
| **MISMO XML** | Export | Supports MISMO-compliant exports for lender/GSE integration |
| **CSV** | Import/Export | Bulk data import for contacts, rates, properties |
| **PDF** | Export | HUD-1, Closing Disclosure, ALTA Settlement Statements |
| **XLSX** | Export | Reporting and data analysis |

### API & Integration
- **SoftPro 360 Integrations**: Platform for connecting to third-party services
- **SoftPro Sync**: Real-time bidirectional data sync with external systems
- **REST API**: Available at `docs-api.softprocorp.com` (requires authentication)
  - Order CRUD operations
  - Document management
  - Contact/party management
- **Integration Partners**: Snapdocs, CloseSimple, ClosingCorp, GreenFolders
- **LOS Integration**: Receives order data from Loan Origination Systems via XML

### Key Data Fields (Order Import)
```
Order Number, File Number, Transaction Type (Purchase/Refi/Equity)
Property: Address, City, State, ZIP, County, Legal Description, APN
Buyer/Borrower: Name, Address, Phone, Email, SSN (last 4)
Seller: Name, Address, Phone, Email
Lender: Name, Address, Loan Officer, Loan Number, Loan Amount
Title Company: Agent Name, Office
Settlement Date, Closing Date, Disbursement Date
Purchase Price, Earnest Money, Down Payment
```

### Documentation Access
- Developer portal: `https://docs-api.softprocorp.com/`
- Support: 800-848-0143
- mySoftPro portal: `https://my.softprocorp.com`
- Documents portal: `https://info.softprocorp.com/softpro-documents-portal-select`

---

## 3. RamQuest (Old Republic)

### Overview
RamQuest is a complete closing solution now owned by Old Republic. Powers both title agencies and underwriters.

### Import/Export Formats

| Format | Direction | Details |
|--------|-----------|---------|
| **Closing Market XML** | Import/Export | Proprietary XML via Closing Market gateway |
| **MISMO XML** | Export | Industry-standard export for lender communication |
| **CSV/Flat File** | Export | Reporting and data extraction |
| **PDF** | Export | Settlement statements, commitments, policies |

### Integration Platform: Closing Market
- **Order Gateway**: Real-time order transmission between lenders and title companies
- **SDK Available**: Developers can build, test, and deploy custom integrations
- **LOS Plug-ins**: Direct integration with loan origination systems (e.g., Calyx Point)
- **Supported Workflows**:
  - Order placement (lender → title)
  - Status updates (title → lender)
  - Document upload/download
  - Fee sheet exchange

### Title Data Integration
- Automated upload of commitments and policies
- Automatic routing of orders with party information
- Runsheet delivery back to document repository
- Integration with Snapdocs for e-signing workflows

### Documentation Access
- Closing Market SDK: Contact `ClosingMarket@Ramquest.com`
- Technical support through RamQuest directly
- Partner portal: `https://www.closingmarket.com/partners/`

---

## 4. Qualia

### Overview
Modern cloud-native title/escrow platform. Now also owns ResWare (Adeptive). Growing rapidly among independent title agencies.

### API Format

| Format | Direction | Details |
|--------|-----------|---------|
| **GraphQL API** | Bidirectional | Primary programmatic interface |
| **JSON** | Import/Export | Native API payload format |
| **MISMO XML** | Export | Industry-standard compliance |
| **CSV** | Export | Bulk data exports, reporting |
| **PDF** | Export | Closing documents, settlement statements |

### GraphQL API Details
- **Endpoint**: Authenticated GraphQL API
- **Documentation**: `https://learn.qualia.com/api-u`
- **Authentication**: OAuth 2.0 / API keys
- **Capabilities**:
  - Query order-level data from Core and Connect products
  - Build custom reporting dashboards
  - Integrate with accounting, CRM, BI platforms
  - Aggregate data from multiple title production systems
  - Secure bidirectional data exchange

### Qualia Connect (Lender Integration)
- Standardized order placement from lenders
- Real-time status updates
- Document exchange
- Fee/cost sharing
- Supports integration with most major LOS platforms

### Key API Data Objects (Inferred from capabilities)
```
Orders: order_id, status, transaction_type, dates
Parties: buyers, sellers, lenders, agents, attorneys
Property: address, legal_description, parcel_id
Financial: purchase_price, loan_amount, fees, premiums
Documents: commitments, policies, disclosures
Workflow: tasks, milestones, status_updates
```

### Documentation Access
- API portal: `https://learn.qualia.com/api-u`
- Contact sales team for API access and documentation
- GraphQL schema introspection available after authentication

---

## 5. AIM+ (Old Republic Title)

### Overview
AIM+ is Old Republic Title's proprietary title production system used primarily by their agents. Successor to AIM for Windows (AFW).

### Import/Export Formats

| Format | Direction | Details |
|--------|-----------|---------|
| **AFW Files** | Import | Legacy AIM for Windows file import |
| **ASCII Flat File** | Export | Fixed-length or delimited (comma, tab, pipe) |
| **Excel (.xls)** | Export | Spreadsheet export format |
| **XML** | Export | Date format: MMDDCCYY |
| **PDF** | Export | Documents and reports |

### Import Specifications

**AFW File Import Fields:**
```
Order Type
Transaction Type
Associated File Number
Property Location
Underwriter
Agent
Multi-line element data (optional)
```

### Export File Specifications

**File Naming Convention**: Files prefixed with "C" (e.g., CXXX) to indicate AIM origin.

**Date Formats by Export Type:**
| Export Format | Date Format |
|---------------|-------------|
| Delimited / Fixed-length | CCYYMMDD |
| Excel / XML | MMDDCCYY |
| NULL dates | 19000101 |

**Monetary Fields**: Decimal point before last two digits.

**Record Types**: Various export layouts identified by fixed record type codes:
- CAAU = Auto Auction Record
- Other specialized record codes per data category

### StewartOrders Integration
- Title search data import from Stewart's portal
- "Load AIM+ Data" link on StewartOrders portal
- Results delivered back into AIM+ automatically

### Documentation
- Help documentation: `https://www.ordersgateway.com/Help/AIM.pdf`
- AFW Import guide: `https://www.virtualunderwriter.com/content/dam/PI/Products/AIM/AFWFileSearch_OrderImport.pdf`

---

## 6. ResWare (Adeptive/Fidelity → now Qualia)

### Overview
Enterprise-grade title production platform, now owned by Qualia (previously Adeptive Software, backed by Fidelity). Widely used by large title agencies and underwriters.

### Import/Export Formats

| Format | Direction | Details |
|--------|-----------|---------|
| **XML** | Import/Export | Order data, notes, documents via web services |
| **Calyx Point (.EXP)** | Import | LOS export file format for order population |
| **MISMO XML** | Export | Industry-standard output |
| **CSV** | Export | Reporting |
| **PDF** | Export | All closing documents |

### API & Web Services
- **SOAP/XML Web Services**: Primary integration method
  - Order placement (Web Services: Order Placement role)
  - ResWare-to-ResWare order submission
  - A.S.K. Search Integration (XML transmission of notes/documents)
- **REST API** (via Qualia platform): Newer integration path
  - Secure bidirectional data exchange
  - Custom app/portal development
- **ActionList Workflow Engine**: Automated task execution triggered by data events

### Integration Partners
- **TitleM**: Real-time access to ResWare production data for BI
- **WFG National Title**: Closing Protection Letter generation
- **FNTG agentTRAX**: Auto-loading policy jackets and numbers
- **Snapdocs**: E-signing and closing workflow
- **CloseSimple**: Client communication automation
- **Stewart A.S.K.**: Title search services

### LOS File Import (Calyx Point Example)
ResWare accepts `.EXP` export files from Calyx Point containing:
```
Borrower information
Co-borrower information
Property address
Loan details (amount, type, term)
Lender information
Transaction type
Settlement date
```
Export templates are downloadable from ResWare for LOS configuration.

### Documentation
- Stewart/ResWare A.S.K. integration guide: `https://www.stewart.com/content/dam/stewart/education-and-training/PDFs/resware-a.s.k-search-integration-user-guide.pdf`
- Contact: `support@resware.qualia.com`

---

## 7. TitleExpress (SMS/First American)

### Overview
TitleExpress by SMS (Settlement Management Solutions), a division of First American, is widely used among First American agents.

### Import/Export Formats

| Format | Direction | Details |
|--------|-----------|---------|
| **XML** | Import | AgentNet integration for search/commitment data |
| **MISMO XML** | Export | Industry-standard output |
| **CSV** | Export | Data extraction and reporting |
| **PDF** | Export | All closing documents |
| **XLSX** | Export | Reporting |

### Key Integrations
- **AgentNet Integration**: 
  - Seamless data sharing between TitleExpress and AgentNet
  - Order search services and commitments
  - Auto-load support documents into Documents Manager
  - Import fees (base premiums and TRID disclosed premiums)
- **RealExpress Integration Platform**:
  - Order products/services from multiple providers without leaving TitleExpress
  - ClosingCorp, Doma Title Insurance, GreenFolders, and others
- **First American Title**: Deep native integration

### Features
- Customizable forms and closing documents
- Escrow accounting with reconciliation
- 1099-S reporting
- Customizable workflow for title policies and recordings
- Available as desktop or cloud/hosted

### Documentation
- Product info: `https://www.smscorp.com/titleexpress/`
- AgentNet integration: `https://info.smscorp.com/te-agentnet`
- Support: `https://www.iwanttss.com/`

---

## 8. ClosingCorp / Closing Market

### ClosingCorp (SmartFees)

#### Overview
ClosingCorp provides real-time closing cost data and fee calculations. Their SmartFees product delivers actual rates/fees (not estimates) from 20,000+ service providers and 70,000+ rate cards.

#### API: SmartFees REST API v2

**Base URL**: `{{baseurl}}/rest/closingestimates/v2/`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/gettaxquestions` | POST | Get required questions for recording fees/transfer taxes |
| `/quickgfe` | POST | Create LoanEstimate file with calculated fees (PreQual) |
| `/getserviceproviders` | POST | Get available service providers by type |
| `/selectprovider` | POST | Select a service provider |
| `/getgfedata` | POST | Retrieve updated loan data and fees |
| `/updategfe` | POST | Update transaction details, revalidate fees |
| `/addverticalstogfe` | POST | Add additional services to existing file |
| `/getpropertytax` | POST | Retrieve property tax data (requires CoreLogic contract) |

**Request Format**: JSON with `serviceOrder` container
```json
{
  "serviceOrder": {
    "quoteType": "PreQual"
  }
}
```

**Upgrade PreQual to FullQuote**:
```json
{
  "criteriaList": [
    {
      "name": "QuoteType",
      "value": "FullQuote"
    }
  ]
}
```

**Key Data Fields in Requests/Responses**:
```
Loan Information: loan amount, loan type, purpose
Property: address, state, county, type
Transfer Tax / Recording Fee questions and answers
Service Providers: name, rates, fees
Fees: title insurance, settlement, endorsements, recording, transfer tax
Property Tax: assessor info, payee, tax lines, amounts, dates
```

### TitleClose API

**Type**: Vendor REST API
**Portal**: `https://apiportal.titleclose.com/`
- Provides accurate fee/service information from TitleClose vendors
- TRID-compliant closing fee calculations
- Real-time cost calculations for title and closing services
- Registration required for API access

### Closing Market (RamQuest)

- Order gateway platform powered by RamQuest
- Real-time order processing between lenders and title companies
- SDK available for custom integrations
- Integrates with most LOS platforms
- Contact: `ClosingMarket@Ramquest.com`

---

## 9. MISMO XML Standard

### Overview
MISMO (Mortgage Industry Standards Maintenance Organization) is the **primary industry standard** for structured data exchange in the mortgage and title industry.

### Current Version: 3.6.2
- Maintained by MBA (Mortgage Bankers Association)
- Freely available XML schemas from `mismo.org`

### XML Document Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<MESSAGE xmlns="http://www.mismo.org/residential/2009/schemas"
         MISMOReferenceModelIdentifier="3.6.0">
  <ABOUT_VERSIONS>
    <ABOUT_VERSION>
      <DataVersionIdentifier>...</DataVersionIdentifier>
    </ABOUT_VERSION>
  </ABOUT_VERSIONS>
  <DEAL_SETS>
    <DEAL_SET>
      <DEALS>
        <DEAL>
          <ABOUT_VERSIONS/>
          <ASSETS/>
          <COLLATERALS>
            <COLLATERAL>
              <SUBJECT_PROPERTY>
                <ADDRESS>
                  <AddressLineText/>
                  <CityName/>
                  <StateCode/>
                  <PostalCode/>
                  <CountyName/>
                </ADDRESS>
                <LEGAL_DESCRIPTIONS/>
                <PROPERTY_DETAIL>
                  <PropertyEstimatedValueAmount/>
                  <PropertyUsageType/>
                </PROPERTY_DETAIL>
              </SUBJECT_PROPERTY>
            </COLLATERAL>
          </COLLATERALS>
          <LIABILITIES/>
          <LOANS>
            <LOAN>
              <CLOSING_INFORMATION>
                <CLOSING_COST_FUNDS/>
                <CLOSING_COSTS>
                  <CLOSING_COST_ITEMS/>
                </CLOSING_COSTS>
                <PRORATIONS/>
              </CLOSING_INFORMATION>
              <DOCUMENT_SPECIFIC_DATA_SETS/>
              <FEES>
                <FEE>
                  <FEE_DETAIL>
                    <FeeType/>
                    <FeeActualTotalAmount/>
                    <FeePaidToType/>
                  </FEE_DETAIL>
                </FEE>
              </FEES>
              <LOAN_DETAIL>
                <LoanPurposeType/>
                <NoteAmount/>
                <NoteRatePercent/>
              </LOAN_DETAIL>
              <TERMS_OF_LOAN>
                <LoanMaturityPeriodCount/>
                <LoanMaturityPeriodType/>
                <MortgageType/>
              </TERMS_OF_LOAN>
              <TITLE_INSURANCE>
                <!-- Title insurance specific elements -->
              </TITLE_INSURANCE>
            </LOAN>
          </LOANS>
          <PARTIES>
            <PARTY>
              <INDIVIDUAL>
                <NAME>
                  <FirstName/>
                  <LastName/>
                  <MiddleName/>
                </NAME>
                <CONTACT_POINTS/>
              </INDIVIDUAL>
              <LEGAL_ENTITY>
                <LEGAL_ENTITY_DETAIL>
                  <FullName/>
                </LEGAL_ENTITY_DETAIL>
              </LEGAL_ENTITY>
              <ROLES>
                <ROLE>
                  <ROLE_DETAIL>
                    <PartyRoleType/>
                    <!-- Borrower, Seller, Lender, TitleCompany, 
                         SettlementAgent, Attorney, etc. -->
                  </ROLE_DETAIL>
                </ROLE>
              </ROLES>
              <ADDRESSES/>
            </PARTY>
          </PARTIES>
          <RELATIONSHIPS/>
          <SERVICES/>
        </DEAL>
      </DEALS>
    </DEAL_SET>
  </DEAL_SETS>
</MESSAGE>
```

### MISMO Title & Closing Dataset Specifications (Candidate Recommendation)
Released October 2023:
1. **Fee Sheet** — Standardized fee itemization
2. **ALTA CPL** (Closing Protection Letter) — Standard format for CPLs
3. **ALTA Title Commitment** — Standard commitment data structure
4. **Endorsements** — Title insurance endorsement data

### Key MISMO Elements for Title/Closing

| Element Path | Description |
|-------------|-------------|
| `MESSAGE/DEAL_SETS/DEAL_SET/DEALS/DEAL` | Root transaction container |
| `DEAL/PARTIES/PARTY` | All parties (buyer, seller, lender, etc.) |
| `DEAL/LOANS/LOAN` | Loan details |
| `DEAL/COLLATERALS/COLLATERAL/SUBJECT_PROPERTY` | Property information |
| `LOAN/CLOSING_INFORMATION` | Closing costs, prorations, funds |
| `LOAN/FEES/FEE` | Individual fee line items |
| `LOAN/TITLE_INSURANCE` | Title insurance specifics |
| `DEAL/SERVICES` | Service requests/responses |

### Schema Downloads
- MISMO 3.6.2: `https://www.mismo.org/standards-resources/residential-specifications/reference-model/xml-schema/mismo-version-3.6.2`
- Model Viewer: `https://modelviewers.pilotfishtechnology.com/modelviewers/MISMO/`

---

## 10. ALTA Settlement Statement Format

### Overview
ALTA (American Land Title Association) provides standardized settlement statement forms used alongside the CFPB Closing Disclosure.

### Available Formats
| Format | Use Case |
|--------|----------|
| **Excel (.xls)** | Data entry, structured export, calculations |
| **Word (.doc)** | Customization and editing |
| **PDF** | Printing and viewing |

### Four Statement Versions
1. **ALTA Settlement Statement — Borrower-Buyer**
2. **ALTA Settlement Statement — Cash** (no lender)
3. **ALTA Settlement Statement — Combined** (buyer + seller)
4. **ALTA Settlement Statement — Seller**

### Key Data Fields
```
File/Order Number
Settlement Date, Disbursement Date
Property Address

BUYER/BORROWER SIDE:
- Contract sales price
- Personal property
- Settlement charges (from Section L)
- Adjustments: taxes, assessments, HOA
- Deposit/earnest money
- Loan amount(s)
- Credits

SELLER SIDE:
- Contract sales price
- Settlement charges (from Section L)
- Payoff amounts (existing mortgages)
- Adjustments: taxes, assessments
- Commission
- Credits

ACTUAL SETTLEMENT CHARGES:
- Title insurance premiums
- Settlement/closing fees
- Abstract/title search
- Examination fees
- Document preparation
- Recording fees
- Transfer taxes
- Survey
- Inspection fees
```

### Relationship to Closing Disclosure
- ALTA statements are supplementary to (not replacements for) the CFPB Closing Disclosure
- They disclose actual title insurance premiums and regional fees that may not appear on federal forms
- Many title companies generate both documents from the same data

---

## 11. HUD-1 Data Format

### Overview
The HUD-1 Settlement Statement was the standard closing document before TRID (October 2015). Still used for:
- Commercial transactions
- Reverse mortgages
- Home equity lines of credit (HELOCs)
- Cash transactions (some states)

### Format
- **Official Form**: PDF with structured line items (lines 100-1400)
- **Data Entry**: Typewriter, hand printing, or computer-generated
- **Digital Exchange**: Via MISMO XML (mapped to settlement statement elements)

### Line Item Structure
```
SECTION J — SUMMARY OF BORROWER'S TRANSACTION
  100-series: Gross amount due from borrower
    101: Contract sales price
    102: Personal property
    103-105: Settlement charges, adjustments
    106-112: City/county taxes, assessments
  200-series: Amounts paid by/on behalf of borrower
    201: Deposit/earnest money
    202: Principal amount of new loan(s)
    203-209: Existing loans, credits
    210-219: Adjustments
  300-series: Cash at settlement to/from borrower

SECTION K — SUMMARY OF SELLER'S TRANSACTION
  400-series: Gross amount due to seller
  500-series: Reductions
  600-series: Cash at settlement to/from seller

SECTION L — SETTLEMENT CHARGES
  700: Sales/broker's commission
  800: Items payable in connection with loan
    801: Loan origination fee
    802: Loan discount
    803: Appraisal fee
    804: Credit report
    805-811: Various lender charges
  900: Items required by lender to be paid in advance
    901: Interest
    902: Mortgage insurance premium
    903: Hazard insurance premium
  1000: Reserves deposited with lender
  1100: Title charges
    1101: Settlement/closing fee
    1102-1104: Abstract, title search, title examination
    1105: Document preparation
    1106: Notary fees
    1107: Attorney fees
    1108: Title insurance binder
    1109-1113: Lender's/owner's title insurance
  1200: Government recording and transfer charges
    1201: Recording fees
    1202-1203: City/county tax stamps
  1300: Additional settlement charges
    1301: Survey
    1302: Pest inspection
  1400: Total settlement charges
```

---

## 12. Closing Disclosure (CD) / TRID Format

### Overview
The TILA-RESPA Integrated Disclosure (TRID) rule, effective October 2015, replaced the HUD-1 with the Closing Disclosure for most residential transactions.

### Uniform Closing Dataset (UCD) — The Digital Format

**Standard**: MISMO v3.3.0299 XML
**Current Version**: UCD v2.0 (published September 2024)
**Maintained by**: Fannie Mae and Freddie Mac (FHFA direction)

### UCD XML Structure
The UCD maps every field on the Closing Disclosure form to MISMO XML elements using Form Field IDs:

**Form Field ID Format**: `n.0` (sections), `n.m` (fields), `n.m.o` (sub-details)

### Key UCD Data Elements
```
CLOSING INFORMATION:
  Date Issued, Closing Date, Disbursement Date
  Settlement Agent, File Number, Property Address
  
TRANSACTION INFORMATION:
  Sale Price, Loan Terms (Amount, Rate, Term)
  
LOAN COSTS:
  A. Origination Charges
  B. Services Borrower Did Not Shop For
  C. Services Borrower Did Shop For
  
OTHER COSTS:
  D. Taxes and Other Government Fees
  E. Prepaids
  F. Initial Escrow Payment at Closing
  G. Other
  H. Total Other Costs
  
CALCULATING CASH TO CLOSE:
  Total Closing Costs
  Down Payment/Funds from Borrower
  Deposit
  Funds for Borrower (credits)
  Adjustments and Other Credits
  Cash to Close
  
CONTACT INFORMATION:
  Lender, Mortgage Broker, Real Estate Broker (B/S),
  Settlement Agent
```

### UCD Supporting Resources
- **UCD v2.0 Specification**: Full field mapping document
- **Implementation Guide**: Technical integration guidance
- **Quick Start Guide**: Abbreviated onboarding
- **Test Case Suite**: Sample CDs paired with UCD XML files
- **Production Schema**: MISMO v3.3.0299 XSD
- **Validation Schema (Subschema)**: For testing compliance
- **UCD EXTENSION Schema**: `ucd:FEE_DETAIL_EXTENSION` container

### Sample XML Files (Fannie Mae)
Available scenarios:
1. Conventional Fixed-Rate Purchase — Whole Loan
2. Conventional ARM Refinance — Whole Loan
3. Conventional Fixed-Rate Condo Purchase
- Download: `https://singlefamily.fanniemae.com/learning-center/delivering/uniform-loan-delivery-dataset-uldd/appendix-c-xml-samples`

### UCD Submission
- **Fannie Mae**: UCD Collection Solution web portal
- **Freddie Mac**: Loan Selling Advisor
- Files accepted in UCD v1.5 or v2.0 (but not mixed)

---

## 13. Common Data Fields Across Systems

### Universal Order/File Data
Every title production system handles these core data entities:

```
ORDER/FILE INFORMATION:
  ├── Order/File Number (unique identifier)
  ├── Transaction Type (Purchase, Refinance, Equity, Cash Sale)
  ├── Order Date
  ├── Expected Closing Date
  ├── Actual Closing Date
  ├── Disbursement Date
  └── Status (Open, Closed, Cancelled, On Hold)

PROPERTY:
  ├── Street Address
  ├── City
  ├── State
  ├── ZIP Code
  ├── County
  ├── Legal Description
  ├── APN / Parcel ID
  ├── Property Type (SFR, Condo, Multi-family, Commercial)
  └── Estimated Value / Purchase Price

BUYER / BORROWER:
  ├── Full Name (First, Middle, Last)
  ├── Mailing Address
  ├── Phone (Home, Work, Cell)
  ├── Email
  ├── SSN (last 4 or full, encrypted)
  ├── Marital Status
  └── Vesting Information

SELLER:
  ├── Full Name / Entity Name
  ├── Mailing Address
  ├── Phone
  ├── Email
  └── SSN/TIN

LENDER:
  ├── Lender Name
  ├── Address
  ├── Loan Officer Name
  ├── Phone / Email
  ├── Loan Number
  ├── Loan Amount
  ├── Loan Type (Conventional, FHA, VA, USDA)
  ├── Interest Rate
  ├── Loan Term
  └── Loan Purpose

TITLE / SETTLEMENT:
  ├── Title Company Name
  ├── Settlement Agent
  ├── Underwriter
  ├── Commitment Number
  ├── Policy Number(s)
  ├── Premium Amounts
  └── Endorsements

FEES / CHARGES:
  ├── Settlement Fee
  ├── Title Search Fee
  ├── Title Examination Fee
  ├── Document Preparation Fee
  ├── Recording Fees
  ├── Transfer Taxes
  ├── Title Insurance Premium (Lender's)
  ├── Title Insurance Premium (Owner's)
  ├── Endorsement Fees
  ├── Courier/Wire Fees
  └── Miscellaneous Fees

DOCUMENTS:
  ├── Title Commitment
  ├── Title Policy
  ├── Closing Disclosure
  ├── Settlement Statement
  ├── Deed
  ├── Mortgage/Deed of Trust
  ├── Payoff Statement(s)
  └── Closing Protection Letter
```

---

## 14. Format Comparison Matrix

| System | XML | JSON | CSV | XLSX | PDF | REST API | SOAP/WS | GraphQL | MISMO |
|--------|-----|------|-----|------|-----|----------|---------|---------|-------|
| **SoftPro** | ✅ | ✅* | ✅ | ✅ | ✅ | ✅ | — | — | ✅ |
| **RamQuest** | ✅ | — | ✅ | — | ✅ | ✅ (SDK) | — | — | ✅ |
| **Qualia** | ✅ | ✅ | ✅ | — | ✅ | — | — | ✅ | ✅ |
| **AIM+** | ✅ | — | ✅ | ✅ | ✅ | — | — | — | Partial |
| **ResWare** | ✅ | ✅* | ✅ | — | ✅ | ✅* | ✅ | — | ✅ |
| **TitleExpress** | ✅ | — | ✅ | ✅ | ✅ | — | — | — | ✅ |
| **ClosingCorp** | ✅ | ✅ | — | — | ✅ | ✅ | — | — | ✅ |

*\* Via newer Qualia platform integration*

### Import Mechanism Comparison

| System | LOS Auto-Import | Manual File Import | API Import | Bulk CSV Import |
|--------|----------------|-------------------|------------|-----------------|
| **SoftPro** | ✅ (360 Integrations) | ✅ | ✅ (REST) | ✅ |
| **RamQuest** | ✅ (Closing Market) | ✅ | ✅ (SDK) | Limited |
| **Qualia** | ✅ (Connect) | ✅ | ✅ (GraphQL) | ✅ |
| **AIM+** | ✅ (StewartOrders) | ✅ (AFW) | Limited | — |
| **ResWare** | ✅ (ActionList) | ✅ (.EXP files) | ✅ (SOAP/REST) | Limited |
| **TitleExpress** | ✅ (AgentNet) | ✅ | Limited | Limited |
| **ClosingCorp** | N/A (fee provider) | N/A | ✅ (REST v2) | N/A |

---

## Key Takeaways for Integration

### If Building a Universal Data Import
1. **MISMO XML** is the safest common denominator — all major systems support it
2. **CSV with standardized headers** is the simplest fallback for bulk data
3. **JSON via REST/GraphQL** is the modern path (Qualia, SoftPro, ClosingCorp)
4. **UCD XML (MISMO v3.3)** is required for anything touching GSE/lender workflows

### Priority Integration Targets
1. **SoftPro** — largest market share, REST API available
2. **Qualia** — fastest growing, modern GraphQL API
3. **ResWare** — enterprise segment, SOAP + newer REST via Qualia
4. **RamQuest** — large installed base, Closing Market SDK
5. **TitleExpress** — First American ecosystem, AgentNet XML

### Recommended Approach
- Build a **MISMO XML parser/generator** as the core translation layer
- Add **system-specific adapters** for each TPS's proprietary API
- Support **CSV import/export** as a universal fallback
- Implement **UCD XML** for lender-facing data exchange
