import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

// `cn` combines class names using `clsx` then merges Tailwind classes via `tailwind-merge`.
// This mirrors the utility used by shadcn/RaidGuild components.
export function cn(...inputs: Array<string | false | null | undefined>) {
  return twMerge(clsx(...inputs));
}

export default cn;
