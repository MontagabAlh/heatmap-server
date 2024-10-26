const express = require('express');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// مسار الصور وملفات JSON
const screenshotDir = path.join(__dirname, 'screenshots');
const jsonDir = path.join(__dirname, 'heatmap');

app.use(express.static(path.join(__dirname, 'public')));

// حالة أخذ اللقطة
let screenshotInProgress = false;

//  لإنشاء لقطة شاشة
app.post('/take-screenshot', async (req, res) => {
    if (screenshotInProgress) {
        return res.status(429).json({ error: 'Screenshot already in progress. Please wait.' });
    }

    screenshotInProgress = true; // تعيين المتغير إلى true عند بدء العملية

    const { url, viewportWidth, device } = req.body;
    const sanitizedUrl = url.replace(/[^a-zA-Z0-9]/g, '_');
    const screenshotName = `${sanitizedUrl}-${viewportWidth}-${device}.png`;
    const screenshotPath = path.join(screenshotDir, screenshotName);

    try {
        // حذف لقطة الشاشة القديمة إذا كانت موجودة
        if (fs.existsSync(screenshotPath)) {
            fs.unlinkSync(screenshotPath);
        }

        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setViewport({ width: viewportWidth, height: 1080 });

        // تحميل الصفحة
        await page.goto(url, { waitUntil: 'networkidle2' });

        // الانتظار لمدة 5 ثوانٍ
        await new Promise(resolve => setTimeout(resolve, 5000));

        // تعيين ارتفاع النافذة إلى ارتفاع الصفحة الكلي
        const pageHeight = await page.evaluate(() => document.body.scrollHeight);
        await page.setViewport({ width: viewportWidth, height: pageHeight });

        // التقاط لقطة الشاشة كاملة
        await page.screenshot({ path: screenshotPath, fullPage: true });
        await browser.close();

        screenshotInProgress = false; // إعادة تعيين المتغير بعد الانتهاء

        res.json({ jsonPath: `${sanitizedUrl}-${viewportWidth}-${device}` });
    } catch (error) {
        console.error('Error taking screenshot:', error);
        screenshotInProgress = false; // إعادة تعيين المتغير في حالة حدوث خطأ
        res.status(500).json({ error: 'Error taking screenshot' });
    }
});

// لتحديث بيانات hover و click بعد 60 ثانية فقط
app.post('/update-data', (req, res) => {
    const { fileName, url, device, viewportWidth, hover, click } = req.body;
    const fileBase = path.join(jsonDir, fileName);
    let visitNumber = 1;
    let jsonFilePath;

    while (fs.existsSync(`${fileBase}-${visitNumber}.json`)) {
        visitNumber++;
    }
    jsonFilePath = `${fileBase}-${visitNumber}.json`;

    try {
        const jsonData = {
            image: `screenshots/${fileName}.png`,
            time: new Date().toISOString(),
            device: device,
            url: url,
            width: viewportWidth,
            hover,
            click,
        };
        fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2));
        res.json({ message: 'Data updated successfully', path: jsonFilePath });
    } catch (error) {
        console.error('Error updating JSON data:', error);
        res.status(500).json({ error: 'Error updating JSON data' });
    }
});

// لاسترجاع الصورة
app.get('/image/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(screenshotDir, filename);

    // التحقق مما إذا كانت الصورة موجودة
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'Image not found' });
    }
});

// لاسترجاع جميع ملفات JSON
app.get('/json/', (req, res) => {
    try {
        const jsonFiles = fs.readdirSync(jsonDir);
        const jsonData = jsonFiles
            .filter(file => file.endsWith('.json')) // تحقق من أن الملف هو JSON
            .map(file => {
                const content = fs.readFileSync(path.join(jsonDir, file), 'utf-8');
                return JSON.parse(content); // تحويل النص إلى JSON
            });

        // ترتيب البيانات حسب الوقت من الأحدث إلى الأقدم
        jsonData.sort((a, b) => new Date(b.time) - new Date(a.time));

        res.json(jsonData);
    } catch (error) {
        console.error('Error reading JSON files:', error);
        res.status(500).json({ error: 'Error reading JSON files' });
    }
});

// لاسترجاع ملف analytics.js
app.get('/analytics.js', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'analytics.js');
    res.sendFile(filePath);
});

// تشغيل السيرفر
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
