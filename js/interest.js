(() => {
  "use strict";
  const branches = {
    reading: ["📚", "阅读 / 共同书架", "书页会慢慢长出来。"],
    cinema: ["📺", "影视 / 假面骑士", "把一起看过和想看的故事留在这里。"],
    github: ["💻", "GitHub", "以后在这里收藏喜欢的项目与灵感。"],
    ai: ["🤖", "AI / Agent", "给好奇心留一个可以继续探索的角落。"],
    cars: ["🚗", "汽车 / 车标", "慢慢收集喜欢的车和标志。"],
    photo: ["📷", "摄影 / Citywalk", "留给街道、光线和散步中的发现。"],
    dolls: ["🧸", "娃娃 / 收藏", "给喜欢的小东西安一个位置。"],
    embedded: ["🔧", "嵌入式 / 机器人", "未来的电路、零件和小机器人会住在这里。"],
    space: ["🌌", "天文 / 太空", "抬头看星星，也记录想知道的宇宙。"]
  };
  const params = new URLSearchParams(location.search);
  const branch = branches[params.get("branch")] || ["🌱", "兴趣支线", "新的兴趣会在这里慢慢长出来。"];
  const set = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
  set("interest-icon", branch[0]);
  set("interest-title", branch[1]);
  set("interest-copy", branch[2]);
  document.title = `${branch[1]}｜小路 OS`;
})();
