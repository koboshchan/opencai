import { requireViewer } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";
import { getEnabledModels } from "@/lib/providers";

export async function GET() {
  try {
    await requireViewer();
    const models = await getEnabledModels();

    return Response.json({ models });
  } catch (error) {
    return toErrorResponse(error);
  }
}