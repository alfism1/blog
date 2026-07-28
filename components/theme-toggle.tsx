"use client";

import * as React from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

const ORDER = ["system", "light", "dark"] as const;

const LABELS: Record<(typeof ORDER)[number], string> = {
  system: "system",
  light: "light",
  dark: "dark",
};

/**
 * Cycles system → light → dark. Renders a stable placeholder until mounted
 * because the resolved theme is unknown during SSR.
 */
const noopSubscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  // Hydration-safe "am I on the client yet?" without a setState-in-effect:
  // the server snapshot is `false`, the client snapshot `true`.
  const mounted = React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const current = (theme ?? "system") as (typeof ORDER)[number];
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];

  const Icon =
    !mounted || current === "system"
      ? MonitorIcon
      : current === "light"
        ? SunIcon
        : MoonIcon;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={
        mounted
          ? `Theme: ${LABELS[current]}. Switch to ${LABELS[next]}.`
          : "Toggle theme"
      }
      title="Toggle theme"
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}
