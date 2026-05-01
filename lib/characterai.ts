// Manual implementation of getCharacterInfo based on https://github.com/realcoloride/node_characterai/blob/2.0/src/character/character.ts
import { gotScraping } from "got-scraping";

export interface CharacterInfo {
  external_id?: string;
  name: string;
  title: string;
  greeting: string;
  description: string;
  avatar_file_name: string;
  participant__name?: string;
  visibility?: string;
  copyable?: boolean;
  creator_username?: string;
  categories?: string[];
}

interface CharacterInfoResponse {
  character?: Partial<CharacterInfo>;
  status?: string;
}

function normalizeCharacterInfo(raw: Partial<CharacterInfo>): CharacterInfo {
  const normalizedName = (raw.name || raw.participant__name || "Imported character").trim();

  return {
    external_id: raw.external_id,
    name: normalizedName,
    title: (raw.title || "").trim(),
    greeting: (raw.greeting || "").trim(),
    description: (raw.description || "").trim(),
    avatar_file_name: (raw.avatar_file_name || "").trim(),
    participant__name: raw.participant__name?.trim(),
    visibility: raw.visibility,
    copyable: raw.copyable,
    creator_username: raw.creator_username,
    categories: Array.isArray(raw.categories) ? raw.categories : [],
  };
}

export async function getCharacterInfo(
  characterId: string,
  token: string,
): Promise<CharacterInfo> {
  const url = "https://neo.character.ai/character/v1/get_character_info";
  const idempotencyKey = String(Math.floor(Math.random() * 1e20));

  try {
    const response = await gotScraping({
      url,
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Idempotency-Key": idempotencyKey,
      },
      json: { external_id: characterId, lang: "en" },
      responseType: "json", // Automatically parses response body
      headerGeneratorOptions: {
        browsers: ["safari"],
      },
    });

    const data = response.body as CharacterInfoResponse;

    if (data.status && data.status !== "OK") {
      throw new Error(`CharacterAI returned non-OK status: ${data.status}`);
    }

    if (!data.character) {
      throw new Error("Character info not found in response");
    }

    return normalizeCharacterInfo(data.character);
  } catch (error: unknown) {
    // If Cloudflare blocks it, you'll see a 403 or 401 error here
    const errorWithResponse = error as {
      response?: { body?: unknown };
      message?: string;
    };
    throw new Error(
      `Request failed: ${errorWithResponse.response?.body ? JSON.stringify(errorWithResponse.response.body) : (error instanceof Error ? error.message : "Unknown error")}`,
    );
  }
}
