import { listChatsForDocument } from "../../../server/chat";
import { db } from "../../../server/db";
import { chats, chatDocuments, documents } from "../../../server/db/schema";
import { desc, inArray, eq } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const documentId = url.searchParams.get("documentId");

    if (documentId) {
      const docChats = await listChatsForDocument(documentId);
      return Response.json({ chats: docChats });
    }

    // List all chats
    const allChats = await db
      .select()
      .from(chats)
      .orderBy(desc(chats.createdAt));

    if (allChats.length === 0) {
      return Response.json({ chats: [] });
    }

    const chatIds = allChats.map((c) => c.id);
    const allLinks = await db
      .select({
        chatId: chatDocuments.chatId,
        docId: chatDocuments.documentId,
        filename: documents.filename,
      })
      .from(chatDocuments)
      .leftJoin(documents, eq(chatDocuments.documentId, documents.id))
      .where(inArray(chatDocuments.chatId, chatIds));

    const result = allChats.map((c) => {
      const docLinks = allLinks.filter((l) => l.chatId === c.id);
      return {
        id: c.id,
        scope: c.scope,
        title: c.title,
        documentIds: docLinks.map((l) => l.docId),
        documentNames: docLinks.map((l) => l.filename || "Untitled"),
        createdAt: c.createdAt,
      };
    });

    return Response.json({ chats: result });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: errorMsg }, { status: 500 });
  }
}
