import { Component } from "react";
import { reportComponentCrash } from "../services/errorReporterService";

/**
 * Catches React render/lifecycle errors, reports them to the backend,
 * and shows a fallback UI so the app doesn't go blank.
 */
class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    reportComponentCrash(
      error,
      info?.componentStack,
      window.location.pathname
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: "60vh", padding: "24px", textAlign: "center",
        }}>
          <h2 style={{ fontSize: "20px", marginBottom: "12px", color: "#333" }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: "14px", color: "#666", marginBottom: "20px", maxWidth: "360px" }}>
            We've recorded this issue and will fix it soon. Please try again.
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: "10px 24px", fontSize: "14px", borderRadius: "8px",
              border: "none", background: "#007BFF", color: "#fff", cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
