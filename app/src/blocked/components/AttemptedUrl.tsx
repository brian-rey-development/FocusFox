import type { AttemptedUrlProps } from '../types';

const MAX_CHARS = 60;

export function AttemptedUrl({ url }: AttemptedUrlProps) {
  const truncated = url.length > MAX_CHARS ? url.slice(0, MAX_CHARS) + '...' : url;

  return (
    <span className="attempted-url" title={url}>
      {truncated}
    </span>
  );
}
