import React, { useState, useCallback } from "react";
import { FileUpload } from "./components/FileUpload";
import { SchemaSelector } from "./components/SchemaSelector";
import { ExtractionProgress } from "./components/ExtractionProgress";
import { ResultsDisplay } from "./components/ResultsDisplay";
import { useRetabExtract, ExtractionStatus } from "./hooks/useRetabExtract";
import { useRetabSchemaGen } from "./hooks/useRetabSchemaGen";
import { getApiKey, setApiKey, hasApiKey, generateSchema as generateSchemaApi } from "./lib/retab";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "./components/ui/alert";
import { AlertCircle, Key, FileText, Settings, Sparkles } from "lucide-react";

function App() {
  // API Key state
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());
  const [apiKeyConfigured, setApiKeyConfigured] = useState(hasApiKey());
  const [showApiKeyWarning, setShowApiKeyWarning] = useState(false);

  // File state
  const [selectedFile, setSelectedFile] = useState(null);

  // Schema state
  const [selectedSchema, setSelectedSchema] = useState(null);

  // Extraction hook
  const {
    status,
    progress,
    result,
    error: extractionError,
    extract,
    reset: resetExtraction,
    isLoading,
    isComplete,
  } = useRetabExtract();

  // Schema generation hook
  const {
    isGenerating,
    error: schemaGenError,
    generate: generateSchema,
  } = useRetabSchemaGen();

  // Handle API key save
  const handleSaveApiKey = () => {
    if (!apiKeyInput.trim()) {
      setShowApiKeyWarning(true);
      return;
    }
    setApiKey(apiKeyInput.trim());
    setApiKeyConfigured(true);
    setShowApiKeyWarning(false);
  };

  // Handle API key clear
  const handleClearApiKey = () => {
    setApiKey("");
    setApiKeyInput("");
    setApiKeyConfigured(false);
  };

  // Handle file selection
  const handleFileSelect = (fileData) => {
    setSelectedFile(fileData);
    resetExtraction();
  };

  // Handle file clear
  const handleFileClear = () => {
    setSelectedFile(null);
    resetExtraction();
  };

  // Handle schema change
  const handleSchemaChange = (schema) => {
    setSelectedSchema(schema);
  };

  // Handle schema generation
  const handleGenerateSchema = useCallback(async () => {
    if (!selectedFile) return null;
    
    try {
      const schema = await generateSchemaApi({
        document: selectedFile.base64,
        filename: selectedFile.name,
        instructions: "Generate a comprehensive JSON schema to extract all relevant data from this document.",
      });
      return schema;
    } catch (err) {
      console.error("Schema generation failed:", err);
      throw err;
    }
  }, [selectedFile]);

  // Handle extraction
  const handleExtract = async () => {
    if (!selectedFile || !selectedSchema) return;

    try {
      await extract({
        document: selectedFile.base64,
        filename: selectedFile.name,
        jsonSchema: selectedSchema,
        model: "retab-small",
        nConsensus: 1,
      });
    } catch (err) {
      console.error("Extraction failed:", err);
    }
  };

  // Handle reset for new extraction
  const handleReset = () => {
    setSelectedFile(null);
    setSelectedSchema(null);
    resetExtraction();
  };

  // Check if ready to extract
  const canExtract = selectedFile && selectedSchema && !isLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#9e2339] rounded-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Stewart Ingestion Engine
                </h1>
                <p className="text-sm text-gray-500">
                  Structured Data Extraction TEST
                </p>
              </div>
            </div>
            {apiKeyConfigured && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearApiKey}
                className="text-gray-500"
              >
                <Settings className="h-4 w-4 mr-1" />
                Change API Key
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* API Key Configuration */}
        {!apiKeyConfigured && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-[#9e2339]" />
                Configure API Key
              </CardTitle>
              <CardDescription>
                Enter your Retab API key to get started. You can find your API
                key in the{" "}
                <a
                  href="https://retab.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#9e2339] hover:underline"
                >
                  Retab Dashboard
                </a>
                .
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="Enter your Retab API key"
                    value={apiKeyInput}
                    onChange={(e) => {
                      setApiKeyInput(e.target.value);
                      setShowApiKeyWarning(false);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveApiKey()}
                  />
                </div>
                {showApiKeyWarning && (
                  <Alert variant="warning">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Please enter a valid API key
                    </AlertDescription>
                  </Alert>
                )}
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Security Note</AlertTitle>
                  <AlertDescription>
                    Your API key is stored locally in your browser. For
                    production use, consider using a backend proxy to protect
                    your key.
                  </AlertDescription>
                </Alert>
                <Button onClick={handleSaveApiKey} className="w-full">
                  Save API Key
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        {apiKeyConfigured && (
          <div className="space-y-6">
            {/* Show results if complete */}
            {isComplete && result ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-[#9e2339]" />
                    Extraction Results
                  </CardTitle>
                  <CardDescription>
                    Data extracted from {selectedFile?.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResultsDisplay result={result} file={selectedFile} onReset={handleReset} />
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Step 1: Upload Document */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#9e2339] text-white text-sm font-bold">
                        1
                      </span>
                      Upload Document
                    </CardTitle>
                    <CardDescription>
                      Upload a PDF document to extract data from
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FileUpload
                      selectedFile={selectedFile}
                      onFileSelect={handleFileSelect}
                      onClear={handleFileClear}
                      disabled={isLoading}
                    />
                  </CardContent>
                </Card>

                {/* Step 2: Select Schema */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#9e2339] text-white text-sm font-bold">
                        2
                      </span>
                      Define Schema
                    </CardTitle>
                    <CardDescription>
                      Choose a prebuilt schema or define a custom one
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SchemaSelector
                      selectedSchema={selectedSchema}
                      onSchemaChange={handleSchemaChange}
                      onGenerateSchema={handleGenerateSchema}
                      isGenerating={isGenerating}
                      hasFile={!!selectedFile}
                      disabled={isLoading}
                    />
                    {schemaGenError && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{schemaGenError}</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                {/* Step 3: Extract */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#9e2339] text-white text-sm font-bold">
                        3
                      </span>
                      Extract Data
                    </CardTitle>
                    <CardDescription>
                      Run the extraction to get structured data
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Extraction progress */}
                    {status !== ExtractionStatus.IDLE && (
                      <ExtractionProgress
                        status={status}
                        progress={progress}
                        error={extractionError}
                      />
                    )}

                    {/* Extract button */}
                    <Button
                      onClick={handleExtract}
                      disabled={!canExtract}
                      className="w-full"
                      size="lg"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                          Extracting...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Extract Data
                        </>
                      )}
                    </Button>

                    {/* Validation messages */}
                    {!selectedFile && (
                      <p className="text-sm text-gray-500 text-center">
                        Upload a document to continue
                      </p>
                    )}
                    {selectedFile && !selectedSchema && (
                      <p className="text-sm text-gray-500 text-center">
                        Select or define a schema to continue
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center text-sm text-gray-500">
            <p>POWERED BY <span className="font-semibold text-[#9e2339]">SAIL</span></p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
