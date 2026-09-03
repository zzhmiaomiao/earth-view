import { useEffect, useMemo, useState } from "react";
import type { BoundingBox } from "@/types/imagery";
import {
  type GeoJsonCollection,
  type Position,
  forEachPolygonRing,
  loadRssGeoJson,
} from "./RssChangeOverlay";

type Props = {
  geojsonUrl: string | null;
  visible: boolean;
  bbox: BoundingBox | null;
  imageTransform: string;
};

function ringTouchesBbox(ring: Position[], bbox: BoundingBox) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  for (const [lon, lat] of ring) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  }

  return !(maxLon < bbox.minLon || minLon > bbox.maxLon || maxLat < bbox.minLat || minLat > bbox.maxLat);
}

function ringToPath(ring: Position[], bbox: BoundingBox) {
  const lonSpan = Math.max(bbox.maxLon - bbox.minLon, 1e-8);
  const latSpan = Math.max(bbox.maxLat - bbox.minLat, 1e-8);
  const parts: string[] = [];

  ring.forEach(([lon, lat], index) => {
    const x = ((lon - bbox.minLon) / lonSpan) * 100;
    const y = ((bbox.maxLat - lat) / latSpan) * 100;
    parts.push(`${index === 0 ? "M" : "L"}${x.toFixed(3)} ${y.toFixed(3)}`);
  });

  return parts.length ? `${parts.join(" ")} Z` : "";
}

export function RssChangeMapOverlay({ geojsonUrl, visible, bbox, imageTransform }: Props) {
  const [collection, setCollection] = useState<GeoJsonCollection | null>(null);

  useEffect(() => {
    if (!geojsonUrl || !visible) {
      setCollection(null);
      return;
    }

    let cancelled = false;
    loadRssGeoJson(geojsonUrl)
      .then((data) => {
        if (!cancelled) setCollection(data);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[RssChangeMapOverlay] load failed:", err);
          setCollection(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [geojsonUrl, visible]);

  const pathD = useMemo(() => {
    if (!collection || !bbox) return "";
    const padded: BoundingBox = {
      minLat: bbox.minLat - (bbox.maxLat - bbox.minLat) * 0.15,
      maxLat: bbox.maxLat + (bbox.maxLat - bbox.minLat) * 0.15,
      minLon: bbox.minLon - (bbox.maxLon - bbox.minLon) * 0.15,
      maxLon: bbox.maxLon + (bbox.maxLon - bbox.minLon) * 0.15,
    };
    const parts: string[] = [];
    forEachPolygonRing(collection, (ring) => {
      if (ring.length < 3 || !ringTouchesBbox(ring, padded)) return;
      const d = ringToPath(ring, bbox);
      if (d) parts.push(d);
    });
    return parts.join(" ");
  }, [collection, bbox]);

  if (!visible || !bbox || !pathD) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[7] h-full w-full overflow-visible"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ transform: imageTransform, transformOrigin: "center" }}
    >
      <path
        d={pathD}
        fill="#ff3333"
        fillOpacity="0.28"
        stroke="#ff3333"
        strokeWidth="0.18"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
