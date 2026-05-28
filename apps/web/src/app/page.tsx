import Link from "next/link";

const sections = [
  {
    href: "/live",
    title: "Live",
    description: "Watch calls happening in real time as the AI talks to callers.",
  },
  {
    href: "/calls",
    title: "Calls",
    description: "Call history: who called, when, how long, and what happened.",
  },
  {
    href: "/analytics",
    title: "Analytics",
    description: "Aggregate stats: call volume, average duration, booking conversion.",
  },
];

export default function Home() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-2">AI Receptionist Dashboard</h1>
      <p className="text-foreground/60 mb-8">
        Live calls, call history, and booking analytics for the AI voice receptionist.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="block rounded-lg border border-foreground/10 p-4 hover:border-foreground/30 transition-colors"
          >
            <h2 className="font-semibold mb-1">{section.title}</h2>
            <p className="text-sm text-foreground/60">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
