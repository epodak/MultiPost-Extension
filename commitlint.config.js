module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat',    // 新功能
      'fix',     // 修复
      'docs',    // 文档
      'style',   // 格式
      'refactor',// 重构
      'test',    // 测试
      'chore',   // 构建过程或辅助工具的变动
      'revert',  // 回退
      'wip'      // 开发中
    ]],
    'type-case': [0],           // 类型大小写不做限制
    'type-empty': [0],          // 类型可以为空
    'scope-empty': [0],         // scope可以为空
    'scope-case': [0],          // scope格式不做限制
    'subject-empty': [0],       // subject可以为空
    'subject-full-stop': [0],   // subject结尾不做限制
    'subject-case': [0],        // subject大小写不做限制
    'header-max-length': [0],   // header长度不做限制
    'body-max-line-length': [0] // body长度不做限制
  }
};
