export interface NetState {
  network_id: string;
  consensus: "poa";
  tick: number;
  paused: boolean;
  latency: number;
  partition: string[][] | null;
  nodes: number;
  tolerance: number;
  messages: { delivered: number; dropped: number };
  pending_txs: number;
}

export interface BlockSummary {
  index: number;
  hash: string;
  proposer: string;
  weight: number;
  txs: number;
}

export interface NodeInfo {
  id: string;
  name: string;
  address: string;
  joining: boolean;
  mode: "honest" | "offline" | "equivocate" | "tamper";
  online: boolean;
  height: number;
  head_hash: string;
  head_weight: number;
  mempool: number;
  known_blocks: number;
  diverges: boolean;
  first_divergent_index: number | null;
  recent: BlockSummary[];
  consensus: Record<string, any>;
}

export interface MonitorRow {
  index: number;
  forked: boolean;
  variants: (BlockSummary & { nodes: string[] })[];
}

export interface Monitor {
  forked: boolean;
  tie: boolean;
  majority_head: string | null;
  majority_nodes: string[];
  divergent_nodes: string[];
  groups: { head: string; nodes: string[] }[];
  first_divergent_index: number | null;
  rows: MonitorRow[];
  nodes: NodeInfo[];
}

export interface Party {
  address: string;
  name: string;
  role: "admin" | "validator" | "producer" | "participant" | "customer";
  approved: boolean;
}

export interface Tag {
  product_id: string;
  tag_id: string;
  write_counter: number;
  read_counter: number;
  signature: string;
}

export interface Product {
  product_id: string;
  name: string;
  producer: string;
  producer_name: string;
  owner: string;
  owner_name: string;
  status: "registered" | "sold";
  tag_id: string;
  write_counter: number;
  read_counter: number;
  record_hash: string;
  tag: Tag | null;
  history: Record<string, any>[];
  failures: { kind: string; reason: string; block: number }[];
  db_edits: string[];
}

export interface TxInfo {
  hash: string;
  type: string;
  sender: string;
  payload: Record<string, any>;
  entry_node: string | null;
  sent_tick: number | null;
}

export interface BlockDetail {
  index: number;
  hash: string;
  prev_hash: string;
  proposer: string;
  weight: number;
  tick: number;
  state_root: string;
  txs: TxInfo[];
}

export interface Layer {
  name: string;
  ok: boolean | null;
  detail: string;
  recovered_signer?: string | null;
  registered_signer?: string | null;
  tx?: string;
}

export interface ScanResult {
  verdict: "genuine" | "suspicious" | "unconfirmed";
  attack: string;
  summary: string;
  layers: Layer[];
  answered_by: { id: string; name: string; height: number };
  tx?: string;
  block?: number;
  sold?: boolean;
  owner?: string;
  failure_logged_tx?: string | null;
}

export interface ChainEvent {
  id: number;
  type: string;
  tick: number;
  node: string | null;
  data: Record<string, any>;
}

export interface ShelfTag {
  id: string;
  label: string;
  data: Tag;
  lastSent?: Tag;
}

export type Notify = (message: string, kind?: "ok" | "error") => void;
