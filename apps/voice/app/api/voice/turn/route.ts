import { NextResponse } from 'next/server';
import { executePhoneAction, type PhoneActionArguments } from '../../../../lib/phone-tool';

export const runtime = 'nodejs';

type OpenAIOutputItem = {
  type?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: Array<{
    type?: string;
    text?: string;
  }>;
};

type OpenAIResponse = {
  id?: string;
  output?: OpenAIOutputItem[];
  output_text?: string;
  error?: {
    code?: string;
    message?: string;
    type?: string;
  };
};

type SarvamTranscript = {
  transcript?: string;
  language_code?: string | null;
  error?: {
    message?: string;
  };
};

type ConversationState = {
  responseId: string;
  languageCode: string;
  updatedAt: number;
};

const conversations = new Map<string, ConversationState>();
const conversationTtlMs = 10 * 60 * 1000;

const phoneTools = [
  {
    type: 'function',
    name: 'prepare_grocery',
    description: [
      'Search Blinkit and safely prepare a requested grocery item.',
      'Use this whenever the user asks to add, buy, find, search, or get a grocery product.',
      'This action searches the product and either adds one unambiguous exact match or returns visible options for clarification.',
      'Do not use open_blinkit for a grocery request.',
    ].join(' '),
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        request: {
          type: 'string',
          description: [
            'The exact product words spoken by the user.',
            'Preserve brand, flavor, quantity, and size exactly when provided.',
            'Never invent a variant or size that the user did not say.',
          ].join(' '),
        },
      },
      required: ['request'],
    },
  },
  {
    type: 'function',
    name: 'open_blinkit',
    description: [
      'Open Blinkit without searching or adding anything.',
      'Use only when the user explicitly asks to open or launch Blinkit and does not request a product.',
    ].join(' '),
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {},
      required: [],
    },
  },
  {
    type: 'function',
    name: 'phone_status',
    description: 'Check whether the connected Android phone and Appium are reachable.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {},
      required: [],
    },
  },
];

function phoneActionForCall(
  callName: string,
  arguments_: PhoneActionArguments,
): PhoneActionArguments {
  if (callName === 'prepare_grocery') {
    return { action: 'prepare_grocery', request: arguments_.request };
  }
  if (callName === 'open_blinkit') return { action: 'open_blinkit' };
  if (callName === 'phone_status') return { action: 'phone_status' };
  return {};
}

function extractText(response: OpenAIResponse): string {
  if (response.output_text?.trim()) return response.output_text.trim();

  return response.output
    ?.flatMap((item) => item.content ?? [])
    .filter((content) => content.type === 'output_text' && content.text)
    .map((content) => content.text)
    .join('')
    .trim() ?? '';
}

async function createOpenAIResponse(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<OpenAIResponse> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    body: JSON.stringify(body),
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    method: 'POST',
  });
  const payload = await response.json() as OpenAIResponse;

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `OpenAI returned ${response.status}.`);
  }

  return payload;
}

async function transcribeAudio(apiKey: string, audio: File): Promise<SarvamTranscript> {
  const body = new FormData();
  const contentType = audio.type.split(';', 1)[0] || 'application/octet-stream';
  const normalizedAudio = new Blob([await audio.arrayBuffer()], { type: contentType });
  body.set('file', normalizedAudio, audio.name || 'command.webm');
  body.set('model', 'saaras:v3');
  body.set('mode', 'codemix');
  body.set('language_code', 'unknown');

  const response = await fetch('https://api.sarvam.ai/speech-to-text', {
    body,
    headers: { 'api-subscription-key': apiKey },
    method: 'POST',
  });
  const payload = await response.json() as SarvamTranscript;

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Sarvam transcription returned ${response.status}.`);
  }

  return payload;
}

async function synthesizeSpeech(
  apiKey: string,
  text: string,
  languageCode: string,
): Promise<{ audioBase64?: string; audioType?: string }> {
  const response = await fetch('https://api.sarvam.ai/text-to-speech/stream', {
    body: JSON.stringify({
      text,
      target_language_code: languageCode,
      speaker: 'shubh',
      model: 'bulbul:v3',
      output_audio_codec: 'mp3',
      pace: 1.05,
    }),
    headers: {
      'api-subscription-key': apiKey,
      'content-type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    return {};
  }

  const audio = Buffer.from(await response.arrayBuffer()).toString('base64');
  return {
    audioBase64: audio,
    audioType: response.headers.get('content-type') ?? 'audio/mpeg',
  };
}

export async function POST(request: Request): Promise<Response> {
  const sarvamApiKey = process.env.SARVAM_API_KEY;
  const openAIApiKey = process.env.OPENAI_API_KEY;
  if (!sarvamApiKey || !openAIApiKey) {
    return NextResponse.json(
      { error: 'The server voice providers are not configured.' },
      { status: 503 },
    );
  }

  try {
    const form = await request.formData();
    const audio = form.get('audio');
    const clientIdValue = form.get('clientId');
    const clientId = typeof clientIdValue === 'string' && clientIdValue.trim()
      ? clientIdValue.trim().slice(0, 80)
      : 'pixel-web';
    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: 'A recorded voice command is required.' }, { status: 400 });
    }

    const transcription = await transcribeAudio(sarvamApiKey, audio);
    const transcript = transcription.transcript?.trim();
    if (!transcript) {
      return NextResponse.json({ error: 'I could not hear a clear command. Please try again.' }, { status: 422 });
    }

    const savedConversation = conversations.get(clientId);
    const conversation = savedConversation
      && Date.now() - savedConversation.updatedAt < conversationTtlMs
      ? savedConversation
      : undefined;

    const instructions = [
      'You are ErrandOS, a concise voice-first assistant operating the owner’s Android phone.',
      'The user may speak an Indian language, English, or a code-mixed combination.',
      'Always reply in the same spoken language, script style, and code-mix as the user.',
      'If the transcript is entirely English, reply only in English.',
      'Use Hinglish only when the user mixes Hindi and English.',
      'For Hinglish input, reply in natural Hinglish rather than formal Hindi or English.',
      'Keep the spoken response under three short sentences.',
      'For every request to add, buy, find, search, or get a grocery item, call prepare_grocery immediately.',
      'Never call only open_blinkit when the user also names or requests a grocery item.',
      'Pass the user’s exact product phrase to prepare_grocery; do not invent or silently choose a brand, flavor, pack, or size.',
      'Use open_blinkit only for a bare request to open the app.',
      'When a tool returns needs_clarification, say one short spoken question and mention the exact visible product or size options.',
      'When a tool returns not_found, ask the user to repeat or use another product name.',
      'Never imply an item was added when a tool asks for clarification.',
      'When a tool confirms added or already_in_cart, speak that exact result.',
      'Opening an app and read-only checks are safe.',
      'Never claim an order was placed unless a tool returns a verified provider reference.',
      'Before any purchase, say that explicit review is required.',
    ].join(' ');

    let aiResponse = await createOpenAIResponse(openAIApiKey, {
      model: 'gpt-4.1-mini',
      instructions,
      input: transcript,
      tools: phoneTools,
      tool_choice: 'auto',
      ...(conversation ? { previous_response_id: conversation.responseId } : {}),
    });

    const toolCalls = aiResponse.output?.filter((item) => item.type === 'function_call') ?? [];
    const toolEvents: string[] = [];
    const toolResults: unknown[] = [];

    if (toolCalls.length > 0 && aiResponse.id) {
      const toolOutputs = [];
      for (const call of toolCalls) {
        if (!call.call_id || !call.name) continue;

        let arguments_: PhoneActionArguments = {};
        try {
          arguments_ = JSON.parse(call.arguments ?? '{}') as PhoneActionArguments;
        } catch {
          arguments_ = {};
        }

        const phoneAction = phoneActionForCall(call.name, arguments_);
        const result = await executePhoneAction(phoneAction);
        toolEvents.push(phoneAction.action ?? call.name);
        toolResults.push(result);
        toolOutputs.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify(result),
        });
      }

      if (toolOutputs.length > 0) {
        aiResponse = await createOpenAIResponse(openAIApiKey, {
          model: 'gpt-4.1-mini',
          instructions,
          previous_response_id: aiResponse.id,
          input: toolOutputs,
          tools: phoneTools,
        });
      }
    }

    const reply = extractText(aiResponse) || 'Done.';
    const detectedLanguage = transcription.language_code || conversation?.languageCode || 'en-IN';
    const isShortFollowUp = transcript.trim().split(/\s+/).length <= 3;
    const responseLanguage = isShortFollowUp && conversation
      ? conversation.languageCode
      : detectedLanguage;
    if (aiResponse.id) {
      conversations.set(clientId, {
        responseId: aiResponse.id,
        languageCode: responseLanguage,
        updatedAt: Date.now(),
      });
    }

    const firstToolResult = toolResults[0] as { status?: string } | undefined;
    const assistantState = ['needs_clarification', 'not_found'].includes(
      firstToolResult?.status ?? '',
    )
      ? 'clarification'
      : ['added', 'already_in_cart'].includes(firstToolResult?.status ?? '')
        ? 'success'
        : 'ready';
    const voice = await synthesizeSpeech(sarvamApiKey, reply, responseLanguage);

    return NextResponse.json({
      ok: true,
      transcript,
      reply,
      languageCode: responseLanguage,
      toolEvents,
      toolResults,
      assistantState,
      ...voice,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The voice turn failed.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
