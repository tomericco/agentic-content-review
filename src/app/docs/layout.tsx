import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "API reference for amend: upload content for human review, poll for a decision summary, and receive the result via webhook.",
  alternates: {
    canonical: "/docs",
  },
  openGraph: {
    title: "Documentation",
    description:
      "API reference for amend: upload content for human review, poll for a decision summary, and receive the result via webhook.",
    url: "/docs",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
