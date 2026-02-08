import React from "react";

/**
 * Sailboat icon evoking SAIL (Stewart AI Lab).
 * Matches the Lucide icon style: 24x24 viewBox, stroke-based, 2px stroke.
 * Accepts className for sizing/coloring just like Lucide icons.
 */
export function SailboatIcon({ className = "h-6 w-6", ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Main sail (tall triangle) */}
      <path d="M12 3 L12 17 L5 17 Z" />
      {/* Jib sail (smaller triangle) */}
      <path d="M12 6 L12 17 L17 17 Z" />
      {/* Hull (gentle curve) */}
      <path d="M3 17 C3 17 4 21 12 21 C20 21 21 17 21 17" />
      {/* Waterline */}
      <line x1="3" y1="17" x2="21" y2="17" />
    </svg>
  );
}

export default SailboatIcon;
