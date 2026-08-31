import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { cx } from "@/lib/utils";

/** Contextual "How-to" help link in page headers → the matching doc guide. */
export default function DocLink({
  docId,
  label = "How-to",
  className,
}: {
  docId: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      to={`/docs/${docId}`}
      title={`Open the "${label}" guide`}
      className={cx("btn-ghost text-sm px-3 py-1.5", className)}
    >
      <BookOpen size={14} className="mr-1 inline" /> {label}
    </Link>
  );
}