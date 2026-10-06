#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# احیای سرور پیش‌نمایش شهریار (پورت ۳۰۰۰) + نگهبان
# سرور hang شده را می‌کشد و watchdog را (در صورت خاموش بودن)
# با الگوی double-fork اجرا می‌کند؛ خود watchdog سرور را با
# همان الگو بالا می‌آورد و برای همیشه زنده نگه می‌دارد.
# نکته: الگوهای pkill عمداً داخل این فایل هستند تا با cmdline
# ابزار bash تداخل نکنند (self-match).
# اجرا: bash /home/z/my-project/scripts/revive-preview.sh
# ═══════════════════════════════════════════════════════════════
cd /home/z/my-project

echo "[$(date '+%H:%M:%S')] کشتن سرورهای قبلی (hang شده)..."
# الگوی دقیق — «next dev» به تنهایی wrapper اسکریپت dev را می‌کشت
pkill -f "node_modules/.bin/next" 2>/dev/null
pkill -f "next-server" 2>/dev/null
pkill -f "postcss.js" 2>/dev/null
sleep 2
rm -f .next/dev/lock 2>/dev/null

if pgrep -f "scripts/watchdog.sh" > /dev/null 2>&1; then
  echo "[$(date '+%H:%M:%S')] watchdog از قبل فعال است — خودش سرور را احیا می‌کند"
else
  ( setsid nohup bash /home/z/my-project/scripts/watchdog.sh > /dev/null 2>&1 & )
  echo "[$(date '+%H:%M:%S')] watchdog با الگوی double-fork اجرا شد — سرور را احیا می‌کند"
fi
echo "revival initiated"
