export const TYPE_COLORS: Record<string, string> = {
  Person: "#f59e0b",
  Organization: "#7c9cff",
  Location: "#34d399",
  Product: "#f472b6",
  Technology: "#22d3ee",
  Concept: "#a78bfa",
  Event: "#fb7185",
  Process: "#facc15",
  Metric: "#4ade80",
  Date: "#94a3b8",
  Document: "#fdba74",
  Other: "#9ca3af",
};
export const typeColor = (t: string) => TYPE_COLORS[t] ?? "#9ca3af";

export const STATUS_LABEL: Record<string, string> = {
  pending: "Sırada",
  embedding: "Vektörleştiriliyor",
  extracting: "Graf çıkarılıyor",
  analyzing: "Analiz ediliyor",
  ready: "Hazır",
};
