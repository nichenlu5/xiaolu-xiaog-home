# 小路 × 小G的小家

一个使用原生 HTML、CSS 和 JavaScript 制作的小网站。第一版包含温暖简洁的首页，以及每局随机抽取 10 道题的知识问答游戏。

## 本地预览

直接双击 `index.html` 即可打开。也可以在项目目录启动一个本地静态服务器：

```bash
python -m http.server 8000
```

然后在浏览器访问 `http://localhost:8000`。

## 文件说明

- `index.html`：首页
- `game.html`：知识问答页面
- `css/style.css`：全站样式和响应式布局
- `js/questions.js`：题库数据
- `js/game.js`：游戏逻辑
