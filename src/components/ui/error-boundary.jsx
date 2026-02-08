import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "./button";

/**
 * Generic React error boundary.
 * Catches render errors in child components and displays a fallback UI
 * instead of crashing the entire application.
 *
 * Usage:
 *   <ErrorBoundary name="Results">
 *     <PacketResultsView ... />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const section = this.props.name || "Unknown";
    console.error(`[ErrorBoundary:${section}] Component crashed:`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      // Allow a custom fallback via props
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.handleReset });
      }

      const section = this.props.name || "This section";
      return (
        <div className="flex items-center justify-center p-8 min-h-[200px]">
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-3">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {section} encountered an error
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <Button onClick={this.handleReset} variant="outline" size="sm">
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
