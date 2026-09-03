import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LoadingScreen } from '../src/components/ui/LoadingScreen';

export default function Index() {
  return (
    <View style={styles.container}>
      <LoadingScreen message="Connecting to CallMedex Healthcare Cloud..." />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
