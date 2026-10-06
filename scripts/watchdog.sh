#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# نگهبان سرور پیش‌نمایش شهریار (نسخه‌ی مقاوم + ماندگاری داده)
# ───────────────────────────────────────────────────────────────
# ۱) هر ۱۵ ثانیه پورت ۳۰۰۰ را چک می‌کند؛ اگر پایین بود سرور را با
#    الگوی double-fork (یتیم‌سازی → سپردن به tini/PID 1) بالا می‌آورد.
# ۲) در شروع: بازیابی خودکار دیتابیس/storage/env (autoheal) —
#    ترمیم وضعیت پس از ری‌ست سندباکس.
# ۳) هر ۱۰ دقیقه: اسنپ‌شات ماندگاری (دیتابیس + storage + کلیدها →
#    git commit) — تنها چیزهایی که از ری‌ست سندباکس جان می‌برند
#    فایل‌های git-tracked هستند.
# لاگ: /home/z/my-project/watchdog.log
# اجرا:  ( setsid nohup bash /home/z/my-project/scripts/watchdog.sh & )
# ═══════════════════════════════════════════════════════════════
cd /home/z/my-project
echo "[$(date '+%H:%M:%S')] watchdog شروع شد (PID $$)" >> watchdog.log

# ── ترمیم اولیه: اگر دیتابیس/استوریج با ری‌ست سندباکس پاک شده باشد ──
bash scripts/db-autoheal.sh --no-revive >> watchdog.log 2>&1

SNAPSHOT_EVERY=40   # هر ۴۰ چرخه × ۱۵ ثانیه = ۱۰ دقیقه
CYCLE=0

while true; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ --max-time 3 2>/dev/null || echo 000)
  if [ "$code" != "200" ]; then
    echo "[$(date '+%H:%M:%S')] سرور پایین است (HTTP $code) — راه‌اندازی مجدد..." >> watchdog.log
    rm -f .next/dev/lock 2>/dev/null
    # الگوی دقیق — «next dev» به تنهایی wrapper اسکریپت dev را می‌کشت
    pkill -f "node_modules/.bin/next" 2>/dev/null
    pkill -f "next-server" 2>/dev/null
    sleep 2
    # ── الگوی double-fork: ساب‌شل فوراً exit می‌شود → پردازه یتیم
    # → والدش tini (PID 1) می‌شود → از کشته‌شدن با bash در امان می‌ماند
    ( setsid nohup bun run dev >> /home/z/my-project/dev.log 2>&1 & )
    # صبر برای آماده شدن (حداکثر ۹۰ ثانیه)
    ok=0
    for i in $(seq 1 90); do
      c=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ --max-time 3 2>/dev/null || echo 000)
      if [ "$c" = "200" ]; then
        echo "[$(date '+%H:%M:%S')] سرور بعد از ${i}s دوباره بالا آمد ✓" >> watchdog.log
        ok=1
        break
      fi
      sleep 1
    done
    [ "$ok" = "0" ] && echo "[$(date '+%H:%M:%S')] ⚠ سرور در ۹۰ ثانیه بالا نیامد — تلاش مجدد در چرخه بعد" >> watchdog.log
  fi

  # ── چک سلامت دیتابیس هر چرخه (درس Task 47: clobber پلتفرم) ──
  DBH=$(node scripts/db-health.mjs 2>/dev/null || echo '{"healthy":false}')
  if ! echo "$DBH" | grep -q '"healthy":true'; then
    # cooldown ده‌دقیقه‌ای — اگر autoheal نتوانست درست کند، سرور له‌له نشود
    if [ ! -f /tmp/db-heal-cooldown ] || [ -n "$(find /tmp/db-heal-cooldown -mmin +10 2>/dev/null)" ]; then
      touch /tmp/db-heal-cooldown
      echo "[$(date '+%H:%M:%S')] ⚠ دیتابیس ناسالم ($DBH) — autoheal..." >> watchdog.log
      bash scripts/db-autoheal.sh --no-revive >> watchdog.log 2>&1
      # autoheal سرور را کشت؛ چرخه بعدی دوباره بالا می‌آوردش
    fi
  fi

  # ── اسنپ‌شات دوره‌ای ماندگاری (هر ۱۰ دقیقه؛ commit فقط هنگام تغییر) ──
  CYCLE=$((CYCLE+1))
  if [ "$CYCLE" -ge "$SNAPSHOT_EVERY" ]; then
    CYCLE=0
    bash scripts/db-snapshot.sh >> watchdog.log 2>&1
  fi

  sleep 15
done
