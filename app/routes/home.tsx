import type { Route } from "./+types/home";
import { useEffect, useMemo, useState } from "react";
import type { FC } from "react";
import type { Data, Vessel, Place, Coordinate } from "../types/schema";
import { useLoaderData } from "react-router";
import yaml from "js-yaml";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";

import "leaflet/dist/leaflet.css";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Kantai Explorer" },
  ];
}

export async function clientLoader() {
  const res = await fetch("/data.yml");
  const text = await res.text();
  const data = yaml.load(text) as Data;
  return data;
}

class DataManager {
  data: Data;

  constructor(data: Data) {
    this.data = data;
  }

  getCoordinate(placeRef: string | { coordinate: Coordinate; }):
    Coordinate {
    if (typeof placeRef === "string") {
      const place = this.data.places[placeRef];
      if (!place) {
        throw new Error(`Place ${placeRef} not found`);
      }
      return place.coordinate;
    } else {
      return placeRef.coordinate;
    }
  }

  getVesselCoordinate(vessel: Vessel, time: number): Coordinate | null {
    const eventsWithPlace = vessel.events.filter((ev) => {
      return ev.place !== undefined;
    });

    for (let i = 0; i + 1 < eventsWithPlace.length; i++) {
      const ev1 = eventsWithPlace[i];
      const ev2 = eventsWithPlace[i + 1];

      let time1 = new Date(ev1.date).getTime();
      let time2 = new Date(ev2.date).getTime();

      if (time1 <= time && time <= time2) {
        const coord1 = this.getCoordinate(ev1.place!);
        const coord2 = this.getCoordinate(ev2.place!);

        const ratio = (time - time1) / (time2 - time1);
        const lat = coord1[0] + (coord2[0] - coord1[0]) * ratio;
        const lng = coord1[1] + (coord2[1] - coord1[1]) * ratio;
        return [lat, lng];
      }
    }

    return null;
  }

  getBeginEndTime(): { begin: number; end: number } {
    let begin = Number.MAX_SAFE_INTEGER;
    let end = Number.MIN_SAFE_INTEGER;

    for (const event of this.data.events) {
      if (event.begin_date) {
        const date = new Date(event.begin_date);
        begin = Math.min(begin, date.getTime());
      }

      if (event.end_date) {
        const date = new Date(event.end_date);
        end = Math.max(end, date.getTime());
      }

      if (event.date) {
        const date = new Date(event.date);
        begin = Math.min(begin, date.getTime());
        end = Math.max(end, date.getTime());
      }
    }

    for (const vesselKey in this.data.vessels) {
      const vessel = this.data.vessels[vesselKey];
      for (const ev of vessel.events) {
        if (ev.date) {
          const date = new Date(ev.date);
          begin = Math.min(begin, date.getTime());
          end = Math.max(end, date.getTime());
        }
      }
    }

    return { begin, end };
  }
}

function Map({ dataManager, time }: { dataManager: DataManager; time: number }) {
  const vesselColors = [
    "blue", "red", "green", "orange", "purple", "brown", "pink", "gray", "cyan", "magenta"
  ];
  const vesselTracks = Object.entries(dataManager.data.vessels)
    .map(([key, vessel]) => {
      let track = vessel.events
        .filter(ev => new Date(ev.date).getTime() <= time && ev.place)
        .map(ev => {
          try {
            return dataManager.getCoordinate(ev.place);
          } catch {
            return null;
          }
        })
        .filter((coord): coord is Coordinate => Array.isArray(coord) && coord.length === 2);
      return { name: vessel.name, track };
    });
  const vesselMarkers = Object.entries(dataManager.data.vessels)
    .map(([key, vessel]) => {
      const coord = dataManager.getVesselCoordinate(vessel, time);
      if (!coord) return null;
      return (
        <Marker key={key} position={coord}>
          <Popup>{vessel.name}</Popup>
        </Marker>
      );
    })
    .filter(Boolean);

  return (
    <MapContainer center={[34, 132]} zoom={6} style={{ width: "100%", height: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {Object.entries(dataManager.data.places).map(([key, place]) => (
        <Marker key={key} position={place.coordinate}>
          <Popup>{place.name}</Popup>
        </Marker>
      ))}
      {vesselMarkers}
      {vesselTracks.map((v, i) => (
        v.track.length > 1 ? (
          <Polyline key={v.name} positions={v.track} color={vesselColors[i % vesselColors.length]} />
        ) : null
      ))}
    </MapContainer>
  );
}

export default function Home() {
  const data = useLoaderData<Data>();
  const dataManager = useMemo(() => new DataManager(data), [data]);
  const { begin, end } = dataManager.getBeginEndTime();
  const [currentTime, setCurrentTime] = useState(begin);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <Map dataManager={dataManager} time={currentTime} />
      <div style={{ position: "absolute", bottom: 10, left: 10, backgroundColor: "white", padding: "5px", zIndex: 1000, color: "black" }}>
        <label>
          <input
            type="range"
            min={begin}
            max={end}
            value={currentTime}
            onChange={(e) => setCurrentTime(parseInt(e.target.value, 10))}
            style={{ width: "300px" }}
          />
        </label>
        <div>
          {new Date(currentTime).toISOString().split("T")[0]}
        </div>
      </div>
    </div>
  );
}
