type Props = {
  count?: number;
};

export function EventCardSkeletonGrid({ count = 4 }: Props) {
  return (
    <div className="events-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="event-card event-card-skeleton">
          <div className="skeleton-line skeleton-line-sm" />
          <div className="skeleton-line skeleton-line-lg" />
          <div className="skeleton-line skeleton-line-md" />
          <div className="skeleton-row">
            <div className="skeleton-line skeleton-line-sm" />
            <div className="skeleton-line skeleton-line-sm" />
          </div>
          <div className="skeleton-row">
            <div className="skeleton-pill" />
            <div className="skeleton-pill" />
            <div className="skeleton-pill" />
          </div>
        </div>
      ))}
    </div>
  );
}
