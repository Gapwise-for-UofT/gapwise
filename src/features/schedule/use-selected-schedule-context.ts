import { useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import {
  createScheduleTransitionPlanner,
  type TransitionPlanner,
} from "@/features/routing/transition";
import { activeUniversity } from "@/universities/registry";
import { chooseDefaultTerm } from "@/lib/calendar-awareness";
import { findGaps } from "@/lib/gaps";
import { availableScheduleTerms, composeTermSchedule } from "@/lib/personal-scheduler";
import type { Meeting, Term } from "@/lib/timetable-types";

const EMPTY_MEETINGS: Meeting[] = [];

/** Owns the selected-term facts shared by responsive timetable, Today, and gap views. */
export function useSelectedScheduleContext(meetings: Meeting[] | null) {
  const university = activeUniversity();
  const universityId = university?.id;
  const isOutdoorCampus = Boolean(
    universityId && universityId !== "uoft" && university?.enabledFeatures.routing,
  );
  const [outdoorPlanner, setOutdoorPlanner] = useState<TransitionPlanner | null>(null);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [term, setTerm] = useState<Term>("Fall");
  const terms = useMemo(() => availableScheduleTerms(meetings ?? EMPTY_MEETINGS), [meetings]);
  const todayRoute = pathname.replace(/\/+$/, "") === "/today";

  useEffect(() => {
    if (terms.length > 0 && !terms.includes(term)) setTerm(terms[0]!);
  }, [terms, term]);

  useEffect(() => {
    if (meetings?.length) setTerm(chooseDefaultTerm(meetings, new Date()));
  }, [meetings]);

  useEffect(() => {
    if (todayRoute && meetings?.length) setTerm(chooseDefaultTerm(meetings, new Date()));
  }, [meetings, todayRoute]);

  useEffect(() => {
    if (!isOutdoorCampus || !universityId) {
      setOutdoorPlanner(null);
      return;
    }
    let current = true;
    void import("@/features/routing/carleton-transition").then(
      ({ getOutdoorCampusTransitionPlanner }) => {
        getOutdoorCampusTransitionPlanner(universityId).then((planner) => {
          if (current) setOutdoorPlanner(() => planner);
        });
      },
    );
    return () => {
      current = false;
    };
  }, [isOutdoorCampus, universityId]);

  const schedule = useMemo(
    () => composeTermSchedule(meetings ?? EMPTY_MEETINGS, [], term),
    [meetings, term],
  );
  const gaps = useMemo(() => findGaps(schedule, term), [schedule, term]);
  const planTransition = useMemo(
    () =>
      isOutdoorCampus
        ? (outdoorPlanner ??
          (() => ({
            status: "unavailable" as const,
            message: "Campus routes are loading.",
            accuracy: "Location unavailable" as const,
            result: null,
            displayCoordinates: [],
            warnings: [],
            approximateDistanceMeters: null,
            approximateSeconds: null,
          })))
        : createScheduleTransitionPlanner(UTM_ROUTING_GRAPH, meetings ?? EMPTY_MEETINGS),
    [meetings, isOutdoorCampus, outdoorPlanner],
  );

  return { term, setTerm, terms, schedule, gaps, planTransition };
}
