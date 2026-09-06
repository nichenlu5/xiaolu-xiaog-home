// 第一批题库。每道题包含：分类、题目、四个选项、正确答案下标和简短解析。
const questionBank = [
  { category: "地理", question: "世界上面积最大的海洋是？", options: ["大西洋", "印度洋", "太平洋", "北冰洋"], answer: 2, explanation: "太平洋面积约占世界海洋总面积的一半，也是最深的海洋。" },
  { category: "地理", question: "被称为“世界屋脊”的高原是？", options: ["青藏高原", "巴西高原", "蒙古高原", "东非高原"], answer: 0, explanation: "青藏高原平均海拔超过4000米，是世界上海拔最高的高原。" },
  { category: "地理", question: "赤道穿过的大洲中，不包括哪一个？", options: ["亚洲", "非洲", "南美洲", "欧洲"], answer: 3, explanation: "赤道穿过亚洲、非洲和南美洲，但不经过欧洲。" },
  { category: "地理", question: "我国最长的河流是？", options: ["黄河", "长江", "珠江", "黑龙江"], answer: 1, explanation: "长江全长约6300千米，是中国第一长河。" },
  { category: "地理", question: "撒哈拉沙漠主要位于哪个大洲？", options: ["亚洲", "南美洲", "非洲", "大洋洲"], answer: 2, explanation: "撒哈拉沙漠横跨非洲北部，是世界最大的热带沙漠。" },

  { category: "历史", question: "中国古代四大发明中，用于辨别方向的是？", options: ["造纸术", "印刷术", "火药", "指南针"], answer: 3, explanation: "指南针利用磁性指示方向，后来对远洋航海产生了重要影响。" },
  { category: "历史", question: "秦始皇统一六国后，建立了哪个朝代？", options: ["秦朝", "汉朝", "唐朝", "宋朝"], answer: 0, explanation: "公元前221年，秦始皇完成统一并建立秦朝。" },
  { category: "历史", question: "丝绸之路在汉代最初开拓，与谁出使西域密切相关？", options: ["班超", "玄奘", "张骞", "郑和"], answer: 2, explanation: "张骞两次出使西域，促进了中原与西域的交流。" },
  { category: "历史", question: "我国现存最早的一部纪传体通史是？", options: ["《资治通鉴》", "《史记》", "《汉书》", "《春秋》"], answer: 1, explanation: "司马迁所著《史记》是中国第一部纪传体通史。" },
  { category: "历史", question: "郑和下西洋发生在哪个朝代？", options: ["唐朝", "宋朝", "元朝", "明朝"], answer: 3, explanation: "明朝永乐至宣德年间，郑和率船队七次远航。" },

  { category: "物理", question: "声音不能在哪种环境中传播？", options: ["空气", "水", "真空", "钢铁"], answer: 2, explanation: "声音需要介质传播，真空中没有可传递振动的介质。" },
  { category: "物理", question: "光在真空中的传播速度约为？", options: ["30万千米/秒", "3万千米/秒", "3000千米/秒", "300千米/秒"], answer: 0, explanation: "真空光速约为每秒30万千米，即约3×10⁸米/秒。" },
  { category: "物理", question: "下列哪一种属于可再生能源？", options: ["煤炭", "石油", "天然气", "太阳能"], answer: 3, explanation: "太阳能可持续获得；煤、石油和天然气都属于不可再生能源。" },
  { category: "物理", question: "用吸管喝饮料，主要利用了什么？", options: ["浮力", "大气压", "摩擦力", "惯性"], answer: 1, explanation: "吸气使管内气压降低，外界大气压将饮料压入吸管。" },
  { category: "物理", question: "冰块漂浮在水面上，说明冰的密度与水相比？", options: ["更大", "相等", "更小", "无法比较"], answer: 2, explanation: "物体密度小于液体密度时会漂浮，冰的密度比水小。" },

  { category: "生物", question: "植物进行光合作用的主要场所是？", options: ["细胞核", "叶绿体", "液泡", "细胞壁"], answer: 1, explanation: "叶绿体含有叶绿素，是绿色植物进行光合作用的主要场所。" },
  { category: "生物", question: "人体内负责输送氧气的血细胞是？", options: ["红细胞", "白细胞", "血小板", "神经细胞"], answer: 0, explanation: "红细胞中的血红蛋白能够结合并运输氧气。" },
  { category: "生物", question: "蝙蝠属于哪一类动物？", options: ["鸟类", "爬行类", "哺乳类", "两栖类"], answer: 2, explanation: "蝙蝠体表有毛并以乳汁哺育幼崽，因此属于哺乳动物。" },
  { category: "生物", question: "遗传信息的主要载体是？", options: ["脂肪", "水", "维生素", "DNA"], answer: 3, explanation: "DNA储存着生物体生长、发育与遗传所需的信息。" },
  { category: "生物", question: "人体最大的器官是？", options: ["肝脏", "皮肤", "肺", "小肠"], answer: 1, explanation: "皮肤覆盖全身，是人体面积和重量都最大的器官。" },

  { category: "文学", question: "“床前明月光”的下一句是？", options: ["疑是地上霜", "低头思故乡", "举头望明月", "江清月近人"], answer: 0, explanation: "这两句出自唐代李白的《静夜思》。" },
  { category: "文学", question: "《西游记》中孙悟空的兵器是？", options: ["九齿钉耙", "金箍棒", "青龙偃月刀", "方天画戟"], answer: 1, explanation: "孙悟空的兵器是如意金箍棒，原为东海龙宫的定海神针。" },
  { category: "文学", question: "《卖火柴的小女孩》的作者是？", options: ["格林兄弟", "伊索", "安徒生", "雨果"], answer: 2, explanation: "《卖火柴的小女孩》是丹麦作家安徒生创作的童话。" },
  { category: "文学", question: "“但愿人长久，千里共婵娟”中的“婵娟”指的是？", options: ["桂花", "月亮", "故乡", "美酒"], answer: 1, explanation: "诗句中的“婵娟”借指明月，表达对远方亲人的祝愿。" },
  { category: "文学", question: "《红楼梦》中的“金陵十二钗”不包括谁？", options: ["林黛玉", "薛宝钗", "王熙凤", "花木兰"], answer: 3, explanation: "花木兰来自南北朝民歌传说，并不是《红楼梦》人物。" },

  { category: "生活常识", question: "发现家中燃气泄漏时，首先应该怎么做？", options: ["打开排气扇", "关闭阀门并开窗", "开灯检查", "点火寻找漏点"], answer: 1, explanation: "应先关闭燃气阀门、开窗通风，并避免开关电器或产生明火。" },
  { category: "生活常识", question: "炒菜时油锅突然起火，合适的处理方式是？", options: ["倒水灭火", "端锅跑出门", "盖上锅盖并关火", "用嘴吹灭"], answer: 2, explanation: "盖上锅盖能隔绝氧气；不要倒水，否则可能造成燃烧的油飞溅。" },
  { category: "生活常识", question: "通常情况下，人体正常体温约为？", options: ["32℃", "36～37℃", "39～40℃", "42℃"], answer: 1, explanation: "人体体温会因测量部位和时间略有变化，通常约为36～37℃。" },
  { category: "生活常识", question: "哪种垃圾通常应投入可回收物垃圾桶？", options: ["废纸箱", "剩菜", "用过的纸巾", "尘土"], answer: 0, explanation: "干净的废纸箱可回收再利用；投放前宜压平并保持干燥。" },
  { category: "生活常识", question: "雷雨天气在室外时，以下做法更安全的是？", options: ["躲在孤立大树下", "站在空旷高处", "远离高大孤立物", "使用金属杆雨伞"], answer: 2, explanation: "雷雨时应远离孤立的大树、高塔和金属物，尽快进入可靠建筑物。" },

  { category: "地理", question: "地球上跨经度最广的大洲是？", options: ["亚洲", "欧洲", "南极洲", "北美洲"], answer: 2, explanation: "所有经线都汇聚于南极点，因此南极洲跨越全部经度。" },
  { category: "历史", question: "唐代诗人杜甫被后人尊称为？", options: ["诗仙", "诗圣", "诗佛", "诗鬼"], answer: 1, explanation: "杜甫的诗歌深刻反映社会现实，被后人尊为“诗圣”。" },
  { category: "物理", question: "雨后天空出现彩虹，主要是光发生了什么现象？", options: ["色散", "吸收", "直线传播", "完全反射"], answer: 0, explanation: "阳光经雨滴折射、反射并发生色散，分解成不同颜色。" },
  { category: "生物", question: "种子萌发通常不一定需要哪个条件？", options: ["适量水分", "适宜温度", "充足空气", "阳光照射"], answer: 3, explanation: "多数种子萌发需要水、适宜温度和空气，但不一定需要阳光。" },
  { category: "文学", question: "“海内存知己，天涯若比邻”的作者是？", options: ["王勃", "杜甫", "白居易", "孟浩然"], answer: 0, explanation: "这句诗出自初唐诗人王勃的《送杜少府之任蜀州》。" },
  { category: "生活常识", question: "切开的苹果放久后变褐色，主要是因为？", options: ["水分凝固", "发生氧化", "温度升高", "糖分消失"], answer: 1, explanation: "果肉接触空气后发生酶促氧化，因而逐渐变成褐色。" }
];
