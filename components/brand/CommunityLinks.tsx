import { COMMUNITY } from "@/lib/community";
import { cn } from "@/lib/cn";

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M21.8 4.3 3.4 11.4c-1.3.5-1.2 1.2-.2 1.5l4.6 1.4 1.8 5.4c.2.6.4.8 1 .8.6 0 .9-.3 1.2-.6l2.7-2.6 4.6 3.4c.8.5 1.4.2 1.6-.8L23 5.6c.3-1.2-.5-1.7-1.2-1.3ZM9.3 14.5l-.3 3.5 2.8-2.7L17 9.2z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M17.6 3H20.5L13.9 10.5 21.7 21H15.7L10.9 14.7 5.5 21H2.6L9.7 12.9 2.2 3H8.4L12.7 8.7 17.6 3ZM16.6 19.2H18.2L7.5 4.7H5.8L16.6 19.2Z" />
    </svg>
  );
}

const linkClass =
  "inline-flex size-8 items-center justify-center rounded-xs border border-line-strong text-brass-400 transition-colors sm:size-9 " +
  "hover:border-tape/60 hover:bg-tape/8 hover:text-tape " +
  "focus-visible:border-tape focus-visible:text-tape";

export function CommunityLinks({
  className,
  density = "icons",
}: {
  className?: string;
  density?: "icons" | "labeled";
}) {
  return (
    <nav aria-label="Community" className={cn("flex items-center gap-2", className)}>
      <a
        href={COMMUNITY.telegram.href}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={COMMUNITY.telegram.label}
        title={COMMUNITY.telegram.label}
        className={linkClass}
      >
        <TelegramIcon className="size-4" />
        {density === "labeled" ? (
          <span className="sr-only">{COMMUNITY.telegram.label}</span>
        ) : null}
      </a>
      <a
        href={COMMUNITY.x.href}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={COMMUNITY.x.label}
        title={COMMUNITY.x.label}
        className={linkClass}
      >
        <XIcon className="size-4" />
        {density === "labeled" ? (
          <span className="sr-only">{COMMUNITY.x.label}</span>
        ) : null}
      </a>
    </nav>
  );
}
