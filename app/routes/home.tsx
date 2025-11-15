import type { Route } from "./+types/home";
import { useEffect, useMemo, useState, memo } from "react";
import type { FC } from "react";
import type { Data, Ship, Place, Coordinate } from "../types/schema";
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

  getShipCoordinate(ship: Ship, time: number): Coordinate | null {
    const eventsWithPlace = ship.events.filter((ev) => {
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

    for (const shipKey in this.data.ships) {
      const ship = this.data.ships[shipKey];
      for (const ev of ship.events) {
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
  const shipColors = [
    "blue", "red", "green", "orange", "purple", "brown", "pink", "gray", "cyan", "magenta"
  ];
  const shipTracks = Object.entries(dataManager.data.ships)
    .map(([key, ship]) => {
      let track = ship.events
        .filter(ev => new Date(ev.date).getTime() <= time && ev.place)
        .map(ev => {
          try {
            return dataManager.getCoordinate(ev.place);
          } catch {
            return null;
          }
        })
        .filter((coord): coord is Coordinate => Array.isArray(coord) && coord.length === 2);
      return { name: ship.name, track };
    });
  const shipMarkers = Object.entries(dataManager.data.ships)
    .map(([key, ship]) => {
      const coord = dataManager.getShipCoordinate(ship, time);
      if (!coord) return null;
      return (
        <Marker key={key} position={coord}>
          <Popup>{ship.name}</Popup>
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
      {shipMarkers}
      {shipTracks.map((v, i) => (
        v.track.length > 1 ? (
          <Polyline key={v.name} positions={v.track} color={shipColors[i % shipColors.length]} />
        ) : null
      ))}
    </MapContainer>
  );
}

const PlayPauseButton = memo(function PlayPauseButton({ playing, onClick }: { playing: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: "1.2em",
        padding: "0.2em 0.8em",
        borderRadius: "0.2em",
        border: "none",
        background: "#dddddd",
        cursor: "pointer",
      }}
      aria-label={playing ? "Stop" : "Play"}
    >
      {playing ? "■" : "▶"}
    </button>
  );
});

const kAutoPlaySpeed = 0.1 * 365 * 24 * 60 * 60; // [s/s]
const kFramePerSecond = 30;
const kDefaultTime = new Date("1941-12-08").getTime();

export default function Home() {
  const data = useLoaderData<Data>();
  const dataManager = useMemo(() => new DataManager(data), [data]);
  const { begin, end } = dataManager.getBeginEndTime();
  const [currentTime, setCurrentTime] = useState(kDefaultTime);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (currentTime >= end) {
      setPlaying(false);
      return;
    }
    let lastTime = Date.now();
    const tick = () => {
      const now = Date.now();
      const elapsed = (now - lastTime) / 1000;
      lastTime = now;
      console.log(elapsed, currentTime);
      setCurrentTime((prev) => Math.min(prev + kAutoPlaySpeed * 1000 * elapsed, end));
      if (playing && currentTime < end) {
        timerId = setTimeout(tick, 1000 / kFramePerSecond);
      }
    };
    let timerId = setTimeout(tick, 1000 / kFramePerSecond);
    return () => clearTimeout(timerId);
  }, [playing, currentTime, begin, end]);

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Map dataManager={dataManager} time={currentTime} />
      </div>
      <div style={{ backgroundColor: "white", padding: "16px 0 12px 0", color: "black", width: "100%", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5em", width: "100%", justifyContent: "center" }}>
          <PlayPauseButton
            playing={playing}
            onClick={() => {
              if (playing) {
                setPlaying(false);
              } else {
                if (currentTime >= end) setCurrentTime(begin);
                setPlaying(true);
              }
            }}
          />
          <input
            type="range"
            min={begin}
            max={end}
            value={currentTime}
            onChange={(e) => setCurrentTime(parseInt(e.target.value, 10))}
            style={{ width: "80vw", maxWidth: "900px" }}
          />
          <span style={{ minWidth: "100px", textAlign: "center" }}>{new Date(currentTime).toISOString().split("T")[0]}</span>
        </div>
      </div>
    </div>
  );
}
