import { registerRootComponent } from 'expo';
import React from 'react';
import { View, Text } from 'react-native';

function App() {
  return React.createElement(
    View,
    { style: { flex: 1, backgroundColor: 'red', alignItems: 'center', justifyContent: 'center' } },
    React.createElement(Text, { style: { color: 'white', fontSize: 28, fontWeight: 'bold' } }, 'BUILD 22 WORKS')
  );
}

registerRootComponent(App);
