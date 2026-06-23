import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding: '20px', color: 'white', backgroundColor: 'red', minHeight: '100vh', wordWrap: 'break-word'}}>
          <h1 style={{fontSize: '24px', fontWeight: 'bold'}}>Something went wrong.</h1>
          <pre style={{whiteSpace: 'pre-wrap', marginTop: '10px'}}>{this.state.error?.toString()}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
