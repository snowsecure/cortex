import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./button";
import { cn } from "../../lib/utils";

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger", // "danger" | "warning" | "info"
}) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: "text-red-500 bg-red-100",
      button: "bg-red-600 hover:bg-red-700 text-white",
    },
    warning: {
      icon: "text-amber-500 bg-amber-100",
      button: "bg-amber-600 hover:bg-amber-700 text-white",
    },
    info: {
      icon: "text-blue-500 bg-blue-100",
      button: "bg-blue-600 hover:bg-blue-700 text-white",
    },
  };

  const styles = variantStyles[variant] || variantStyles.danger;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 animate-in fade-in duration-150"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 fade-in duration-150">
        <div className="flex items-start gap-4">
          <div className={cn("p-2 rounded-full shrink-0", styles.icon)}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
            <p className="text-sm text-gray-600">{message}</p>
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>
            {cancelText}
          </Button>
          <Button 
            className={styles.button}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
