# CORTEX Review Workflow Enhancement Plan

## Executive Summary

The current review system has a critical gap: **human corrections made during review are not persisted**. For Stewart's title insurance operations (back plants, starter files, structured data from unstructured records), this must be fixed to ensure export accuracy.

---

## Current Data Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Upload    │───▶│   Extract   │───▶│   Review    │───▶│   Export    │
│   (PDF)     │    │   (Retab)   │    │   (Human)   │    │   (CSV/JSON)│
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                  │                  │                   │
       ▼                  ▼                  ▼                   ▼
    ✓ Works          ✓ Works           ✗ BROKEN            ✗ BROKEN
                                       Edits not          Uses raw AI
                                       saved              output only
```

---

## Database Schema (Current)

The schema already supports corrections but they're not utilized:

```sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  extraction_data TEXT,       -- Raw AI extraction (JSON)
  likelihoods TEXT,           -- Per-field confidence (JSON)
  extraction_confidence REAL, -- Overall confidence
  needs_review INTEGER,       -- Flag for human review
  review_reasons TEXT,        -- Why flagged (JSON array)
  reviewed_at DATETIME,       -- ✗ Never set
  reviewed_by TEXT,           -- ✗ Never set
  reviewer_notes TEXT,        -- ✗ Never set
  edited_fields TEXT,         -- ✗ Never set (JSON of corrections)
);
```

---

## Proposed Enhanced Data Model

### 1. Field-Level Corrections Tracking

```javascript
// edited_fields should store:
{
  "field_name": {
    "original_value": "JOHN DOE",        // What AI extracted
    "corrected_value": "JOHN D. DOE",    // What human corrected to
    "corrected_at": "2025-01-31T12:00:00Z",
    "corrected_by": "reviewer@stewart.com",
    "correction_reason": "Middle initial missing"  // Optional
  }
}
```

### 2. Document Review Status

```javascript
// Status progression:
"pending"      → Waiting for processing
"completed"    → AI extraction done, high confidence
"needs_review" → AI extraction done, flagged for human review
"reviewed"     → Human reviewed and approved (NEW STATUS)
"rejected"     → Human rejected, needs reprocessing (NEW STATUS)
```

### 3. Audit Trail

```javascript
// New table: review_history
{
  id: "rev_123",
  document_id: "doc_456",
  action: "approve" | "reject" | "edit",
  field_name: "grantor_name",  // null for approve/reject
  old_value: "JOHN DOE",
  new_value: "JOHN D. DOE",
  reviewer_id: "reviewer@stewart.com",
  timestamp: "2025-01-31T12:00:00Z",
  notes: "Added middle initial per recorded document"
}
```

---

## Review UI/UX Improvements

### Current Problems:
1. PDF viewer was constrained by field panel (fixed)
2. Field edits possible but not persisted (critical)
3. No visual indication of what was changed
4. No way to add field-level notes
5. No keyboard shortcuts for efficient review
6. No progress saving (lose work if page closes)

### Recommended Layout:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Document: ALTA Survey Certificate          [Back to Results]   [Close]   │
├────────────┬─────────────────────────────────────────────────────────────┤
│            │                                                             │
│  Queue     │              PDF VIEWER (60-70% width)                      │
│            │                                                             │
│  1. ✓ Done │    • Page navigation                                        │
│  2. ◉ Now  │    • Zoom controls                                          │
│  3. ○ Next │    • Jump to field location (if bounding boxes available)   │
│  4. ○ ...  │                                                             │
│            │                                                             │
│  ────────  │─────────────────────────────────────────────────────────────│
│  Progress: │                                                             │
│  2/15      │              EXTRACTED DATA PANEL (30-40% width)            │
│            │                                                             │
│            │    ┌─────────────────────────────────────────────────┐      │
│            │    │ ⚠️ NEEDS ATTENTION (3 fields)                   │      │
│            │    │                                                 │      │
│            │    │ Grantor Name          [JOHN DOE        ] [✓]    │      │
│            │    │ 45% confidence        Original: "JOHN DOE"      │      │
│            │    │                                                 │      │
│            │    │ Recording Date        [          empty ] [✓]    │      │
│            │    │ REQUIRED FIELD                                  │      │
│            │    └─────────────────────────────────────────────────┘      │
│            │                                                             │
│            │    ┌─────────────────────────────────────────────────┐      │
│            │    │ ✓ VERIFIED (12 fields)                  [Show] │      │
│            │    └─────────────────────────────────────────────────┘      │
│            │                                                             │
├────────────┴─────────────────────────────────────────────────────────────┤
│  [Reject & Skip]                    [Save Draft]    [Approve & Next →]   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Field Editor Features:

1. **Inline Editing**: Click field value to edit directly
2. **Original Value Display**: Show what AI extracted (grayed out)
3. **Change Indicator**: Visual diff when value modified
4. **Confidence Badge**: Color-coded (green/amber/red)
5. **Required Indicator**: Flag for fields that must have values
6. **Field Notes**: Optional note explaining correction
7. **Keyboard Shortcuts**:
   - `Tab` - Next field
   - `Enter` - Approve field
   - `Cmd+Enter` - Approve document
   - `Cmd+S` - Save draft

### Review States:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Needs      │────▶│  In Review  │────▶│  Approved   │
│  Attention  │     │  (editing)  │     │  (final)    │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │
      │                   ▼
      │             ┌─────────────┐
      └────────────▶│  Rejected   │
                    │  (reprocess)│
                    └─────────────┘
```

---

## Export Enhancement

### Current Export:
- Uses raw `extraction_data` only
- Ignores any corrections
- No metadata about review status

### Enhanced Export:

```javascript
// JSON export structure
{
  "documents": [
    {
      "id": "doc_123",
      "source_file": "packet_001.pdf",
      "document_type": "deed_of_trust",
      "pages": [1, 2, 3],
      "extraction_status": "reviewed",  // NEW
      "extraction_confidence": 0.87,
      
      // Final data (AI + human corrections merged)
      "data": {
        "grantor_name": "JOHN D. DOE",
        "grantee_name": "ABC TITLE COMPANY",
        "recording_date": "2024-01-15",
        // ...
      },
      
      // Audit trail (NEW)
      "corrections": [
        {
          "field": "grantor_name",
          "original": "JOHN DOE",
          "corrected": "JOHN D. DOE",
          "corrected_by": "reviewer@stewart.com",
          "corrected_at": "2025-01-31T12:00:00Z"
        }
      ],
      
      // Review metadata (NEW)
      "review": {
        "status": "approved",
        "reviewed_by": "reviewer@stewart.com",
        "reviewed_at": "2025-01-31T12:05:00Z",
        "notes": "Verified against recorded document image"
      }
    }
  ],
  
  // Export metadata
  "export_metadata": {
    "exported_at": "2025-01-31T12:10:00Z",
    "total_documents": 15,
    "reviewed_count": 15,
    "correction_count": 3,
    "confidence_avg": 0.92
  }
}
```

### CSV Export Options:

1. **Data Only**: Just the final corrected values
2. **Data + Flags**: Include `_was_corrected` columns
3. **Full Audit**: Separate columns for original/corrected values

---

## Implementation Priority

### Phase 1: Core Fixes (Critical)
1. [ ] Implement `handleApproveReview` to save corrections to database
2. [ ] Implement `handleRejectReview` to mark documents for reprocessing
3. [ ] Update document status after review
4. [ ] Merge corrections into export data

### Phase 2: UI Improvements
1. [ ] Make fields editable in ReviewQueue
2. [ ] Show original vs corrected values
3. [ ] Add visual indicators for changes
4. [ ] Implement "Save Draft" functionality
5. [ ] Add keyboard shortcuts

### Phase 3: Audit & Quality
1. [ ] Create review_history table
2. [ ] Track all field-level changes
3. [ ] Add reviewer identification
4. [ ] Export audit trail
5. [ ] Add field validation rules per document type

### Phase 4: Advanced Features
1. [ ] Bounding box visualization (if Retab returns coordinates)
2. [ ] Bulk corrections (same error across documents)
3. [ ] Review templates (common corrections)
4. [ ] Quality metrics dashboard
5. [ ] Review time tracking

---

## Key Metrics to Track

For Stewart's quality assurance:

1. **Extraction Accuracy**: % of fields requiring no correction
2. **Review Rate**: % of documents flagged for review
3. **Correction Rate**: % of fields corrected by humans
4. **Review Time**: Average time per document
5. **Rejection Rate**: % of documents rejected/reprocessed
6. **Field-Level Accuracy**: Per-field accuracy rates
7. **Confidence Calibration**: Does confidence predict accuracy?

---

## Next Steps

1. **Immediate**: Implement Phase 1 to make review corrections persist
2. **This Week**: Complete Phase 2 UI improvements
3. **Ongoing**: Build out audit and quality features

The goal is to ensure that when Stewart exports data from CORTEX, it represents the **highest quality, human-verified extraction** - not just raw AI output.
