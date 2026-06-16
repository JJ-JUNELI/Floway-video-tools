/**
 * ChartCore —— 图表效果的共享默认值（单一事实源）
 *
 * chart-fx / multi-line / bar-chart 三个笛卡尔图表的 config 里，有大块**图表无关**、
 * 且逐字相同的默认值（卡片漂浮 / 入场动画 / 动画 / 卡面材质 / 纸张 / 标题通用子集）。
 * 抽到这里，各图表 `const config = { ...chartBaseConfig(), 本图表特有键与覆盖 }`，
 * 改一个通用默认值不再要同步改多个文件（根除「副本漂移」）。
 *
 * ⚠️ 只放「三家逐字相同」的键。凡有差异的（subTitleSize/subTitleX/animDuration、
 * 标题文本、折线/柱状/坐标轴/数据模型等）都不在此，留各图表自己写并覆盖。
 * pie-chart 是异类（无双风格、无坐标轴、模型不同），目前不接入本工厂。
 *
 * 安全网：tests/snapshots/<chart>.json 控件默认值快照。接入后必须逐字节不变，
 * 证明「只去重、没改任何生效默认值」。
 */

/** 返回一份全新的通用默认值对象（新对象，避免多图表共享引用被互相改写）。 */
export function chartBaseConfig() {
    return {
        // —— 标题（通用子集；mainTitle/subTitle 文本、subTitleSize、subTitleX 各图表不同，不在此） ——
        titleFont: "'Noto Sans SC', sans-serif",
        mainTitleSize: 26,
        mainTitleWeight: 700,
        subTitleWeight: 400,
        mainTitleColor: '#333333',
        subTitleColor: '#999999',
        mainTitleX: 0,
        mainTitleY: -490,
        subTitleY: 0,
        showBrackets: true,
        subTitleGlow: false,
        showMainTitle: true,
        showSubTitle: true,

        // —— 卡片漂浮 (WebGL) ——
        rotateX: 1.5, rotateY: -1,
        shadowEnabled: true,
        shadowAngle: 90,
        shadowDistance: 10,
        shadowBlur: 20,
        shadowOpacity: 25,
        cardRadius: 16,
        cardBorderEnabled: false,
        cardBorderWidth: 0,
        cardBorderColor: '#ffffff',
        cardGlowEnabled: false,
        cardGlowWidth: 0,
        cardGlowColor: '#3b82f6',
        cardGlowIntensity: 70,
        cardScale: 0.8,
        cardPad: 32,
        floatEnabled: true,
        floatRotateX: 2.0, floatRotateY: 1.5,
        floatPhase: 25, floatDuration: 4,

        // —— 动画 ——
        animDuration: 3.5,
        animEasing: 'easeInOut',

        // —— 入场动画（lineDelay 仅折线图有，不在此） ——
        entranceEnabled: true,
        entrancePreset: 'slideUp',
        entranceDuration: 0.8,
        entranceEasing: 'easeOut',
        entranceStartX: 0,
        entranceStartY: 300,
        entranceEndX: 0,
        entranceEndY: 0,
        entranceStartOpacity: 0,
        entranceEndOpacity: 100,
        entranceStartScale: 100,
        entranceEndScale: 100,

        // —— 图表区域（chartExtraH 各图表不同，不在此） ——
        chartOffX: 0,
        chartOffY: 0,
        chartExtraW: 0,

        // —— 卡面材质（独立于纸张/赛博风格） ——
        cardMaterial: 'follow',
        glassColor: 'light', glassVeil: 0.12, glassBorder: 0.5, glassBorderWidth: 1,
        glassHighlight: 0.45, glassSheen: 0.45, glassGrain: true,

        // —— 纸张纹理 ——
        noiseGrain: 35, vignette: 15,

        // —— 公用 ——
        gridOpacity: 0.30,
        cardBg: '#faf8f3',
        showGrid: true,
        gridColor: '#c3bcaf',
    };
}
