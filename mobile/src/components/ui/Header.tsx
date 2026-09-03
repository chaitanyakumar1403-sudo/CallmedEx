import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  transparent?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onBack,
  showBack,
  rightAction,
  transparent = false,
}) => {
  const { themeColors, isDark } = useTheme();
  const router = useRouter();

  const handleBackPress = onBack || (showBack ? () => router.back() : undefined);

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: transparent
            ? 'transparent'
            : isDark
            ? themeColors.headerBackground
            : themeColors.primary.DEFAULT,
        },
      ]}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={
          transparent
            ? 'transparent'
            : isDark
            ? themeColors.headerBackground
            : themeColors.primary.DEFAULT
        }
      />
      <View style={styles.container}>
        <View style={styles.leftSection}>
          {handleBackPress ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleBackPress}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.backText}>‹</Text>
            </TouchableOpacity>
          ) : null}
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {rightAction ? <View style={styles.rightSection}>{rightAction}</View> : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    width: '100%',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    height: spacing.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: spacing.sm,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 28,
    fontWeight: '300',
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.bold,
  },
  subtitle: {
    color: '#00D4B2',
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.medium,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
