import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    // 项目广泛以 catch (e: any) 处理运行时错误，属既定工程惯例；
    // 关闭 no-explicit-any 以保持简洁，配合 strict TS 其它规则保障类型安全
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      // ignoreRestSiblings: 允许 {...rest} 省略敏感字段（如剔除 secret_enc）时不误报
      "@typescript-eslint/no-unused-vars": ["error", { "ignoreRestSiblings": true }],
      "prefer-const": "error",
    },
  },
];

export default eslintConfig;
