// Manual implementation of getCharacterInfo based on https://github.com/realcoloride/node_characterai/blob/2.0/src/character/character.ts
import { gotScraping } from "got-scraping";

export interface CharacterInfo {
  external_id: string;
  name: string;
  title: string;
  description: string;
  greeting: string;
  avatar_file_name: string;
  visibility: string;
  participant__name: string;
  copyable: boolean;
  creator_username: string;
  categories: string[];
  // Add more fields as needed
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

    // Access the parsed body directly
    const data = response.body as { character?: CharacterInfo };

    if (!data.character) {
      throw new Error("Character info not found in response");
    }

    return data.character;
  } catch (error: any) {
    // If Cloudflare blocks it, you'll see a 403 or 401 error here
    throw new Error(
      `Request failed: ${error.response?.body ? JSON.stringify(error.response.body) : error.message}`,
    );
  }
}
