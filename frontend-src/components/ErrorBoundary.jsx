import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * Catches render errors so a single broken component can never blank the whole
 * app. Before this existed, any thrown error — including a chunk that failed to
 * download after a deploy — left the user staring at an empty screen with no
 * explanation and no way forward except a manual refresh.
 *
 * A stale-chunk error is recoverable, so it offers a reload as the primary
 * action. Anything else shows the real message plus a way back home.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep this: it is the only trace of a production render failure.
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    // Navigating away from a broken screen should clear the error.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const msg = String(error?.message || '');
    const isStale = error?.name === 'ChunkLoadError' ||
      /Loading chunk|dynamically imported module|Importing a module script failed/i.test(msg);

    return (
      <div className="flex items-center justify-center min-h-[60vh] px-6">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} className="text-yellow-400" />
          </div>

          <h2 className="text-white text-lg font-semibold mb-2">
            {isStale ? 'A new version is available' : 'Something went wrong on this screen'}
          </h2>
          <p className="text-gray-400 text-sm mb-5">
            {isStale
              ? 'The app was updated while you had it open. Reload to get the latest version — your work is not affected.'
              : 'This screen hit an error. The rest of the app is still fine, so you can go back and carry on.'}
          </p>

          {!isStale && msg && (
            <p className="text-gray-600 text-xs font-mono mb-5 break-words">{msg.slice(0, 200)}</p>
          )}

          <div className="flex gap-2 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#3572b9] to-[#38b6ff] text-white text-sm font-medium inline-flex items-center gap-2"
            >
              <RefreshCw size={14} /> Reload
            </button>
            {!isStale && (
              <button
                onClick={() => { this.setState({ error: null }); window.location.href = '/'; }}
                className="px-4 py-2 rounded-xl border border-white/10 text-white text-sm hover:bg-white/5 inline-flex items-center gap-2"
              >
                <Home size={14} /> Home
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
