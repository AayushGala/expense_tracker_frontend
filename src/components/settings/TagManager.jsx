import { useMemo } from 'react';
import Card from '../common/Card';
import api from '../../api/client';
import { useApiResource } from '../../hooks/useApiResource';
import { useData } from '../../context/DataContext';

export default function TagManager() {
  // Tags + usage counts are derived server-side from the transactions table.
  const { dataVersion } = useData();
  const { data } = useApiResource(() => api.getTagCounts(), [dataVersion ?? 0]);

  const tagRows = data ?? [];
  const tags = useMemo(() => tagRows.map((r) => r.tag), [tagRows]);
  const tagCounts = useMemo(
    () => new Map(tagRows.map((r) => [r.tag, r.count])),
    [tagRows],
  );

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="pb-3 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-800">Tags</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Tags are derived automatically from your transactions.
          </p>
        </div>
        {tags.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 mt-2">
            No tags found. Add tags to transactions using comma-separated values.
          </p>
        ) : (
          <>
            <div className="mt-3"></div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <div
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-light ring-1 ring-accent/30"
                >
                  <span className="text-sm text-brand font-semibold">{tag}</span>
                  <span className="text-[11px] text-accent font-medium">
                    x{tagCounts.get(tag) ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
