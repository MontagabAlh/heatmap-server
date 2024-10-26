let hoverData = {};
let clickData = {};
let fileName = '';
let screenshotCaptured = false; 
let sendingDataInProgress = false; // حالة إرسال البيانات

//  لإرسال البيانات بعد 20 ثانية
const sendDataAfterInterval = async () => {
    const url = window.location.href;
    const viewportWidth = window.innerWidth;
    const device = viewportWidth >= 1280 ? 'Desktop' : viewportWidth >= 768 ? 'Tablet' : 'Mobile';

    try {
        if (!screenshotCaptured) {
            const screenshotResponse = await fetch('http://localhost:3001/take-screenshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, viewportWidth, device }),
            });

            if (!screenshotResponse.ok) {
                throw new Error('Error taking screenshot');
            }

            console.log('Screenshot taken');
            const { jsonPath } = await screenshotResponse.json();
            fileName = jsonPath.split('/').pop().split('.')[0];
            screenshotCaptured = true;
        }

        // بعد 20 ثانية
        setTimeout(async () => {
            if (!sendingDataInProgress) { 
                sendingDataInProgress = true; 

                const response = await fetch('http://localhost:3001/update-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileName, url, device, viewportWidth, hover: hoverData, click: clickData }),
                });

                if (!response.ok) {
                    throw new Error('Error updating mouse data');
                }
                console.log('Mouse data updated successfully');
                sendingDataInProgress = false; 
            }
        }, 20000);

    } catch (error) {
        console.error('Error:', error);
    }
};

// تجميع بيانات الماوس
document.addEventListener('mousemove', (event) => {
    const timestamp = Math.floor(Date.now() / 1000) - startTime; // احسب الوقت منذ البداية
    hoverData[timestamp] = [event.clientX, event.clientY]; // احفظ موقع الماوس
});

document.addEventListener('click', (event) => {
    const clickKey = `${event.clientX},${event.clientY}`;
    if (!clickData[clickKey]) {
        clickData[clickKey] = [event.clientX, event.clientY, 1]; 
    } else {
        clickData[clickKey][2] += 1; 
    }
});

const startTime = Math.floor(Date.now() / 1000); // بدء الوقت
sendDataAfterInterval(); // بدء إرسال البيانات بعد فترة
