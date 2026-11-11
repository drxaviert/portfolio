import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function Home() {
  return (
    <main className="min-h-screen bg-surface px-6 py-10 text-on-surface">
      <h1 className="text-2xl font-medium">Portfolio</h1>
      <div className="mt-6">
        <ThemeToggle />
      </div>
    </main>
  );
}
