// app/tv/page.tsx
// URL เดิมของจอ TV — ตอนนี้จอคิวย้ายมาอยู่หน้าแรกแล้ว ส่งต่อไปให้
// (เก็บไว้เพราะทีวีที่ตั้งไว้แล้วอาจ bookmark /tv ไว้)
import { redirect } from "next/navigation";

export default function TvRedirect() {
  redirect("/");
}
