import api from '../api/client';
import { useData } from '../context/DataContext';
import { useApiResource } from './useApiResource';
import { windowDateFrom } from '../utils/smsReview';

const TO_REVIEW_STATUSES = ['pending', 'parsed', 'failed'];

// Same window as /sms/review?since=30, so the count matches what that page
// shows. Older never-parsed SMS (backfills) would otherwise pin it at 99+.
export const SMS_REVIEW_WINDOW = '30';

/** SMS waiting for review in the last 30 days (dashboard nudge, mobile nav badge). */
export function useSmsReviewCount() {
  const { dataVersion } = useData();
  const { data } = useApiResource(() => {
    const params = new URLSearchParams({ page_size: '1', date_from: windowDateFrom(SMS_REVIEW_WINDOW) });
    for (const s of TO_REVIEW_STATUSES) params.append('status', s);
    return api.getSMSMessages(params);
  }, [dataVersion ?? 0]);
  return data?.count ?? 0;
}
