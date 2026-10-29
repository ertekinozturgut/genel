"use client";
import ForceGraph2D from "react-force-graph-2d";

/** next/dynamic ref iletmediği için ref'i prop olarak taşıyan sarmalayıcı. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ForceGraph({ fgRef, ...props }: any) {
  return <ForceGraph2D ref={fgRef} {...props} />;
}
