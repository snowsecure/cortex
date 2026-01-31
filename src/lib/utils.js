import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Extract data from a Retab API extraction response
 * Handles wrapped, unwrapped, and top-level likelihoods formats
 * @param {Object} extraction - The extraction response from the API
 * @returns {{ data: Object, likelihoods: Object }} Extracted data and likelihoods
 */
export function getExtractionData(extraction) {
  if (!extraction) {
    return { data: {}, likelihoods: {} };
  }

  const content = extraction.content || extraction;

  const data =
    content?.choices?.[0]?.message?.parsed ||
    content?.data ||
    content?.result ||
    {};

  const likelihoods =
    content?.likelihoods ||
    content?.choices?.[0]?.message?.likelihoods ||
    extraction?.likelihoods ||
    {};

  return { data, likelihoods };
}
