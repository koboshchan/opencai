import { requireViewer } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";
import { updateProfileSchema } from "@/lib/validators";
import { getDb } from "@/lib/db";
import { UserDocument } from "@/lib/types";

export async function GET() {
  try {
    const viewer = await requireViewer();

    return Response.json({
      user: {
        id: viewer.user._id?.toString(),
        clerkUserId: viewer.user.clerkUserId,
        email: viewer.user.email,
        displayName: viewer.user.displayName,
        description: viewer.user.description ?? null,
        imageUrl: viewer.user.imageUrl,
        isAdmin: viewer.user.isAdmin,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const viewer = await requireViewer();
    const payload = updateProfileSchema.parse(await request.json());
    const db = await getDb();

    const updateDoc: Partial<UserDocument> = {
      updatedAt: new Date(),
    };

    if (payload.displayName !== undefined) {
      updateDoc.displayName = payload.displayName;
    }
    if (payload.description !== undefined) {
      updateDoc.description = payload.description;
    }

    await db.collection<UserDocument>("users").updateOne(
      { clerkUserId: viewer.clerkUserId },
      { $set: updateDoc }
    );

    const updatedUser = await db.collection<UserDocument>("users").findOne({ clerkUserId: viewer.clerkUserId });
    if (!updatedUser) {
      throw new Error("User not found after update.");
    }

    return Response.json({
      user: {
        id: updatedUser._id?.toString(),
        clerkUserId: updatedUser.clerkUserId,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        description: updatedUser.description ?? null,
        imageUrl: updatedUser.imageUrl,
        isAdmin: updatedUser.isAdmin,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}