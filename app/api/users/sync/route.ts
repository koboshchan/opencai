import { syncSignedInUser } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";

export async function POST() {
  try {
    const user = await syncSignedInUser();

    return Response.json({
      user: {
        id: user._id?.toString(),
        clerkUserId: user.clerkUserId,
        email: user.email,
        displayName: user.displayName,
        imageUrl: user.imageUrl,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}