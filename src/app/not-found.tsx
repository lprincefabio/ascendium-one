import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <Image src="/brand/ascendium-logo.png" alt="Ascendium Global Holdings" width={160} height={48} priority />
      <h1 className="font-display mt-6 text-3xl font-semibold text-navy-deep dark:text-white">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
        The record you are looking for does not exist, or sits outside your authorised institutional scope.
      </p>
      <Link href="/" className="btn-primary mt-6">Return to the Executive Dashboard</Link>
    </div>
  );
}
