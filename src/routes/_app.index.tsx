import { createFileRoute } from "@tanstack/react-router";
import { activeUniversity } from "@/universities/registry";

export const Route = createFileRoute("/_app/")({
  head: () => {
    const university = activeUniversity();
    const title = `Gapwise — ${university?.name ?? "Campus timetable"}`;
    const description = `Plan ${university?.name ?? "campus"} timetables, useful gaps, and source-backed campus routes in one precise workspace.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: RouteBoundary,
});

function RouteBoundary() {
  return null;
}
