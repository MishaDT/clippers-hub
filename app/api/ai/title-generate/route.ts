import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    titles: [
      "Донат, который сломал стрим",
      "Он не ожидал такой реакции",
      "Самая дорогая ошибка вечера",
      "Этот момент уже утащили в клипы",
      "Стример понял все слишком поздно"
    ],
    hashtags: ["#stream", "#clips", "#ch_NX24", "#viral", "#shorts"]
  });
}
