import { BookOpen } from "lucide-react";
import { cx } from "@/lib/utils";

/** Contextual help link in page headers → the matching doc guide. Always reads
 *  "Learn more" — `label` (if passed) only sets the hover title for context.
 *
 *  Opens in a new tab: several places render this inside a modal or drawer
 *  (e.g. the pentest agent's agreement dialog), and a same-tab route change
 *  just navigates the guide in behind whatever overlay is still open. A new
 *  tab sidesteps that entirely and also leaves the original page — agreement
 *  still unaccepted, form still filled in — untouched. */
export default function DocLink({
  docId,
  label = "Learn more",
  className,
}: {
  docId: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={`/docs/${docId}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open the "${label}" guide in a new tab`}
      className={cx("btn-ghost text-sm px-3 py-1.5", className)}
    >
      <BookOpen size={14} className="mr-1 inline" /> Learn more
    </a>
  );
}