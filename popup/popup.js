// TransGemma Popup Script

const CONFIG = {
    API_ENDPOINT: 'https://transgemma-api.godii.xyz/api/generate',
    MODEL: 'translategemma:latest'
};

// DOM Elements
const elements = {
    sourceLang: document.getElementById('sourceLang'),
    targetLang: document.getElementById('targetLang'),
    swapLangs: document.getElementById('swapLangs'),
    inputText: document.getElementById('inputText'),
    outputText: document.getElementById('outputText'),
    copyBtn: document.getElementById('copyBtn'),
    hoverToggle: document.getElementById('hoverToggle'),
    selectToggle: document.getElementById('selectToggle')
};

// State
let debounceTimer = null;
let isTranslating = false;

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
    loadSettings();
    setupEventListeners();
}

function loadSettings() {
    chrome.storage.sync.get(['hoverEnabled', 'selectEnabled', 'sourceLang', 'targetLang'], (result) => {
        elements.hoverToggle.checked = result.hoverEnabled !== false;
        elements.selectToggle.checked = result.selectEnabled !== false;
        if (result.sourceLang) elements.sourceLang.value = result.sourceLang;
        if (result.targetLang) elements.targetLang.value = result.targetLang;
    });
}

function saveSettings() {
    chrome.storage.sync.set({
        hoverEnabled: elements.hoverToggle.checked,
        selectEnabled: elements.selectToggle.checked,
        sourceLang: elements.sourceLang.value,
        targetLang: elements.targetLang.value
    });
}

function setupEventListeners() {
    // Language swap
    elements.swapLangs.addEventListener('click', () => {
        const temp = elements.sourceLang.value;
        elements.sourceLang.value = elements.targetLang.value;
        elements.targetLang.value = temp;
        saveSettings();
    });

    // Real-time translation
    elements.inputText.addEventListener('input', handleInputChange);

    // Language change
    elements.sourceLang.addEventListener('change', () => {
        saveSettings();
        handleInputChange();
    });
    elements.targetLang.addEventListener('change', () => {
        saveSettings();
        handleInputChange();
    });

    // Copy button
    elements.copyBtn.addEventListener('click', copyTranslation);

    // Toggle settings
    elements.hoverToggle.addEventListener('change', saveSettings);
    elements.selectToggle.addEventListener('change', saveSettings);
}

function handleInputChange() {
    clearTimeout(debounceTimer);

    const text = elements.inputText.value.trim();
    if (!text) {
        elements.outputText.innerHTML = '<span class="placeholder">翻译结果</span>';
        return;
    }

    elements.outputText.textContent = '翻译中...';

    debounceTimer = setTimeout(() => {
        translateText(text);
    }, 500);
}

async function translateText(text) {
    if (isTranslating) return;
    isTranslating = true;

    const sourceLang = elements.sourceLang.value === 'auto' ? '自动检测语言' : elements.sourceLang.value;
    const targetLang = elements.targetLang.value;

    const prompt = `Translate the following text from ${sourceLang} to ${targetLang}. Only provide the translation, no explanations:

${text}`;

    try {
        const response = await fetch(CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: CONFIG.MODEL,
                prompt: prompt,
                stream: false
            })
        });

        if (!response.ok) throw new Error('API 请求失败');

        const data = await response.json();
        elements.outputText.textContent = data.response || '翻译失败';
    } catch (error) {
        elements.outputText.textContent = '翻译失败: ' + error.message;
    } finally {
        isTranslating = false;
    }
}

function copyTranslation() {
    const text = elements.outputText.textContent;
    if (!text || text === '翻译结果' || text.startsWith('翻译')) return;

    navigator.clipboard.writeText(text).then(() => {
        const originalColor = elements.copyBtn.style.color;
        elements.copyBtn.style.color = '#22c55e';
        setTimeout(() => {
            elements.copyBtn.style.color = originalColor;
        }, 1000);
    });
}

// ==================== License Management ====================

const LICENSE_API_BASE = 'https://transgemma-api.godii.xyz';

// License UI elements
const licenseElements = {
    status: document.getElementById('licenseStatus'),
    inputRow: document.getElementById('licenseInputRow'),
    codeInput: document.getElementById('licenseCode'),
    activateBtn: document.getElementById('activateBtn'),
    message: document.getElementById('licenseMessage')
};

// 生成设备指纹
async function generateDeviceId() {
    const components = [];

    components.push(navigator.userAgent);
    components.push(navigator.language);
    components.push(navigator.platform);
    components.push(screen.width + 'x' + screen.height);
    components.push(screen.colorDepth);
    components.push(new Date().getTimezoneOffset());

    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('TransGemma-FP', 2, 2);
        components.push(canvas.toDataURL().slice(-50));
    } catch (e) {
        components.push('no-canvas');
    }

    const str = components.join('|||');
    const buffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// 获取或创建设备ID
async function getDeviceId() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['deviceId'], async (result) => {
            if (result.deviceId) {
                resolve(result.deviceId);
            } else {
                const deviceId = await generateDeviceId();
                chrome.storage.local.set({ deviceId }, () => {
                    resolve(deviceId);
                });
            }
        });
    });
}

// Initialize license UI
function initLicense() {
    updateLicenseStatus();

    if (licenseElements.activateBtn) {
        licenseElements.activateBtn.addEventListener('click', activateLicense);
    }

    if (licenseElements.codeInput) {
        licenseElements.codeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') activateLicense();
        });
    }
}

function updateLicenseStatus() {
    chrome.storage.local.get(['license', 'usageStats'], (result) => {
        const license = result.license;
        const today = new Date().toISOString().split('T')[0];
        let stats = result.usageStats || { date: today, paragraphCount: 0, selectionCount: 0 };

        if (stats.date !== today) {
            stats = { date: today, paragraphCount: 0, selectionCount: 0 };
        }

        if (license && license.valid && license.expireTime > Date.now()) {
            const daysLeft = Math.ceil((license.expireTime - Date.now()) / (24 * 60 * 60 * 1000));
            const deviceInfo = license.deviceCount ? ` (${license.deviceCount}/5 设备)` : '';
            licenseElements.status.textContent = `✅ Pro 用户 - 剩余 ${daysLeft} 天${deviceInfo}`;
            licenseElements.status.className = 'license-status pro';
            licenseElements.inputRow.style.display = 'none';
        } else {
            const paragraphRemaining = 10 - stats.paragraphCount;
            const selectionRemaining = 10 - stats.selectionCount;
            licenseElements.status.textContent = `免费用户 - 今日剩余: 段落翻译 ${paragraphRemaining} 次, 划词翻译 ${selectionRemaining} 次`;
            licenseElements.status.className = 'license-status free';
            licenseElements.inputRow.style.display = 'flex';
        }
    });
}

async function activateLicense() {
    const code = licenseElements.codeInput.value.trim().toUpperCase();

    if (!code) {
        showLicenseMessage('请输入授权码', false);
        return;
    }

    // 显示加载状态
    licenseElements.activateBtn.disabled = true;
    licenseElements.activateBtn.textContent = '验证中...';

    try {
        const deviceId = await getDeviceId();

        const response = await fetch(`${LICENSE_API_BASE}/api/license/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: code,
                deviceId: deviceId
            })
        });

        const data = await response.json();

        if (data.success) {
            const license = {
                code: code,
                valid: true,
                deviceId: deviceId,
                activateTime: Date.now(),
                expireTime: data.expireAt,
                deviceCount: data.deviceCount
            };

            chrome.storage.local.set({ license }, () => {
                showLicenseMessage(`✅ 授权成功！(${data.deviceCount}/5 设备已绑定)`, true);
                updateLicenseStatus();
                licenseElements.codeInput.value = '';
            });
        } else {
            showLicenseMessage('❌ ' + (data.message || '授权失败'), false);
        }
    } catch (error) {
        showLicenseMessage('❌ 网络错误，请稍后重试', false);
    } finally {
        licenseElements.activateBtn.disabled = false;
        licenseElements.activateBtn.textContent = '激活';
    }
}

function showLicenseMessage(msg, success) {
    licenseElements.message.textContent = msg;
    licenseElements.message.className = 'license-message ' + (success ? 'success' : 'error');

    setTimeout(() => {
        licenseElements.message.textContent = '';
        licenseElements.message.className = 'license-message';
    }, 3000);
}

// Initialize license on DOM ready
document.addEventListener('DOMContentLoaded', initLicense);

