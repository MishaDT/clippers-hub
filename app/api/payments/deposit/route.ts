import { NextResponse } from "next/server";
import { z } from "zod";
import { createPaymentIntent } from "@/lib/payments";

const schema = z.object({
  amountCents: z.number().int().positive(),
  userId: z.string().min(1),
  provider: z.enum(["yookassa", "stripe"])
});

export async function POST(request: Request) {
  const input = schema.parse(await request.json());
  const intent = await createPaymentIntent({ ...input, description: "Clippers Hub deposit" });
  return NextResponse.json(intent);
}
