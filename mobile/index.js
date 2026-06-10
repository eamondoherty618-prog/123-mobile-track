import { registerRootComponent } from 'expo';
import React from 'react';
import { View, Text } from 'react-native';

class TopBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(e) {
    return { error: e?.message || String(e) };
  }
  render() {
    if (this.state.error) {
      return React.createElement(View,
        { style: { flex: 1, backgroundColor: '#8b0000', padding: 32, paddingTop: 80 } },
        React.createElement(Text, { style: { color: '#fff', fontSize: 14, fontWeight: 'bold' } }, 'Error'),
        React.createElement(Text, { style: { color: '#fcc', fontSize: 12, marginTop: 8 } }, this.state.error)
      );
    }
    return this.props.children;
  }
}

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
  registerRootComponent(() => React.createElement(View,
    { style: { flex: 1, backgroundColor: '#8b0000', padding: 32, paddingTop: 80 } },
    React.createElement(Text, { style: { color: '#fff', fontSize: 12 } }, 'Import error: ' + importErr)
  ));
} else {
  function App() {
    return React.createElement(TopBoundary, null,
      React.createElement(ExpoRoot, { context: ctx })
    );
  }
  registerRootComponent(App);
}
