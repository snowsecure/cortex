import React, { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { Select } from "./ui/select";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { schemaList, documentCategories, schemas } from "../schemas";
import { Wand2, Code, FileJson, AlertCircle, CheckCircle } from "lucide-react";

export function SchemaSelector({
  selectedSchema,
  onSchemaChange,
  onGenerateSchema,
  isGenerating,
  hasFile,
  disabled,
}) {
  const [mode, setMode] = useState("prebuilt"); // "prebuilt" or "custom"
  const [selectedPrebuilt, setSelectedPrebuilt] = useState("");
  const [customSchemaText, setCustomSchemaText] = useState("");
  const [validationError, setValidationError] = useState(null);
  const [isValid, setIsValid] = useState(false);

  // Validate JSON schema
  const validateSchema = (text) => {
    if (!text.trim()) {
      setValidationError(null);
      setIsValid(false);
      return null;
    }

    try {
      const parsed = JSON.parse(text);
      
      // Basic JSON Schema validation
      if (typeof parsed !== "object" || parsed === null) {
        setValidationError("Schema must be a JSON object");
        setIsValid(false);
        return null;
      }

      if (!parsed.type) {
        setValidationError("Schema should have a 'type' property");
        setIsValid(false);
        return null;
      }

      setValidationError(null);
      setIsValid(true);
      return parsed;
    } catch (e) {
      setValidationError(`Invalid JSON: ${e.message}`);
      setIsValid(false);
      return null;
    }
  };

  // Handle prebuilt schema selection
  const handlePrebuiltChange = (e) => {
    const value = e.target.value;
    setSelectedPrebuilt(value);
    
    if (value) {
      const schema = schemaList.find((s) => s.id === value);
      if (schema) {
        onSchemaChange(schema.schema);
        setCustomSchemaText(JSON.stringify(schema.schema, null, 2));
        setIsValid(true);
        setValidationError(null);
      }
    } else {
      onSchemaChange(null);
      setCustomSchemaText("");
      setIsValid(false);
    }
  };

  // Handle custom schema text changes
  const handleCustomSchemaChange = (value) => {
    setCustomSchemaText(value || "");
    const parsed = validateSchema(value || "");
    if (parsed) {
      onSchemaChange(parsed);
    } else {
      onSchemaChange(null);
    }
  };

  // Handle mode switch
  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (newMode === "custom" && selectedPrebuilt) {
      // Keep the schema text when switching to custom mode
    } else if (newMode === "prebuilt") {
      // Reset to prebuilt selection
      if (selectedPrebuilt) {
        const schema = schemaList.find((s) => s.id === selectedPrebuilt);
        if (schema) {
          onSchemaChange(schema.schema);
          setCustomSchemaText(JSON.stringify(schema.schema, null, 2));
        }
      }
    }
  };

  // Handle generate schema
  const handleGenerateClick = async () => {
    if (!hasFile || isGenerating) return;
    
    try {
      const generatedSchema = await onGenerateSchema();
      if (generatedSchema) {
        setMode("custom");
        setSelectedPrebuilt("");
        setCustomSchemaText(JSON.stringify(generatedSchema, null, 2));
        onSchemaChange(generatedSchema);
        setIsValid(true);
        setValidationError(null);
      }
    } catch (error) {
      setValidationError(error.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <Button
          variant={mode === "prebuilt" ? "default" : "outline"}
          size="sm"
          onClick={() => handleModeChange("prebuilt")}
          disabled={disabled}
          className="flex items-center gap-2"
        >
          <FileJson className="h-4 w-4" />
          Prebuilt Schemas
        </Button>
        <Button
          variant={mode === "custom" ? "default" : "outline"}
          size="sm"
          onClick={() => handleModeChange("custom")}
          disabled={disabled}
          className="flex items-center gap-2"
        >
          <Code className="h-4 w-4" />
          Custom Schema
        </Button>
        {hasFile && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateClick}
            disabled={disabled || isGenerating || !hasFile}
            className="flex items-center gap-2 ml-auto"
          >
            <Wand2 className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
            {isGenerating ? "Generating..." : "Auto-Generate"}
          </Button>
        )}
      </div>

      {/* Prebuilt Schema Selector */}
      {mode === "prebuilt" && (
        <div className="space-y-2">
          <Label htmlFor="schema-select">Select Document Type</Label>
          <Select
            id="schema-select"
            value={selectedPrebuilt}
            onChange={handlePrebuiltChange}
            disabled={disabled}
            className="text-sm"
          >
            <option value="">Choose a document type...</option>
            {documentCategories.map((category) => (
              <optgroup key={category.category} label={category.category}>
                {category.schemas.map((schemaId) => {
                  const schema = schemas[schemaId];
                  return (
                    <option key={schema.id} value={schema.id}>
                      {schema.name}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </Select>
          {selectedPrebuilt && (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600">
                {schemaList.find((s) => s.id === selectedPrebuilt)?.description}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {Object.keys(schemaList.find((s) => s.id === selectedPrebuilt)?.schema?.properties || {}).length} fields
              </p>
            </div>
          )}
        </div>
      )}

      {/* Custom Schema Editor */}
      {mode === "custom" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>JSON Schema</Label>
            <div className="flex items-center gap-2">
              {customSchemaText && (
                isValid ? (
                  <Badge variant="success" className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Valid
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Invalid
                  </Badge>
                )
              )}
            </div>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Editor
              height="300px"
              defaultLanguage="json"
              value={customSchemaText}
              onChange={handleCustomSchemaChange}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                tabSize: 2,
                automaticLayout: true,
                readOnly: disabled,
              }}
              theme="vs-light"
            />
          </div>
          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}
          <p className="text-xs text-gray-500">
            Define a JSON Schema to specify what data to extract from the document.
            The schema should follow JSON Schema specification.
          </p>
        </div>
      )}
    </div>
  );
}

export default SchemaSelector;
