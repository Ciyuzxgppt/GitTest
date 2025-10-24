// eslint.config.js
import eslint from '@eslint/js';
import vue from 'eslint-plugin-vue';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

// 必须导出数组（扁平配置核心）
export default [
  {
    // 声明环境：浏览器 + ES 最新特性 + Node（可选，用于 Node 相关代码）
    env: {
      browser: true, // 关键：启用浏览器环境全局变量（包括 console）
      es2021: true,
      node: false, // 若不需要 Node 环境可设为 false
    },
  },
  // 基础 JS 规则
  eslint.configs.recommended,
  // Vue3 规则（注意：vue.configs 路径在最新版有变化）
  ...vue.configs['flat/recommended'],
  // Prettier 关闭冲突规则
  prettierConfig,
  // 自定义规则
  {
    plugins: { prettier },
    rules: {
      'prettier/prettier': 'error',
      'no-console': 'off',
      'vue/multi-word-component-names': 'off', // 关闭组件名多单词检查
    },
    // 指定生效的文件类型
    files: ['**/*.js', '**/*.vue'],
  },
];
