// Claude API utility with model selection and logging

export type ClaudeModel = 'haiku' | 'sonnet'

const MODEL_IDS: Record<ClaudeModel, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-5-20250929',
}

// Pricing per 1M tokens (USD) - for cost estimation
const PRICING: Record<ClaudeModel, { input: number; output: number }> = {
  haiku: { input: 0.80, output: 4.00 },
  sonnet: { input: 3.00, output: 15.00 },
}

interface ClaudeOptions {
  model: ClaudeModel
  system?: string
  prompt: string
  maxTokens?: number
}

interface ClaudeResponse {
  text: string
  model: ClaudeModel
  inputTokens: number
  outputTokens: number
  estimatedCost: number
}

function getAnthropicKey(): string {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured')
  return key
}

function calculateCost(model: ClaudeModel, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model]
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
}

export async function callClaude(options: ClaudeOptions): Promise<ClaudeResponse> {
  const { model, system, prompt, maxTokens = 2000 } = options
  const modelId = MODEL_IDS[model]

  const messages: Array<{ role: string; content: string }> = [
    { role: 'user', content: prompt }
  ]

  const body: Record<string, unknown> = {
    model: modelId,
    max_tokens: maxTokens,
    messages,
  }

  if (system) {
    body.system = system
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': getAnthropicKey(),
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()

  if (!response.ok || !data.content?.[0]) {
    throw new Error(`Claude API error (${model}): ${data.error?.message || 'Unknown error'}`)
  }

  const inputTokens = data.usage?.input_tokens || 0
  const outputTokens = data.usage?.output_tokens || 0
  const estimatedCost = calculateCost(model, inputTokens, outputTokens)

  // Log usage for cost tracking
  console.log(`[Claude ${model.toUpperCase()}] Model: ${modelId} | Input: ${inputTokens} tokens | Output: ${outputTokens} tokens | Cost: $${estimatedCost.toFixed(4)}`)

  return {
    text: data.content[0].text,
    model,
    inputTokens,
    outputTokens,
    estimatedCost,
  }
}

// Helper to clean JSON from markdown code blocks
export function cleanJsonResponse(text: string): string {
  return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
}

// Call Claude with fallback: try first model, if parsing fails try fallback model
export async function callClaudeWithFallback(
  options: ClaudeOptions,
  fallbackModel: ClaudeModel
): Promise<ClaudeResponse & { usedFallback: boolean }> {
  try {
    const response = await callClaude(options)

    // Validate JSON response
    const cleaned = cleanJsonResponse(response.text)
    JSON.parse(cleaned) // Will throw if invalid

    return { ...response, usedFallback: false }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.warn(`[Claude ${options.model.toUpperCase()}] Failed: ${errorMessage} - Retrying with ${fallbackModel}...`)

    const fallbackResponse = await callClaude({
      ...options,
      model: fallbackModel,
    })

    return { ...fallbackResponse, usedFallback: true }
  }
}
