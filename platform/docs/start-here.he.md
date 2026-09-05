# התחלה מהירה לצוות Concord

הגרסה החדשה נמצאת בתיקיית `platform` במאגר. קוד הגרסה הקודמת נשמר בשורש המאגר; לעבודה על הפלטפורמה החדשה מתחילים כאן.

נדרשים Git, Node.js 24 ו־Python 3.11 ומעלה.

```bash
git clone --branch chore/concord-platform-handoff https://github.com/Nitaiarieli/concord-ai-assurance.git
cd concord-ai-assurance/platform
npm ci
npm run prepare:python
npm run dev:local
```

פתחו בדפדפן את כתובת ה־localhost שהפקודה מציגה. ב־Windows אפשר להשתמש ב־WSL2 עם Ubuntu. הוראות ל־PowerShell והסברים מפורטים נמצאים ב־[מדריך ההקמה](developer-setup.md).

אין צורך במפתח API או חשבון ענן כדי להריץ את הדמו. הוא עובד על נתוני דוגמה. המסך הראשי הוא מוקאפ אינטראקטיבי של חיבור Confluence ו־Jira. מעבדת ה־Python הקודמת נמצאת ב־`/runtime-lab`; ה־backend המקומי נפרד ואינו מתחבר למוקאפ אוטומטית.

הקוד העסקי נמצא ב־`backend/concord`, הממשק ב־`components/concord`, תמונות האתר ב־`public/assets`, ותמונות המקור הנוספות ב־`design/source-images`.

אחרי שינוי ב־Python מריצים `npm run test:python` ואז `npm run prepare:python`. בדיקות נוספות: `npm run test:wasm` ו־`npm run build:local`.

## הרכיב האוטומטי החדש

מתיקיית `platform/backend` הריצו `python -m concord.runtime init --directory ../../concord-local`, ואחריו `python -m concord.runtime run --config ../../concord-local/runtime.json`. ערכו קובץ מקור בעורך חיצוני; הזיהוי, העדכון והאימות מתבצעים אוטומטית. מדריך מלא: [Atlassian, API וקבצים](atlassian-mvp.md). נדרש Python 3.11 ומעלה עם Linux, macOS או WSL. האתר הציבורי הוא הדגמה על נתוני דוגמה; הרכיב המקומי עובד על קבצים אמיתיים.
