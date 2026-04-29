import { getCharacterInfo } from '@/lib/characterai';
import { toErrorResponse } from '@/lib/errors';

// This endpoint expects ?token=... in the query string for authentication
export async function GET(request: Request, context: RouteContext<"/api/characters/[characterId]/external-info">) {
  try {
    const { characterId } = await context.params;
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    if (!token) {
      return Response.json({ error: 'Missing token' }, { status: 400 });
    }
    const info = await getCharacterInfo(characterId, token);
    return Response.json({ character: info });
  } catch (error) {
    return toErrorResponse(error);
  }
}
