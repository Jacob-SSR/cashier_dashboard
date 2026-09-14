// lib/audio/AudioQueueManager.ts
// เล่นเสียงประกาศทีละอัน ห้ามทับกัน
//
// เจ้าหน้าที่กดเรียกคิวรัว ๆ ได้ (คนหนึ่งไม่มา กดเรียกคนถัดไปเลย) ถ้าปล่อยให้
// เล่นพร้อมกันคนไข้จะไม่ได้ยินชื่อตัวเองสักคน ตัวนี้จึงต่อคิวเสียงไว้แล้วเล่น
// ไล่ทีละอันจนหมด
//
// ใช้ HTMLAudioElement ล้วน ๆ ไม่มี API เฉพาะยี่ห้อ จึงใช้ได้กับทีวีทุกแบรนด์
type Task = { url: string; onDone?: () => void };

/** แปลรหัส error ของ <audio> เป็นภาษาที่บอกสาเหตุได้จริง */
function describeMediaError(err: MediaError | null): string {
  if (!err) return "ไม่ทราบสาเหตุ";
  switch (err.code) {
    case 1:
      return "MEDIA_ERR_ABORTED — ถูกยกเลิกกลางคัน";
    case 2:
      return "MEDIA_ERR_NETWORK — เน็ตหลุดระหว่างโหลด";
    case 3:
      return "MEDIA_ERR_DECODE — โหลดได้แต่ถอดรหัสไม่ได้ (ไฟล์ไม่ใช่ MP3 ที่ถูกต้อง)";
    case 4:
      return "MEDIA_ERR_SRC_NOT_SUPPORTED — เบราว์เซอร์ไม่รับไฟล์นี้ (มักได้ HTML แทนเสียง)";
    default:
      return `code ${err.code} ${err.message}`;
  }
}

export class AudioQueueManager {
  private queue: Task[] = [];
  private playing = false;
  private unlocked = false;
  private unlocking: Promise<boolean> | null = null;

  /** element เดียวใช้ซ้ำตลอด — ทีวีบางรุ่นสร้าง Audio ใหม่รัว ๆ แล้วค้าง */
  private el: HTMLAudioElement | null = null;

  private makeEl(): HTMLAudioElement {
    const el = new Audio();
    el.preload = "auto";
    // ทีวีบางรุ่นต้องมี attribute นี้ถึงจะเล่นโดยไม่เปิดตัวเล่นเต็มจอ
    el.setAttribute("playsinline", "");
    return el;
  }

  private element(): HTMLAudioElement {
    if (!this.el) this.el = this.makeEl();
    return this.el;
  }

  /**
   * ปลดล็อกเสียง — ต้องเรียก "ในจังหวะที่ผู้ใช้เพิ่งกดปุ่ม" เท่านั้น
   * เบราว์เซอร์นับว่าเป็น user gesture แล้วจะยอมให้เล่นเสียงได้ตลอดไป
   * เล่นไฟล์เงียบสั้น ๆ 1 ครั้งเพื่อ "จอง" สิทธิ์ไว้
   */
  unlock(fromGesture = false): Promise<boolean> {
    if (this.unlocked) return Promise.resolve(true);
    // กำลังประกาศอยู่ = เบราว์เซอร์ยอมให้เล่นแล้ว ไม่ต้องไปยุ่งอะไรอีก
    if (this.playing) {
      this.unlocked = true;
      return Promise.resolve(true);
    }

    // ห้ามลอง play เองนอก user gesture เพราะจะได้ NotAllowedError ทุกครั้งบน Chrome/TV
    if (!fromGesture) return Promise.resolve(false);
    // pointerdown + click หรือปุ่มบนจออาจเข้ามาซ้อนกัน ใช้ promise เดิม
    if (this.unlocking) return this.unlocking;

    const el = this.element();
    el.src = SILENT_WAV;
    el.muted = true;
    // เรียกก่อน await ใด ๆ เพื่อให้ browser ผูกกับ user gesture นี้
    const play = el.play();
    this.unlocking = play
      .then(() => {
        el.pause();
        el.currentTime = 0;
        el.muted = false;
        this.unlocked = true;
        return true;
      })
      .catch((err: unknown) => {
        el.muted = false;
        console.warn("[audio] ปลดล็อกเสียงไม่สำเร็จ:", err);
        return false;
      })
      .finally(() => {
        this.unlocking = null;
      });
    return this.unlocking;
  }

  isUnlocked(): boolean {
    // กำลังเล่นอยู่ = เบราว์เซอร์ยอมให้เล่นแน่นอน ถือว่าปลดล็อกแล้ว
    return this.unlocked || this.playing;
  }

  /** ต่อคิวเสียง ถ้ายังไม่มีอะไรเล่นอยู่ก็เริ่มเล่นเลย */
  enqueue(url: string, onDone?: () => void): void {
    this.queue.push({ url, onDone });
    if (!this.playing) void this.drain();
  }

  clear(): void {
    this.queue = [];
  }

  private async drain(): Promise<void> {
    this.playing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;
      await this.playOne(task.url);
      task.onDone?.();
    }
    this.playing = false;
  }

  private playOne(url: string): Promise<void> {
    return new Promise((resolve) => {
      const el = this.element();
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        el.onended = null;
        el.onerror = null;
        clearTimeout(guard);
        resolve();
      };

      // กันค้าง: ถ้าไฟล์เสีย/เน็ตหลุด ต้องไม่ทำให้คิวเสียงตันทั้งวัน
      const guard = setTimeout(finish, 30_000);

      el.onended = finish;
      el.onerror = () => {
        // บอกให้ชัดว่าพังเพราะอะไร ไม่ใช่แค่ "เล่นไม่ได้"
        // MEDIA_ERR_DECODE / SRC_NOT_SUPPORTED = ไฟล์ที่ได้ไม่ใช่ MP3 ที่เล่นได้
        // → เปิด /api/tts?debug=1&text=... ดูว่าเซิร์ฟเวอร์ได้อะไรมาจาก Google
        console.error(
          `[audio] เล่นไฟล์เสียงไม่ได้ (${describeMediaError(el.error)})`,
          "\nลองเปิดดูสาเหตุที่:",
          url.replace("/api/tts?", "/api/tts?debug=1&"),
        );
        finish();
      };

      el.src = url;
      el.play()
        .then(() => {
          // เล่นได้ = เบราว์เซอร์ยอมแล้วแน่นอน
          this.unlocked = true;
        })
        .catch((err: unknown) => {
          const name = err instanceof Error ? err.name : "";
          if (name === "NotAllowedError") {
            // ยังไม่ได้ปลดล็อก — จอจะขึ้นปุ่มให้กดรีโมต
            console.error("[audio] เบราว์เซอร์ยังไม่อนุญาตให้เล่นเสียง:", err);
            this.unlocked = false;
          } else {
            // AbortError ฯลฯ = โดนขัดจังหวะ ไม่ได้แปลว่าถูกบล็อก
            // ห้ามตั้ง unlocked = false ตรงนี้ ไม่งั้นจะไปกระตุ้นให้ probe
            // มาตั้ง src ทับซ้ำ กลายเป็นวนขัดจังหวะกันเองไม่จบ
            console.error("[audio] เล่นไม่สำเร็จ:", err);
          }
          finish();
        });
    });
  }
}

/** WAV PCM เงียบ 1 sample — browser/TV รองรับกว้างกว่า MP3 และไม่ต้องยิงเน็ต */
const SILENT_WAV = "data:audio/wav;base64,UklGRiUAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQEAAACA";

/** เก็บไว้เพื่อรองรับการอ้างอิงจาก build เก่า; ไม่ใช้เป็น probe แล้ว */
const SILENT_MP3 =
  "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tAwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA//////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAASDs90hvAAAAAAAAAAAAAAAAAAAA//sQxAADwAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQxCADwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";
