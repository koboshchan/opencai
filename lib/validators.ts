import { z } from "zod";

const visibilitySchema = z.enum(["public", "private"]);

export const createCharacterSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(1).max(500),
  systemPrompt: z.string().trim().min(1).max(8000),
  visibility: visibilitySchema,
  avatarUrl: z.string().url().nullable().optional(),
  greeting: z.string().trim().max(2000).optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(10).default([]),
});

export const importCharacterSchema = z.object({
  url: z.string().trim().url(),
  visibility: visibilitySchema.default("private"),
});

export const updateCharacterSchema = createCharacterSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field must be provided.",
);

export const startChatSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  modelId: z.string().trim().optional(),
});

export const updateChatSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    archived: z.boolean().optional(),
    modelId: z.string().trim().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided.");

export const createMessageSchema = z.object({
  content: z.string().trim().max(16000).optional(),
  modelId: z.string().trim().optional(),
});

export const providerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  baseUrl: z.string().url(),
  apiKey: z.string().trim().min(8).max(2048),
  isActive: z.boolean().optional().default(true),
});

export const providerUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    baseUrl: z.string().url().optional(),
    apiKey: z.string().trim().min(8).max(2048).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided.");

export const providerModelUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  isEnabled: z.boolean().optional(),
});

export const paginationSchema = z.object({
  cursor: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().optional(),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).optional(),
});