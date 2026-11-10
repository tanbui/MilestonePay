import { PINECREST_SOW_FILENAME, PINECREST_SOW_TEXT } from "@/data/samples";
import { createDraftFromSow, WorkflowError } from "@/lib/agent/workflows";

// Reading a long SOW with Claude can take a while.
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;

/** Upload a SOW (multipart `file`, or `sample=pinecrest`) and get a draft project back. */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Send the SOW as multipart form data." }, { status: 400 });
  }

  let input: { fileName: string; mediaType: "application/pdf" | "text/plain"; data: string };
  if (form.get("sample") === "pinecrest") {
    input = { fileName: PINECREST_SOW_FILENAME, mediaType: "text/plain", data: PINECREST_SOW_TEXT };
  } else {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: "Choose a SOW file to upload." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "That file is over 4 MB." }, { status: 413 });
    }
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    input = isPdf
      ? { fileName: file.name, mediaType: "application/pdf", data: Buffer.from(await file.arrayBuffer()).toString("base64") }
      : { fileName: file.name, mediaType: "text/plain", data: await file.text() };
  }

  try {
    const { projectId } = await createDraftFromSow(input);
    return Response.json({ projectId });
  } catch (error) {
    console.error("SOW extraction failed", error);
    const message =
      error instanceof WorkflowError ? error.message : "The agent couldn't read that document. Check the server logs and your ANTHROPIC_API_KEY.";
    return Response.json({ error: message }, { status: 500 });
  }
}
