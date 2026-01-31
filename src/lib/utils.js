import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * CST/CDT timezone identifier (handles daylight saving automatically)
 */
const CST_TIMEZONE = "America/Chicago";

/**
 * Format a date/time in Central Time (CST/CDT)
 * @param {Date|string|number} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options (optional)
 * @returns {string} Formatted date/time string in Central Time
 */
export function formatDateTimeCST(date, options = {}) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  
  const defaultOptions = {
    timeZone: CST_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  };
  
  return d.toLocaleString("en-US", { ...defaultOptions, ...options });
}

/**
 * Format just the time in Central Time (CST/CDT)
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted time string in Central Time
 */
export function formatTimeCST(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  
  return d.toLocaleTimeString("en-US", {
    timeZone: CST_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format just the date in Central Time (CST/CDT)
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date string in Central Time
 */
export function formatDateCST(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  
  return d.toLocaleDateString("en-US", {
    timeZone: CST_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

/**
 * Get relative time string (e.g., "2h ago", "3d ago") in Central Time
 * @param {Date|string|number} date - Date to compare
 * @returns {string} Relative time string
 */
export function formatRelativeTimeCST(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return formatDateCST(d);
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
