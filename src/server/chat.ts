import { eq, desc, inArray } from "drizzle-orm";
import { db } from "./db";
import { chats, chatDocuments, messages, quotes, documents } from "./db/schema";
import type { Coverage } from "../lib/types";
import type { QuoteMatch } from "../lib/quotes";

export interface StoredQuote {
  id: string;
  messageId: string;
  localId: string;
  documentId: string;
  documentName?: string;
  text: string;
  status: "verified" | "unverified" | "dropped";
  reason?: string | null;
  matches?: QuoteMatch[] | null;
  chunkId?: string | null;
  createdAt: Date | string;
}

export interface StoredMessage {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system";
  content: string;
  status: "complete" | "stopped" | "error";
  mode?: "full" | "map_reduce" | "retrieval" | "agent" | null;
  coverage?: Coverage | null;
  stats?: Record<string, unknown> | null;
  quotes: StoredQuote[];
  createdAt: Date | string;
}

export interface StoredChat {
  id: string;
  scope: "single" | "multi";
  title: string;
  documentIds: string[];
  documentNames: string[];
  createdAt: Date | string;
}

/**
 * Create a new chat session linked to one or more documents.
 */
export async function createChat(
  scope: "single" | "multi",
  title: string,
  documentIds: string[]
): Promise<StoredChat> {
  const [newChat] = await db
    .insert(chats)
    .values({
      scope,
      title: title.slice(0, 200),
    })
    .returning();

  if (documentIds.length > 0) {
    await db.insert(chatDocuments).values(
      documentIds.map((docId) => ({
        chatId: newChat.id,
        documentId: docId,
      }))
    );
  }

  // Get document names
  let docNames: string[] = [];
  if (documentIds.length > 0) {
    const docs = await db
      .select({ id: documents.id, filename: documents.filename })
      .from(documents)
      .where(inArray(documents.id, documentIds));
    docNames = docs.map((d) => d.filename);
  }

  return {
    id: newChat.id,
    scope: newChat.scope as "single" | "multi",
    title: newChat.title,
    documentIds,
    documentNames: docNames,
    createdAt: newChat.createdAt,
  };
}

/**
 * List all chats for a given document.
 */
export async function listChatsForDocument(documentId: string): Promise<StoredChat[]> {
  const links = await db
    .select({ chatId: chatDocuments.chatId })
    .from(chatDocuments)
    .where(eq(chatDocuments.documentId, documentId));

  if (links.length === 0) return [];

  const chatIds = links.map((l) => l.chatId);
  const chatRows = await db
    .select()
    .from(chats)
    .where(inArray(chats.id, chatIds))
    .orderBy(desc(chats.createdAt));

  const allLinks = await db
    .select({
      chatId: chatDocuments.chatId,
      docId: chatDocuments.documentId,
      filename: documents.filename,
    })
    .from(chatDocuments)
    .leftJoin(documents, eq(chatDocuments.documentId, documents.id))
    .where(inArray(chatDocuments.chatId, chatIds));

  return chatRows.map((c) => {
    const docLinks = allLinks.filter((l) => l.chatId === c.id);
    return {
      id: c.id,
      scope: c.scope as "single" | "multi",
      title: c.title,
      documentIds: docLinks.map((l) => l.docId),
      documentNames: docLinks.map((l) => l.filename || "Untitled"),
      createdAt: c.createdAt,
    };
  });
}

/**
 * Get all messages and quotes for a chat in chronological order.
 */
export async function getChatMessages(chatId: string): Promise<StoredMessage[]> {
  const messageRows = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(messages.createdAt);

  if (messageRows.length === 0) return [];

  const messageIds = messageRows.map((m) => m.id);
  const quoteRows = await db
    .select({
      quote: quotes,
      docFilename: documents.filename,
    })
    .from(quotes)
    .leftJoin(documents, eq(quotes.documentId, documents.id))
    .where(inArray(quotes.messageId, messageIds))
    .orderBy(quotes.createdAt);

  return messageRows.map((m) => {
    const msgQuotes = quoteRows
      .filter((q) => q.quote.messageId === m.id)
      .map((q) => ({
        id: q.quote.id,
        messageId: q.quote.messageId,
        localId: q.quote.localId,
        documentId: q.quote.documentId,
        documentName: q.docFilename || undefined,
        text: q.quote.text,
        status: q.quote.status as "verified" | "unverified" | "dropped",
        reason: q.quote.reason,
        matches: q.quote.matches as QuoteMatch[] | null,
        chunkId: q.quote.chunkId,
        createdAt: q.quote.createdAt,
      }));

    return {
      id: m.id,
      chatId: m.chatId,
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
      status: m.status as "complete" | "stopped" | "error",
      mode: m.mode as any,
      coverage: m.coverage as Coverage | null,
      stats: m.stats as Record<string, unknown> | null,
      quotes: msgQuotes,
      createdAt: m.createdAt,
    };
  });
}

/**
 * Insert a message.
 */
export async function insertMessage(data: {
  chatId: string;
  role: "user" | "assistant" | "system";
  content: string;
  status: "complete" | "stopped" | "error";
  mode?: "full" | "map_reduce" | "retrieval" | "agent";
  coverage?: Coverage;
  stats?: Record<string, unknown>;
}): Promise<string> {
  const [msg] = await db
    .insert(messages)
    .values({
      chatId: data.chatId,
      role: data.role,
      content: data.content,
      status: data.status,
      mode: data.mode,
      coverage: data.coverage,
      stats: data.stats,
    })
    .returning({ id: messages.id });

  return msg.id;
}

/**
 * Update an existing message.
 */
export async function updateMessage(
  messageId: string,
  data: {
    content?: string;
    status?: "complete" | "stopped" | "error";
    coverage?: Coverage;
    stats?: Record<string, unknown>;
  }
): Promise<void> {
  await db
    .update(messages)
    .set({
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.coverage !== undefined ? { coverage: data.coverage } : {}),
      ...(data.stats !== undefined ? { stats: data.stats } : {}),
    })
    .where(eq(messages.id, messageId));
}

/**
 * Insert a quote.
 */
export async function insertQuote(data: {
  messageId: string;
  localId: string;
  documentId: string;
  text: string;
  status: "verified" | "unverified" | "dropped";
  reason?: string | null;
  matches?: QuoteMatch[] | null;
  chunkId?: string | null;
}): Promise<string> {
  const [q] = await db
    .insert(quotes)
    .values({
      messageId: data.messageId,
      localId: data.localId,
      documentId: data.documentId,
      text: data.text,
      status: data.status,
      reason: data.reason,
      matches: data.matches,
      chunkId: data.chunkId,
    })
    .returning({ id: quotes.id });

  return q.id;
}

/**
 * Update a quote (e.g. after repair pass).
 */
export async function updateQuote(
  quoteId: string,
  data: {
    status?: "verified" | "unverified" | "dropped";
    text?: string;
    reason?: string | null;
    matches?: QuoteMatch[] | null;
  }
): Promise<void> {
  await db
    .update(quotes)
    .set({
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.text !== undefined ? { text: data.text } : {}),
      ...(data.reason !== undefined ? { reason: data.reason } : {}),
      ...(data.matches !== undefined ? { matches: data.matches } : {}),
    })
    .where(eq(quotes.id, quoteId));
}
