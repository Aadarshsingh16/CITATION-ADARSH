import { getDocument, getDocumentPages } from "@/server/documents";
import {
  createChat,
  insertMessage,
  updateMessage,
  insertQuote,
  updateQuote,
} from "@/server/chat";
import {
  verifyQuote,
  splitByPages,
  type QuotePageBoundary,
  type Match,
} from "@/lib/quotes";
import { StreamTagParser } from "@/lib/llm/stream-parser";
import {
  streamChatCompletion,
  repairQuote,
  getLLMConfig,
} from "@/lib/llm/client";
import {
  buildChatSystemPrompt,
  buildChatUserMessage,
  type DocumentContextItem,
} from "@/lib/llm/prompts";
import type { Coverage } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { documentIds, question, chatId: requestedChatId } = body;

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return Response.json(
        { error: "At least one document ID is required." },
        { status: 400 }
      );
    }

    if (!question || typeof question !== "string" || !question.trim()) {
      return Response.json(
        { error: "Question cannot be empty." },
        { status: 400 }
      );
    }

    // 1. Fetch documents and pages
    const docRecords: Array<{
      id: string;
      label: string;
      filename: string;
      text: string;
      pages: QuotePageBoundary[];
      unreadablePages: number[];
    }> = [];

    const labelToDoc: Record<string, typeof docRecords[0]> = {};
    const allowedDocIds: string[] = [];

    for (let i = 0; i < documentIds.length; i++) {
      const docId = documentIds[i];
      const doc = await getDocument(docId);
      if (!doc) {
        return Response.json(
          { error: `Document ${docId} not found.` },
          { status: 404 }
        );
      }
      if (doc.status !== "ready" || !doc.text) {
        return Response.json(
          {
            error: `Document "${doc.filename}" is not ready for chat (status: ${doc.status}).`,
          },
          { status: 400 }
        );
      }

      const pRows = await getDocumentPages(docId);
      const label = `D${i + 1}`;
      allowedDocIds.push(label);

      const parsedPages: QuotePageBoundary[] = pRows.map((p) => ({
        pageNumber: p.pageNumber,
        startOffset: p.startOffset,
        endOffset: p.endOffset,
      }));

      const unreadable = (doc.unreadablePages as number[]) || [];

      const item = {
        id: doc.id,
        label,
        filename: doc.filename,
        text: doc.text,
        pages: parsedPages,
        unreadablePages: unreadable,
      };

      docRecords.push(item);
      labelToDoc[label] = item;
    }

    // 2. Chat session & messages persistence
    let chatId = requestedChatId;
    if (!chatId) {
      const newChat = await createChat(
        documentIds.length > 1 ? "multi" : "single",
        question.slice(0, 100),
        documentIds
      );
      chatId = newChat.id;
    }

    const userMessageId = await insertMessage({
      chatId,
      role: "user",
      content: question,
      status: "complete",
    });

    const assistantMessageId = await insertMessage({
      chatId,
      role: "assistant",
      content: "",
      status: "stopped", // initial status; updated to 'complete' on finish
      mode: "full",
    });

    // 3. Compute coverage object
    const allUnreadable = Array.from(
      new Set(docRecords.flatMap((d) => d.unreadablePages))
    );
    const perDocCoverage: Record<string, { chunksTotal: number; chunksRead: number }> = {};
    for (const d of docRecords) {
      perDocCoverage[d.label] = { chunksTotal: 1, chunksRead: 1 };
    }

    const coverage: Coverage = {
      mode: "full",
      chunksTotal: docRecords.length,
      chunksRead: docRecords.length,
      complete: allUnreadable.length === 0,
      unreadablePages: allUnreadable,
      perDoc: perDocCoverage,
    };

    // 4. Build prompt
    const systemPrompt = buildChatSystemPrompt({
      isMultiDoc: docRecords.length > 1,
      isCoveragePartial: !coverage.complete,
    });

    const contextDocs: DocumentContextItem[] = docRecords.map((d) => ({
      docId: d.label,
      filename: d.filename,
      content: d.text,
    }));

    const userPromptContent = buildChatUserMessage(question, contextDocs);

    // 5. Setup SSE Stream
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const sendSSE = async (event: string, data: unknown) => {
      try {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        await writer.write(encoder.encode(payload));
      } catch {
        // Stream writing failed (e.g. client closed)
      }
    };

    // Telemetry stats
    const stats = {
      proposed: 0,
      verified: 0,
      unverified: {} as Record<string, number>,
      dropped: 0,
      repaired: 0,
    };

    const quoteRecords = new Map<
      string,
      {
        quoteId: string;
        localId: string;
        docId: string;
        text: string;
        status: "verified" | "unverified" | "dropped";
        reason?: string;
      }
    >();

    // Initial event
    void sendSSE("init", {
      chatId,
      userMessageId,
      assistantMessageId,
      documents: docRecords.map((d) => ({
        id: d.id,
        label: d.label,
        filename: d.filename,
      })),
      coverage,
    });

    // Setup StreamTagParser
    const parser = new StreamTagParser({
      allowedDocIds,
      defaultDocId: "D1",
      onText: async (cleanChunk) => {
        await sendSSE("token", { text: cleanChunk });
      },
      onQuoteOpen: () => {
        stats.proposed++;
      },
      onQuoteClose: async (q) => {
        const target = labelToDoc[q.docId];
        let status: "verified" | "unverified" = "unverified";
        let reason: string | undefined;
        let matches: Match[] = [];
        let pageNumber: number | undefined;

        if (target && target.text) {
          // Build other document texts for misattribution check (D-016)
          const otherTexts: Record<string, string> = {};
          for (const otherLabel of allowedDocIds) {
            if (otherLabel !== q.docId && labelToDoc[otherLabel]?.text) {
              otherTexts[otherLabel] = labelToDoc[otherLabel].text;
            }
          }

          const vRes = verifyQuote(q.text, target.text, {
            otherDocTexts: otherTexts,
          });

          if (vRes.status === "verified") {
            status = "verified";
            matches = vRes.matches;
            const splits = splitByPages(matches[0], target.pages);
            pageNumber = splits[0]?.pageNumber;
            stats.verified++;
          } else {
            status = "unverified";
            reason = vRes.reason;
            const rKey = reason || "unknown";
            stats.unverified[rKey] = (stats.unverified[rKey] || 0) + 1;
          }
        } else {
          status = "unverified";
          reason = "not_found";
          stats.unverified["not_found"] = (stats.unverified["not_found"] || 0) + 1;
        }

        const realDocId = target?.id || docRecords[0].id;
        const quoteDbId = await insertQuote({
          messageId: assistantMessageId,
          localId: q.localId,
          documentId: realDocId,
          text: q.text,
          status,
          reason,
          matches,
        });

        quoteRecords.set(q.localId, {
          quoteId: quoteDbId,
          localId: q.localId,
          docId: q.docId,
          text: q.text,
          status,
          reason,
        });

        await sendSSE("quote", {
          id: quoteDbId,
          localId: q.localId,
          docId: q.docId,
          documentId: realDocId,
          documentName: target?.filename,
          text: q.text,
          status,
          reason,
          matches,
          pageNumber,
        });
      },
      onQuoteDropped: () => {
        stats.dropped++;
      },
    });

    const abortController = new AbortController();
    request.signal.addEventListener("abort", () => {
      abortController.abort();
    });

    // Asynchronously consume LLM stream
    (async () => {
      try {
        const config = getLLMConfig();
        if (!config.apiKey || !config.baseUrl) {
          throw new Error("LLM_API_KEY is not set in environment.");
        }

        for await (const chunk of streamChatCompletion({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPromptContent },
          ],
          signal: abortController.signal,
        })) {
          parser.feed(chunk);
        }
        parser.end();

        // Optional repair pass (D-036) for quotes returning not_found
        for (const [, item] of quoteRecords.entries()) {
          if (item.status === "unverified" && item.reason === "not_found") {
            const target = labelToDoc[item.docId];
            if (target && target.text) {
              const candidate = await repairQuote({
                claim: parser.getCleanText(),
                attemptedQuote: item.text,
                chunkText: target.text.slice(0, 15000),
                docId: item.docId,
                localId: item.localId,
                signal: abortController.signal,
              });

              if (candidate) {
                const otherTexts: Record<string, string> = {};
                for (const otherLabel of allowedDocIds) {
                  if (otherLabel !== item.docId && labelToDoc[otherLabel]?.text) {
                    otherTexts[otherLabel] = labelToDoc[otherLabel].text;
                  }
                }

                const repCheck = verifyQuote(candidate, target.text, {
                  otherDocTexts: otherTexts,
                });

                if (repCheck.status === "verified") {
                  stats.repaired++;
                  stats.verified++;
                  if ((stats.unverified["not_found"] || 0) > 0) {
                    stats.unverified["not_found"]--;
                  }

                  const repSplits = splitByPages(repCheck.matches[0], target.pages);
                  const repPage = repSplits[0]?.pageNumber;

                  await updateQuote(item.quoteId, {
                    status: "verified",
                    text: candidate,
                    reason: null,
                    matches: repCheck.matches,
                  });

                  await sendSSE("quote", {
                    id: item.quoteId,
                    localId: item.localId,
                    docId: item.docId,
                    documentId: target.id,
                    documentName: target.filename,
                    text: candidate,
                    status: "verified",
                    matches: repCheck.matches,
                    pageNumber: repPage,
                  });
                }
              }
            }
          }
        }

        await sendSSE("coverage", coverage);

        const finalClean = parser.getCleanText();
        await updateMessage(assistantMessageId, {
          content: finalClean,
          status: "complete",
          coverage,
          stats,
        });

        await sendSSE("done", {
          messageId: assistantMessageId,
          content: finalClean,
          stats,
        });
      } catch (err: unknown) {
        if (request.signal.aborted || abortController.signal.aborted) {
          // Client stopped mid-stream (Acceptance test A7)
          parser.end();
          const partialClean = parser.getCleanText();
          await updateMessage(assistantMessageId, {
            content: partialClean,
            status: "stopped",
            coverage,
            stats,
          });

          await sendSSE("done", {
            messageId: assistantMessageId,
            content: partialClean,
            stats,
            stopped: true,
          });
        } else {
          const errorMsg = err instanceof Error ? err.message : String(err);
          await sendSSE("error", { message: errorMsg });
          await updateMessage(assistantMessageId, {
            content: parser.getCleanText(),
            status: "error",
            stats,
          });
        }
      } finally {
        try {
          await writer.close();
        } catch {
          // stream writer already closed
        }
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: errorMsg }, { status: 500 });
  }
}
