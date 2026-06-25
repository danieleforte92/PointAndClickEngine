import {
  buildPromptPackContext,
  createPromptPackDocument,
  stableHash,
  type GeneratePromptPackRequest,
  type PromptProviderJob
} from "./prompt-pack-studio";
import { normalizePromptPackOutputs } from "./prompt-pack-output-normalizer";

export interface OpenAIPromptProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface OpenAIPromptProviderOptions {
  fetchImpl?: typeof fetch;
  now?: () => string;
}

interface OpenAIResponseContent {
  text?: string;
  type?: string;
}

interface OpenAIResponseOutput {
  content?: OpenAIResponseContent[];
}

interface OpenAIResponsesPayload {
  id?: string;
  output?: OpenAIResponseOutput[];
  output_text?: string;
}

const outputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "sceneBackgroundPrompt",
    "propPrompts",
    "characterReferencePrompts",
    "animationNotes",
    "negativePrompt",
    "styleNotes"
  ],
  properties: {
    sceneBackgroundPrompt: { type: "string", minLength: 1 },
    propPrompts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "prompt"],
        properties: {
          id: { type: "string", minLength: 1 },
          prompt: { type: "string", minLength: 1 }
        }
      }
    },
    characterReferencePrompts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "prompt"],
        properties: {
          id: { type: "string", minLength: 1 },
          prompt: { type: "string", minLength: 1 }
        }
      }
    },
    animationNotes: {
      type: "array",
      items: { type: "string", minLength: 1 }
    },
    negativePrompt: { type: "string" },
    styleNotes: {
      type: "array",
      items: { type: "string", minLength: 1 }
    }
  }
};

function extractOutputText(payload: OpenAIResponsesPayload): string {
  if (payload.output_text) return payload.output_text;

  for (const output of payload.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.text) return content.text;
    }
  }

  throw new Error("OpenAI response did not include text output");
}

export async function generateOpenAIPromptPack(
  request: GeneratePromptPackRequest,
  config: OpenAIPromptProviderConfig,
  options: OpenAIPromptProviderOptions = {}
): Promise<PromptProviderJob> {
  const apiKey = config.apiKey?.trim() || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI provider needs an API key or OPENAI_API_KEY.");
  }

  const model = config.model?.trim() || "gpt-5.2";
  const baseUrl = (config.baseUrl?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
  const context = buildPromptPackContext(request.bundle, request.sceneId, request.artBrief);
  const inputHash = stableHash({ context, model });
  const fetchImpl = options.fetchImpl ?? fetch;
  const generatedAt = options.now?.() ?? new Date().toISOString();

  const response = await fetchImpl(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "You are an art-director assistant for a 2D point-and-click adventure editor. Return only JSON that matches the supplied schema. Do not invent ids; use only ids present in the scene context."
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Draft production-ready prompt-pack copy for this scene. Keep prompts concise, specific, and useful for image generation.",
            context
          })
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "prompt_pack_outputs",
          strict: true,
          schema: outputSchema
        }
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI provider failed (${response.status}): ${detail || response.statusText}`);
  }

  const payload = (await response.json()) as OpenAIResponsesPayload;
  const outputs = normalizePromptPackOutputs(extractOutputText(payload), "OpenAI");
  const jobId = payload.id ?? `openai-${inputHash}`;
  const promptPack = createPromptPackDocument(
    {
      ...request,
      generatedAt
    },
    {
      provider: "openai",
      model,
      jobId,
      seed: inputHash
    },
    outputs
  );

  return {
    id: jobId,
    provider: "openai",
    status: "completed",
    candidates: [
      {
        promptPack,
        summary: `${promptPack.outputs.generationTargets.length} target(s), OpenAI ${model}, ${promptPack.outputs.propPrompts.length} prop prompt(s).`
      }
    ]
  };
}
