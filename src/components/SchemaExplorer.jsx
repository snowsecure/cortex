import React, { useState, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  Search,
  X,
  Copy,
  Check,
  Tag,
  AlertCircle,
  ArrowRight,
  FileText,
  Hash,
  ToggleLeft,
  Calendar,
  Type,
  List,
  Eye,
  Code,
  ChevronsUpDown,
  FileStack,
  Building2,
  Scale,
  Home,
  Gavel,
  Receipt,
  Shield,
  Landmark,
  ScrollText,
  Users,
  MapPin,
} from "lucide-react";
import { cn } from "../lib/utils";
import { schemas, schemaList, documentCategories } from "../schemas";
import {
  SUBDOCUMENT_TYPES,
  SPLIT_TO_CATEGORY_MAP,
  CRITICAL_FIELDS,
  getCategoryDisplayName,
} from "../lib/documentCategories";

// ============================================================================
// CATEGORY ICONS
// ============================================================================

const CATEGORY_ICONS = {
  "Admin & Transaction": { icon: FileStack, color: "text-blue-500" },
  "Deeds & Transfers": { icon: Home, color: "text-emerald-500" },
  "Mortgages & Loans": { icon: Building2, color: "text-violet-500" },
  "Liens": { icon: Scale, color: "text-red-500" },
  "Legal Actions": { icon: Gavel, color: "text-orange-500" },
  "Easements & Restrictions": { icon: ScrollText, color: "text-cyan-500" },
  "Tax & Assessment": { icon: Receipt, color: "text-amber-500" },
  "Title Insurance": { icon: Shield, color: "text-indigo-500" },
  "Court & Probate": { icon: Landmark, color: "text-pink-500" },
  "Parties & Authority": { icon: Users, color: "text-teal-500" },
  "Property Information": { icon: MapPin, color: "text-lime-500" },
  "Other": { icon: FileText, color: "text-gray-400" },
};

// ============================================================================
// TYPE HELPERS
// ============================================================================

function getTypeIcon(type) {
  const iconClass = "h-3.5 w-3.5";
  switch (type) {
    case "string": return <Type className={cn(iconClass, "text-blue-400")} />;
    case "number":
    case "integer": return <Hash className={cn(iconClass, "text-emerald-400")} />;
    case "boolean": return <ToggleLeft className={cn(iconClass, "text-violet-400")} />;
    case "date": return <Calendar className={cn(iconClass, "text-amber-400")} />;
    case "array": return <List className={cn(iconClass, "text-cyan-400")} />;
    default: return <FileText className={cn(iconClass, "text-gray-300")} />;
  }
}

// ============================================================================
// FIELD ROW
// ============================================================================

function FieldRow({ fieldName, fieldDef, isCritical }) {
  const displayName = fieldName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  
  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-2.5",
      isCritical && "bg-amber-50/50"
    )}>
      {getTypeIcon(fieldDef.type)}
      <span className="text-sm text-gray-600 flex-1">{displayName}</span>
      {isCritical && <span className="text-[10px] text-amber-600 font-medium">critical</span>}
      <span className="text-[10px] text-gray-400">{fieldDef.type}</span>
    </div>
  );
}

// ============================================================================
// SCHEMA DETAIL PANEL
// ============================================================================

function SchemaDetailPanel({ schemaId, onClose }) {
  const [viewMode, setViewMode] = useState("fields");
  const [copied, setCopied] = useState(false);
  
  const schemaData = schemas[schemaId];
  if (!schemaData) return null;
  
  const schema = schemaData.schema;
  const properties = schema.properties || {};
  const criticalFields = CRITICAL_FIELDS[schemaId] || [];
  
  const fields = Object.entries(properties);
  
  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(schema, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="px-5 py-4 bg-white flex items-center justify-between">
        <div>
          <h2 className="font-medium text-gray-900">{schemaData.name}</h2>
          <p className="text-xs text-gray-400 mt-1">
            {fields.length} fields · {criticalFields.length} critical
          </p>
        </div>
        <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
          <X className="h-3.5 w-3.5" />
          Back
        </button>
      </div>
      
      {/* View Toggle */}
      <div className="px-5 py-3 bg-white flex gap-6 text-sm">
        <button
          onClick={() => setViewMode("fields")}
          className={cn("flex items-center gap-1.5", viewMode === "fields" ? "text-gray-900" : "text-gray-400")}
        >
          <Eye className="h-3.5 w-3.5" /> Fields
        </button>
        <button
          onClick={() => setViewMode("json")}
          className={cn("flex items-center gap-1.5", viewMode === "json" ? "text-gray-900" : "text-gray-400")}
        >
          <Code className="h-3.5 w-3.5" /> JSON
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-white mt-2 rounded-t-2xl">
        {viewMode === "fields" ? (
          <div className="py-2">
            {fields.map(([name, def]) => (
              <FieldRow
                key={name}
                fieldName={name}
                fieldDef={def}
                isCritical={criticalFields.includes(name)}
              />
            ))}
          </div>
        ) : (
          <div className="p-4">
            <button
              onClick={handleCopyJson}
              className="mb-3 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1.5"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy JSON"}
            </button>
            <pre className="p-4 bg-gray-800 text-gray-300 rounded-xl text-[11px] overflow-x-auto font-mono">
              {JSON.stringify(schema, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SCHEMA LIST ITEM
// ============================================================================

function SchemaListItem({ schemaId, isSelected, onClick }) {
  const schemaData = schemas[schemaId];
  if (!schemaData) return null;
  
  const fieldCount = Object.keys(schemaData.schema.properties || {}).length;
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 text-left text-sm rounded-lg transition-colors",
        isSelected ? "bg-[#9e2339]/10 text-[#9e2339]" : "hover:bg-gray-50 text-gray-600"
      )}
    >
      <span className="flex-1 truncate">{schemaData.name}</span>
      <span className="text-[11px] text-gray-400">{fieldCount} fields</span>
      <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
    </button>
  );
}

// ============================================================================
// CATEGORY SECTION
// ============================================================================

function CategorySection({ category, schemaIds, onSelectSchema, selectedSchema, isExpanded, onToggle }) {
  const categoryInfo = CATEGORY_ICONS[category] || CATEGORY_ICONS["Other"];
  const CategoryIcon = categoryInfo.icon;
  
  return (
    <div className="mb-2">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
      >
        <CategoryIcon className={cn("h-4 w-4", categoryInfo.color)} />
        <span className="flex-1 text-left">{category}</span>
        <span className="text-[11px] font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {schemaIds.length}
        </span>
        <ChevronRight className={cn("h-4 w-4 text-gray-400 transition-transform", isExpanded && "rotate-90")} />
      </button>
      
      {isExpanded && (
        <div className="ml-8 mt-1 mb-2 space-y-1">
          {schemaIds.map((schemaId) => (
            <SchemaListItem
              key={schemaId}
              schemaId={schemaId}
              isSelected={selectedSchema === schemaId}
              onClick={() => onSelectSchema(schemaId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SPLIT TYPES VIEW
// ============================================================================

// Icon and color mapping for split types
const SPLIT_TYPE_STYLES = {
  cover_sheet: { icon: FileStack, color: "text-blue-500", bg: "bg-blue-50" },
  deed: { icon: Home, color: "text-emerald-500", bg: "bg-emerald-50" },
  mortgage: { icon: Building2, color: "text-violet-500", bg: "bg-violet-50" },
  mortgage_modification: { icon: Building2, color: "text-purple-500", bg: "bg-purple-50" },
  tax_lien: { icon: Receipt, color: "text-amber-500", bg: "bg-amber-50" },
  mechanics_lien: { icon: Scale, color: "text-orange-500", bg: "bg-orange-50" },
  hoa_lien: { icon: Scale, color: "text-red-500", bg: "bg-red-50" },
  judgment_lien: { icon: Gavel, color: "text-rose-500", bg: "bg-rose-50" },
  ucc_filing: { icon: FileText, color: "text-indigo-500", bg: "bg-indigo-50" },
  easement: { icon: ScrollText, color: "text-cyan-500", bg: "bg-cyan-50" },
  ccr_restrictions: { icon: ScrollText, color: "text-teal-500", bg: "bg-teal-50" },
  lis_pendens: { icon: Gavel, color: "text-pink-500", bg: "bg-pink-50" },
  court_order: { icon: Landmark, color: "text-fuchsia-500", bg: "bg-fuchsia-50" },
  probate_document: { icon: Landmark, color: "text-slate-500", bg: "bg-slate-50" },
  bankruptcy_document: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
  foreclosure_notice: { icon: AlertCircle, color: "text-orange-600", bg: "bg-orange-50" },
  tax_reports: { icon: Receipt, color: "text-lime-500", bg: "bg-lime-50" },
  prior_policy: { icon: Shield, color: "text-sky-500", bg: "bg-sky-50" },
  survey_plat: { icon: MapPin, color: "text-green-500", bg: "bg-green-50" },
  power_of_attorney: { icon: Users, color: "text-violet-500", bg: "bg-violet-50" },
  affidavit: { icon: FileText, color: "text-gray-500", bg: "bg-gray-50" },
  entity_authority: { icon: Users, color: "text-blue-500", bg: "bg-blue-50" },
  trust_certification: { icon: Shield, color: "text-indigo-500", bg: "bg-indigo-50" },
  settlement_statement: { icon: FileStack, color: "text-emerald-500", bg: "bg-emerald-50" },
  lease_document: { icon: Home, color: "text-teal-500", bg: "bg-teal-50" },
  other_recorded: { icon: FileText, color: "text-gray-400", bg: "bg-gray-50" },
};

function toFriendlyName(snakeCaseName) {
  return snakeCaseName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function SplitTypesView() {
  return (
    <div className="p-5">
      <p className="text-xs text-gray-500 mb-5">
        Split types identify document boundaries when processing multi-page PDFs.
      </p>
      
      <div className="grid gap-3">
        {SUBDOCUMENT_TYPES.map((type) => {
          const mappedCategory = SPLIT_TO_CATEGORY_MAP[type.name];
          const displayName = getCategoryDisplayName(mappedCategory);
          const style = SPLIT_TYPE_STYLES[type.name] || { icon: Tag, color: "text-gray-400", bg: "bg-gray-50" };
          const TypeIcon = style.icon;
          const friendlyName = toFriendlyName(type.name);
          
          return (
            <div key={type.name} className="group p-4 bg-white rounded-xl hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", style.bg)}>
                  <TypeIcon className={cn("h-5 w-5", style.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{friendlyName}</p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{type.description}</p>
                  {mappedCategory && (
                    <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg">
                      <ArrowRight className="h-3 w-3" />
                      <span className="text-[#9e2339] font-medium">{displayName}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN SCHEMA EXPLORER
// ============================================================================

export function SchemaExplorer({ onClose }) {
  const [selectedSchema, setSelectedSchema] = useState(null);
  const [activeTab, setActiveTab] = useState("schemas");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState(
    () => new Set(documentCategories.map(c => c.category))
  );
  
  const filteredCategories = useMemo(() => {
    if (!searchTerm) return documentCategories;
    const lower = searchTerm.toLowerCase();
    return documentCategories.map(cat => ({
      ...cat,
      schemas: cat.schemas.filter(schemaId => {
        const schema = schemas[schemaId];
        if (!schema) return false;
        return (
          schema.name.toLowerCase().includes(lower) ||
          schemaId.toLowerCase().includes(lower)
        );
      }),
    })).filter(cat => cat.schemas.length > 0);
  }, [searchTerm]);
  
  const toggleCategory = (category) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };
  
  const expandAll = () => {
    setExpandedCategories(new Set(documentCategories.map(c => c.category)));
  };
  
  const collapseAll = () => {
    setExpandedCategories(new Set());
  };
  
  const allExpanded = expandedCategories.size === documentCategories.length;
  
  return (
    <div className="h-full flex flex-col bg-white rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Schema Explorer</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {schemaList.length} schemas · {SUBDOCUMENT_TYPES.length} split types
          </p>
        </div>
        <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
          <X className="h-3.5 w-3.5" />
          Close
        </button>
      </div>
      
      {/* Tabs */}
      <div className="px-5 py-3 flex items-center gap-6 text-sm">
        <button
          onClick={() => { setActiveTab("schemas"); setSelectedSchema(null); }}
          className={cn(activeTab === "schemas" ? "text-gray-900 font-medium" : "text-gray-400")}
        >
          Schemas
        </button>
        <button
          onClick={() => { setActiveTab("splits"); setSelectedSchema(null); }}
          className={cn(activeTab === "splits" ? "text-gray-900 font-medium" : "text-gray-400")}
        >
          Split Types
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 flex min-h-0">
        {activeTab === "schemas" ? (
          <>
            {/* Schema List */}
            <div className={cn(
              "flex flex-col transition-all",
              selectedSchema ? "w-72" : "w-full"
            )}>
              {/* Search + Expand/Collapse */}
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search schemas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-100 rounded-xl focus:outline-none focus:bg-gray-50 focus:ring-2 focus:ring-gray-200 placeholder:text-gray-400"
                  />
                </div>
                <button
                  onClick={allExpanded ? collapseAll : expandAll}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl"
                >
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                  {allExpanded ? "Collapse" : "Expand"}
                </button>
              </div>
              
              {/* Categories */}
              <div className="flex-1 overflow-y-auto px-3 pb-4">
                {filteredCategories.map((cat) => (
                  <CategorySection
                    key={cat.category}
                    category={cat.category}
                    schemaIds={cat.schemas}
                    onSelectSchema={setSelectedSchema}
                    selectedSchema={selectedSchema}
                    isExpanded={expandedCategories.has(cat.category)}
                    onToggle={() => toggleCategory(cat.category)}
                  />
                ))}
                
                {filteredCategories.length === 0 && (
                  <p className="p-6 text-center text-sm text-gray-500">No schemas match your search.</p>
                )}
              </div>
            </div>
            
            {/* Schema Detail */}
            {selectedSchema && (
              <div className="flex-1 min-w-0">
                <SchemaDetailPanel
                  schemaId={selectedSchema}
                  onClose={() => setSelectedSchema(null)}
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <SplitTypesView />
          </div>
        )}
      </div>
    </div>
  );
}

export default SchemaExplorer;
