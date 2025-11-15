import { z } from "zod";

export const CoordinateSchema = z.tuple([z.number(), z.number()]);
export type Coordinate = z.infer<typeof CoordinateSchema>;

export const PlaceSchema = z.object({
  name: z.string(),
  coordinate: CoordinateSchema,
  references: z.string().array().optional(),
});
export type Place = z.infer<typeof PlaceSchema>;

export const PlaceRefSchema = z.union([
  z.string(),
  z.object({ coordinate: CoordinateSchema })
]);
export type PlaceRef = z.infer<typeof PlaceRefSchema>;

export const VesselTypeSchema = z.enum(["battleship"]);
export type VesselType = z.infer<typeof VesselTypeSchema>;

export const VesselEventTypeSchema = z.enum([
  // 起工
  "laid_down",
  // 進水
  "launched",
  // 就役
  "commissioned",
  // 退役
  "decommissioned",
  // 沈没
  "sunk",
  // 除籍
  "stricken",
  // 出発
  "departure",
  // 到着
  "arrival",
  // 経由地
  "waypoint",
]);
export type VesselEventType = z.infer<typeof VesselEventTypeSchema>;

export const VesselEventSchema = z.object({
  name: z.string().optional(),
  date: z.string(),
  type: VesselEventTypeSchema.optional(),
  place: PlaceRefSchema,
  references: z.string().array().optional(),
});
export type VesselEvent = z.infer<typeof VesselEventSchema>;

export const VesselSchema = z.object({
  name: z.string(),
  affiliation: z.string(),
  type: VesselTypeSchema,
  events: VesselEventSchema.array(),
});
export type Vessel = z.infer<typeof VesselSchema>;

export const EventSchema = z.object({
  name: z.string(),
  date: z.string().optional(),
  begin_date: z.string().optional(),
  end_date: z.string().optional(),
  place: PlaceRefSchema,
  references: z.string().array().optional(),
});
export type Event = z.infer<typeof EventSchema>;

export const DataSchema = z.object({
  places: z.record(z.string(), PlaceSchema),
  vessels: z.record(z.string(), VesselSchema),
  events: EventSchema.array(),
});
export type Data = z.infer<typeof DataSchema>;
