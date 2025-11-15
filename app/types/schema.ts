export type Coordinate = [number, number];

export type Place = {
  name: string;
  coordinate: Coordinate;
  references?: string[];
};

export type VesselEvent = {
  name?: string;
  date: string;
  place: string | { coordinate: Coordinate };
  references?: string[];
};

export type Vessel = {
  name: string;
  affiliation: string;
  type: string;
  events: VesselEvent[];
};

export type Event = {
  name: string;
  date?: string;
  begin_date?: string;
  end_date?: string;
  place: string | { coordinate: Coordinate; };
  references?: string[];
};

export type Data = {
  places: Record<string, Place>;
  vessels: Record<string, Vessel>;
  events: Event[];
};
