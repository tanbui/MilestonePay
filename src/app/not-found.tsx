import Link from "next/link";
import { buttonClass } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-3 px-6 py-24">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="text-[13px] text-muted">
        That project or milestone doesn&apos;t exist. If you&apos;re using mock data, it may have been reset when the server restarted.
      </p>
      <Link href="/" className={buttonClass("primary")}>
        Back to overview
      </Link>
    </div>
  );
}
