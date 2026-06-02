# Floway Tools

视频效果生成工具集，基于 WebGL + Canvas 2D 的浏览器端动画效果模板。

## 效果模板

| 模板 | 文件 | 说明 |
|------|------|------|
| 折线图 | `chart-fx` | 双风格动态折线图（纸张 + 赛博），WebGL 3D 漂浮 |
| 柱状图效果 | `bar-chart` | 动态柱状图，纵向/横向 + 手绘抖动 |
| 饼图效果 | `pie-chart` | 动态饼图/环形图，阶梯缩放 |
| 文字动效 | `text-animator` | 科技感标题动画引擎，VP9/MP4/PNG 导出 |
| 文字突出扫描 | `stack-scan` | 赛博朋克风格堆叠扫描文字 |
| Logo 矩阵 | `logo-matrix` | 循环 Logo 阵列背景 |
| 粒子场 | `particle-field` | 动态粒子连线场 |
| 3D 卡片 | `card-3d` | 伪 3D 悬浮展示卡片（图片/视频） |
| 小lin说卡片 | `xiaolin-card` | 旋转光边发光展示卡片 |

## 本地运行

```bash
# 启动本地服务器
./start.sh

# 或者用任意 HTTP 服务器
python3 -m http.server 8000
```

打开 `http://localhost:8000` 浏览效果。

## 技术栈

- Canvas 2D (2x supersampling)
- WebGL (3D 卡片合成)
- MP4/WebM/PNG 序列 + 透明视频(MOV, PNG-in-MOV) 录制导出
- 透明视频纯 JS 自封装（无 ffmpeg）；高清/标准分辨率档；桌面剪映/安卓剪映/AE/Pr/Resolve 通用
- 纯前端，无框架依赖
