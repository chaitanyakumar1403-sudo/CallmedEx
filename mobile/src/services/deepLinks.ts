/**
 * CallMedex Deep Linking & Universal Links Service
 */
import { Linking } from 'react-native';
import { router } from 'expo-router';

export interface ParsedDeepLink {
  route: string;
  params: Record<string, string>;
}

export const deepLinkService = {
  /**
   * Parse an incoming deep link URL (e.g. callmedex://consultation/cons_123 or https://app.callmedex.com/reports/rep_456)
   */
  parseUrl(url: string): ParsedDeepLink | null {
    if (!url) return null;

    try {
      // Handle callmedex://path?query or https://domain/path?query
      const normalized = url.replace(/^[a-zA-Z]+:\/\//, '');
      const parts = normalized.split('?');
      const route = parts[0] || '';
      const queryString = parts[1] || '';

      const params: Record<string, string> = {};
      if (queryString) {
        queryString.split('&').forEach((pair) => {
          const [k, v] = pair.split('=');
          if (k) {
            params[decodeURIComponent(k)] = decodeURIComponent(v || '');
          }
        });
      }

      return {
        route,
        params,
      };
    } catch {
      return null;
    }
  },

  /**
   * Navigate safely to deep link destination
   */
  handleIncomingUrl(url: string) {
    const parsed = this.parseUrl(url);
    if (!parsed) return;

    const { route } = parsed;

    if (route.includes('consultation') || route.includes('appointments')) {
      router.push('/(patient)/appointments');
    } else if (route.includes('reports')) {
      router.push('/(patient)/reports');
    } else if (route.includes('records') || route.includes('prescriptions')) {
      router.push('/(patient)/records');
    } else if (route.includes('pharmacy')) {
      router.push('/(pharmacy)/queue');
    } else if (route.includes('tasks') || route.includes('phlebo')) {
      router.push('/(phlebotomist)/tasks');
    }
  },

  /**
   * Generate a sharable consultation or emergency deep link
   */
  createConsultationLink(consultationId: string): string {
    return `callmedex://consultation/${consultationId}`;
  },

  createReportLink(reportId: string): string {
    return `callmedex://reports/${reportId}`;
  },
};
