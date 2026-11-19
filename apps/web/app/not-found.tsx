import { buttonVariants } from "@/components/ui/button";

/** A real 404: readable in every theme, with a way back. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">This page could not be found</h1>
      <a className={buttonVariants()} href="/">
        Back to sur.plus
      </a>
    </main>
  );
}
