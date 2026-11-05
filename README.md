# CCAP — Crypto Capital Dashboard (iPhone PWA)

**نسخه انتشار: 0.9.28**

داشبورد فارسی مدیریت سرمایه و تحلیل بازار برای iPhone. قابل نصب از Safari با گزینه Add to Home Screen.

## امکانات
- اسکن زنده بازار و تحلیل چندتایم‌فریم.
- حالت ترکیب چند استراتژی و موتور هوشمند تطبیقی.
- اسکن ابری مستقل از باز بودن اپ با Cloudflare Workers؛ اجرای فعلی هر ۲ دقیقه.
- ذخیره آخرین Snapshot و نمایش وضعیت تازگی داده.
- اعلان Web Push برای سیگنال جدید، تغییر جهت و تضعیف سیگنال.
- مدیریت ریسک و سرمایه و Paper Trading.

## نصب
1. این سایت را در Safari آیفون باز کنید.
2. Share → Add to Home Screen را انتخاب کنید.
3. برای اعلان‌ها اپ را از آیکون Home Screen باز کنید و اجازه Notifications را بدهید.

## اسکنر ابری
موتور فعال در مخزن خصوصی پروژه است. برای Deploy، لازم است دو GitHub Actions Secret با نام‌های `CLOUDFLARE_API_TOKEN` و `CLOUDFLARE_ACCOUNT_ID` تنظیم شوند؛ سپس Workflow از مسیر Actions اجرا می‌شود. راهنمای دقیق در فایل [راهنمای Cloudflare](https://github.com/mohammadamin2407-wq/crypto-capital-iphone-app/blob/main/cloudflare/SETUP-FA.md) موجود است.

## نکات
- داده‌ها عمومی و فقط‌خواندنی هستند؛ هیچ سفارش واقعی ثبت نمی‌شود.
- تحلیل کندلی عمیق Worker فعلی روی ۶ قرارداد پرحجم انجام می‌شود.
- امتیازها الگوریتمی و آزمایشی‌اند و تضمین سود یا احتمال موفقیت نیستند.
