import { useEffect, useState } from "react";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { latLonToVector } from "@/lib/geo";

export type Position = [number, number];

export type GeoJsonFeature = {
  geometry: {
    type: string;
    coordinates: unknown;
  } | null;
};

export type GeoJsonCollection = {
  type?: string;
  features?: GeoJsonFeature[];
  coordinates?: unknown;
};

const collectionCache = new Map<string, GeoJsonCollection>();
const inflightLoads = new Map<string, Promise<GeoJsonCollection>>();

export function rememberRssGeoJson(url: string, data: GeoJsonCollection) {
  collectionCache.set(url, data);
}

export function loadRssGeoJson(url: string): Promise<GeoJsonCollection> {
  const cached = collectionCache.get(url);
  if (cached) {
    return Promise.resolve(cached);
  }

  const pending = inflightLoads.get(url);
  if (pending) {
    return pending;
  }

  const request = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<GeoJsonCollection>;
    })
    .then((data) => {
      collectionCache.set(url, data);
      inflightLoads.delete(url);
      return data;
    })
    .catch((err) => {
      inflightLoads.delete(url);
      throw err;
    });

  inflightLoads.set(url, request);
  return request;
}

export function forEachPolygonRing(collection: GeoJsonCollection, visit: (ring: Position[]) => void) {
  const visitGeom = (geom: GeoJsonFeature["geometry"]) => {
    if (!geom) return;
    if (geom.type === "Polygon") {
      for (const ring of geom.coordinates as Position[][]) visit(ring);
    }
    if (geom.type === "MultiPolygon") {
      for (const poly of geom.coordinates as Position[][][]) {
        for (const ring of poly) visit(ring);
      }
    }
  };

  if (collection.features) {
    for (const feature of collection.features) visitGeom(feature.geometry);
  } else if (collection.type === "Polygon") {
    visitGeom({ type: "Polygon", coordinates: collection.coordinates });
  } else if (collection.type === "MultiPolygon") {
    visitGeom({ type: "MultiPolygon", coordinates: collection.coordinates });
  }
}

type Props = {
  geojsonUrl: string | null;
  visible: boolean;
};

function ringToSegments(ring: Position[], radius: number) {
  const vertices: number[] = [];
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [lonA, latA] = ring[i];
    const [lonB, latB] = ring[i + 1];
    if (Math.abs(lonA - lonB) > 180) continue;
    const a = latLonToVector(latA, lonA, radius);
    const b = latLonToVector(latB, lonB, radius);
    vertices.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  return vertices;
}

function polygonToSegments(polygon: Position[][], radius: number) {
  const vertices: number[] = [];
  for (const ring of polygon) {
    vertices.push(...ringToSegments(ring, radius));
  }
  return vertices;
}

function buildGeometryFromCollection(collection: GeoJsonCollection, radius: number) {
  const vertices: number[] = [];

  const pushGeometry = (geom: GeoJsonFeature["geometry"]) => {
    if (!geom) return;
    if (geom.type === "Polygon") {
      vertices.push(...polygonToSegments(geom.coordinates as Position[][], radius));
    }
    if (geom.type === "MultiPolygon") {
      for (const poly of geom.coordinates as Position[][][]) {
        vertices.push(...polygonToSegments(poly, radius));
      }
    }
  };

  if (collection.features) {
    for (const feature of collection.features) {
      pushGeometry(feature.geometry);
    }
  } else if (collection.type === "Polygon") {
    pushGeometry({ type: "Polygon", coordinates: collection.coordinates });
  } else if (collection.type === "MultiPolygon") {
    pushGeometry({ type: "MultiPolygon", coordinates: collection.coordinates });
  }

  if (vertices.length === 0) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

export function RssChangeOverlay({ geojsonUrl, visible }: Props) {
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null);

  useEffect(() => {
    if (!geojsonUrl || !visible) {
      setGeometry(null);
      return;
    }

    const controller = new AbortController();

    loadRssGeoJson(geojsonUrl)
      .then((data) => {
        if (controller.signal.aborted) return;
        const built = buildGeometryFromCollection(data, 1.006);
        setGeometry(built);
      })
      .catch((err) => {
        if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }
        console.error("[RssChangeOverlay] load failed:", err);
        setGeometry(null);
      });

    return () => controller.abort();
  }, [geojsonUrl, visible]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!visible || !geometry) return null;

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#ff3333" linewidth={2} transparent opacity={0.95} />
    </lineSegments>
  );
}

export function computeGeoJsonCenter(collection: GeoJsonCollection): { lat: number; lon: number } | null {
  const points: Position[] = [];
  forEachPolygonRing(collection, (ring) => {
    points.push(...ring);
  });

  if (points.length === 0) return null;
  const lat = points.reduce((s, p) => s + p[1], 0) / points.length;
  const lon = points.reduce((s, p) => s + p[0], 0) / points.length;
  return { lat, lon };
}

export function computeGeoJsonBounds(collection: GeoJsonCollection) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  let found = false;

  forEachPolygonRing(collection, (ring) => {
    for (const [lon, lat] of ring) {
      found = true;
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
    }
  });

  if (!found) return null;
  return { minLat, maxLat, minLon, maxLon };
}
