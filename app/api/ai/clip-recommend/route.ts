import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    moments: [
      { timecode: "00:12:44", reason: "Эмоциональный пик", title: "Донат, после которого стример замолчал", score: 91 },
      { timecode: "01:08:19", reason: "Мемная фраза", title: "Он не поверил, что это случилось", score: 87 },
      { timecode: "02:41:02", reason: "Неожиданный поворот", title: "Самый дорогой раунд вечера", score: 83 }
    ]
  });
}
