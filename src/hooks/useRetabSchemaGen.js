import { useState, useCallback } from "react";
import { generateSchema } from "../lib/retab";

/**
 * Hook for schema generation from documents
 */
export function useRetabSchemaGen() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [generatedSchema, setGeneratedSchema] = useState(null);

  /**
   * Generate a schema from a document
   */
  const generate = useCallback(async ({ document, filename, instructions }) => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await generateSchema({
        document,
        filename: filename || "document.pdf",
        instructions,
      });

      const schema = response.json_schema;
      setGeneratedSchema(schema);
      return schema;
    } catch (err) {
      setError(err.message || "Schema generation failed");
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setIsGenerating(false);
    setError(null);
    setGeneratedSchema(null);
  }, []);

  return {
    isGenerating,
    error,
    generatedSchema,
    generate,
    reset,
  };
}

export default useRetabSchemaGen;
