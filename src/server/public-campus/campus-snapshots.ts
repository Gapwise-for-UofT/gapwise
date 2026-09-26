import type { CampusSnapshot } from "../../data/campuses/contract.js";
import brockSnapshot from "../../data/campuses/brock/campus.json";
import carletonSnapshot from "../../data/campuses/carleton/campus.json";
import guelphSnapshot from "../../data/campuses/guelph/campus.json";
import laurierSnapshot from "../../data/campuses/laurier/campus.json";
import mcmasterSnapshot from "../../data/campuses/mcmaster/campus.json";
import queensSnapshot from "../../data/campuses/queens/campus.json";
import tmuSnapshot from "../../data/campuses/tmu/campus.json";
import uottawaSnapshot from "../../data/campuses/uottawa/campus.json";
import westernSnapshot from "../../data/campuses/western/campus.json";
import yorkSnapshot from "../../data/campuses/york/campus.json";

export const CAMPUS_SNAPSHOTS: Record<string, CampusSnapshot> = {
  brock: brockSnapshot as unknown as CampusSnapshot,
  carleton: carletonSnapshot as unknown as CampusSnapshot,
  guelph: guelphSnapshot as unknown as CampusSnapshot,
  laurier: laurierSnapshot as unknown as CampusSnapshot,
  waterloo: laurierSnapshot as unknown as CampusSnapshot,
  mcmaster: mcmasterSnapshot as unknown as CampusSnapshot,
  queens: queensSnapshot as unknown as CampusSnapshot,
  tmu: tmuSnapshot as unknown as CampusSnapshot,
  uottawa: uottawaSnapshot as unknown as CampusSnapshot,
  western: westernSnapshot as unknown as CampusSnapshot,
  york: yorkSnapshot as unknown as CampusSnapshot,
  keele: yorkSnapshot as unknown as CampusSnapshot,
};

export function getCampusSnapshot(campusId: string): CampusSnapshot | null {
  return CAMPUS_SNAPSHOTS[campusId.toLowerCase()] ?? null;
}
