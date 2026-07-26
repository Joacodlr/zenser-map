import { z } from "zod";
import { MAX_BBOX_AREA_KM2, MIN_BBOX_DELTA_DEG } from "@/lib/config";

// Approx km^2 for a small WGS84 bbox around Madrid latitude (~40.4N).
function bboxAreaKm2([minLng, minLat, maxLng, maxLat]: number[]): number {
  const midLat = (minLat + maxLat) / 2;
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos((midLat * Math.PI) / 180);
  return Math.abs(maxLat - minLat) * kmPerDegLat * Math.abs(maxLng - minLng) * kmPerDegLng;
}

export const bboxSchema = z
  .string()
  .transform((s, ctx) => {
    const parts = s.split(",").map((p) => Number(p.trim()));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "bbox must be 'minLng,minLat,maxLng,maxLat'" });
      return z.NEVER;
    }
    return parts as [number, number, number, number];
  })
  .superRefine((bbox, ctx) => {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    if (minLng >= maxLng || minLat >= maxLat) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "min must be < max" });
      return;
    }
    if (Math.abs(maxLng - minLng) < MIN_BBOX_DELTA_DEG || Math.abs(maxLat - minLat) < MIN_BBOX_DELTA_DEG) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "bbox too small" });
      return;
    }
    if (bboxAreaKm2(bbox) > MAX_BBOX_AREA_KM2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "BBOX_TOO_LARGE" });
    }
  });

export const solarInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  installedPowerKw: z.number().positive().max(10000),
  tilt: z.number().min(0).max(90).default(30),
  azimuth: z.number().min(-180).max(180).default(0),
  technology: z.enum(["crystSi", "CIS", "CdTe", "Unknown"]).default("crystSi"),
  systemLossPct: z.number().min(0).max(50).optional(),
});

export type SolarInputParsed = z.infer<typeof solarInputSchema>;
