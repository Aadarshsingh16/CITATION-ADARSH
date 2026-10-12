import { pgTable, text, integer, timestamp, jsonb, uuid, primaryKey, customType } from "drizzle-orm/pg-core";

export const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  status: text("status", {
    enum: ["uploading", "extracting", "indexing", "ready", "rejected", "failed"],
  }).notNull(),
  statusDetail: text("status_detail"),
  rejectReason: text("reject_reason"),
  pageCount: integer("page_count"),
  charCount: integer("char_count"),
  text: text("text"),
  sha256: text("sha256"),
  unreadablePages: integer("unreadable_pages").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const documentFiles = pgTable("document_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .unique()
    .references(() => documents.id, { onDelete: "cascade" }),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const pages = pgTable("pages", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  pageNumber: integer("page_number").notNull(),
  startOffset: integer("start_offset").notNull(),
  endOffset: integer("end_offset").notNull(),
  items: jsonb("items"),
});

export const chunks = pgTable("chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  ordinal: integer("ordinal").notNull(),
  startOffset: integer("start_offset").notNull(),
  endOffset: integer("end_offset").notNull(),
  heading: text("heading"),
  clauseRef: text("clause_ref"),
  tokenEst: integer("token_est").notNull(),
});

export const chats = pgTable("chats", {
  id: uuid("id").defaultRandom().primaryKey(),
  scope: text("scope", { enum: ["single", "multi"] }).notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const chatDocuments = pgTable(
  "chat_documents",
  {
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.documentId] }),
  ]
);

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  status: text("status", { enum: ["complete", "stopped", "error"] }).notNull(),
  mode: text("mode", { enum: ["full", "map_reduce", "retrieval", "agent"] }),
  coverage: jsonb("coverage"),
  stats: jsonb("stats"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const quotes = pgTable("quotes", {
  id: uuid("id").defaultRandom().primaryKey(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  localId: text("local_id").notNull(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  status: text("status", { enum: ["verified", "unverified", "dropped"] }).notNull(),
  reason: text("reason"),
  matches: jsonb("matches"),
  chunkId: uuid("chunk_id").references(() => chunks.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const comparisons = pgTable("comparisons", {
  id: uuid("id").defaultRandom().primaryKey(),
  docAId: uuid("doc_a_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  docBId: uuid("doc_b_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  overallSummary: text("overall_summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const comparisonChanges = pgTable("comparison_changes", {
  id: uuid("id").defaultRandom().primaryKey(),
  comparisonId: uuid("comparison_id")
    .notNull()
    .references(() => comparisons.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["added", "removed", "modified", "moved"] }).notNull(),
  refA: text("ref_a"),
  refB: text("ref_b"),
  textA: text("text_a"),
  textB: text("text_b"),
  rangeA: jsonb("range_a"),
  rangeB: jsonb("range_b"),
  significance: text("significance", {
    enum: ["high", "medium", "low", "cosmetic"],
  }).notNull(),
  category: text("category"),
  summary: text("summary").notNull(),
  signals: jsonb("signals"),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(),
  documentId: uuid("document_id").references(() => documents.id, {
    onDelete: "cascade",
  }),
  status: text("status").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lastError: text("last_error"),
});
