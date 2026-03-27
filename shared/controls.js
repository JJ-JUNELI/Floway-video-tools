/**
 * Floway Tools — 共享控件注入
 * 在效果 HTML 中用 <!-- SHARED-CONTROLS --> 标记，调用此函数自动替换为标准面板
 */

export function injectSharedControls(opts = {}) {
    const placeholder = document.querySelector('#shared-controls-placeholder');
    if (!placeholder) {
        console.warn('[shared/controls] #shared-controls-placeholder not found');
        return;
    }

    const defaultBgMode = opts.defaultBgMode || '#000000';
    const defaultPatternColor = opts.defaultPatternColor || '#333333';

    placeholder.innerHTML = `
        <!-- Background controls -->
        <div class="control-group">
            <div class="group-title"><span>▩ 场景背景</span></div>
            <div class="row">
                <select id="BgMode">
                    <option value="transparent">🏁 透明</option>
                    <option value="#000000" ${defaultBgMode === '#000000' ? 'selected' : ''}>⬛ 纯黑</option>
                    <option value="#00ff00">🟩 绿幕</option>
                    <option value="#0000ff">🟦 蓝幕</option>
                    <option value="grid">▦ 网格</option>
                    <option value="dots">::: 点阵</option>
                    <option value="custom">📂 上传背景...</option>
                </select>
            </div>
            <input type="file" id="BgUpload" accept="image/*,video/*" style="display:none">
            <div class="row" id="PatternColorRow" style="display:none; justify-content:space-between; align-items:center;">
                <div style="font-size:11px; color:#aaa;">纹理颜色</div>
                <input type="color" id="PatternColor" value="${defaultPatternColor}">
            </div>
        </div>

        <!-- Export controls -->
        <div class="control-group" style="border-color:var(--danger)">
            <div class="group-title">🎥 导出</div>
            <div class="row">
                <select id="ExportFormat">
                    <option value="png_seq">📸 PNG 序列</option>
                    <option value="mp4">🎥 MP4</option>
                    <option value="webm">🌐 WebM</option>
                </select>
            </div>
            <div class="row" style="margin-top:10px;">
                <button id="BtnRecord" class="btn btn-record" disabled>⌛ 连接组件...</button>
            </div>
            <div id="LibStatus" style="font-size:10px; color:#666; margin-top:5px; text-align:center;">
                <span class='status-dot status-loading'></span>初始化...
            </div>
        </div>
    `;
}
