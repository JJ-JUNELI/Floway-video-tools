/**
 * Floway Tools — SVG 渲染管线
 * 用于 SVG 效果的导出：SVG DOM → 序列化 → Canvas → Recorder
 *
 * 使用方式:
 *   const renderer = new SvgRenderer(svgElement, 1600, 1200);
 *   // 预览: 直接操作 SVG DOM，浏览器自动渲染
 *   // 导出: recorder.onFrame = async (time) => { updateSVG(time); await renderer.rasterize(); };
 *   // recorder 的 canvas 用 renderer.exportCanvas
 */

export class SvgRenderer {
    /**
     * @param {SVGSVGElement} svgElement - 根 SVG 元素
     * @param {number} width - 导出宽度
     * @param {number} height - 导出高度
     */
    constructor(svgElement, width, height) {
        this.svg = svgElement;
        this.width = width;
        this.height = height;

        // 隐藏的导出 Canvas（Recorder 抓这个）
        this.exportCanvas = document.createElement('canvas');
        this.exportCanvas.width = width;
        this.exportCanvas.height = height;
        this.exportCtx = this.exportCanvas.getContext('2d');
    }

    /**
     * 将当前 SVG DOM 状态序列化并绘制到导出 Canvas
     * @returns {Promise<void>}
     */
    rasterize() {
        return new Promise((resolve) => {
            const svgData = new XMLSerializer().serializeToString(this.svg);
            const img = new Image();
            img.onload = () => {
                this.exportCtx.clearRect(0, 0, this.width, this.height);
                this.exportCtx.drawImage(img, 0, 0);
                resolve();
            };
            img.onerror = () => resolve();
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        });
    }

    /**
     * 将背景绘制到导出 Canvas（在 rasterize 之前调用，作为底层）
     * @param {import('./background.js').Background} bg - Background 实例
     * @param {string} exportFormat - 'png_seq' | 'mp4' | 'webm'
     */
    drawBackground(bg, exportFormat = '') {
        bg.drawToCanvas(this.exportCtx, this.width, this.height, exportFormat);
    }
}
