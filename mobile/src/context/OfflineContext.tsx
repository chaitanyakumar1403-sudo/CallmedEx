import React, { createContext, useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { offlineSyncService } from '../services/offlineSync';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface OfflineContextType {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
  setIsOnline: (online: boolean) => void;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshPendingCount = async () => {
    const queue = await offlineSyncService.getPendingQueue();
    setPendingCount(queue.length);
  };

  const syncNow = async () => {
    if (isSyncing || !isOnline) return;
    setIsSyncing(true);
    try {
      await offlineSyncService.processQueue();
      await refreshPendingCount();
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        pendingCount,
        isSyncing,
        syncNow,
        setIsOnline,
      }}
    >
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            ⚡ Offline Mode — Changes saved locally ({pendingCount} pending)
          </Text>
          <TouchableOpacity onPress={syncNow} disabled={isSyncing}>
            <Text style={styles.syncText}>{isSyncing ? 'Syncing...' : 'Sync'}</Text>
          </TouchableOpacity>
        </View>
      )}
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  offlineBanner: {
    backgroundColor: '#E63946',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingVertical: 8,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  offlineText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.bold,
  },
  syncText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.bold,
    textDecorationLine: 'underline',
  },
});
