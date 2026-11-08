"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class SectionErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[SectionErrorBoundary] Error caught in section ${this.props.name || "unnamed"}:`,
      error,
      errorInfo
    );
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Non-intrusive fallback: does not break the layout or take down the whole page
      return (
        <div className="w-full py-8 text-center text-text-tertiary text-xs">
          <span>This section is temporarily unavailable.</span>
        </div>
      );
    }

    return this.props.children;
  }
}

