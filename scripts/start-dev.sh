#!/bin/bash
# راه‌اندازی سریع سرور توسعه و انتظار برای آماده‌شدن
# استفاده: source scripts/start-dev.sh
pkill -f "next dev" 2>/dev/null
sleep 1
cd /home/z/my-project
nohup bunx next dev -p 3000 > /home/z/my-project/dev.log 2>&1 &
SERVER_PID=$!
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ --max-time 3 2>/dev/null)
  if [ "$code" = "200" ]; then
    echo "SERVER_READY (after ${i}s)"
    return 0 2>/dev/null || exit 0
  fi
  sleep 1
done
echo "SERVER_TIMEOUT"
exit 1
