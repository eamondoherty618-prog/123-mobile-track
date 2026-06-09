// Custom entry: wraps expo-router in a top-level error boundary.
// If the app crashes on startup you'll see a red screen with the exact error.
import { registerRootComponent } from 'expo';
import React from 'react';
import { View, Text, ScrollView } from 'react-native';

// --- Capture global / fatal errors before anything else loads ---
const _errors = [];
try {
  const origHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((err, isFatal) => {
    const msg = (isFatal ? 'FATAL: ' : 'ERR: ') + (err?.message || String(err));
    if (!_errors.includes(msg)) _errors.push(msg);
    origHandler(err, isFatal);
  });
} catch (_) {}

function ErrorScreen({ msg }) {
  return React.createElement(
    View,
    { style: { flex: 1, backgroundColor: '#8b0000', padding: 32, paddingTop: 80 } },
    React.createElement(Text, { style: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginBottom: 10 } }, 'Startup Crash (build 19)'),
    React.createElement(Text, { style: { color: '#fcc', fontSize: 12, marginBottom: 8 } }, msg || '(no message)'),
    ..._errors.slice(0, 4).map((e, i) =>
      React.createElement(Text, { key: i, style: { color: '#faa', fontSize: 10, marginTop: 4 } }, e)
    )
  );
}

// --- Top-level error boundary wraps the entire expo-router tree ---
class TopBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(e) {
    return { error: e?.message || String(e) };
  }
  render() {
    if (this.state.error) {
      return React.createElement(ErrorScreen, { msg: this.state.error });
    }
    return this.props.children;
  }
}

// --- Try to import expo-router ---
let ExpoRoot = null;
let ctx = null;
let importErr = null;
try {
  ExpoRoot = require('expo-router').ExpoRoot;
  ctx = require('expo-router/_ctx').ctx;
} catch (e) {
  importErr = e?.message || String(e);
}

if (importErr || !ExpoRoot) {
  registerRootComponent(() => React.createElement(ErrorScreen, { msg: 'Import error: ' + importErr }));
} else {
  function App() {
    return React.createElement(
      TopBoundary,
      null,
      React.createElement(ExpoRoot, { context: ctx })
    );
  }
  registerRootComponent(App);
}
