export interface InventoryEntry {
  path: string;
  kind: "file" | "dir";
  basename: string;
  tokens: string[];
}

export interface Inventory {
  generated_at: string;
  root: string;
  entries: InventoryEntry[];
  text_hits?: { term: string; paths: string[] }[];
}
