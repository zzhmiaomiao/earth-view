import { useState } from "react";

type Props = {
  onLoad: (orderId: string) => void;
  visible: boolean;
  onToggleVisible: (v: boolean) => void;
  loading: boolean;
  error: string | null;
};

export function RssChangePanel({ onLoad, visible, onToggleVisible, loading, error }: Props) {
  const [orderId, setOrderId] = useState("28");

  return (
    <div className="fixed bottom-4 left-4 z-50 w-72 rounded-lg border border-white/20 bg-black/70 p-3 text-sm text-white backdrop-blur">
      <div className="mb-2 font-semibold">RSS 变化检测图层</div>
      <label className="mb-1 block text-xs text-white/70">订单 ID</label>
      <input
        className="mb-2 w-full rounded border border-white/20 bg-black/40 px-2 py-1 text-white"
        value={orderId}
        onChange={(e) => setOrderId(e.target.value)}
        placeholder="例如 28"
      />
      <div className="flex gap-2">
        <button
          className="flex-1 rounded bg-red-600 px-2 py-1 hover:bg-red-500 disabled:opacity-50"
          disabled={loading}
          onClick={() => onLoad(orderId.trim())}
        >
          {loading ? "加载中..." : "加载图斑"}
        </button>
        <button
          className="rounded border border-white/30 px-2 py-1"
          onClick={() => onToggleVisible(!visible)}
        >
          {visible ? "隐藏" : "显示"}
        </button>
      </div>
      {error && <div className="mt-2 text-xs text-red-300">{error}</div>}
      <div className="mt-2 text-xs text-white/50">数据源: localhost:8000</div>
    </div>
  );
}
