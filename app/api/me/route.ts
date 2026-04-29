import { requireViewer } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const viewer = await requireViewer();

    return Response.json({
      user: {
        id: viewer.user._id?.toString(),
        clerkUserId: viewer.user.clerkUserId,
        email: viewer.user.email,
        displayName: viewer.user.displayName,
        imageUrl: viewer.user.imageUrl,
        isAdmin: viewer.user.isAdmin,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}