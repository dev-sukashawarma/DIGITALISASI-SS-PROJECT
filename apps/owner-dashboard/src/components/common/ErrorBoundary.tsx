'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-suka-cream p-4">
          <div className="bg-white border-2 border-suka-brown rounded-lg p-6 max-w-md">
            <h1 className="text-2xl font-bold text-suka-brown mb-2">Oops!</h1>
            <p className="text-suka-gray-600 mb-4">Terjadi kesalahan. Silakan refresh halaman.</p>
            <p className="text-sm text-red-600 font-mono break-all">
              {this.state.error?.message || 'Unknown error'}
            </p>
            <button
              className="mt-4 px-4 py-2 bg-suka-orange text-white rounded-md hover:bg-orange-600"
              onClick={() => window.location.reload()}
            >
              Refresh
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
