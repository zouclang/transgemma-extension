// TransGemma License Management Module
// 授权码验证和使用次数限制 - 带设备绑定

const LICENSE_CONFIG = {
    // API 端点
    API_BASE: 'https://transgemma-api.godii.xyz',

    // 免费用户每日限制
    FREE_PARAGRAPH_LIMIT: 10,
    FREE_SELECTION_LIMIT: 10
};

// 生成设备指纹
async function generateDeviceId() {
    const components = [];

    // 浏览器信息
    components.push(navigator.userAgent);
    components.push(navigator.language);
    components.push(navigator.platform);
    components.push(screen.width + 'x' + screen.height);
    components.push(screen.colorDepth);
    components.push(new Date().getTimezoneOffset());

    // Canvas 指纹
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

    // WebGL 信息
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
            }
        }
    } catch (e) {
        components.push('no-webgl');
    }

    // 生成 hash
    const str = components.join('|||');
    const hash = await sha256(str);
    return hash.slice(0, 32);
}

// SHA256 hash
async function sha256(str) {
    const buffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

// 获取今天的日期字符串 (YYYY-MM-DD)
function getTodayString() {
    const now = new Date();
    return now.toISOString().split('T')[0];
}

// 获取使用统计
async function getUsageStats() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['usageStats', 'license'], (result) => {
            const today = getTodayString();
            let stats = result.usageStats || {};

            // 如果日期不是今天，重置计数
            if (stats.date !== today) {
                stats = {
                    date: today,
                    paragraphCount: 0,
                    selectionCount: 0
                };
            }

            resolve({
                stats,
                license: result.license || null
            });
        });
    });
}

// 保存使用统计
async function saveUsageStats(stats) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ usageStats: stats }, resolve);
    });
}

// 检查是否可以继续翻译
async function checkUsageLimit(type) {
    const { stats, license } = await getUsageStats();

    // 如果有有效授权码，无限制
    if (license && license.valid && license.expireTime > Date.now()) {
        return { allowed: true, isPro: true };
    }

    // 免费用户检查限制
    if (type === 'paragraph') {
        if (stats.paragraphCount >= LICENSE_CONFIG.FREE_PARAGRAPH_LIMIT) {
            return {
                allowed: false,
                isPro: false,
                remaining: 0,
                type: 'paragraph',
                message: `今日段落翻译次数已用完 (${LICENSE_CONFIG.FREE_PARAGRAPH_LIMIT}/${LICENSE_CONFIG.FREE_PARAGRAPH_LIMIT})，请明天再试或输入授权码`
            };
        }
        return {
            allowed: true,
            isPro: false,
            remaining: LICENSE_CONFIG.FREE_PARAGRAPH_LIMIT - stats.paragraphCount
        };
    } else {
        if (stats.selectionCount >= LICENSE_CONFIG.FREE_SELECTION_LIMIT) {
            return {
                allowed: false,
                isPro: false,
                remaining: 0,
                type: 'selection',
                message: `今日划词翻译次数已用完 (${LICENSE_CONFIG.FREE_SELECTION_LIMIT}/${LICENSE_CONFIG.FREE_SELECTION_LIMIT})，请明天再试或输入授权码`
            };
        }
        return {
            allowed: true,
            isPro: false,
            remaining: LICENSE_CONFIG.FREE_SELECTION_LIMIT - stats.selectionCount
        };
    }
}

// 增加使用次数
async function incrementUsage(type) {
    const { stats } = await getUsageStats();

    if (type === 'paragraph') {
        stats.paragraphCount = (stats.paragraphCount || 0) + 1;
    } else {
        stats.selectionCount = (stats.selectionCount || 0) + 1;
    }
    stats.date = getTodayString();

    await saveUsageStats(stats);
    return stats;
}

// 服务端验证授权码
async function validateLicenseCode(code) {
    const normalizedCode = code.trim().toUpperCase();
    const deviceId = await getDeviceId();

    try {
        const response = await fetch(`${LICENSE_CONFIG.API_BASE}/api/license/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: normalizedCode,
                deviceId: deviceId
            })
        });

        const data = await response.json();

        if (data.success) {
            // 保存授权信息到本地
            const license = {
                code: normalizedCode,
                valid: true,
                deviceId: deviceId,
                activateTime: Date.now(),
                expireTime: data.expireAt,
                deviceCount: data.deviceCount
            };

            await new Promise((resolve) => {
                chrome.storage.local.set({ license }, resolve);
            });

            return {
                success: true,
                message: `授权成功！有效期一年。(已绑定 ${data.deviceCount}/5 个设备)`
            };
        } else {
            return { success: false, message: data.message || '授权失败' };
        }
    } catch (error) {
        console.error('[TransGemma] 授权请求失败:', error);
        return { success: false, message: '网络错误，请稍后重试' };
    }
}

// 验证本地授权是否仍有效（可选的服务端验证）
async function verifyLicenseOnServer() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['license'], async (result) => {
            const license = result.license;
            if (!license || !license.code) {
                resolve({ valid: false });
                return;
            }

            try {
                const deviceId = await getDeviceId();
                const response = await fetch(`${LICENSE_CONFIG.API_BASE}/api/license/verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code: license.code,
                        deviceId: deviceId
                    })
                });

                const data = await response.json();

                if (data.valid) {
                    // 更新本地授权信息
                    license.expireTime = data.expireAt;
                    license.deviceCount = data.deviceCount;
                    chrome.storage.local.set({ license });
                }

                resolve(data);
            } catch (error) {
                // 网络错误时使用本地缓存
                resolve({
                    valid: license.valid && license.expireTime > Date.now(),
                    cached: true
                });
            }
        });
    });
}

// 获取授权状态
async function getLicenseStatus() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['license', 'usageStats', 'deviceId'], (result) => {
            const license = result.license;
            const today = getTodayString();
            let stats = result.usageStats || { date: today, paragraphCount: 0, selectionCount: 0 };

            if (stats.date !== today) {
                stats = { date: today, paragraphCount: 0, selectionCount: 0 };
            }

            if (license && license.valid && license.expireTime > Date.now()) {
                const daysLeft = Math.ceil((license.expireTime - Date.now()) / (24 * 60 * 60 * 1000));
                resolve({
                    isPro: true,
                    daysLeft,
                    deviceCount: license.deviceCount || 1,
                    message: `Pro 用户 - 剩余 ${daysLeft} 天 (${license.deviceCount || 1}/5 设备)`
                });
            } else {
                resolve({
                    isPro: false,
                    paragraphRemaining: LICENSE_CONFIG.FREE_PARAGRAPH_LIMIT - stats.paragraphCount,
                    selectionRemaining: LICENSE_CONFIG.FREE_SELECTION_LIMIT - stats.selectionCount,
                    message: `免费用户 - 今日剩余: 段落翻译 ${LICENSE_CONFIG.FREE_PARAGRAPH_LIMIT - stats.paragraphCount} 次, 划词翻译 ${LICENSE_CONFIG.FREE_SELECTION_LIMIT - stats.selectionCount} 次`
                });
            }
        });
    });
}

// 导出供其他脚本使用
if (typeof window !== 'undefined') {
    window.TransGemmaLicense = {
        checkUsageLimit,
        incrementUsage,
        validateLicenseCode,
        verifyLicenseOnServer,
        getLicenseStatus,
        getDeviceId,
        LICENSE_CONFIG
    };
}
