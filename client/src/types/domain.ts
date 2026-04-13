/**
 * Shared client-side types for API payloads and UI state.
 * Keeps calculations and views aligned with backend field names.
 */

export type TimelineViewMode = 'Day' | 'Week' | 'Month';

export interface TimelineBarLayout {
  left: number;
  width: number;
}

export interface ApiErrorPayload {
  error?: {
    code: string;
    message: string;
    request_id: string;
  };
  detail?: string | unknown;
}
