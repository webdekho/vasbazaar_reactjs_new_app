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
        <div className="cm-crash-screen">
          <div className="cm-crash-icon">!</div>
          <h2 className="cm-crash-title">Something went wrong</h2>
          <p className="cm-crash-msg">
            We've recorded this issue and are working on it. Please try again.
          </p>
          <button className="cm-crash-btn" type="button" onClick={this.handleRetry}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
