#!/bin/bash
# اجرای پایدار سرور توسعه شهریار — خارج از گروه فرآیند ابزار Bash
cd /home/z/my-project
export NODE_ENV=development
exec bunx next dev -p 3000 > /home/z/my-project/dev.log 2>&1
