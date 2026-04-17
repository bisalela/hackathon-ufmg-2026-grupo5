import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Unexpected application error.",
    };
  }

  componentDidCatch(error) {
    console.error("AppErrorBoundary caught an error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-shell flex min-h-screen items-center justify-center bg-black px-6">
          <div className="glass-panel max-w-2xl rounded-[2rem] p-8">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-300">
              Runtime Error
            </p>
            <h1 className="mt-4 text-3xl font-semibold text-white">
              The interface hit a client-side error.
            </h1>
            <p className="mt-4 text-base leading-8 text-slate-200">
              {this.state.message}
            </p>
            <p className="mt-4 text-sm text-yellow-200">
              Refresh the page after the latest code reload. If this persists,
              the specific error text above is the next thing to fix.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
