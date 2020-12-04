const esbuild = require('esbuild');
const skypack = require('esbuild-skypack-loader').default;

esbuild.build({
  entryPoints: [
    'src/index.ts',
  ],
  outfile: 'dist/index.js',
  bundle: true,
  plugins: [skypack],
}).then(
  console.log,
  console.error,
);