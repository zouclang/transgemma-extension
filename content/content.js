// TransGemma Content Script
// 提供划词翻译和悬停翻译功能

const CONFIG = {
    API_ENDPOINT: 'https://transgemma-api.godii.xyz/api/generate',
    MODEL: 'translategemma:latest'
};

// State
let settings = {
    hoverEnabled: true,
    selectEnabled: true,
    sourceLang: 'auto',
    targetLang: 'English'
};

let currentTooltip = null;
let isModifierPressed = false; // Ctrl on Windows, Cmd on Mac
let hoveredElement = null;
let translatedElements = new Map();
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function init() {
    console.log('[TransGemma] 插件已加载');
    loadSettings();
    createTooltip();
    setupEventListeners();
}

function loadSettings() {
    // 默认启用所有功能
    settings.hoverEnabled = true;
    settings.selectEnabled = true;

    // 尝试从 storage 加载设置
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get(['hoverEnabled', 'selectEnabled', 'sourceLang', 'targetLang'], (result) => {
            settings.hoverEnabled = result.hoverEnabled !== false;
            settings.selectEnabled = result.selectEnabled !== false;
            settings.sourceLang = result.sourceLang || 'auto';
            settings.targetLang = result.targetLang || 'English';
            console.log('[TransGemma] 设置已加载:', settings);
        });

        // Listen for settings changes
        chrome.storage.onChanged.addListener((changes) => {
            if (changes.hoverEnabled) settings.hoverEnabled = changes.hoverEnabled.newValue;
            if (changes.selectEnabled) settings.selectEnabled = changes.selectEnabled.newValue;
            if (changes.sourceLang) settings.sourceLang = changes.sourceLang.newValue;
            if (changes.targetLang) settings.targetLang = changes.targetLang.newValue;
        });
    }
}

function createTooltip() {
    // 检查是否已存在
    if (document.getElementById('transgemma-tooltip')) return;

    const tooltip = document.createElement('div');
    tooltip.id = 'transgemma-tooltip';
    tooltip.className = 'transgemma-tooltip';
    document.body.appendChild(tooltip);
    currentTooltip = tooltip;
    console.log('[TransGemma] 翻译弹窗已创建');
}

function setupEventListeners() {
    // Modifier key tracking (Ctrl on Windows/Linux, Cmd on Mac)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Control' || e.key === 'Meta') {
            isModifierPressed = true;
            document.body.style.cursor = 'pointer';
            console.log('[TransGemma] 修饰键按下');
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'Control' || e.key === 'Meta') {
            isModifierPressed = false;
            document.body.style.cursor = '';
            // Remove highlight when modifier is released
            if (hoveredElement) {
                highlightElement(hoveredElement, false);
                hoveredElement = null;
            }
        }
    });

    // Hover translation (modifier + hover + click)
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);

    // Modifier + Click to translate paragraph
    document.addEventListener('click', handleClick);

    // Text selection translation
    document.addEventListener('mouseup', handleTextSelection);

    console.log('[TransGemma] 事件监听器已设置');
}

// Hover highlight when modifier is pressed
function handleMouseOver(e) {
    if (!settings.hoverEnabled || !isModifierPressed) return;

    const element = findTextElement(e.target);
    if (!element || element === hoveredElement) return;

    // Remove highlight from previous element
    if (hoveredElement) {
        highlightElement(hoveredElement, false);
    }

    hoveredElement = element;
    highlightElement(element, true);
}

function handleMouseOut(e) {
    if (!hoveredElement || !isModifierPressed) return;

    const relatedTarget = e.relatedTarget;
    if (relatedTarget && hoveredElement.contains(relatedTarget)) return;

    highlightElement(hoveredElement, false);
    hoveredElement = null;
}

// Modifier + Click to trigger translation
function handleClick(e) {
    // Don't hide tooltip if there's text selection (user is selecting text)
    const selection = window.getSelection();
    const hasSelection = selection && selection.toString().trim().length > 0;

    // Handle tooltip close only if clicking outside tooltip AND no text selection
    if (!e.target.closest('#transgemma-tooltip') && !hasSelection) {
        hideTooltip();
    }

    // Modifier + Click paragraph translation
    if (!settings.hoverEnabled || !isModifierPressed) return;

    const element = findTextElement(e.target);
    if (!element) return;

    e.preventDefault();
    e.stopPropagation();
    toggleParagraphTranslation(element);
    console.log('[TransGemma] 段落翻译触发');
}

function findTextElement(target) {
    let element = target;
    while (element && element !== document.body) {
        if (element.matches('p, h1, h2, h3, h4, h5, h6, li, td, th, span, div, blockquote')) {
            const text = element.innerText?.trim();
            if (text && text.length > 2 && text.length < 5000) {
                return element;
            }
        }
        element = element.parentElement;
    }
    return null;
}

function highlightElement(element, highlight) {
    if (highlight) {
        element.style.outline = '2px solid rgba(99, 102, 241, 0.5)';
        element.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
    } else {
        element.style.outline = '';
        element.style.backgroundColor = '';
    }
}

async function toggleParagraphTranslation(element) {
    // 检查是否已经有翻译
    const existingTranslation = element.querySelector('.transgemma-translation-block');

    if (existingTranslation) {
        // 移除翻译块
        existingTranslation.remove();
        element.classList.remove('transgemma-translated');
        translatedElements.delete(element);
        console.log('[TransGemma] 翻译已移除');
    } else {
        // 检查使用限制
        if (window.TransGemmaLicense) {
            const check = await window.TransGemmaLicense.checkUsageLimit('paragraph');
            if (!check.allowed) {
                showLimitReachedTooltip(check.message);
                return;
            }
        }

        // 添加翻译
        const originalText = element.innerText;

        // 标记为正在翻译
        element.classList.add('transgemma-translating');

        // 创建翻译块占位符
        const translationBlock = document.createElement('div');
        translationBlock.className = 'transgemma-translation-block';
        translationBlock.innerHTML = '<span class="transgemma-loading">翻译中...</span>';
        element.appendChild(translationBlock);

        try {
            const translation = await translateText(originalText);

            if (translation) {
                // 翻译成功后增加使用次数
                if (window.TransGemmaLicense) {
                    await window.TransGemmaLicense.incrementUsage('paragraph');
                }

                translationBlock.innerHTML = '';
                translationBlock.textContent = translation;
                element.classList.remove('transgemma-translating');
                element.classList.add('transgemma-translated');
                translatedElements.set(element, originalText);
                console.log('[TransGemma] 翻译完成');
            } else {
                translationBlock.innerHTML = '<span class="transgemma-error">翻译失败</span>';
                element.classList.remove('transgemma-translating');
            }
        } catch (error) {
            translationBlock.innerHTML = '<span class="transgemma-error">翻译失败</span>';
            element.classList.remove('transgemma-translating');
            console.error('[TransGemma] 翻译错误:', error);
        }
    }
}

// 显示使用限制提示
function showLimitReachedTooltip(message) {
    if (!currentTooltip) {
        createTooltip();
    }

    currentTooltip.innerHTML = `
        <div style="color: #fbbf24; margin-bottom: 10px;">⚠️ ${message}</div>
        <div style="font-size: 12px; color: #a0a0a0;">点击插件图标输入授权码解锁无限使用</div>
    `;

    currentTooltip.setAttribute('style', 'display: block !important; position: fixed !important; left: 50% !important; top: 50% !important; transform: translate(-50%, -50%) !important; z-index: 2147483647 !important; max-width: 400px !important; min-width: 280px !important; padding: 16px 20px !important; background: #1a1a2e !important; border: 1px solid rgba(251, 191, 36, 0.5) !important; border-radius: 12px !important; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6) !important; font-family: Segoe UI, sans-serif !important; font-size: 14px !important; line-height: 1.5 !important; color: #f0f0f0 !important; text-align: center !important;');

    // 3秒后自动隐藏
    setTimeout(() => {
        hideTooltip();
    }, 3000);
}

// Text Selection Translation
function handleTextSelection(e) {
    // 跳过修饰键点击（那是段落翻译）
    if (isModifierPressed) return;
    if (!settings.selectEnabled) return;

    // 获取选中文本
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    console.log('[TransGemma] 检测到文本选择:', selectedText.substring(0, 50) + (selectedText.length > 50 ? '...' : ''));

    if (!selectedText || selectedText.length < 2 || selectedText.length > 1000) {
        return;
    }

    // Don't show if clicking inside tooltip
    if (e.target.closest('#transgemma-tooltip')) return;

    try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        console.log('[TransGemma] 显示翻译弹窗');
        showTooltip(selectedText, rect);
    } catch (err) {
        console.error('[TransGemma] 选择范围错误:', err);
    }
}

async function showTooltip(text, rect) {
    // 确保 tooltip 存在
    if (!currentTooltip) {
        createTooltip();
    }

    // 检查使用限制
    if (window.TransGemmaLicense) {
        const check = await window.TransGemmaLicense.checkUsageLimit('selection');
        if (!check.allowed) {
            showLimitReachedTooltip(check.message);
            return;
        }
    }

    currentTooltip.innerHTML = '<div style="color: #a0a0a0; font-style: italic;">翻译中...</div>';

    // 使用 setAttribute 更可靠地设置样式
    const styleString = 'display: block !important; position: fixed !important; left: ' + Math.max(10, rect.left) + 'px !important; top: ' + (rect.bottom + 8) + 'px !important; z-index: 2147483647 !important; max-width: 400px !important; min-width: 200px !important; padding: 12px 16px !important; background: #1a1a2e !important; border: 1px solid rgba(99, 102, 241, 0.3) !important; border-radius: 12px !important; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important; font-family: Segoe UI, sans-serif !important; font-size: 14px !important; line-height: 1.5 !important; color: #f0f0f0 !important;';

    currentTooltip.setAttribute('style', styleString);

    console.log('[TransGemma] Tooltip 位置:', rect.left, rect.bottom);

    try {
        const translation = await translateText(text);

        if (translation) {
            // 翻译成功后增加使用次数
            if (window.TransGemmaLicense) {
                await window.TransGemmaLicense.incrementUsage('selection');
            }

            currentTooltip.innerHTML = `
                <div class="translation-result">${escapeHtml(translation)}</div>
                <button class="copy-btn" id="transgemma-copy-btn">复制</button>
            `;
            // 绑定复制按钮事件
            const copyBtn = currentTooltip.querySelector('#transgemma-copy-btn');
            if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(translation);
                    copyBtn.textContent = '已复制!';
                    setTimeout(() => { copyBtn.textContent = '复制'; }, 1500);
                });
            }
        } else {
            currentTooltip.innerHTML = '<div class="error">翻译失败</div>';
        }
    } catch (error) {
        console.error('[TransGemma] 翻译错误:', error);
        currentTooltip.innerHTML = '<div class="error">翻译失败: ' + error.message + '</div>';
    }
}

function hideTooltip() {
    if (currentTooltip) {
        currentTooltip.style.display = 'none';
    }
}

// Translation API
async function translateText(text) {
    // Auto detect language
    const isChineseInput = detectChinese(text);
    let fromLang, toLang;

    if (settings.sourceLang === 'auto') {
        fromLang = isChineseInput ? 'Chinese' : 'English';
        toLang = isChineseInput ? settings.targetLang : 'Chinese';
    } else {
        fromLang = settings.sourceLang;
        toLang = settings.targetLang;
    }

    const prompt = `Translate the following text from ${fromLang} to ${toLang}. Only provide the translation, no explanations:

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

        if (!response.ok) throw new Error('API error');

        const data = await response.json();
        return data.response || null;
    } catch (error) {
        console.error('TransGemma translation error:', error);
        return null;
    }
}

function detectChinese(text) {
    const chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf]/g;
    const matches = text.match(chineseRegex) || [];
    return matches.length / text.replace(/\s/g, '').length > 0.3;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
