# Gemini Local Cloud Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use Gemini for the existing cloud AI flows in local web and Android clients without weakening offline fallback or exposing the key.

**Architecture:** The NestJS AI services share one provider adapter. The adapter sends Anthropic requests through the existing SDK and Gemini requests to the official `generateContent` API. The current authorization, UML validation, proposal confirmation, and deterministic code generation remain unchanged.

**Tech Stack:** NestJS, TypeScript, Jest, built-in `fetch`, Anthropic SDK, Gemini REST API.

**Spec:** `docs/superpowers/specs/2026-09-21-gemini-local-cloud-provider-design.md`

## Global Constraints

- Keep credentials only in ignored `backend/.env` and backend memory.
- Keep `AI_PROVIDER=anthropic` operational for existing installations.
- Select `gemini-3.8-flash` by default when Gemini is chosen.
- Never label a local fallback as a successful cloud response.
- Do not merge or push to `main`.

## Review Focus

- A Gemini key may list models while generation is denied: the app must show fallback rather than `mode=cloud`.
- Image data must reach Gemini as an inline image part and must not be written to diagnostic files on failure.
- Empty or malformed successful Gemini responses must be rejected.
- Refinement responses outside the allowed feature list must still be rejected.
- Logs must not contain the API key or full provider payload.

---

### Task 1: Provider selection and adapter

**Files:** Modify `backend/src/ai-chat/ai-provider.config.ts`; create `backend/src/ai-chat/cloud-ai.client.ts`; test `backend/src/ai-chat/ai-provider.config.spec.ts` and `backend/src/ai-chat/cloud-ai.client.spec.ts`.

**Interfaces:** `resolveAiProviderConfig(config): AiProviderConfig` produces provider, key, models. `CloudAiClient.generate({prompt,model,maxTokens,json,image?}): Promise<string>` consumes this configuration.

- [ ] Write tests for Gemini precedence when selected, Anthropic legacy behavior, Gemini text/image request encoding, denied requests, and missing output.
- [ ] Run `npm test -- --runInBand ai-provider.config.spec.ts cloud-ai.client.spec.ts`; confirm new behavior fails first.
- [ ] Implement the provider config and client with a 60-second request timeout, key in the `x-goog-api-key` header, and sanitized errors.
- [ ] Run the same tests and `npm run build`; confirm success.

### Task 2: Use the adapter in both AI services

**Files:** Modify `backend/src/ai-chat/ai-chat.service.ts`, `backend/src/ai-chat/backend-refinement.service.ts` and their `.spec.ts` files.

**Interfaces:** Both services consume `CloudAiClient.generate`; their HTTP results and confirmation tokens retain existing shapes.

- [ ] Write failing tests for Gemini UML/chat/image responses, Gemini refinement proposal, and fallback on a provider denial.
- [ ] Run `npm test -- --runInBand ai-chat.service.spec.ts backend-refinement.service.spec.ts`; inspect expected failures.
- [ ] Replace provider-specific calls with the adapter, preserve validation/audit, and remove raw failed-image diagnostic writes.
- [ ] Run the focused tests and then `npm test -- --runInBand`; confirm success.

### Task 3: Local configuration, documentation, and live verification

**Files:** Modify ignored `backend/.env`, `backend/.env.example`, `README.md`, `docs/TRACEABILITY.md`.

**Interfaces:** `AI_PROVIDER=gemini`, `GEMINI_API_KEY`, `AI_MODEL_MAIN`, `AI_MODEL_FAST` are read by Task 1; no key is committed.

- [ ] Put the provided key only into ignored `backend/.env`; put placeholders in `.env.example`.
- [ ] Update setup and traceability text to distinguish implemented adapter from actual account access.
- [ ] Run `npm test -- --runInBand`, `npm run build`, and a minimal live Gemini generation call without printing the key.
- [ ] Restart the local backend and verify the app's authenticated chat path if the provider permits generation; otherwise record the precise external refusal.
