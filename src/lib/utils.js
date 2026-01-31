import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Extract data from a Retab API extraction response
 * Handles both wrapped ({ content: { ... } }) and unwrapped formats
 * @param {Object} extraction - The extraction response from the API
 * @returns {{ data: Object, likelihoods: Object }} Extracted data and likelihoods
 */
export function getExtractionData(extraction) {
  if (!extraction) {
    return { data: {}, likelihoods: {} };
  }
  
  // Handle wrapped response: { content: { choices: [...], likelihoods: {...} }, error: null }
  const content = extraction.content || extraction;
  
  const data = content?.choices?.[0]?.message?.parsed || 
               content?.data || 
               {};
  
  const likelihoods = content?.likelihoods || {};
  
  return { data, likelihoods };
}
