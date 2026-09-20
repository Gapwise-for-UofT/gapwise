import { createFileRoute } from "@tanstack/react-router";
import { normalizePublicBuildingCode } from "@/data/utm/building-registry";

export function validateRouteSearch(search: Record<string, unknown>) {
  const rawBuilding = search["building"];
  const building = normalizePublicBuildingCode(rawBuilding) ?? undefined;
  return building ? { building } : {};
}

export const Route = createFileRoute("/_app/route/")({
  validateSearch: validateRouteSearch,
  head: () => ({
    meta: [
      { title: "Campus Route — Gapwise" },
      {
        name: "description",
        content:
          "Explore University of Toronto campus buildings and review route-aware transitions where supported.",
      },
    ],
  }),
  component: RouteBoundary,
});

function RouteBoundary() {
  return null;
}
