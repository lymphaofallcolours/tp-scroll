// Override the default vite/client CSS-Modules type so values are typed as
// plain `string` instead of `string | undefined` (which collides with the
// workspace-wide `noUncheckedIndexedAccess`). Missing classes still render as
// undefined at runtime; that's a developer error caught by ESLint /
// type-checked usages with explicit `?? ""` fallbacks where needed.
declare module "*.module.css" {
  const classes: Readonly<Record<string, string>> & { readonly [K in string]: string };
  export default classes;
}
