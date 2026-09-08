# 词库来源与许可证

本目录的四本静态词库由 [WordTyper Vocabularies](https://github.com/grhliu/wordtyper-vocabularies) 的对应 JSON 在开发阶段一次性转换生成。v2.1 的主词书为考研完整词汇与 CET-6；考研必考词汇和 CET-4 文件继续保留，仅用于兼容 v2.0 数据迁移与归档恢复。该项目说明其数据由 [ECDICT](https://github.com/skywind3000/ECDICT) 按考试大纲标签与客观词频字段派生，采用 MIT License。

- `kaoyan-required.json`：来源文件 `kaoyan_high_freq.json`，考研大纲词汇按 ECDICT `bnc` / `frq` 语料词频筛选的高频集合。
- `kaoyan-complete.json`：来源文件 `kaoyan.json`，ECDICT `ky` 考试标签集合。
- `cet6.json`：来源文件 `cet6.json`，ECDICT `cet6` 考试标签集合。
- `cet4.json`：来源文件 `cet4.json`，ECDICT `cet4` 考试标签集合。

转换仅保留 `word`、中文 `translations` 与 `phonetic`，并增加稳定的 `bookId` 与词条 ID。词性若存在于释义开头（如 `n.`、`vt.`）会原样保留。网站运行时只读取本目录文件，不请求第三方接口。

MIT License

Copyright (c) 2025 Linwei

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
