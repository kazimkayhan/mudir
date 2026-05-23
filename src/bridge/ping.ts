import { invoke, isTauri } from "@tauri-apps/api/core";
import { z } from "zod";

const dataLayerPingSchema = z.object({
  message: z.string(),
  ok: z.boolean(),
});

export type DataLayerPing = z.infer<typeof dataLayerPingSchema>;

/** نمونهٔ پل invoke → Zod برای دستورهای Rust. */
export async function pingDataLayer(): Promise<DataLayerPing | null> {
  if (!isTauri()) {
    return null;
  }
  const raw = await invoke<unknown>("ping_data_layer");
  return dataLayerPingSchema.parse(raw);
}
