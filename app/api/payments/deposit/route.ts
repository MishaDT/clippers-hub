import { NextResponse } from "next/server";
import { z } from "zod";
import { createPaymentIntent } from "@/lib/payments";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  amountCents: z.number().int().positive(),
  provider: z.enum(["yookassa", "stripe"])
});

export async function POST(request: Request) {
  const user = await requireUser();
  const input = schema.parse(await request.json());
  const intent = await createPaymentIntent({ ...input, userId: user.id, description: "Clippers Hub deposit" });
  return NextResponse.json(intent);
}
