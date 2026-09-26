import { createFileRoute } from "@tanstack/react-router";
import { activeUniversity } from "@/universities/registry";

export const Route = createFileRoute("/_app/")({
  head: () => {
    const university = activeUniversity();
    const isRootHost = !university || university.id === "uoft";
    const title = isRootHost
      ? "Gapwise — University Timetable & Campus Navigation"
      : `Gapwise — ${university?.name ?? "Campus timetable"}`;
    const description = isRootHost
      ? "Gapwise is a free and open-source timetable, campus navigation, and student planning platform for students across multiple Canadian universities."
      : `Gapwise is a free and open-source timetable, campus navigation, and student planning platform for ${university.name} students.`;
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
