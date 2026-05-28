'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  tabName?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class TabErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  override componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[TabErrorBoundary]', error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      const tab = this.props.tabName ?? 'tab';
      return (
        <div style={{
          padding: '24px 20px',
          background: '#f0f2f5',
          borderRadius: 6,
          border: '1px solid #d0d5de',
          color: '#1a2940',
          fontSize: 13,
          maxWidth: 480,
          margin: '32px auto',
        }}>
          <strong style={{ display: 'block', marginBottom: 6 }}>
            Something went wrong rendering the &ldquo;{tab}&rdquo; tab.
          </strong>
          {this.state.message && (
            <code style={{ display: 'block', marginBottom: 12, fontSize: 11, color: '#555', wordBreak: 'break-all' }}>
              {this.state.message}
            </code>
          )}
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            style={{
              padding: '6px 14px',
              background: '#1a2940',
              color: '#fff',
              border: 'none',
              borderRadius: 3,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Reload tab
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
