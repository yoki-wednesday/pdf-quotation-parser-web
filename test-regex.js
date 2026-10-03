const text = "㈱大平テック  小山工場 朝海様  御   見   積   書  岩瀬産業株式会社 2026年1月8日 備考欄参照 備   考 品名・寸法・仕様   数量";
const regex1 = /((?:株式会社|㈱|有限会社|㈲)[^\s]+(?:\s+[^\s]+)*?)\s*(?:御中|(?<!仕)様)(?:\s|$)/;
const match1 = text.match(regex1);
console.log("Match 1:", match1 ? match1[1] : "null");

const regex2 = /((?:株式会社|㈱|有限会社|㈲)[^\s]+(?:\s+[^様\s]+)*?)\s*(?:御中|様)(?:\s|$)/;
const match2 = text.match(regex2);
console.log("Match 2:", match2 ? match2[1] : "null");
