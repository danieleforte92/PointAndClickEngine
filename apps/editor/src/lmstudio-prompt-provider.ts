import {
  buildPromptPackContext,
  createPromptPackDocument,
  stableHash,
  type GeneratePromptPackRequest,
  type PromptProviderJob
} from "./prompt-pack-studio";
import { normalizePromptPackOutputs } from "./prompt-pack-output-normalizer";

export interface LMStudioPromptProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface LMStudioPromptProviderOptions {
  fetchImpl?: typeof fetch;
  now?: () => string;
}

interface LocalResponseContent {
  text?: string;
  type?: string;
}

interface LocalResponseOutput {
  content?: LocalResponseContent[];
}

interface LocalResponsesPayload {
  id?: string;
  output?: LocalResponseOutput[];
  output_text?: string;
}

interface LocalChatPayload {
  id?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

function extractResponsesText(payload: LocalResponsesPayload): string {
  if (payload.output_text) return payload.output_text;

  for (const output of payload.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.text) return content.text;
    }
  }

  throw new Error("LM Studio response did not include text output");
}

function extractChatText(payload: LocalChatPayload): string {
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LM Studio chat response did not include message content");
  }
  return content;
}

function buildPromptPackInstruction(context: unknown) {
  return JSON.stringify({
    task:
      "Draft production-ready prompt-pack copy for this 2D point-and-click adventure scene. Return strict JSON only.",
    requiredShape: {
      sceneBackgroundPrompt: "string",
      propPrompts: [{ id: "existing pickup or prop id", prompt: "string" }],
      characterReferencePrompts: [{ id: "existing actor id", prompt: "string" }],
      animationNotes: ["string"],
      negativePrompt: "string",
      styleNotes: ["string"]
    },
    rules: [
      "Do not invent ids.",
      "Use only ids present in the scene context.",
      "Keep prompts concise, visual, and directly useful for image generation.",
      "Avoid baked text in generated artwork."
    ],
    context
  });
}

async function readError(response: Response) {
  return response.text().catch(() => response.statusText);
}

export async function generateLMStudioPromptPack(
  request: GeneratePromptPackRequest,
  config: LMStudioPromptProviderConfig = {},
  options: LMStudioPromptProviderOptions = {}
): Promise<PromptProviderJob> {
  const model = config.model?.trim() || "local-model";
  const baseUrl = (config.baseUrl?.trim() || "http://localhost:1234/v1").replace(/\/+$/, "");
  const apiKey = config.apiKey?.trim() || "lm-studio";
  const context = buildPromptPackContext(request.bundle, request.sceneId, request.artBrief);
  const inputHash = stableHash({ context, model, provider: "lmstudio" });
  const fetchImpl = options.fetchImpl ?? fetch;
  const generatedAt = options.now?.() ?? new Date().toISOString();
  const systemPrompt =
    "You are an art-director assistant for a 2D point-and-click adventure editor. Return only valid JSON and no markdown.";
  const userPrompt = buildPromptPackInstruction(context);

  let jobId = `lmstudio-${inputHash}`;
  let outputText = "";

  const responsesResult = await fetchImpl(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (responsesResult.ok) {
    const payload = (await responsesResult.json()) as LocalResponsesPayload;
    jobId = payload.id ?? jobId;
    outputText = extractResponsesText(payload);
  } else if (responsesResult.status === 404 || responsesResult.status === 400) {
    const chatResult = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.4
      })
    });

    if (!chatResult.ok) {
      throw new Error(`LM Studio provider failed (${chatResult.status}): ${await readError(chatResult)}`);
    }

    const payload = (await chatResult.json()) as LocalChatPayload;
    jobId = payload.id ?? jobId;
    outputText = extractChatText(payload);
  } else {
    throw new Error(`LM Studio provider failed (${responsesResult.status}): ${await readError(responsesResult)}`);
  }

  const outputs = normalizePromptPackOutputs(outputText, "LM Studio");
  const promptPack = createPromptPackDocument(
    {
      ...request,
      generatedAt
    },
    {
      provider: "lmstudio",
      model,
      jobId,
      seed: inputHash
    },
    outputs
  );

  return {
    id: jobId,
    provider: "lmstudio",
    status: "completed",
    candidates: [
      {
        promptPack,
        summary: `${promptPack.outputs.generationTargets.length} target(s), LM Studio ${model}, ${promptPack.outputs.propPrompts.length} prop prompt(s).`
      }
    ]
  };
}
