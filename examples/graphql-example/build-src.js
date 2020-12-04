const esbuild = require('esbuild');
const graphql = require('esbuild-graphql-loader').default;

esbuild.build({
  entryPoints: [
    'src/index.ts',
  ],
  outfile: 'dist/index.js',
  bundle: true,
  plugins: [graphql],
}).then(
  console.log,
  console.error,
);