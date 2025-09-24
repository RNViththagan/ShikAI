"use client";

import { useState } from "react";

interface PermissionData {
  action: string;
  command?: string;
  risks: string;
  reason: string;
  severity: "low" | "medium" | "high";
  timestamp: string;
}

interface PermissionDialogProps {
  permissionData: PermissionData;
  onApprove: () => void;
  onDeny: () => void;
  isVisible: boolean;
}

export default function PermissionDialog({
  permissionData,
  onApprove,
  onDeny,
  isVisible,
}: PermissionDialogProps) {
  if (!isVisible) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-50 border-red-200 text-red-800";
      case "medium":
        return "bg-yellow-50 border-yellow-200 text-yellow-800";
      case "low":
        return "bg-green-50 border-green-200 text-green-800";
      default:
        return "bg-gray-50 border-gray-200 text-gray-800";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "high":
        return "🚨";
      case "medium":
        return "⚠️";
      case "low":
        return "ℹ️";
      default:
        return "❓";
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            🤖 Permission Required
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            The AI assistant needs your approval to proceed
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Action */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Requested Action
            </h3>
            <p className="text-gray-700 bg-blue-50 p-3 rounded-lg">
              {permissionData.action}
            </p>
          </div>

          {/* Command (if provided) */}
          {permissionData.command && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Command</h3>
              <code className="block bg-gray-900 text-green-400 p-3 rounded-lg text-sm font-mono">
                $ {permissionData.command}
              </code>
            </div>
          )}

          {/* Reason */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Why This is Needed
            </h3>
            <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
              {permissionData.reason}
            </p>
          </div>

          {/* Risk Assessment */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              Risk Assessment
              <span
                className={`text-xs px-2 py-1 rounded-full border ${getSeverityColor(
                  permissionData.severity
                )}`}
              >
                {getSeverityIcon(permissionData.severity)}{" "}
                {permissionData.severity.toUpperCase()}
              </span>
            </h3>
            <div
              className={`p-3 rounded-lg border-l-4 ${getSeverityColor(
                permissionData.severity
              ).replace("border-", "border-l-")}`}
            >
              <p className="text-gray-700">{permissionData.risks}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
          <button
            onClick={onDeny}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
          >
            ❌ Deny
          </button>
          <button
            onClick={onApprove}
            className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium"
          >
            ✅ Approve
          </button>
        </div>
      </div>
    </div>
  );
}
