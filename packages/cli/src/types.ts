import type {
  Board,
  BoardStatus,
  Breakout,
  Chip,
  Evidence,
  FactRuleCode,
  Fixture,
  IC,
  Module,
  Status,
} from '@pinout/schema';

export const KINDS = [
  'evidence',
  'chips',
  'modules',
  'boards',
  'ics',
  'breakouts',
  'fixtures',
] as const;
export type Kind = (typeof KINDS)[number];

export const STATUSES: readonly Status[] = [
  'verified',
  'single-source',
  'conflict',
  'interim',
  'community',
  'missing',
];

export const BOARD_STATUSES: readonly BoardStatus[] = [
  'fully-verified',
  'partially-verified',
  'datasheet-required',
  'unsupported',
];

/** One catalog file as read from disk. `file` is root-relative with forward slashes. */
export interface SourceFile {
  file: string;
  kind: Kind;
  text: string;
}

/** Codes of the cross-field fact rules come from the schema package, so the two cannot drift. */
export type ErrorCode =
  | FactRuleCode
  | 'E_YAML'
  | 'E_SCHEMA'
  | 'E_EVIDENCE_UNKNOWN'
  | 'E_PIN_NUMBERING'
  | 'E_BOARD_STATUS'
  | 'E_DUPLICATE_ID'
  | 'E_REF_UNRESOLVED'
  | 'E_FILE_EXTENSION';
export type WarningCode = 'W_IGNORED_FILE';

export type Diagnostic =
  | { severity: 'error'; code: ErrorCode; file: string; path: string; message: string }
  | { severity: 'warning'; code: WarningCode; file: string; path: string; message: string };

export interface CatalogEntities {
  evidence: Evidence[];
  chips: Chip[];
  modules: Module[];
  boards: Board[];
  ics: IC[];
  breakouts: Breakout[];
  fixtures: Fixture[];
}

export type StatusCounts = Record<Status, number>;

export interface Coverage {
  entities: Record<Kind, number>;
  facts: StatusCounts;
  factsByKind: Record<Kind, StatusCounts>;
  boards: { ref: string; declared: BoardStatus; computed: BoardStatus | null }[];
}

export interface ValidationResult {
  diagnostics: Diagnostic[];
  errorCount: number;
  warningCount: number;
  fileCount: number;
  /** Entities that passed the shape check, sorted by id (boards by `<id>@<revision>`). */
  catalog: CatalogEntities;
  coverage: Coverage;
}
