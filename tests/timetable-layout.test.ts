import { describe, expect, test } from "bun:test";
import {
  buildTimetableScale,
  getTimetableCardLayout,
  isCompactMeetingCard,
} from "@/lib/timetable-layout";
import { meeting } from "./fixtures";

describe("timetable card layout", () => {
  test("uses compact content for one-hour and overlapping cards", () => {
    expect(isCompactMeetingCard(meeting(), 1)).toBe(true);
    expect(isCompactMeetingCard(meeting({ endTime: 660 }), 1)).toBe(false);
    expect(isCompactMeetingCard(meeting({ endTime: 660 }), 2)).toBe(true);
  });

  test("computes adaptive density and information hierarchy based on height and lanes", () => {
    // 2-hour class (132px), single lane -> full density with title and full detail
    const fullLayout = getTimetableCardLayout(132, 1);
    expect(fullLayout.density).toBe("full");
    expect(fullLayout.widthMode).toBe("normal");
    expect(fullLayout.showIcon).toBe(true);
    expect(fullLayout.showTitle).toBe(true);
    expect(fullLayout.inlineTimeLocation).toBe(false);

    // 1-hour class (66px), single lane -> compact density (title hidden first, time and room separate)
    const compactLayout = getTimetableCardLayout(66, 1);
    expect(compactLayout.density).toBe("compact");
    expect(compactLayout.widthMode).toBe("normal");
    expect(compactLayout.showIcon).toBe(true);
    expect(compactLayout.showTitle).toBe(false);
    expect(compactLayout.inlineTimeLocation).toBe(false);

    // 50-minute class (55px), single lane -> dense density (title hidden, time · room combined on 1 line)
    const denseLayout = getTimetableCardLayout(55, 1);
    expect(denseLayout.density).toBe("dense");
    expect(denseLayout.widthMode).toBe("normal");
    expect(denseLayout.showIcon).toBe(true);
    expect(denseLayout.showTitle).toBe(false);
    expect(denseLayout.inlineTimeLocation).toBe(true);

    // 30-minute class (33px), single lane -> micro density (compact badge, time · room on 1 line)
    const microLayout = getTimetableCardLayout(33, 1);
    expect(microLayout.density).toBe("micro");
    expect(microLayout.widthMode).toBe("normal");
    expect(microLayout.showIcon).toBe(false);
    expect(microLayout.showTitle).toBe(false);
    expect(microLayout.inlineTimeLocation).toBe(true);
    expect(microLayout.compactTime).toBe(true);
    expect(microLayout.compactBadge).toBe(true);

    // 2-lane overlapping 1-hour class (66px) -> dense density
    const twoLaneLayout = getTimetableCardLayout(66, 2);
    expect(twoLaneLayout.density).toBe("dense");
    expect(twoLaneLayout.widthMode).toBe("compact");
    expect(twoLaneLayout.showIcon).toBe(false);
    expect(twoLaneLayout.inlineTimeLocation).toBe(true);
    expect(twoLaneLayout.compactBadge).toBe(true);

    // 3-lane overlapping 2-hour class (132px) -> compact density (never full because narrow)
    const threeLaneLayout = getTimetableCardLayout(132, 3);
    expect(threeLaneLayout.density).toBe("compact");
    expect(threeLaneLayout.widthMode).toBe("narrow");
    expect(threeLaneLayout.showIcon).toBe(false);
    expect(threeLaneLayout.showTitle).toBe(false);
  });

  test("compresses only consecutive globally empty hours without shrinking classes", () => {
    const hours = Array.from({ length: 14 }, (_, index) => index + 8);
    const meetings = [
      meeting({ startTime: 540, endTime: 660 }),
      meeting({ id: "evening", startTime: 1140, endTime: 1260 }),
    ];
    const scale = buildTimetableScale(hours, meetings, true, 60, 20);

    expect(scale.compactableHours.has(8)).toBe(false);
    expect(scale.compactableHours.has(12)).toBe(true);
    expect(scale.hourHeights.get(12)).toBe(20);
    expect(scale.minuteToTop(660) - scale.minuteToTop(540)).toBe(120);
    expect(scale.minuteToTop(1140)).toBeLessThan((1140 - 480) * 1);
  });
});
