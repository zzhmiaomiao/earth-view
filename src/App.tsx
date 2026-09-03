import { useCallback, useState } from "react";
import { Satellite } from "lucide-react";
import { Globe } from "@/components/Globe/Globe";
import { CameraHotkeys } from "@/components/Globe/CameraHotkeys";
import { MaxZoomImagery } from "@/components/Globe/MaxZoomImagery";
import { computeGeoJsonBounds, computeGeoJsonCenter, rememberRssGeoJson } from "@/components/Globe/RssChangeOverlay";
import { RssChangePanel } from "@/components/Globe/RssChangePanel";
import { ImageryModal } from "@/components/Modal/ImageryModal";
import { formatGibsCaptureTime, formatSentinelCaptureTime } from "@/lib/captureTime";
import { getImageryProvider } from "@/providers/registry";
import { useAppStore } from "@/store/useAppStore";

export default function App() {
  const date = useAppStore((state) => state.date);
  const layerId = useAppStore((state) => state.layerId);
  const globeView = useAppStore((state) => state.globeView);
  const focusGlobeAt = useAppStore((state) => state.focusGlobeAt);
  const syncGlobeDetailView = useAppStore((state) => state.syncGlobeDetailView);
  const provider = getImageryProvider(layerId);
  const captureLabel = provider.sentinelVariantId
    ? formatSentinelCaptureTime(date, provider.sentinelVariantId, globeView?.lon)
    : formatGibsCaptureTime(date, provider.id, globeView?.lon);

  const [rssUrl, setRssUrl] = useState<string | null>(null);
  const [rssVisible, setRssVisible] = useState(true);
  const [rssLoading, setRssLoading] = useState(false);
  const [rssError, setRssError] = useState<string | null>(null);

  const handleLoadRss = useCallback(
    async (orderId: string) => {
      if (!orderId) {
        setRssError("请输入订单 ID");
        return;
      }
      setRssLoading(true);
      setRssError(null);
      const url = `http://localhost:8000/api/public/demo/detect.geojson?orderId=${encodeURIComponent(orderId)}`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        rememberRssGeoJson(url, data);
        setRssUrl(url);
        setRssVisible(true);
        const center = computeGeoJsonCenter(data);
        const bounds = computeGeoJsonBounds(data);
        if (center && bounds) {
          const latSpan = Math.max(0.12, (bounds.maxLat - bounds.minLat) * 1.6);
          const lonSpan = Math.max(0.12, (bounds.maxLon - bounds.minLon) * 1.6);
          focusGlobeAt(center.lat, center.lon, { immediate: true });
          syncGlobeDetailView({
            lat: center.lat,
            lon: center.lon,
            latSpan,
            lonSpan,
          });
        } else if (center) {
          focusGlobeAt(center.lat, center.lon, { immediate: true, distance: 1.32 });
        }
      } catch (e) {
        setRssError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setRssLoading(false);
      }
    },
    [focusGlobeAt, syncGlobeDetailView],
  );

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-space">
      <Globe rssGeojsonUrl={rssUrl} rssVisible={rssVisible} />
      <MaxZoomImagery rssGeojsonUrl={rssUrl} rssVisible={rssVisible} />
      <CameraHotkeys />
      <RssChangePanel
        onLoad={handleLoadRss}
        visible={rssVisible}
        onToggleVisible={setRssVisible}
        loading={rssLoading}
        error={rssError}
      />

      <header
        data-testid="app-chrome"
        className="pointer-events-none absolute left-4 top-4 z-10 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border border-white/10 bg-background/55 px-4 py-3 shadow-2xl backdrop-blur md:left-6 md:top-6"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Satellite className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-normal">Earth View</h1>
          <p className="truncate text-sm text-muted-foreground">
            {provider.name} · {captureLabel}
          </p>
        </div>
      </header>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-40 bg-gradient-to-t from-background/75 to-transparent" />
      <ImageryModal />
    </main>
  );
}
