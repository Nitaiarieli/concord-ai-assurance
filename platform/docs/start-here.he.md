# התחלה מהירה לצוות Concord

הגרסה החדשה נמצאת בתיקיית `platform` במאגר. קוד הגרסה הקודמת נשמר בשורש המאגר; לעבודה על הפלטפורמה החדשה מתחילים כאן.

נדרשים Git, Node.js 24 ו־Python 3.11 ומעלה.

```bash
git clone https://github.com/Nitaiarieli/concord-ai-assurance.git
cd concord-ai-assurance/platform
npm ci
npm run prepare:python
npm run dev:local
```

פתחו בדפדפן את כתובת ה־localhost שהפקודה מציגה. ב־Windows אפשר להשתמש ב־WSL2 עם Ubuntu. הוראות ל־PowerShell והסברים מפורטים נמצאים ב־[מדריך ההקמה](developer-setup.md).

אין צורך במפתח API או חשבון ענן כדי להריץ את הדמו. הוא עובד על נתוני דוגמה. ממשק המשתמש מפעיל Python בדפדפן; ה־API המקומי הוא סביבת בדיקה נפרדת ואינו מתחבר לממשק אוטומטית.

הקוד העסקי נמצא ב־`backend/concord`, הממשק ב־`components/concord`, תמונות האתר ב־`public/assets`, ותמונות המקור הנוספות ב־`design/source-images`.

אחרי שינוי ב־Python מריצים `npm run test:python` ואז `npm run prepare:python`. בדיקות נוספות: `npm run test:wasm` ו־`npm run build:local`.
